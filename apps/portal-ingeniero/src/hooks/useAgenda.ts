import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { agendaService } from '../services/firebaseService';
import type { AgendaEntry } from '@ags/shared';

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
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

export function useAgenda() {
  const { usuario } = useAuth();
  const [entries, setEntries] = useState<AgendaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');

  const weekStart = useMemo(() => startOfWeek(selectedDate), [selectedDate]);
  const rangeStart = formatDate(weekStart);
  const rangeEnd = formatDate(addDays(weekStart, 6));

  useEffect(() => {
    if (!usuario?.id) return;
    setLoading(true);
    const unsub = agendaService.subscribeToRange(rangeStart, rangeEnd, usuario.id, (data) => {
      setEntries(data);
      setLoading(false);
    });
    return unsub;
  }, [usuario?.id, rangeStart, rangeEnd]);

  const goNext = useCallback(() => {
    setSelectedDate(d => addDays(d, viewMode === 'week' ? 7 : 1));
  }, [viewMode]);

  const goPrev = useCallback(() => {
    setSelectedDate(d => addDays(d, viewMode === 'week' ? -7 : -1));
  }, [viewMode]);

  const goToday = useCallback(() => setSelectedDate(new Date()), []);

  const entriesForDay = useCallback((date: string) => {
    return entries.filter(e => e.fechaInicio <= date && e.fechaFin >= date);
  }, [entries]);

  return {
    entries, loading, selectedDate, setSelectedDate,
    viewMode, setViewMode, goNext, goPrev, goToday,
    weekStart, rangeStart, rangeEnd, entriesForDay,
  };
}
