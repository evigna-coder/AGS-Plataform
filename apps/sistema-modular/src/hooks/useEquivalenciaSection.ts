import { useCallback, useEffect, useMemo, useState } from 'react';
import { articulosService } from '../services/firebaseService';
import { linkEquivalencia, unlinkEquivalencia } from '../services/equivalenciasService';
import type { Articulo, ArticuloEquivalencia } from '@ags/shared';

interface UseEquivalenciaSectionParams {
  articuloId: string | null;
  articulo: Articulo | null;
  onMutated?: () => void;
}

export function useEquivalenciaSection({
  articuloId,
  articulo,
  onMutated,
}: UseEquivalenciaSectionParams) {
  const [articulosDestino, setArticulosDestino] = useState<Articulo[]>([]);
  const [loadingArticulos, setLoadingArticulos] = useState(false);
  const [selectedDestinoId, setSelectedDestinoId] = useState('');
  const [factor, setFactor] = useState('');
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derived from the loaded articulo — at most one equivalencia in v1
  const currentEquivalencia: ArticuloEquivalencia | null = useMemo(
    () => articulo?.equivalencias?.[0] ?? null,
    [articulo],
  );

  // Load destination candidates once when articuloId becomes available
  useEffect(() => {
    if (!articuloId) return;
    setLoadingArticulos(true);
    articulosService
      .getAll({ activoOnly: true })
      .then(all => {
        // Filter: exclude self, and any artículo already used as a destination
        // (articuloIdDestinoEquivalencia null/undefined = not a destination yet)
        const filtered = all.filter(
          a =>
            a.id !== articuloId &&
            !a.articuloIdDestinoEquivalencia,
        );
        setArticulosDestino(filtered);
      })
      .catch(err => setError((err as Error).message ?? String(err)))
      .finally(() => setLoadingArticulos(false));
  }, [articuloId]);

  const link = useCallback(async () => {
    if (!articuloId) return;
    setError(null);
    if (!selectedDestinoId) {
      setError('Seleccioná un artículo destino');
      return;
    }
    const parsed = Number.parseFloat(factor.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Factor inválido. Debe ser número > 0');
      return;
    }
    setLinking(true);
    try {
      await linkEquivalencia(articuloId, selectedDestinoId, parsed);
      setSelectedDestinoId('');
      setFactor('');
      onMutated?.();
    } catch (e) {
      setError((e as Error)?.message ?? 'Error al vincular');
    } finally {
      setLinking(false);
    }
  }, [articuloId, selectedDestinoId, factor, onMutated]);

  const unlink = useCallback(async () => {
    if (!articuloId) return;
    setError(null);
    setUnlinking(true);
    try {
      await unlinkEquivalencia(articuloId);
      onMutated?.();
    } catch (e) {
      setError((e as Error)?.message ?? 'Error al desvincular');
    } finally {
      setUnlinking(false);
    }
  }, [articuloId, onMutated]);

  const clearError = useCallback(() => setError(null), []);

  return {
    currentEquivalencia,
    articulosDestino,
    loadingArticulos,
    selectedDestinoId,
    setSelectedDestinoId,
    factor,
    setFactor,
    linking,
    unlinking,
    error,
    clearError,
    link,
    unlink,
  };
}
