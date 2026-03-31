import { useState, useEffect, useCallback, useMemo } from 'react';
import type { AgendaEntry, AgendaNota, Ingeniero, WorkOrder, ZoomLevel } from '@ags/shared';
import { ingenierosService, agendaService, agendaNotasService, feriadosService, ordenesTrabajoService } from '../services/firebaseService';
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
  feriados: Set<string>;
  loading: boolean;
  // CRUD
  createEntry: (data: Omit<AgendaEntry, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'createdByName' | 'updatedBy' | 'updatedByName'>) => Promise<string>;
  updateEntry: (id: string, data: Partial<AgendaEntry>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  upsertNota: (data: { fecha: string; ingenieroId: string; ingenieroNombre: string; texto: string }) => Promise<void>;
  deleteNota: (id: string) => Promise<void>;
  toggleFeriado: (fecha: string) => Promise<void>;
}

export function useAgenda(): UseAgendaReturn {
  const [anchor, setAnchor] = useState<Date>(() => getMonday(new Date()));
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('month');
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

  // Real-time feriados subscription (global, no range filter)
  useEffect(() => {
    return feriadosService.subscribe(setFeriados);
  }, []);

  // Load all candidate OTs once
  const [allCandidateOTs, setAllCandidateOTs] = useState<WorkOrder[]>([]);
  useEffect(() => {
    const PENDING_ESTADOS = ['CREADA', 'ASIGNADA', 'COORDINADA', 'EN_CURSO'];
    ordenesTrabajoService.getAll().then(allOTs => {
      setAllCandidateOTs(allOTs.filter(
        ot => ot.status === 'BORRADOR' || PENDING_ESTADOS.includes(ot.estadoAdmin || '')
      ));
    }).catch(err => console.error('Error loading OTs:', err));
  }, []);

  // Derive pending OTs from candidates minus assigned (no Firestore re-read)
  const pendingOTs = useMemo(() => {
    const assignedOTNumbers = new Set(
      entries.filter(e => e.estadoAgenda !== 'cancelado').map(e => e.otNumber)
    );
    return allCandidateOTs.filter(ot => !assignedOTNumbers.has(ot.otNumber));
  }, [allCandidateOTs, entries]);

  // Navigation
  const goToPrev = useCallback(() => setAnchor(prev => navigatePrev(prev, zoomLevel)), [zoomLevel]);
  const goToNext = useCallback(() => setAnchor(prev => navigateNext(prev, zoomLevel)), [zoomLevel]);
  const goToToday = useCallback(() => setAnchor(getMonday(new Date())), []);
  const goToDate = useCallback((date: Date) => setAnchor(getMonday(date)), []);

  // CRUD with optimistic updates
  const createEntry = useCallback(async (data: Omit<AgendaEntry, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'createdByName' | 'updatedBy' | 'updatedByName'>) => {
    const tempId = `temp-${Date.now()}`;
    const now = new Date().toISOString();
    const optimistic: AgendaEntry = { ...data, id: tempId, createdAt: now, updatedAt: now, createdBy: null, createdByName: null, updatedBy: null, updatedByName: null };
    setEntries(prev => [...prev, optimistic]);
    const realId = await agendaService.create(data);
    // Replace temp entry with real ID (snapshot will arrive shortly but this avoids flicker)
    setEntries(prev => prev.map(e => e.id === tempId ? { ...e, id: realId } : e));
    return realId;
  }, []);

  const updateEntry = useCallback(async (id: string, data: Partial<AgendaEntry>) => {
    // Optimistic: apply changes immediately
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...data, updatedAt: new Date().toISOString() } : e));
    // Fire to Firestore (don't block UI)
    agendaService.update(id, data).catch(err => console.error('Error updating entry:', err));
  }, []);

  const deleteEntry = useCallback(async (id: string) => {
    // Optimistic: remove immediately
    setEntries(prev => prev.filter(e => e.id !== id));
    agendaService.delete(id).catch(err => console.error('Error deleting entry:', err));
  }, []);

  const upsertNota = useCallback(async (data: { fecha: string; ingenieroId: string; ingenieroNombre: string; texto: string }) => {
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
    ingenieros, entries, notas, pendingOTs, feriados, loading,
    createEntry, updateEntry, deleteEntry, upsertNota, deleteNota, toggleFeriado,
  };
}
