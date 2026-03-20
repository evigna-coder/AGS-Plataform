import { useState, useCallback } from 'react';
import { loanersService } from '../services/firebaseService';
import type { Loaner, PrestamoLoaner, ExtraccionLoaner, VentaLoaner } from '@ags/shared';

interface LoanerFilters {
  estado?: string;
  activoOnly?: boolean;
}

export function useLoaners() {
  const [loaners, setLoaners] = useState<Loaner[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listLoaners = useCallback(async (filters?: LoanerFilters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await loanersService.getAll(filters);
      setLoaners(data);
    } catch (err) {
      console.error('Error listando loaners:', err);
      setError('Error al cargar loaners');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getLoaner = useCallback(async (id: string) => {
    try {
      return await loanersService.getById(id);
    } catch (err) {
      console.error('Error obteniendo loaner:', err);
      throw err;
    }
  }, []);

  const saveLoaner = useCallback(async (
    data: Omit<Loaner, 'id' | 'codigo' | 'createdAt' | 'updatedAt'>,
    id?: string
  ) => {
    try {
      if (id) {
        await loanersService.update(id, data);
        return id;
      }
      return await loanersService.create(data);
    } catch (err) {
      console.error('Error guardando loaner:', err);
      throw err;
    }
  }, []);

  const deleteLoaner = useCallback(async (id: string) => {
    try {
      await loanersService.delete(id);
    } catch (err) {
      console.error('Error eliminando loaner:', err);
      throw err;
    }
  }, []);

  const registrarPrestamo = useCallback(async (
    id: string,
    prestamo: Omit<PrestamoLoaner, 'id'>
  ) => {
    try {
      await loanersService.registrarPrestamo(id, prestamo);
    } catch (err) {
      console.error('Error registrando préstamo:', err);
      throw err;
    }
  }, []);

  const registrarDevolucion = useCallback(async (
    loanerId: string,
    prestamoId: string,
    data: { fechaRetornoReal: string; condicionRetorno: string; remitoRetornoId?: string; remitoRetornoNumero?: string }
  ) => {
    try {
      await loanersService.registrarDevolucion(loanerId, prestamoId, data);
    } catch (err) {
      console.error('Error registrando devolución:', err);
      throw err;
    }
  }, []);

  const registrarExtraccion = useCallback(async (
    id: string,
    extraccion: Omit<ExtraccionLoaner, 'id'>
  ) => {
    try {
      await loanersService.registrarExtraccion(id, extraccion);
    } catch (err) {
      console.error('Error registrando extracción:', err);
      throw err;
    }
  }, []);

  const registrarVenta = useCallback(async (id: string, venta: VentaLoaner) => {
    try {
      await loanersService.registrarVenta(id, venta);
    } catch (err) {
      console.error('Error registrando venta:', err);
      throw err;
    }
  }, []);

  return {
    loaners, loading, error,
    listLoaners, getLoaner, saveLoaner, deleteLoaner,
    registrarPrestamo, registrarDevolucion, registrarExtraccion, registrarVenta,
  };
}
