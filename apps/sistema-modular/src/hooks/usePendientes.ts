import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type {
  Pendiente,
  PendienteEstado,
  PendienteResolucionDocType,
  PendienteTipo,
} from '@ags/shared';
import { pendientesService, type PendienteFilters } from '../services/pendientesService';

export interface UsePendientesFilters {
  clienteId?: string;
  equipoId?: string;
  tipo?: PendienteTipo;
  estado?: PendienteEstado;
  includeDescartadas?: boolean;
}

export interface UsePendientesReturn {
  pendientes: Pendiente[];
  loading: boolean;
  error: Error | null;
  create: (
    data: Omit<
      Pendiente,
      'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'createdByName' | 'updatedBy' | 'updatedByName'
    >,
  ) => Promise<string>;
  update: (id: string, data: Partial<Omit<Pendiente, 'id' | 'createdAt'>>) => Promise<void>;
  completar: (
    id: string,
    data: {
      resolucionDocType: PendienteResolucionDocType;
      resolucionDocId: string;
      resolucionDocLabel: string;
    },
  ) => Promise<void>;
  descartar: (id: string, motivo?: string | null) => Promise<void>;
  reabrir: (id: string) => Promise<void>;
  delete: (id: string) => Promise<void>;
}

export function usePendientes(filters?: UsePendientesFilters): UsePendientesReturn {
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Stable reference for filters to avoid resubscribing on every render
  const filtersRef = useRef(filters);
  const filtersKey = useMemo(
    () =>
      JSON.stringify({
        clienteId: filters?.clienteId ?? null,
        equipoId: filters?.equipoId ?? null,
        tipo: filters?.tipo ?? null,
        estado: filters?.estado ?? null,
        includeDescartadas: filters?.includeDescartadas ?? false,
      }),
    [filters?.clienteId, filters?.equipoId, filters?.tipo, filters?.estado, filters?.includeDescartadas],
  );
  filtersRef.current = filters;

  useEffect(() => {
    setLoading(true);
    setError(null);
    const serviceFilters: PendienteFilters | undefined = filtersRef.current
      ? {
          clienteId: filtersRef.current.clienteId,
          equipoId: filtersRef.current.equipoId,
          tipo: filtersRef.current.tipo,
          estado: filtersRef.current.estado,
          includeDescartadas: filtersRef.current.includeDescartadas,
        }
      : undefined;
    const unsub = pendientesService.subscribe(
      serviceFilters,
      data => {
        setPendientes(data);
        setLoading(false);
      },
      err => {
        setError(err);
        setLoading(false);
      },
    );
    return unsub;
  }, [filtersKey]);

  const create = useCallback(
    async (
      data: Omit<
        Pendiente,
        'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'createdByName' | 'updatedBy' | 'updatedByName'
      >,
    ) => {
      return pendientesService.create(data);
    },
    [],
  );

  const update = useCallback(
    async (id: string, data: Partial<Omit<Pendiente, 'id' | 'createdAt'>>) => {
      // Optimistic local update
      setPendientes(prev =>
        prev.map(p => (p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p)),
      );
      await pendientesService.update(id, data);
    },
    [],
  );

  const completar = useCallback(
    async (
      id: string,
      data: {
        resolucionDocType: PendienteResolucionDocType;
        resolucionDocId: string;
        resolucionDocLabel: string;
      },
    ) => {
      await pendientesService.completar(id, data);
    },
    [],
  );

  const descartar = useCallback(async (id: string, motivo?: string | null) => {
    await pendientesService.descartar(id, motivo);
  }, []);

  const reabrir = useCallback(async (id: string) => {
    await pendientesService.reabrir(id);
  }, []);

  const deleteFn = useCallback(async (id: string) => {
    setPendientes(prev => prev.filter(p => p.id !== id));
    await pendientesService.delete(id);
  }, []);

  return {
    pendientes,
    loading,
    error,
    create,
    update,
    completar,
    descartar,
    reabrir,
    delete: deleteFn,
  };
}
