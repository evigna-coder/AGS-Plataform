import { useState, useCallback } from 'react';
import { reservasService } from '../services/stockService';
import type { UnidadStock } from '@ags/shared';

export interface ReservarParams {
  unidadId: string;
  unidad: UnidadStock;
  presupuestoId: string;
  presupuestoNumero: string;
  clienteId: string;
  clienteNombre: string;
  solicitadoPorNombre: string;
}

export interface LiberarParams {
  unidadId: string;
  unidad: UnidadStock;
  motivo: string;
  solicitadoPorNombre: string;
  destino?: { tipo: 'posicion' | 'minikit' | 'ingeniero'; referenciaId: string; referenciaNombre: string };
}

export function useReservaStock() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reservar = useCallback(async (params: ReservarParams): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await reservasService.reservar(params);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al reservar stock';
      setError(msg);
      console.error('[useReservaStock] reservar:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const liberar = useCallback(async (params: LiberarParams): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await reservasService.liberar(params);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al liberar reserva';
      setError(msg);
      console.error('[useReservaStock] liberar:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { reservar, liberar, loading, error };
}
