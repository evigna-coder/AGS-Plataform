import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { AgendaEntry, AgendaNota, Ingeniero, WorkOrder, ZoomLevel } from '@ags/shared';
import { ingenierosService, agendaService, agendaNotasService, feriadosService, ordenesTrabajoService, sistemasService } from '../services/firebaseService';
import {
  getMonday,
  getVisibleDays,
  getVisibleRange,
  formatDateKey,
  navigatePrev,
  navigateNext,
} from '../utils/agendaDateUtils';

export interface UseAgendaReturn {
  // Date navigation
  anchor: Date;
  zoomLevel: ZoomLevel;
  visibleDays: Date[];
  setZoomLevel: (z: ZoomLevel) => void;
  goToPrev: () => void;
  goToNext: () => void;
  goToToday: () => void;
  goToDate: (date: Date) => void;
  // Data
  ingenieros: Ingeniero[];
  entries: AgendaEntry[];
  notas: AgendaNota[];
  pendingOTs: WorkOrder[];
  /** sistemaId → agsVisibleId (ID de equipo), para mostrarlo en las tarjetas de OT pendiente. */
  equipoIdBySistema: Map<string, string>;
  feriados: Set<string>;
  loading: boolean;
  // CRUD
  createEntry: (data: Omit<AgendaEntry, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'createdByName' | 'updatedBy' | 'updatedByName'>) => Promise<string>;
  updateEntry: (id: string, data: Partial<AgendaEntry>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  upsertNota: (data: { fecha: string; ingenieroId: string; ingenieroNombre: string; quarter: 1 | 2 | 3 | 4; texto: string }) => Promise<void>;
  deleteNota: (id: string) => Promise<void>;
  toggleFeriado: (fecha: string) => Promise<void>;
  /** Bloqueo duro de feriados: primer feriado tocado por el rango, o null. */
  primerFeriadoEnRango: (inicio: string, fin: string) => string | null;
}

export function useAgenda(): UseAgendaReturn {
  const [anchor, setAnchor] = useState<Date>(() => getMonday(new Date()));
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('2weeks');
  const [ingenieros, setIngenieros] = useState<Ingeniero[]>([]);
  const [entries, setEntries] = useState<AgendaEntry[]>([]);
  const [notas, setNotas] = useState<AgendaNota[]>([]);
  const [feriados, setFeriados] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const visibleDays = useMemo(() => getVisibleDays(anchor, zoomLevel), [anchor, zoomLevel]);

  const [rangeStart, rangeEnd] = useMemo(() => {
    const [s, e] = getVisibleRange(anchor, zoomLevel);
    return [formatDateKey(s), formatDateKey(e)];
  }, [anchor, zoomLevel]);

  // Load engineers (once)
  useEffect(() => {
    ingenierosService.getAll().then(list => {
      // Orden de filas pedido por coordinación (2026-07-30) — por apellido;
      // ingenieros no listados van al final en orden alfabético.
      const ORDEN_AGENDA = ['failenbogen', 'genovese', 'estevez', 'di marco', 'blain', 'aguirre', 'galarza'];
      const pos = (nombre: string) => {
        const n = nombre.toLowerCase();
        const idx = ORDEN_AGENDA.findIndex(ap => n.includes(ap));
        return idx === -1 ? ORDEN_AGENDA.length : idx;
      };
      setIngenieros(list.filter(i => i.activo).sort((a, b) => {
        const pa = pos(a.nombre);
        const pb = pos(b.nombre);
        return pa !== pb ? pa - pb : a.nombre.localeCompare(b.nombre);
      }));
    });
  }, []);

  // OTs con entrada de agenda vigente (SIN rango): la cola "a programar" no
  // puede descontar con `entries` (solo trae el rango visible) — una OT
  // agendada meses adelante reaparecía como pendiente (bug UAT 2026-07-30).
  const [otsAgendadas, setOtsAgendadas] = useState<Set<string>>(new Set());
  useEffect(() => {
    return agendaService.subscribeOtNumbersAsignados(setOtsAgendadas);
  }, []);

  // Real-time entries subscription — only flash loading on first load
  const isFirstLoad = useRef(true);
  useEffect(() => {
    if (isFirstLoad.current) setLoading(true);
    const unsubscribe = agendaService.subscribeToRange(rangeStart, rangeEnd, (newEntries) => {
      setEntries(newEntries);
      setLoading(false);
      isFirstLoad.current = false;
    });
    return unsubscribe;
  }, [rangeStart, rangeEnd]);

  // Real-time notas subscription
  useEffect(() => {
    const unsubscribe = agendaNotasService.subscribeToRange(rangeStart, rangeEnd, setNotas);
    return unsubscribe;
  }, [rangeStart, rangeEnd]);

  // Real-time feriados subscription (global, no range filter)
  useEffect(() => {
    return feriadosService.subscribe(setFeriados);
  }, []);

  // Load pending OTs only (filtered query — much faster than getAll)
  const [allCandidateOTs, setAllCandidateOTs] = useState<WorkOrder[]>([]);
  useEffect(() => {
    ordenesTrabajoService.getPending()
      .then(setAllCandidateOTs)
      .catch(err => console.error('Error loading pending OTs:', err));
  }, []);

  // Mapa sistemaId → agsVisibleId para las tarjetas del sidebar (UAT 2026-07-17).
  // sistemasService.getAll() ya está cacheado (serviceCache), es una carga barata.
  const [equipoIdBySistema, setEquipoIdBySistema] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    sistemasService.getAll()
      .then(list => {
        const m = new Map<string, string>();
        for (const s of list) if (s.agsVisibleId) m.set(s.id, s.agsVisibleId);
        setEquipoIdBySistema(m);
      })
      .catch(err => console.error('Error cargando sistemas para agenda:', err));
  }, []);

  // Derive pending OTs from candidates minus assigned (no Firestore re-read).
  // Regla 2026-04-22: ocultar OTs parent (sin punto) que tengan al menos 1
  // child pendiente en la misma lista — el coordinador solo asigna las OTs
  // "hijas" (X.NN), la parent es un contenedor no-accionable.
  const pendingOTs = useMemo(() => {
    // `otsAgendadas` viene de la suscripción GLOBAL (sin rango) — no usar
    // `entries` acá: solo trae el rango visible y una OT agendada en otra
    // semana reaparecía como pendiente (bug UAT 2026-07-30).
    const parentsWithChildren = new Set<string>();
    for (const ot of allCandidateOTs) {
      if (ot.otNumber.includes('.')) {
        const base = ot.otNumber.split('.')[0];
        parentsWithChildren.add(base);
      }
    }
    return allCandidateOTs.filter(ot =>
      !otsAgendadas.has(ot.otNumber) &&
      !parentsWithChildren.has(ot.otNumber),
    );
  }, [allCandidateOTs, otsAgendadas]);

  // Navigation
  const goToPrev = useCallback(() => setAnchor(prev => navigatePrev(prev, zoomLevel)), [zoomLevel]);
  const goToNext = useCallback(() => setAnchor(prev => navigateNext(prev, zoomLevel)), [zoomLevel]);
  const goToToday = useCallback(() => setAnchor(getMonday(new Date())), []);
  const goToDate = useCallback((date: Date) => setAnchor(getMonday(date)), []);

  // ── Bloqueo DURO de feriados (decisión 2026-07-30): no se puede agendar nada
  // que toque un día feriado. Guardia en el cuello de botella (create/update)
  // para cubrir TODOS los caminos: drop desde pendientes, mover, estirar, crear
  // con click, tarea manual y pegar con teclado.
  const primerFeriadoEnRango = useCallback((inicio: string, fin: string): string | null => {
    if (!inicio || !fin) return null;
    const d = new Date(`${inicio}T12:00:00`);
    const end = new Date(`${fin}T12:00:00`);
    for (let guard = 0; d <= end && guard < 120; guard++) {
      const key = d.toISOString().split('T')[0];
      if (feriados.has(key)) return key;
      d.setDate(d.getDate() + 1);
    }
    return null;
  }, [feriados]);

  // CRUD with optimistic updates
  const createEntry = useCallback(async (data: Omit<AgendaEntry, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'createdByName' | 'updatedBy' | 'updatedByName'>) => {
    const feriado = primerFeriadoEnRango(data.fechaInicio, data.fechaFin);
    if (feriado) {
      alert(`El ${feriado} está marcado como feriado — no se puede agendar ese día. Para hacerlo, desmarcá el feriado (click derecho sobre la fecha).`);
      return '';
    }
    const tempId = `temp-${Date.now()}`;
    const now = new Date().toISOString();
    const optimistic: AgendaEntry = { ...data, id: tempId, createdAt: now, updatedAt: now, createdBy: null, createdByName: null, updatedBy: null, updatedByName: null };
    setEntries(prev => [...prev, optimistic]);
    const realId = await agendaService.create(data);
    // Replace temp entry with real ID (snapshot will arrive shortly but this avoids flicker)
    setEntries(prev => prev.map(e => e.id === tempId ? { ...e, id: realId } : e));
    return realId;
  }, [primerFeriadoEnRango]);

  const updateEntry = useCallback(async (id: string, data: Partial<AgendaEntry>) => {
    // Bloqueo de feriados: solo cuando el cambio MUEVE fechas (mover/estirar);
    // cambios de estado/notas sobre una entrada existente pasan siempre.
    if (data.fechaInicio || data.fechaFin) {
      const current = entries.find(e => e.id === id);
      const inicio = data.fechaInicio ?? current?.fechaInicio ?? '';
      const fin = data.fechaFin ?? current?.fechaFin ?? '';
      const feriado = primerFeriadoEnRango(inicio, fin);
      if (feriado) {
        alert(`El ${feriado} está marcado como feriado — no se puede agendar ese día. Para hacerlo, desmarcá el feriado (click derecho sobre la fecha).`);
        return;
      }
    }
    // Optimistic: apply changes immediately
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...data, updatedAt: new Date().toISOString() } : e));
    // Fire to Firestore (don't block UI)
    agendaService.update(id, data).catch(err => console.error('Error updating entry:', err));
  }, [entries, primerFeriadoEnRango]);

  const deleteEntry = useCallback(async (id: string) => {
    // Captura info de la entry antes de removerla para revertir la OT después.
    const entry = entries.find(e => e.id === id);
    const otNumber = entry?.otNumber || null;
    // Optimistic: remove immediately
    setEntries(prev => prev.filter(e => e.id !== id));
    agendaService.delete(id).catch(err => console.error('Error deleting entry:', err));
    // Revertir la OT si tenía una OT linkeada: clear ingeniero/fecha y bajar
    // estadoAdmin a CREADA (solo si estaba en ASIGNADA o COORDINADA — no
    // regresamos estados avanzados como EN_CURSO, CIERRE_TECNICO, etc).
    // El sync del OT a ticket se encarga automaticamente en otService.update.
    if (otNumber) {
      ordenesTrabajoService.getByOtNumber(otNumber).then(ot => {
        if (!ot) return;
        const REVERTIBLE: string[] = ['ASIGNADA', 'COORDINADA'];
        const shouldRevertEstado = REVERTIBLE.includes(ot.estadoAdmin || '');
        return ordenesTrabajoService.update(otNumber, {
          ingenieroAsignadoId: null,
          ingenieroAsignadoNombre: null,
          fechaServicioAprox: null as any,
          ...(shouldRevertEstado ? { estadoAdmin: 'CREADA' as any, estadoAdminFecha: new Date().toISOString() } : {}),
        });
      }).catch(err => console.error('[useAgenda.deleteEntry] revert OT failed:', err));
    }
  }, [entries]);

  const upsertNota = useCallback(async (data: { fecha: string; ingenieroId: string; ingenieroNombre: string; quarter: 1 | 2 | 3 | 4; texto: string }) => {
    await agendaNotasService.upsert(data);
  }, []);

  const deleteNota = useCallback(async (id: string) => {
    await agendaNotasService.delete(id);
  }, []);

  const toggleFeriado = useCallback(async (fecha: string) => {
    const isCurrentlyFeriado = feriados.has(fecha);
    // Optimistic
    setFeriados(prev => {
      const next = new Set(prev);
      if (isCurrentlyFeriado) next.delete(fecha); else next.add(fecha);
      return next;
    });
    // Fire-and-forget
    if (isCurrentlyFeriado) {
      feriadosService.remove(fecha).catch(err => console.error('Error removing feriado:', err));
    } else {
      feriadosService.add(fecha).catch(err => console.error('Error adding feriado:', err));
    }
  }, [feriados]);

  return {
    anchor, zoomLevel, visibleDays,
    setZoomLevel, goToPrev, goToNext, goToToday, goToDate,
    ingenieros, entries, notas, pendingOTs, equipoIdBySistema, feriados, loading,
    createEntry, updateEntry, deleteEntry, upsertNota, deleteNota, toggleFeriado,
    primerFeriadoEnRango,
  };
}
