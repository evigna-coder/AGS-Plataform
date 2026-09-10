import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { agendaService } from '../services/firebaseService';
import { misOTService, type MisOTDoc } from '../services/misOTService';
import { useIngenieroDocId } from './useIngenieroDocId';
import type { AgendaEntry } from '@ags/shared';

export type MisOTRange = 'hoy' | 'semana' | 'proximas';

const QUARTER_LABELS: Record<number, string> = { 1: 'AM1', 2: 'AM2', 3: 'PM1', 4: 'PM2' };

function formatDate(d: Date): string {
  // Fecha LOCAL, no UTC: con toISOString, desde las 21:00 (ART) "hoy" pasaba a
  // ser mañana y toda la lista corría un día.
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export interface MisOTListItem {
  ot: MisOTDoc;
  /** Franja horaria de la agenda (AM1..PM2) si la visita está agendada. */
  franja: string | null;
  /** Cantidad de tareas pendientes abiertas del equipo (colección `pendientes`). */
  pendientesCount: number;
}

/**
 * "Mis OT": OTs de `reportes` asignadas al ingeniero actual en estados no
 * terminales, ordenadas por fechaServicioAprox. Se enriquecen con la franja
 * horaria de agendaEntries y el conteo de tareas pendientes del equipo.
 * Admin ('admin' | 'admin_ing_soporte') ve TODAS las OTs activas por defecto,
 * con toggle "Mis OTs" — mismo criterio que la agenda.
 */
export function useMisOTList(range: MisOTRange) {
  const { usuario, hasRole } = useAuth();
  const isAdmin = hasRole('admin', 'admin_ing_soporte');
  const [showMine, setShowMine] = useState(false);
  const verTodas = isAdmin && !showMine;
  // Finalizadas + buscador (2026-09-10): para encontrar una OT ya cerrada y
  // reabrir el reporte desde el portal. Con "Finalizadas" activo el rango de
  // fechas no aplica (se listan de la más reciente a la más vieja).
  const [verFinalizadas, setVerFinalizadas] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const { ingenieroDocId, loaded: ingLoaded } = useIngenieroDocId(usuario?.id, usuario?.email);
  const [ots, setOts] = useState<MisOTDoc[]>([]);
  const [agenda, setAgenda] = useState<AgendaEntry[]>([]);
  const [pendCounts, setPendCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  const today = useMemo(() => new Date(), []);
  const todayStr = formatDate(today);

  // OTs (realtime): las asignadas al ingeniero, o todas las activas si es admin
  useEffect(() => {
    if (!usuario?.id || !ingLoaded) return;
    setLoading(true);
    const onData = (data: MisOTDoc[]) => { setOts(data); setLoading(false); };
    const onErr = () => setLoading(false);
    const ids = [usuario.id, ingenieroDocId].filter((x): x is string => !!x);
    if (verFinalizadas) {
      return verTodas
        ? misOTService.subscribeTodasFinalizadas(onData, onErr)
        : misOTService.subscribeMisOTsFinalizadas(ids, onData, onErr);
    }
    if (verTodas) return misOTService.subscribeTodasLasOTs(onData, onErr);
    return misOTService.subscribeMisOTs(ids, onData, onErr);
  }, [usuario?.id, ingenieroDocId, ingLoaded, verTodas, verFinalizadas]);

  // Agenda: franjas horarias de las visitas (hoy → +60 días)
  useEffect(() => {
    if (!usuario?.id || !ingLoaded) return;
    const ids = [usuario.id, ingenieroDocId].filter((x): x is string => !!x);
    if (!verTodas && ids.length === 0) return;
    const unsub = agendaService.subscribeToRange(
      // 366 días: la coordinación agenda los regulatorios anuales con meses de
      // anticipación — con 60 días las OTs lejanas quedaban sin franja (2026-07-31).
      // 7 días hacia atrás: las OT atrasadas conservan su franja horaria.
      formatDate(addDays(today, -7)), formatDate(addDays(today, 366)), verTodas ? null : ids, setAgenda);
    return unsub;
  }, [usuario?.id, ingenieroDocId, ingLoaded, todayStr, today, verTodas]);

  // Tareas pendientes por equipo (one-shot por cambio de lista)
  useEffect(() => {
    const sistemaIds = Array.from(new Set(ots.map(o => o.sistemaId).filter((x): x is string => !!x)));
    if (sistemaIds.length === 0) { setPendCounts(new Map()); return; }
    let active = true;
    misOTService.getPendientesCounts(sistemaIds).then(counts => {
      if (active) setPendCounts(counts);
    }).catch(() => {});
    return () => { active = false; };
  }, [ots]);

  const franjaByOt = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of agenda) {
      if (!e.otNumber || map.has(e.otNumber)) continue;
      map.set(e.otNumber, QUARTER_LABELS[e.quarterStart] ?? '');
    }
    return map;
  }, [agenda]);

  // Filtro por rango + agrupación por día. Las OT abiertas con fecha pasada
  // siguen entrando en "Hoy" (no deben perderse de vista), pero agrupadas bajo
  // su fecha REAL — antes se fusionaban en el grupo de hoy y el ingeniero veía
  // una OT de ayer titulada "Hoy" (UAT 2026-08-11).
  const groupedByDay = useMemo(() => {
    const weekEndStr = formatDate(addDays(today, 7));
    const q = busqueda.trim().toLowerCase();
    const coincide = (ot: MisOTDoc) => !q
      || (ot.otNumber || '').toLowerCase().includes(q)
      || (ot.razonSocial || '').toLowerCase().includes(q);
    const filtered = ots.filter(ot => {
      if (!coincide(ot)) return false;
      if (verFinalizadas) return true; // sin rango: se buscan por número o cliente
      const f = ot.fechaServicioAprox || '';
      if (range === 'hoy') return !!f && f <= todayStr;
      if (range === 'semana') return !!f && f <= weekEndStr;
      return true; // próximas: todas, incluidas sin fecha
    });
    const map = new Map<string, MisOTListItem[]>();
    for (const ot of filtered) {
      const f = ot.fechaServicioAprox || '';
      const key = !f ? 'sin-fecha' : f;
      const arr = map.get(key) ?? [];
      arr.push({ ot, franja: franjaByOt.get(ot.otNumber) ?? null, pendientesCount: pendCounts.get(ot.sistemaId ?? '') ?? 0 });
      map.set(key, arr);
    }
    return Array.from(map.entries())
      // Finalizadas: la más reciente primero.
      .sort((a, b) => (a[0] === 'sin-fecha' ? 1 : b[0] === 'sin-fecha' ? -1 : verFinalizadas ? b[0].localeCompare(a[0]) : a[0].localeCompare(b[0])))
      .map(([day, items]) => ({
        day,
        items: items.sort((a, b) => (a.franja ?? 'ZZ').localeCompare(b.franja ?? 'ZZ') || a.ot.otNumber.localeCompare(b.ot.otNumber)),
      }));
  }, [ots, range, todayStr, today, franjaByOt, pendCounts, verFinalizadas, busqueda]);

  const total = groupedByDay.reduce((s, g) => s + g.items.length, 0);

  return {
    groupedByDay, total, loading,
    isAdmin, showMine, verTodas,
    toggleShowMine: () => setShowMine(v => !v),
    verFinalizadas, toggleFinalizadas: () => setVerFinalizadas(v => !v),
    busqueda, setBusqueda,
  };
}
