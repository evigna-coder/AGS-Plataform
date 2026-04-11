import { useState, useCallback } from 'react';
import { columnasService } from '../services/firebaseService';
import type { Columna, CategoriaPatron } from '@ags/shared';

interface ColumnaFilters {
  categoria?: CategoriaPatron;
  activoOnly?: boolean;
}

export function useColumnas() {
  const [columnas, setColumnas] = useState<Columna[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listColumnas = useCallback(async (filters?: ColumnaFilters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await columnasService.getAll(filters);
      setColumnas(data);
    } catch (err) {
      console.error('Error cargando columnas:', err);
      setError('Error al cargar las columnas');
    } finally {
      setLoading(false);
    }
  }, []);

  const getColumna = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      return await columnasService.getById(id);
    } catch (err) {
      console.error('Error cargando columna:', err);
      setError('Error al cargar la columna');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const saveColumna = useCallback(async (
    data: Omit<Columna, 'id' | 'createdAt' | 'updatedAt'>,
    id?: string,
  ): Promise<string> => {
    try {
      if (id) {
        await columnasService.update(id, data);
        return id;
      }
      return await columnasService.create(data);
    } catch (err) {
      console.error('Error guardando columna:', err);
      throw err;
    }
  }, []);

  const deactivateColumna = useCallback(async (id: string) => {
    try {
      await columnasService.deactivate(id);
    } catch (err) {
      console.error('Error desactivando columna:', err);
      throw err;
    }
  }, []);

  const deleteColumna = useCallback(async (id: string) => {
    try {
      await columnasService.delete(id);
    } catch (err) {
      console.error('Error eliminando columna:', err);
      throw err;
    }
  }, []);

  const uploadCertificadoSerie = useCallback(async (columnaId: string, serieIdx: number, file: File) => {
    try {
      return await columnasService.uploadCertificadoSerie(columnaId, serieIdx, file);
    } catch (err) {
      console.error('Error subiendo certificado de serie:', err);
      throw err;
    }
  }, []);

  return {
    columnas,
    loading,
    error,
    listColumnas,
    getColumna,
    saveColumna,
    deactivateColumna,
    deleteColumna,
    uploadCertificadoSerie,
  };
}
