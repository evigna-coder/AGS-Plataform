import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { agendaService, ingenierosService } from '../services/firebaseService';
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
  const { usuario, hasRole } = useAuth();
  // Only 'admin' and 'admin_ing_soporte' can see all agendas
  const isAdmin = hasRole('admin', 'admin_ing_soporte');
  const [entries, setEntries] = useState<AgendaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [weeksAhead, setWeeksAhead] = useState(WEEKS_AHEAD);
  // Ingenieros list — always loaded, used for both admin grid and resolving my ingenieroId
  const [ingenieros, setIngenieros] = useState<{ id: string; nombre: string; usuarioId: string | null; email: string | null }[]>([]);
  const [ingenierosLoaded, setIngenierosLoaded] = useState(false);
  const [showMine, setShowMine] = useState(false);
  const toggleShowMine = useCallback(() => setShowMine(v => !v), []);

  useEffect(() => {
    ingenierosService.getAll().then(list => {
      setIngenieros(list);
      setIngenierosLoaded(true);
    });
  }, []);

  // Resolve my ingenieroId: try linking by usuarioId first, fallback to email match
  const myIngenieroId = useMemo(() => {
    if (!usuario?.id) return null;
    // Primary match: explicit usuarioId link (set manually by admin in IngenierosPage)
    const byUid = ingenieros.find(i => i.usuarioId === usuario.id);
    if (byUid) return byUid.id;
    // Fallback: match by email (case-insensitive)
    if (usuario.email) {
      const email = usuario.email.toLowerCase();
      const byEmail = ingenieros.find(i => (i.email || '').toLowerCase() === email);
      if (byEmail) return byEmail.id;
    }
    return null;
  }, [ingenieros, usuario?.id, usuario?.email]);

  const today = useMemo(() => new Date(), []);
  const weekStart = useMemo(() => startOfWeek(today), [today]);
  const rangeStart = formatDate(addDays(weekStart, -WEEKS_BACK * 7));
  const rangeEnd = formatDate(addDays(weekStart, weeksAhead * 7 - 1));

  useEffect(() => {
    if (!usuario?.id) return;
    // Wait until ingenieros are loaded so myIngenieroId is resolved before filtering
    if (!ingenierosLoaded) return;
    setLoading(true);
    // Admin (not viewing "mine") sees all → pass null
    // Otherwise match BOTH possible ingenieroId values in agendaEntries:
    //   - Firebase UID (stored when OT was assigned — sistema-modular uses ingeniero.usuarioId)
    //   - ingeniero doc ID (stored when created via drag-drop directly in agenda)
    let filter: string | string[] | null;
    if (isAdmin && !showMine) {
      filter = null;
    } else {
      const ids = [usuario.id, myIngenieroId].filter((x): x is string => !!x);
      if (ids.length === 0) {
        setEntries([]);
        setLoading(false);
        return;
      }
      filter = ids;
    }
    const unsub = agendaService.subscribeToRange(rangeStart, rangeEnd, filter, (data) => {
      setEntries(data);
      setLoading(false);
    });
    return unsub;
  }, [usuario?.id, usuario?.email, isAdmin, showMine, rangeStart, rangeEnd, myIngenieroId, ingenierosLoaded]);

  const loadMore = useCallback(() => {
    setWeeksAhead(prev => prev + 4);
  }, []);

  const entriesForDay = useCallback((date: string) => {
    return entries.filter(e => e.fechaInicio <= date && e.fechaFin >= date);
  }, [entries]);

  return {
    entries, loading, today, weekStart, rangeStart, rangeEnd,
    entriesForDay, loadMore, weeksAhead,
    isAdmin, showMine, toggleShowMine, ingenieros,
  };
}
