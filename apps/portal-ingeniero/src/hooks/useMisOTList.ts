import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { agendaService } from '../services/firebaseService';
import { misOTService, type MisOTDoc } from '../services/misOTService';
import { useIngenieroDocId } from './useIngenieroDocId';
import type { AgendaEntry } from '@ags/shared';

export type MisOTRange = 'hoy' | 'semana' | 'proximas';

const QUARTER_LABELS: Record<number, string> = { 1: 'AM1', 2: 'AM2', 3: 'PM1', 4: 'PM2' };

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
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
    if (verTodas) return misOTService.subscribeTodasLasOTs(onData, onErr);
    const ids = [usuario.id, ingenieroDocId].filter((x): x is string => !!x);
    return misOTService.subscribeMisOTs(ids, onData, onErr);
  }, [usuario?.id, ingenieroDocId, ingLoaded, verTodas]);

  // Agenda: franjas horarias de las visitas (hoy → +60 días)
  useEffect(() => {
    if (!usuario?.id || !ingLoaded) return;
    const ids = [usuario.id, ingenieroDocId].filter((x): x is string => !!x);
    if (!verTodas && ids.length === 0) return;
    const unsub = agendaService.subscribeToRange(
      todayStr, formatDate(addDays(today, 60)), verTodas ? null : ids, setAgenda);
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

  // Filtro por rango + agrupación por día (fechas pasadas se agrupan bajo hoy)
  const groupedByDay = useMemo(() => {
    const weekEndStr = formatDate(addDays(today, 7));
    const filtered = ots.filter(ot => {
      const f = ot.fechaServicioAprox || '';
      if (range === 'hoy') return !!f && f <= todayStr;
      if (range === 'semana') return !!f && f <= weekEndStr;
      return true; // próximas: todas, incluidas sin fecha
    });
    const map = new Map<string, MisOTListItem[]>();
    for (const ot of filtered) {
      const f = ot.fechaServicioAprox || '';
      const key = !f ? 'sin-fecha' : f < todayStr ? todayStr : f;
      const arr = map.get(key) ?? [];
      arr.push({ ot, franja: franjaByOt.get(ot.otNumber) ?? null, pendientesCount: pendCounts.get(ot.sistemaId ?? '') ?? 0 });
      map.set(key, arr);
    }
    return Array.from(map.entries())
      .sort((a, b) => (a[0] === 'sin-fecha' ? 1 : b[0] === 'sin-fecha' ? -1 : a[0].localeCompare(b[0])))
      .map(([day, items]) => ({
        day,
        items: items.sort((a, b) => (a.franja ?? 'ZZ').localeCompare(b.franja ?? 'ZZ') || a.ot.otNumber.localeCompare(b.ot.otNumber)),
      }));
  }, [ots, range, todayStr, today, franjaByOt, pendCounts]);

  const total = groupedByDay.reduce((s, g) => s + g.items.length, 0);

  return {
    groupedByDay, total, loading,
    isAdmin, showMine, verTodas,
    toggleShowMine: () => setShowMine(v => !v),
  };
}
