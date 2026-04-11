import { useState, useCallback } from 'react';
import { patronesService } from '../services/firebaseService';
import type { Patron, CategoriaPatron } from '@ags/shared';

interface PatronFilters {
  categoria?: CategoriaPatron;
  activoOnly?: boolean;
}

export function usePatrones() {
  const [patrones, setPatrones] = useState<Patron[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listPatrones = useCallback(async (filters?: PatronFilters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await patronesService.getAll(filters);
      setPatrones(data);
    } catch (err) {
      console.error('Error cargando patrones:', err);
      setError('Error al cargar los patrones');
    } finally {
      setLoading(false);
    }
  }, []);

  const getPatron = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      return await patronesService.getById(id);
    } catch (err) {
      console.error('Error cargando patrón:', err);
      setError('Error al cargar el patrón');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const savePatron = useCallback(async (
    data: Omit<Patron, 'id' | 'createdAt' | 'updatedAt'>,
    id?: string,
  ): Promise<string> => {
    try {
      if (id) {
        await patronesService.update(id, data);
        return id;
      }
      return await patronesService.create(data);
    } catch (err) {
      console.error('Error guardando patrón:', err);
      throw err;
    }
  }, []);

  const deactivatePatron = useCallback(async (id: string) => {
    try {
      await patronesService.deactivate(id);
    } catch (err) {
      console.error('Error desactivando patrón:', err);
      throw err;
    }
  }, []);

  const deletePatron = useCallback(async (id: string) => {
    try {
      await patronesService.delete(id);
    } catch (err) {
      console.error('Error eliminando patrón:', err);
      throw err;
    }
  }, []);

  const uploadCertificadoLote = useCallback(async (patronId: string, loteIdx: number, file: File) => {
    try {
      return await patronesService.uploadCertificadoLote(patronId, loteIdx, file);
    } catch (err) {
      console.error('Error subiendo certificado de lote:', err);
      throw err;
    }
  }, []);

  return {
    patrones,
    loading,
    error,
    listPatrones,
    getPatron,
    savePatron,
    deactivatePatron,
    deletePatron,
    uploadCertificadoLote,
  };
}
