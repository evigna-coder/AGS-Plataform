import { useState, useCallback, useRef } from 'react';
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

  // Pedido vigente (revisión 2026-10-01): al cambiar rápido de proyecto, una
  // respuesta vieja que llegaba última pisaba la lista del proyecto actual.
  const pedidoVigente = useRef(0);
  const listTables = useCallback(async (filters?: TableFilters) => {
    const pedido = ++pedidoVigente.current;
    setLoading(true);
    setError(null);
    try {
      const data = await tableCatalogService.getAll(filters);
      if (pedido !== pedidoVigente.current) return;
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

  /**
   * Guarda respetando el estado actual. Para una tabla PUBLICADA esto evita que
   * "guardar" la despublique sin aviso (saveDraft fuerza borrador).
   */
  const saveKeepingStatus = useCallback(async (entry: TableCatalogEntry) => {
    return tableCatalogService.save(entry);
  }, []);

  /** Recarga sin mostrar el estado "Cargando" (al volver a la pestaña). */
  const refreshTables = useCallback(async (filters?: TableFilters) => {
    try { setTables(await tableCatalogService.getAll(filters)); } catch (err) { console.error('Error refrescando tablas:', err); }
  }, []);

  const publishMany = useCallback(async (ids: string[]) => {
    const set = new Set(ids);
    setTables(prev => prev.map(t => set.has(t.id) ? { ...t, status: 'published' as const } : t));
    await tableCatalogService.publishMany(ids);
  }, []);

  const setListField = useCallback(async (field: 'modelos' | 'tipoServicio', updates: { id: string; values: string[] }[]) => {
    const byId = new Map(updates.map(u => [u.id, u.values]));
    setTables(prev => prev.map(t => byId.has(t.id) ? { ...t, [field]: byId.get(t.id) } : t));
    await tableCatalogService.setListField(field, updates);
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
    saveKeepingStatus,
    refreshTables,
    publishMany,
    setListField,
  };
}
