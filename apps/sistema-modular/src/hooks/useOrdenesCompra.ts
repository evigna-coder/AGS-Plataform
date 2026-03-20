import { useState, useCallback } from 'react';
import { ordenesCompraService } from '../services/firebaseService';
import type { OrdenCompra } from '@ags/shared';

interface OCFilters {
  estado?: string;
  tipo?: string;
  proveedorId?: string;
}

export function useOrdenesCompra() {
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOrdenes = useCallback(async (filters?: OCFilters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await ordenesCompraService.getAll(filters);
      setOrdenes(data);
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
    ordenes, loading, error,
    loadOrdenes, createOrden, updateOrden, deleteOrden,
  };
}
