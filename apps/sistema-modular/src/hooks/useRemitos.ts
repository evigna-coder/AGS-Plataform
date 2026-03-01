import { useState, useCallback } from 'react';
import { remitosService } from '../services/firebaseService';
import type { Remito } from '@ags/shared';

interface RemitoFilters {
  ingenieroId?: string;
  estado?: string;
  tipo?: string;
}

export function useRemitos() {
  const [remitos, setRemitos] = useState<Remito[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listRemitos = useCallback(async (filters?: RemitoFilters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await remitosService.getAll(filters);
      setRemitos(data);
    } catch (err) {
      console.error('Error listando remitos:', err);
      setError('Error al cargar remitos');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getRemito = useCallback(async (id: string) => {
    try {
      return await remitosService.getById(id);
    } catch (err) {
      console.error('Error obteniendo remito:', err);
      throw err;
    }
  }, []);

  const saveRemito = useCallback(async (data: Omit<Remito, 'id' | 'numero' | 'createdAt' | 'updatedAt'> & { numero?: string }, id?: string) => {
    try {
      if (id) {
        await remitosService.update(id, data);
        return id;
      }
      return await remitosService.create(data);
    } catch (err) {
      console.error('Error guardando remito:', err);
      throw err;
    }
  }, []);

  const deleteRemito = useCallback(async (id: string) => {
    try {
      await remitosService.delete(id);
    } catch (err) {
      console.error('Error eliminando remito:', err);
      throw err;
    }
  }, []);

  return {
    remitos, loading, error,
    listRemitos, getRemito, saveRemito, deleteRemito,
  };
}
