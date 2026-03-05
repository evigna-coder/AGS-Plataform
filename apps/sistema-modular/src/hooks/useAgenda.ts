import { useState, useEffect, useCallback, useMemo } from 'react';
import type { AgendaEntry, AgendaNota, Ingeniero, WorkOrder, ZoomLevel } from '@ags/shared';
import { ingenierosService, agendaService, agendaNotasService, ordenesTrabajoService } from '../services/firebaseService';
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
  loading: boolean;
  // CRUD
  createEntry: (data: Omit<AgendaEntry, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'createdByName' | 'updatedBy' | 'updatedByName'>) => Promise<string>;
  updateEntry: (id: string, data: Partial<AgendaEntry>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  upsertNota: (data: { fecha: string; ingenieroId: string; ingenieroNombre: string; texto: string }) => Promise<void>;
  deleteNota: (id: string) => Promise<void>;
}

export function useAgenda(): UseAgendaReturn {
  const [anchor, setAnchor] = useState<Date>(() => getMonday(new Date()));
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('month');
  const [ingenieros, setIngenieros] = useState<Ingeniero[]>([]);
  const [entries, setEntries] = useState<AgendaEntry[]>([]);
  const [notas, setNotas] = useState<AgendaNota[]>([]);
  const [pendingOTs, setPendingOTs] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const visibleDays = useMemo(() => getVisibleDays(anchor, zoomLevel), [anchor, zoomLevel]);

  const [rangeStart, rangeEnd] = useMemo(() => {
    const [s, e] = getVisibleRange(anchor, zoomLevel);
    return [formatDateKey(s), formatDateKey(e)];
  }, [anchor, zoomLevel]);

  // Load engineers (once)
  useEffect(() => {
    ingenierosService.getAll().then(list => {
      setIngenieros(list.filter(i => i.activo));
    });
  }, []);

  // Real-time entries subscription
  useEffect(() => {
    setLoading(true);
    const unsubscribe = agendaService.subscribeToRange(rangeStart, rangeEnd, (newEntries) => {
      setEntries(newEntries);
      setLoading(false);
    });
    return unsubscribe;
  }, [rangeStart, rangeEnd]);

  // Real-time notas subscription
  useEffect(() => {
    const unsubscribe = agendaNotasService.subscribeToRange(rangeStart, rangeEnd, setNotas);
    return unsubscribe;
  }, [rangeStart, rangeEnd]);

  // Load pending OTs (OTs without agenda entries)
  useEffect(() => {
    loadPendingOTs();
  }, [entries]);

  async function loadPendingOTs() {
    try {
      const allOTs = await ordenesTrabajoService.getAll();
      const assignedOTNumbers = new Set(
        entries.filter(e => e.estadoAgenda !== 'cancelado').map(e => e.otNumber)
      );
      const pending = allOTs.filter(
        ot => ot.status === 'BORRADOR' && !assignedOTNumbers.has(ot.otNumber)
      );
      setPendingOTs(pending);
    } catch (err) {
      console.error('Error loading pending OTs:', err);
    }
  }

  // Navigation
  const goToPrev = useCallback(() => setAnchor(prev => navigatePrev(prev, zoomLevel)), [zoomLevel]);
  const goToNext = useCallback(() => setAnchor(prev => navigateNext(prev, zoomLevel)), [zoomLevel]);
  const goToToday = useCallback(() => setAnchor(getMonday(new Date())), []);
  const goToDate = useCallback((date: Date) => setAnchor(getMonday(date)), []);

  // CRUD
  const createEntry = useCallback(async (data: Omit<AgendaEntry, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'createdByName' | 'updatedBy' | 'updatedByName'>) => {
    return agendaService.create(data);
  }, []);

  const updateEntry = useCallback(async (id: string, data: Partial<AgendaEntry>) => {
    await agendaService.update(id, data);
  }, []);

  const deleteEntry = useCallback(async (id: string) => {
    await agendaService.delete(id);
  }, []);

  const upsertNota = useCallback(async (data: { fecha: string; ingenieroId: string; ingenieroNombre: string; texto: string }) => {
    await agendaNotasService.upsert(data);
  }, []);

  const deleteNota = useCallback(async (id: string) => {
    await agendaNotasService.delete(id);
  }, []);

  return {
    anchor, zoomLevel, visibleDays,
    setZoomLevel, goToPrev, goToNext, goToToday, goToDate,
    ingenieros, entries, notas, pendingOTs, loading,
    createEntry, updateEntry, deleteEntry, upsertNota, deleteNota,
  };
}
