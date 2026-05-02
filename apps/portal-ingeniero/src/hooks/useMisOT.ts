import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { agendaService, ingenierosService } from '../services/firebaseService';
import type { AgendaEntry } from '@ags/shared';

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export type MisOTRange = 'hoy' | 'semana' | 'proximas';

/**
 * Lee de agendaEntries las visitas asignadas al ingeniero actual con OT.
 * Source-of-truth para "Mis OT" en portal-ingeniero.
 */
export function useMisOT(range: MisOTRange) {
  const { usuario } = useAuth();
  const [entries, setEntries] = useState<AgendaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [ingenieros, setIngenieros] = useState<{ id: string; usuarioId: string | null; email: string | null }[]>([]);
  const [ingenierosLoaded, setIngenierosLoaded] = useState(false);

  useEffect(() => {
    ingenierosService.getAll().then(list => {
      setIngenieros(list.map(i => ({ id: i.id, usuarioId: i.usuarioId, email: i.email })));
      setIngenierosLoaded(true);
    });
  }, []);

  const myIngenieroId = useMemo(() => {
    if (!usuario?.id) return null;
    const byUid = ingenieros.find(i => i.usuarioId === usuario.id);
    if (byUid) return byUid.id;
    if (usuario.email) {
      const email = usuario.email.toLowerCase();
      const byEmail = ingenieros.find(i => (i.email || '').toLowerCase() === email);
      if (byEmail) return byEmail.id;
    }
    return null;
  }, [ingenieros, usuario?.id, usuario?.email]);

  // Window: from today to +60 days (covers "próximas"), client-side filters by tab
  const today = useMemo(() => new Date(), []);
  const rangeStart = formatDate(today);
  const rangeEnd = formatDate(addDays(today, 60));

  useEffect(() => {
    if (!usuario?.id || !ingenierosLoaded) return;
    setLoading(true);
    const ids = [usuario.id, myIngenieroId].filter((x): x is string => !!x);
    if (ids.length === 0) {
      setEntries([]);
      setLoading(false);
      return;
    }
    const unsub = agendaService.subscribeToRange(rangeStart, rangeEnd, ids, (data) => {
      // Solo entradas con OT asignada (descartar tareas/notas puras)
      setEntries(data.filter(e => !!e.otNumber));
      setLoading(false);
    });
    return unsub;
  }, [usuario?.id, myIngenieroId, ingenierosLoaded, rangeStart, rangeEnd]);

  const filtered = useMemo(() => {
    const todayStr = formatDate(today);
    const weekEndStr = formatDate(addDays(today, 7));
    if (range === 'hoy') return entries.filter(e => e.fechaInicio <= todayStr && e.fechaFin >= todayStr);
    if (range === 'semana') return entries.filter(e => e.fechaInicio <= weekEndStr && e.fechaFin >= todayStr);
    return entries;
  }, [entries, range, today]);

  // Group by day (fechaInicio). Multi-day entries appear under each day they cover.
  const groupedByDay = useMemo(() => {
    const map = new Map<string, AgendaEntry[]>();
    const todayStr = formatDate(today);
    for (const e of filtered) {
      // Single-day or multi-day: index by fechaInicio (compact). Multi-day support
      // can be added later if engineers need to see the same OT under each day.
      const key = e.fechaInicio < todayStr ? todayStr : e.fechaInicio;
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    // Sort days asc, sort entries inside by quarterStart asc
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, list]) => ({
        day,
        entries: list.sort((a, b) => a.quarterStart - b.quarterStart),
      }));
  }, [filtered, today]);

  return { groupedByDay, total: filtered.length, loading };
}
