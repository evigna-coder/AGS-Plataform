import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { agendaService } from '../services/firebaseService';
import type { AgendaEntry } from '@ags/shared';

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Default: load 4 weeks ahead + 1 week back */
const WEEKS_BACK = 1;
const WEEKS_AHEAD = 4;

export function useAgenda() {
  const { usuario } = useAuth();
  const [entries, setEntries] = useState<AgendaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [weeksAhead, setWeeksAhead] = useState(WEEKS_AHEAD);

  const today = useMemo(() => new Date(), []);
  const weekStart = useMemo(() => startOfWeek(today), [today]);
  const rangeStart = formatDate(addDays(weekStart, -WEEKS_BACK * 7));
  const rangeEnd = formatDate(addDays(weekStart, weeksAhead * 7 - 1));

  useEffect(() => {
    if (!usuario?.id) return;
    setLoading(true);
    const unsub = agendaService.subscribeToRange(rangeStart, rangeEnd, usuario.id, (data) => {
      setEntries(data);
      setLoading(false);
    });
    return unsub;
  }, [usuario?.id, rangeStart, rangeEnd]);

  const loadMore = useCallback(() => {
    setWeeksAhead(prev => prev + 4);
  }, []);

  const entriesForDay = useCallback((date: string) => {
    return entries.filter(e => e.fechaInicio <= date && e.fechaFin >= date);
  }, [entries]);

  return {
    entries, loading, today, weekStart, rangeStart, rangeEnd,
    entriesForDay, loadMore, weeksAhead,
  };
}
