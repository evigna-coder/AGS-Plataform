import { useState, useCallback } from 'react';
import { tableCatalogService } from '../services/firebaseService';
import type { TableCatalogEntry } from '@ags/shared';

interface TableFilters {
  sysType?: string;
  status?: string;
}

export function useTableCatalog() {
  const [tables, setTables] = useState<TableCatalogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listTables = useCallback(async (filters?: TableFilters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await tableCatalogService.getAll(filters);
      setTables(data);
    } catch (err) {
      console.error('Error cargando tablas:', err);
      setError('Error al cargar las tablas');
    } finally {
      setLoading(false);
    }
  }, []);

  const getTable = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      return await tableCatalogService.getById(id);
    } catch (err) {
      console.error('Error cargando tabla:', err);
      setError('Error al cargar la tabla');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const saveDraft = useCallback(async (entry: TableCatalogEntry) => {
    try {
      return await tableCatalogService.save({ ...entry, status: 'draft' });
    } catch (err) {
      console.error('Error guardando borrador:', err);
      throw err;
    }
  }, []);

  const publishTable = useCallback(async (id: string) => {
    try {
      await tableCatalogService.publish(id);
    } catch (err) {
      console.error('Error publicando tabla:', err);
      throw err;
    }
  }, []);

  const archiveTable = useCallback(async (id: string) => {
    try {
      await tableCatalogService.archive(id);
    } catch (err) {
      console.error('Error archivando tabla:', err);
      throw err;
    }
  }, []);

  const cloneTable = useCallback(async (id: string) => {
    try {
      return await tableCatalogService.clone(id);
    } catch (err) {
      console.error('Error clonando tabla:', err);
      throw err;
    }
  }, []);

  const importTables = useCallback(async (entries: TableCatalogEntry[]) => {
    try {
      return await tableCatalogService.saveMany(entries);
    } catch (err) {
      console.error('Error importando tablas:', err);
      throw err;
    }
  }, []);

  const deleteTable = useCallback(async (id: string) => {
    try {
      await tableCatalogService.delete(id);
    } catch (err) {
      console.error('Error eliminando tabla:', err);
      throw err;
    }
  }, []);

  return {
    tables,
    loading,
    error,
    listTables,
    getTable,
    saveDraft,
    publishTable,
    archiveTable,
    cloneTable,
    importTables,
    deleteTable,
  };
}
