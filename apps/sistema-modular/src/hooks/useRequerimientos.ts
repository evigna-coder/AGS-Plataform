import { useState, useCallback } from 'react';
import { requerimientosService } from '../services/firebaseService';
import type { RequerimientoCompra } from '@ags/shared';

interface RequerimientoFilters {
  estado?: string;
  origen?: string;
}

export function useRequerimientos() {
  const [requerimientos, setRequerimientos] = useState<RequerimientoCompra[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRequerimientos = useCallback(async (filters?: RequerimientoFilters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await requerimientosService.getAll(filters);
      setRequerimientos(data);
    } catch (err) {
      console.error('Error listando requerimientos:', err);
      setError('Error al cargar requerimientos');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createRequerimiento = useCallback(async (
    data: Omit<RequerimientoCompra, 'id' | 'numero' | 'createdAt' | 'updatedAt'>
  ) => {
    try {
      const id = await requerimientosService.create(data);
      await loadRequerimientos();
      return id;
    } catch (err) {
      console.error('Error creando requerimiento:', err);
      throw err;
    }
  }, [loadRequerimientos]);

  const updateRequerimiento = useCallback(async (
    id: string,
    data: Partial<RequerimientoCompra>
  ) => {
    try {
      await requerimientosService.update(id, data);
      await loadRequerimientos();
    } catch (err) {
      console.error('Error actualizando requerimiento:', err);
      throw err;
    }
  }, [loadRequerimientos]);

  const deleteRequerimiento = useCallback(async (id: string) => {
    try {
      await requerimientosService.delete(id);
      await loadRequerimientos();
    } catch (err) {
      console.error('Error eliminando requerimiento:', err);
      throw err;
    }
  }, [loadRequerimientos]);

  return {
    requerimientos,
    loading,
    error,
    loadRequerimientos,
    createRequerimiento,
    updateRequerimiento,
    deleteRequerimiento,
  };
}
