import { useCallback, useEffect, useMemo, useState } from 'react';
import { unidadesService } from '../services/stockService';
import { desagregarUnidades } from '../services/equivalenciasService';
import { useAuth } from '../contexts/AuthContext';
import type { Articulo, UbicacionStock, UnidadStock } from '@ags/shared';

interface Params {
  articulo: Articulo | null;
  open: boolean;
}

interface UbicacionGroup {
  value: string;       // referenciaId — unique key
  label: string;       // "Posición A1 — 5 disponibles"
  stockDisponible: number;
  ubicacion: UbicacionStock;
}

export function useDesagregarStock({ articulo, open }: Params) {
  const auth = useAuth();
  const solicitadoPorNombre =
    auth.usuario?.displayName || auth.firebaseUser?.displayName || 'unknown';

  const [ubicacionGroups, setUbicacionGroups] = useState<UbicacionGroup[]>([]);
  const [loadingUbicaciones, setLoadingUbicaciones] = useState(false);
  const [selectedUbicacionId, setSelectedUbicacionId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<{
    cantidadOrigen: number;
    cantidadDestino: number;
    movimientoId: string;
  } | null>(null);

  const factor = articulo?.equivalencias?.[0]?.factor ?? 0;

  const reset = useCallback(() => {
    setSelectedUbicacionId('');
    setCantidad('');
    setError(null);
    setSuccessMessage(null);
  }, []);

  // Load disponible unidades grouped by ubicacion when the modal opens
  useEffect(() => {
    if (!open || !articulo) return;
    reset();
    setLoadingUbicaciones(true);
    unidadesService
      .getAll({ articuloId: articulo.id, estado: 'disponible', activoOnly: true })
      .then((all: UnidadStock[]) => {
        // Group by ubicacion.referenciaId
        const grouped = new Map<string, UbicacionGroup>();
        for (const u of all) {
          const key = u.ubicacion.referenciaId;
          const existing = grouped.get(key);
          if (existing) {
            existing.stockDisponible += 1;
          } else {
            grouped.set(key, {
              value: key,
              label: '',  // filled below after count is final
              stockDisponible: 1,
              ubicacion: u.ubicacion,
            });
          }
        }
        const list = Array.from(grouped.values()).map(g => ({
          ...g,
          label: `${g.ubicacion.referenciaNombre} — ${g.stockDisponible} disponibles`,
        }));
        list.sort((a, b) =>
          a.ubicacion.referenciaNombre.localeCompare(b.ubicacion.referenciaNombre),
        );
        setUbicacionGroups(list);
      })
      .catch((e: unknown) => setError((e as Error)?.message ?? String(e)))
      .finally(() => setLoadingUbicaciones(false));
  }, [open, articulo, reset]);

  const selectedUbicacion = useMemo(
    () => ubicacionGroups.find(g => g.value === selectedUbicacionId) ?? null,
    [ubicacionGroups, selectedUbicacionId],
  );

  const cantidadNum = useMemo(() => {
    const n = Number.parseInt(cantidad, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [cantidad]);

  const cantidadDestinoPreview = useMemo(
    () => cantidadNum * factor,
    [cantidadNum, factor],
  );

  const canConfirm = useMemo(
    () =>
      !!articulo &&
      !!selectedUbicacion &&
      cantidadNum > 0 &&
      cantidadNum <= selectedUbicacion.stockDisponible &&
      factor > 0,
    [articulo, selectedUbicacion, cantidadNum, factor],
  );

  const confirm = useCallback(async () => {
    if (!articulo || !selectedUbicacion) return;
    setError(null);
    setConfirming(true);
    try {
      const result = await desagregarUnidades({
        articuloOrigenId: articulo.id,
        cantidad: cantidadNum,
        ubicacion: selectedUbicacion.ubicacion,
        solicitadoPorNombre,
      });
      setSuccessMessage({
        cantidadOrigen: cantidadNum,
        cantidadDestino: result.cantidadDestino,
        movimientoId: result.movimientoId,
      });
    } catch (e: unknown) {
      setError((e as Error)?.message ?? 'Error al desagregar');
    } finally {
      setConfirming(false);
    }
  }, [articulo, selectedUbicacion, cantidadNum, solicitadoPorNombre]);

  return {
    ubicacionOptions: ubicacionGroups,
    loadingUbicaciones,
    selectedUbicacionId,
    setSelectedUbicacionId,
    cantidad,
    setCantidad,
    selectedUbicacion,
    cantidadNum,
    factor,
    cantidadDestinoPreview,
    confirming,
    error,
    successMessage,
    canConfirm,
    reset,
    confirm,
  };
}
