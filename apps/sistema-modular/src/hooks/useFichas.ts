import { useState, useCallback } from 'react';
import { fichasService } from '../services/firebaseService';
import type { FichaPropiedad, EstadoFicha } from '@ags/shared';

interface FichaFilters {
  clienteId?: string;
  estado?: string;
  activasOnly?: boolean;
}

export function useFichas() {
  const [fichas, setFichas] = useState<FichaPropiedad[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listFichas = useCallback(async (filters?: FichaFilters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fichasService.getAll(filters);
      setFichas(data);
    } catch (err) {
      console.error('Error listando fichas:', err);
      setError('Error al cargar fichas');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getFicha = useCallback(async (id: string) => {
    try {
      return await fichasService.getById(id);
    } catch (err) {
      console.error('Error obteniendo ficha:', err);
      throw err;
    }
  }, []);

  const saveFicha = useCallback(async (
    data: Omit<FichaPropiedad, 'id' | 'numero' | 'createdAt' | 'updatedAt'>,
    id?: string
  ) => {
    try {
      if (id) {
        await fichasService.update(id, data);
        return id;
      }
      return await fichasService.create(data);
    } catch (err) {
      console.error('Error guardando ficha:', err);
      throw err;
    }
  }, []);

  const deleteFicha = useCallback(async (id: string) => {
    try {
      await fichasService.delete(id);
    } catch (err) {
      console.error('Error eliminando ficha:', err);
      throw err;
    }
  }, []);

  const changeEstado = useCallback(async (
    id: string,
    estadoAnterior: EstadoFicha,
    estadoNuevo: EstadoFicha,
    nota: string,
    extras?: { otNumber?: string; reporteTecnico?: string }
  ) => {
    try {
      await fichasService.addHistorial(id, {
        fecha: new Date().toISOString(),
        estadoAnterior,
        estadoNuevo,
        nota,
        otNumber: extras?.otNumber ?? null,
        reporteTecnico: extras?.reporteTecnico ?? null,
        creadoPor: 'admin',
      });
    } catch (err) {
      console.error('Error cambiando estado ficha:', err);
      throw err;
    }
  }, []);

  return {
    fichas, loading, error,
    listFichas, getFicha, saveFicha, deleteFicha, changeEstado,
  };
}
