import { useState, useCallback } from 'react';
import { instrumentosService } from '../services/firebaseService';
import type { InstrumentoPatron, CategoriaInstrumento, CategoriaPatron } from '@ags/shared';

interface InstrumentoFilters {
  tipo?: 'instrumento' | 'patron';
  categoria?: CategoriaInstrumento | CategoriaPatron;
  activoOnly?: boolean;
}

export function useInstrumentos() {
  const [instrumentos, setInstrumentos] = useState<InstrumentoPatron[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listInstrumentos = useCallback(async (filters?: InstrumentoFilters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await instrumentosService.getAll(filters);
      setInstrumentos(data);
    } catch (err) {
      console.error('Error cargando instrumentos:', err);
      setError('Error al cargar los instrumentos');
    } finally {
      setLoading(false);
    }
  }, []);

  const getInstrumento = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      return await instrumentosService.getById(id);
    } catch (err) {
      console.error('Error cargando instrumento:', err);
      setError('Error al cargar el instrumento');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const saveInstrumento = useCallback(async (
    data: Omit<InstrumentoPatron, 'id' | 'createdAt' | 'updatedAt'>,
    id?: string,
  ): Promise<string> => {
    try {
      if (id) {
        await instrumentosService.update(id, data);
        return id;
      }
      return await instrumentosService.create(data);
    } catch (err) {
      console.error('Error guardando instrumento:', err);
      throw err;
    }
  }, []);

  const deactivateInstrumento = useCallback(async (id: string) => {
    try {
      await instrumentosService.deactivate(id);
    } catch (err) {
      console.error('Error desactivando instrumento:', err);
      throw err;
    }
  }, []);

  const deleteInstrumento = useCallback(async (id: string) => {
    try {
      await instrumentosService.delete(id);
    } catch (err) {
      console.error('Error eliminando instrumento:', err);
      throw err;
    }
  }, []);

  const uploadCertificado = useCallback(async (instrumentoId: string, file: File) => {
    try {
      return await instrumentosService.uploadCertificado(instrumentoId, file);
    } catch (err) {
      console.error('Error subiendo certificado:', err);
      throw err;
    }
  }, []);

  const uploadTrazabilidad = useCallback(async (instrumentoId: string, file: File) => {
    try {
      return await instrumentosService.uploadTrazabilidad(instrumentoId, file);
    } catch (err) {
      console.error('Error subiendo trazabilidad:', err);
      throw err;
    }
  }, []);

  return {
    instrumentos,
    loading,
    error,
    listInstrumentos,
    getInstrumento,
    saveInstrumento,
    deactivateInstrumento,
    deleteInstrumento,
    uploadCertificado,
    uploadTrazabilidad,
  };
}
