import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { AgendaEntry, AgendaNota, Ingeniero, WorkOrder, ZoomLevel } from '@ags/shared';
import { ingenierosService, agendaService, agendaNotasService, feriadosService, diasAgsService, ordenesTrabajoService, sistemasService, establecimientosService } from '../services/firebaseService';
import { esInteriorPorDistancia } from '../utils/distanciaInterior';
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
  /** Días AGS (no laborables por ingeniero): claves `${ingenieroId}_${fecha}`. */
  diasAgs: Set<string>;
  toggleDiaAgs: (ingenieroId: string, ingenieroNombre: string, fecha: string) => Promise<void>;
  primerDiaAgsEnRango: (ingenieroId: string, inicio: string, fin: string) => string | null;
}

type NuevaEntrada = Omit<AgendaEntry, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'createdByName' | 'updatedBy' | 'updatedByName'>;

/**
 * Sube el estado a su variante `_interior` cuando el establecimiento de la OT
 * está a más de 200 km. Solo toca los estados en los que nace una entrada nueva
 * (`tentativo` / `confirmado`): lo que ya viene marcado interior, o está en otro
 * punto del ciclo, se respeta tal cual. Best-effort — si la lectura falla, la
 * entrada se crea con el estado que le pasaron.
 */
async function conMarcaInterior(data: NuevaEntrada): Promise<NuevaEntrada> {
  if (data.estadoAgenda !== 'tentativo' && data.estadoAgenda !== 'confirmado') return data;
  if (!data.otNumber) return data;
  try {
    const ot = await ordenesTrabajoService.getByOtNumber(data.otNumber);
    if (!ot?.establecimientoId) return data;
    const est = await establecimientosService.getById(ot.establecimientoId);
    if (!esInteriorPorDistancia(est)) return data;
    return {
      ...data,
      estadoAgenda: data.estadoAgenda === 'confirmado' ? 'confirmado_interior' : 'tentativo_interior',
    };
  } catch (err) {
    console.error('[useAgenda] marca de interior:', err);
    return data;
  }
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

  // Días AGS: no laborables POR INGENIERO (claves `${ingId}_${fecha}`).
  const [diasAgs, setDiasAgs] = useState<Set<string>>(new Set());
  useEffect(() => {
    return diasAgsService.subscribe(setDiasAgs);
  }, []);

  // Load pending OTs only (filtered query — much faster than getAll).
  // REFRESCO AUTOMÁTICO (2026-07-31): era un fetch único al montar, pero las
  // pestañas viven horas — las OTs creadas después no entraban a la cola hasta
  // reabrir la pestaña ("creamos órdenes y no aparecen en agenda"). Ahora se
  // recarga cada 60s y al volver el foco a la ventana.
  const [allCandidateOTs, setAllCandidateOTs] = useState<WorkOrder[]>([]);
  useEffect(() => {
    const load = () => ordenesTrabajoService.getPending()
      .then(setAllCandidateOTs)
      .catch(err => console.error('Error loading pending OTs:', err));
    load();
    const int = setInterval(load, 60_000);
    const onVis = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(int); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  // Mapa sistemaId → id visible para las tarjetas del sidebar (UAT 2026-07-17).
  // Prioriza el código interno del CLIENTE (pedido coordinación 2026-08-03).
  // sistemasService.getAll() ya está cacheado (serviceCache), es una carga barata.
  const [equipoIdBySistema, setEquipoIdBySistema] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    sistemasService.getAll()
      .then(list => {
        const m = new Map<string, string>();
        for (const s of list) {
          const id = s.codigoInternoCliente || s.agsVisibleId;
          if (id) m.set(s.id, id);
        }
        setEquipoIdBySistema(m);
      })
      .catch(err => console.error('Error cargando sistemas para agenda:', err));
  }, []);

  // Padres candidatos que SÍ tienen hijas, consultando la colección — no
  // alcanza con mirar las pendientes (2026-08-07): si la hija ya cerró
  // técnicamente no está en `allCandidateOTs`, el padre no se detectaba como
  // contenedor y caía en la cola "a programar" (caso 29970 con 29970.01
  // asignada y cerrada). Solo se consultan los padres que hoy aparecerían en
  // la cola, así que son pocas lecturas.
  const [padresConHijas, setPadresConHijas] = useState<Set<string>>(new Set());
  useEffect(() => {
    const candidatosPadre = allCandidateOTs
      .filter(ot => !ot.otNumber.includes('.'))
      .map(ot => ot.otNumber);
    if (candidatosPadre.length === 0) { setPadresConHijas(new Set()); return; }
    let cancelled = false;
    Promise.all(candidatosPadre.map(async num => {
      try {
        const hijas = await ordenesTrabajoService.getItemsByOtPadre(num);
        return hijas.length > 0 ? num : null;
      } catch { return null; }
    })).then(res => {
      if (!cancelled) setPadresConHijas(new Set(res.filter((n): n is string => !!n)));
    });
    return () => { cancelled = true; };
  }, [allCandidateOTs]);

  // Derive pending OTs from candidates minus assigned (no Firestore re-read).
  // Regla 2026-04-22: ocultar OTs parent (sin punto) que tengan al menos 1
  // child — el coordinador solo asigna las OTs "hijas" (X.NN), la parent es un
  // contenedor no-accionable.
  const pendingOTs = useMemo(() => {
    // `otsAgendadas` viene de la suscripción GLOBAL (sin rango) — no usar
    // `entries` acá: solo trae el rango visible y una OT agendada en otra
    // semana reaparecía como pendiente (bug UAT 2026-07-30).
    const parentsWithChildren = new Set<string>(padresConHijas);
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
  }, [allCandidateOTs, otsAgendadas, padresConHijas]);

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

  // Ídem feriados pero POR INGENIERO: primer día AGS del rango, o null.
  const primerDiaAgsEnRango = useCallback((ingenieroId: string, inicio: string, fin: string): string | null => {
    if (!ingenieroId || !inicio || !fin) return null;
    const d = new Date(`${inicio}T12:00:00`);
    const end = new Date(`${fin}T12:00:00`);
    for (let guard = 0; d <= end && guard < 120; guard++) {
      const key = d.toISOString().split('T')[0];
      if (diasAgs.has(`${ingenieroId}_${key}`)) return key;
      d.setDate(d.getDate() + 1);
    }
    return null;
  }, [diasAgs]);

  // CRUD with optimistic updates
  const createEntry = useCallback(async (data: Omit<AgendaEntry, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'createdByName' | 'updatedBy' | 'updatedByName'>) => {
    const feriado = primerFeriadoEnRango(data.fechaInicio, data.fechaFin);
    if (feriado) {
      alert(`El ${feriado} está marcado como feriado — no se puede agendar ese día. Para hacerlo, desmarcá el feriado (click derecho sobre la fecha).`);
      return '';
    }
    const diaAgs = primerDiaAgsEnRango(data.ingenieroId, data.fechaInicio, data.fechaFin);
    if (diaAgs) {
      alert(`El ${diaAgs} es día AGS de ${data.ingenieroNombre} (no laborable) — no se le puede agendar ese día. Para hacerlo, quitá el día AGS (click derecho sobre la celda).`);
      return '';
    }
    // La marca de INTERIOR se resuelve ACÁ y no en cada llamador (2026-08-09).
    // Estaba solo en la vía de arrastrar una OT suelta desde la cola: el
    // arrastre múltiple y el pegado de entradas copiadas hardcodeaban
    // 'tentativo', así que la misma OT quedaba interior o no según cómo se
    // hubiera agendado. De esta marca depende el desarraigo del mes.
    const entryData = await conMarcaInterior(data);
    const tempId = `temp-${Date.now()}`;
    const now = new Date().toISOString();
    const optimistic: AgendaEntry = { ...entryData, id: tempId, createdAt: now, updatedAt: now, createdBy: null, createdByName: null, updatedBy: null, updatedByName: null };
    setEntries(prev => [...prev, optimistic]);
    const realId = await agendaService.create(entryData);
    // Replace temp entry with real ID (snapshot will arrive shortly but this avoids flicker)
    setEntries(prev => prev.map(e => e.id === tempId ? { ...e, id: realId } : e));
    return realId;
  }, [primerFeriadoEnRango, primerDiaAgsEnRango]);

  const updateEntry = useCallback(async (id: string, data: Partial<AgendaEntry>) => {
    // Bloqueo de feriados: solo cuando el cambio MUEVE fechas (mover/estirar);
    // cambios de estado/notas sobre una entrada existente pasan siempre.
    if (data.fechaInicio || data.fechaFin || data.ingenieroId) {
      const current = entries.find(e => e.id === id);
      const inicio = data.fechaInicio ?? current?.fechaInicio ?? '';
      const fin = data.fechaFin ?? current?.fechaFin ?? '';
      const feriado = (data.fechaInicio || data.fechaFin) ? primerFeriadoEnRango(inicio, fin) : null;
      if (feriado) {
        alert(`El ${feriado} está marcado como feriado — no se puede agendar ese día. Para hacerlo, desmarcá el feriado (click derecho sobre la fecha).`);
        return;
      }
      const ingId = data.ingenieroId ?? current?.ingenieroId ?? '';
      const ingNombre = data.ingenieroNombre ?? current?.ingenieroNombre ?? 'ese ingeniero';
      const diaAgs = primerDiaAgsEnRango(ingId, inicio, fin);
      if (diaAgs) {
        alert(`El ${diaAgs} es día AGS de ${ingNombre} (no laborable) — no se le puede agendar ese día. Para hacerlo, quitá el día AGS (click derecho sobre la celda).`);
        return;
      }
    }
    // Optimistic: apply changes immediately
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...data, updatedAt: new Date().toISOString() } : e));
    // Fire to Firestore (don't block UI)
    agendaService.update(id, data).catch(err => console.error('Error updating entry:', err));
    // Reserva de servicio sin OT (2026-08-03): si se mueve, la previsión la sigue.
    const moved = entries.find(e => e.id === id);
    if (moved && !moved.otNumber && (data.fechaInicio || data.fechaFin || data.ingenieroId)) {
      import('../services/previsionesService').then(({ previsionesService }) =>
        previsionesService.syncDesdeReserva(id, {
          fechaInicio: data.fechaInicio ?? moved.fechaInicio,
          fechaFin: data.fechaFin ?? moved.fechaFin,
          ingenieroId: data.ingenieroId ?? moved.ingenieroId,
          ingenieroNombre: data.ingenieroNombre ?? moved.ingenieroNombre,
        }),
      ).catch(err => console.error('[useAgenda] sync previsión desde reserva falló:', err));
    }
  }, [entries, primerFeriadoEnRango, primerDiaAgsEnRango]);

  const deleteEntry = useCallback(async (id: string) => {
    // Captura info de la entry antes de removerla para revertir la OT después.
    const entry = entries.find(e => e.id === id);
    const otNumber = entry?.otNumber || null;
    // Optimistic: remove immediately
    setEntries(prev => prev.filter(e => e.id !== id));
    agendaService.delete(id).catch(err => console.error('Error deleting entry:', err));
    // Reserva de servicio sin OT (2026-08-03): borrar la reserva descarta la previsión.
    if (entry && !entry.otNumber) {
      import('../services/previsionesService').then(({ previsionesService }) =>
        previsionesService.syncDesdeReserva(id, { descartar: true }),
      ).catch(err => console.error('[useAgenda] descartar previsión desde reserva falló:', err));
    }
    // Revertir la OT si tenía una OT linkeada: clear ingeniero/fecha y bajar
    // estadoAdmin a CREADA (solo si estaba en ASIGNADA o COORDINADA — no
    // regresamos estados avanzados como EN_CURSO, CIERRE_TECNICO, etc).
    // El sync del OT a ticket se encarga automaticamente en otService.update.
    if (otNumber) {
      ordenesTrabajoService.getByOtNumber(otNumber).then(async ot => {
        if (!ot) return;
        const REVERTIBLE: string[] = ['ASIGNADA', 'COORDINADA'];
        const shouldRevertEstado = REVERTIBLE.includes(ot.estadoAdmin || '');
        // La matriz solo retrocede DE A UN PASO: COORDINADA → CREADA directo
        // tiraba "Transición OT inválida" y el revert moría entero — la entrada
        // se borraba pero la OT quedaba COORDINADA con ingeniero y fecha
        // (2026-08-11). Se baja escalonado: COORDINADA → ASIGNADA → CREADA.
        if (ot.estadoAdmin === 'COORDINADA') {
          await ordenesTrabajoService.update(otNumber, {
            estadoAdmin: 'ASIGNADA' as any,
            estadoAdminFecha: new Date().toISOString(),
          }, { skipAgendaSync: true });
        }
        // skipAgendaSync (2026-08-03): la entrada ya se borró ACÁ. Sin el flag,
        // el rebote OT→agenda (ingeniero null → borrar entrada) podía llegar
        // DESPUÉS de un pegado rápido y borrarle la entrada recién creada.
        return ordenesTrabajoService.update(otNumber, {
          ingenieroAsignadoId: null,
          ingenieroAsignadoNombre: null,
          fechaServicioAprox: null as any,
          ...(shouldRevertEstado ? { estadoAdmin: 'CREADA' as any, estadoAdminFecha: new Date().toISOString() } : {}),
        }, { skipAgendaSync: true });
      }).catch(err => console.error('[useAgenda.deleteEntry] revert OT failed:', err));
    }
  }, [entries]);

  const upsertNota = useCallback(async (data: { fecha: string; ingenieroId: string; ingenieroNombre: string; quarter: 1 | 2 | 3 | 4; texto: string }) => {
    await agendaNotasService.upsert(data);
  }, []);

  const deleteNota = useCallback(async (id: string) => {
    await agendaNotasService.delete(id);
  }, []);

  const toggleDiaAgs = useCallback(async (ingenieroId: string, ingenieroNombre: string, fecha: string) => {
    const key = `${ingenieroId}_${fecha}`;
    const marcado = diasAgs.has(key);
    // Optimistic
    setDiasAgs(prev => {
      const next = new Set(prev);
      if (marcado) next.delete(key); else next.add(key);
      return next;
    });
    try {
      await diasAgsService.toggle(ingenieroId, ingenieroNombre, fecha, marcado);
    } catch (err) {
      console.error('Error toggling día AGS:', err);
      setDiasAgs(prev => {
        const next = new Set(prev);
        if (marcado) next.add(key); else next.delete(key);
        return next;
      });
    }
  }, [diasAgs]);

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
    diasAgs, toggleDiaAgs, primerDiaAgsEnRango,
  };
}
