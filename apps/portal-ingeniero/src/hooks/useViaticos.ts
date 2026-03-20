import { useState, useEffect, useCallback } from 'react';
import type { ViaticoPeriodo, GastoViatico, MedioPago } from '@ags/shared';
import { viaticosService } from '../services/firebaseService';
import { useAuth } from '../contexts/AuthContext';

export function useViaticos() {
  const { usuario } = useAuth();
  const [periodo, setPeriodo] = useState<ViaticoPeriodo | null>(null);
  const [historial, setHistorial] = useState<ViaticoPeriodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPeriodo = useCallback(async () => {
    if (!usuario) return;
    try {
      setLoading(true);
      setError(null);
      const p = await viaticosService.getOrCreatePeriodoActual(usuario.id, usuario.displayName);
      setPeriodo(p);
    } catch (err) {
      console.error('Error cargando viáticos:', err);
      setError('No se pudo cargar el período de viáticos. Verificá que tengas permisos o intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [usuario]);

  const loadHistorial = useCallback(async () => {
    if (!usuario) return;
    try {
      const h = await viaticosService.getHistorial(usuario.id);
      setHistorial(h);
    } catch (err) {
      console.error('Error cargando historial:', err);
    }
  }, [usuario]);

  useEffect(() => { loadPeriodo(); }, [loadPeriodo]);

  const agregarGasto = async (data: { fecha: string; concepto: string; establecimiento?: string; monto: number; medioPago: MedioPago; notas?: string }) => {
    if (!periodo) return;
    setSaving(true);
    try {
      const gasto: GastoViatico = {
        id: crypto.randomUUID(),
        fecha: data.fecha,
        concepto: data.concepto,
        establecimiento: data.establecimiento || null,
        monto: data.monto,
        medioPago: data.medioPago,
        notas: data.notas || null,
      };
      await viaticosService.agregarGasto(periodo.id, gasto);
      await loadPeriodo();
    } catch (err) {
      console.error('Error agregando gasto:', err);
      alert('Error al guardar el gasto');
    } finally {
      setSaving(false);
    }
  };

  const editarGasto = async (gastoId: string, data: { fecha: string; concepto: string; establecimiento?: string; monto: number; medioPago: MedioPago; notas?: string }) => {
    if (!periodo) return;
    setSaving(true);
    try {
      await viaticosService.editarGasto(periodo.id, gastoId, {
        fecha: data.fecha,
        concepto: data.concepto,
        establecimiento: data.establecimiento || null,
        monto: data.monto,
        medioPago: data.medioPago,
        notas: data.notas || null,
      });
      await loadPeriodo();
    } catch (err) {
      console.error('Error editando gasto:', err);
      alert('Error al editar el gasto');
    } finally {
      setSaving(false);
    }
  };

  const eliminarGasto = async (gastoId: string) => {
    if (!periodo) return;
    setSaving(true);
    try {
      await viaticosService.eliminarGasto(periodo.id, gastoId);
      await loadPeriodo();
    } catch (err) {
      console.error('Error eliminando gasto:', err);
    } finally {
      setSaving(false);
    }
  };

  const enviarPeriodo = async () => {
    if (!periodo || periodo.gastos.length === 0) return;
    setSaving(true);
    try {
      await viaticosService.enviarPeriodo(periodo.id);
      await loadPeriodo();
    } catch (err) {
      console.error('Error enviando período:', err);
      alert('Error al enviar los viáticos');
    } finally {
      setSaving(false);
    }
  };

  return { periodo, historial, loading, saving, error, agregarGasto, editarGasto, eliminarGasto, enviarPeriodo, loadHistorial, retry: loadPeriodo };
}
