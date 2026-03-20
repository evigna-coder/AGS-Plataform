import { useState, useCallback } from 'react';
import { articulosService, unidadesService, movimientosService } from '../services/firebaseService';
import type { Articulo, UnidadStock, MovimientoStock } from '@ags/shared';

interface ArticuloFilters {
  categoriaEquipo?: string;
  marcaId?: string;
  tipo?: string;
  activoOnly?: boolean;
}

interface UnidadFilters {
  articuloId?: string;
  estado?: string;
  condicion?: string;
  activoOnly?: boolean;
}

export function useStock() {
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [unidades, setUnidades] = useState<UnidadStock[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoStock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Artículos ---

  const listArticulos = useCallback(async (filters?: ArticuloFilters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await articulosService.getAll(filters);
      setArticulos(data);
    } catch (err) {
      console.error('Error listando artículos:', err);
      setError('Error al cargar artículos');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getArticulo = useCallback(async (id: string) => {
    try {
      return await articulosService.getById(id);
    } catch (err) {
      console.error('Error obteniendo artículo:', err);
      throw err;
    }
  }, []);

  const saveArticulo = useCallback(async (data: Omit<Articulo, 'id' | 'createdAt' | 'updatedAt'>, id?: string) => {
    try {
      if (id) {
        await articulosService.update(id, data);
        return id;
      }
      return await articulosService.create(data);
    } catch (err) {
      console.error('Error guardando artículo:', err);
      throw err;
    }
  }, []);

  const deactivateArticulo = useCallback(async (id: string) => {
    try {
      await articulosService.deactivate(id);
    } catch (err) {
      console.error('Error desactivando artículo:', err);
      throw err;
    }
  }, []);

  const deleteArticulo = useCallback(async (id: string) => {
    try {
      await articulosService.delete(id);
    } catch (err) {
      console.error('Error eliminando artículo:', err);
      throw err;
    }
  }, []);

  // --- Unidades ---

  const listUnidades = useCallback(async (filters?: UnidadFilters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await unidadesService.getAll(filters);
      setUnidades(data);
    } catch (err) {
      console.error('Error listando unidades:', err);
      setError('Error al cargar unidades');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const saveUnidad = useCallback(async (data: Omit<UnidadStock, 'id' | 'createdAt' | 'updatedAt'>, id?: string) => {
    try {
      if (id) {
        await unidadesService.update(id, data);
        return id;
      }
      return await unidadesService.create(data);
    } catch (err) {
      console.error('Error guardando unidad:', err);
      throw err;
    }
  }, []);

  // --- Movimientos ---

  const listMovimientos = useCallback(async (filters?: { articuloId?: string; unidadId?: string; tipo?: string; limitCount?: number }) => {
    setLoading(true);
    setError(null);
    try {
      const data = await movimientosService.getAll(filters);
      setMovimientos(data);
    } catch (err) {
      console.error('Error listando movimientos:', err);
      setError('Error al cargar movimientos');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createMovimiento = useCallback(async (data: Omit<MovimientoStock, 'id' | 'createdAt'>) => {
    try {
      return await movimientosService.create(data);
    } catch (err) {
      console.error('Error creando movimiento:', err);
      throw err;
    }
  }, []);

  return {
    articulos, unidades, movimientos, loading, error,
    listArticulos, getArticulo, saveArticulo, deactivateArticulo, deleteArticulo,
    listUnidades, saveUnidad,
    listMovimientos, createMovimiento,
  };
}
