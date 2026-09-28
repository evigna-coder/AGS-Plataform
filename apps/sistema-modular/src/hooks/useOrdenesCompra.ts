import { useState, useCallback } from 'react';
import { importacionesService, ordenesCompraService } from '../services/firebaseService';
import type { Importacion, OrdenCompra } from '@ags/shared';

interface OCFilters {
  estado?: string;
  tipo?: string;
  proveedorId?: string;
}

export function useOrdenesCompra() {
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  /**
   * Importaciones por OC (2026-09-28): para marcar en la lista qué OC de
   * importación ya tiene su importación creada. Se deriva de
   * `Importacion.ordenCompraId` (el `importacionId` de la OC nunca se escribe);
   * las canceladas no cuentan.
   */
  const [importacionesPorOC, setImportacionesPorOC] = useState<Map<string, Importacion[]>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOrdenes = useCallback(async (filters?: OCFilters) => {
    setLoading(true);
    setError(null);
    try {
      const [data, importaciones] = await Promise.all([
        ordenesCompraService.getAll(filters),
        importacionesService.getAll().catch(err => { console.error('[useOrdenesCompra] importaciones:', err); return [] as Importacion[]; }),
      ]);
      setOrdenes(data);
      const porOC = new Map<string, Importacion[]>();
      for (const imp of importaciones) {
        if (!imp.ordenCompraId || imp.estado === 'cancelado') continue;
        porOC.set(imp.ordenCompraId, [...(porOC.get(imp.ordenCompraId) ?? []), imp]);
      }
      setImportacionesPorOC(porOC);
    } catch (err) {
      console.error('Error listando órdenes de compra:', err);
      setError('Error al cargar órdenes de compra');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createOrden = useCallback(async (data: Omit<OrdenCompra, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      return await ordenesCompraService.create(data);
    } catch (err) {
      console.error('Error creando orden de compra:', err);
      throw err;
    }
  }, []);

  const updateOrden = useCallback(async (id: string, data: Partial<OrdenCompra>) => {
    try {
      await ordenesCompraService.update(id, data);
    } catch (err) {
      console.error('Error actualizando orden de compra:', err);
      throw err;
    }
  }, []);

  const deleteOrden = useCallback(async (id: string) => {
    try {
      await ordenesCompraService.delete(id);
    } catch (err) {
      console.error('Error eliminando orden de compra:', err);
      throw err;
    }
  }, []);

  return {
    ordenes, importacionesPorOC, loading, error,
    loadOrdenes, createOrden, updateOrden, deleteOrden,
  };
}
