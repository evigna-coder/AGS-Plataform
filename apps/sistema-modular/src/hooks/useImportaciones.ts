import { useState, useCallback } from 'react';
import { importacionesService } from '../services/firebaseService';
import type { Importacion } from '@ags/shared';

interface ImportacionFilters {
  estado?: string;
}

export function useImportaciones() {
  const [importaciones, setImportaciones] = useState<Importacion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadImportaciones = useCallback(async (filters?: ImportacionFilters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await importacionesService.getAll(filters);
      setImportaciones(data);
    } catch (err) {
      console.error('Error cargando importaciones:', err);
      setError('Error al cargar importaciones');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createImportacion = useCallback(async (data: Omit<Importacion, 'id' | 'numero' | 'createdAt' | 'updatedAt'>) => {
    try {
      return await importacionesService.create(data);
    } catch (err) {
      console.error('Error creando importacion:', err);
      throw err;
    }
  }, []);

  const updateImportacion = useCallback(async (id: string, data: Partial<Importacion>) => {
    try {
      await importacionesService.update(id, data);
    } catch (err) {
      console.error('Error actualizando importacion:', err);
      throw err;
    }
  }, []);

  const deleteImportacion = useCallback(async (id: string) => {
    try {
      await importacionesService.delete(id);
    } catch (err) {
      console.error('Error eliminando importacion:', err);
      throw err;
    }
  }, []);

  return {
    importaciones, loading, error,
    loadImportaciones, createImportacion, updateImportacion, deleteImportacion,
  };
}
