import { useState, useCallback } from 'react';
import { tableCatalogService } from '../services/firebaseService';
import type { TableCatalogEntry } from '@ags/shared';

interface TableFilters {
  sysType?: string;
  status?: string;
  projectId?: string | null;
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

  // Optimistic: actualiza status localmente y escribe a Firebase en background
  const publishTable = useCallback(async (id: string) => {
    setTables(prev => prev.map(t => t.id === id ? { ...t, status: 'published' as const } : t));
    tableCatalogService.publish(id).catch(err => {
      console.error('Error publicando tabla:', err);
      setTables(prev => prev.map(t => t.id === id ? { ...t, status: 'draft' as const } : t));
    });
  }, []);

  const archiveTable = useCallback(async (id: string) => {
    setTables(prev => prev.map(t => t.id === id ? { ...t, status: 'archived' as const } : t));
    tableCatalogService.archive(id).catch(err => {
      console.error('Error archivando tabla:', err);
      setTables(prev => prev.map(t => t.id === id ? { ...t, status: 'draft' as const } : t));
    });
  }, []);

  const cloneTable = useCallback(async (id: string, overrides?: { name?: string; sysType?: string; projectId?: string | null }) => {
    try {
      return await tableCatalogService.clone(id, overrides);
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

  // Optimistic: quitar de la lista local y borrar en background
  const deleteTable = useCallback(async (id: string) => {
    const backup = tables;
    setTables(prev => prev.filter(t => t.id !== id));
    tableCatalogService.delete(id).catch(err => {
      console.error('Error eliminando tabla:', err);
      setTables(backup);
    });
  }, [tables]);

  // Optimistic: actualizar projectId localmente y escribir en background
  const assignProject = useCallback(async (tableIds: string[], projectId: string | null) => {
    setTables(prev => prev.map(t => tableIds.includes(t.id) ? { ...t, projectId } : t));
    tableCatalogService.assignProject(tableIds, projectId).catch(err => {
      console.error('Error asignando proyecto:', err);
    });
  }, []);

  const bulkAddModelosToProject = useCallback(
    async (projectId: string, modelosToAdd: string[]) => {
      return tableCatalogService.bulkAddModelosToProject(projectId, modelosToAdd);
    },
    [],
  );

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
    assignProject,
    bulkAddModelosToProject,
  };
}
