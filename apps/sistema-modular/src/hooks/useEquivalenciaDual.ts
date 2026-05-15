import { useCallback, useEffect, useState } from 'react';
import { articulosService } from '../services/firebaseService';
import { findOrigenDeDestino } from '../services/equivalenciasService';
import type { Articulo } from '@ags/shared';

type Mode = 'origen' | 'destino' | 'loading' | 'none';

interface UseEquivalenciaDualResult {
  mode: Mode;
  origenArticulo: Articulo | null;
  destinoArticulo: Articulo | null;
  factor: number;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Derives dual equivalencia state for an artículo.
 *
 * Mode semantics (M5 fix — prevents flicker null → loading → destino):
 * - 'loading': in-flight AND no equivalencia data resolved yet
 * - 'origen':  articulo.equivalencias?.[0] exists (known sync from articulo prop)
 * - 'destino': no local equivalencias but a remote origen pointing here was found
 * - 'none':    discovery complete, no equivalencia on either side
 *
 * The parent MUST check mode === 'loading' BEFORE mode === 'none'.
 */
export function useEquivalenciaDual(articulo: Articulo | null): UseEquivalenciaDualResult {
  const [origenFetched, setOrigenFetched] = useState<Articulo | null>(null);
  const [destinoFetched, setDestinoFetched] = useState<Articulo | null>(null);
  // discoveryDone: true once findOrigenDeDestino has resolved (prevents 'none' during in-flight)
  const [discoveryDone, setDiscoveryDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const refresh = useCallback(() => setRefreshTick(t => t + 1), []);

  useEffect(() => {
    if (!articulo) {
      setOrigenFetched(null);
      setDestinoFetched(null);
      setDiscoveryDone(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setDiscoveryDone(false);
    setOrigenFetched(null);
    setDestinoFetched(null);

    let cancelled = false;

    (async () => {
      try {
        const equivalencia = articulo.equivalencias?.[0];
        if (equivalencia) {
          // Mode: origen — fetch the destino article for stock display
          const destino = await articulosService.getById(equivalencia.articuloIdDestino);
          if (!cancelled) setDestinoFetched(destino);
        } else {
          // Maybe this articulo is a destino — query reverse
          const origen = await findOrigenDeDestino(articulo.id);
          if (!cancelled) setOrigenFetched(origen);
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) {
          setLoading(false);
          setDiscoveryDone(true);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [articulo?.id, refreshTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derive mode in render path ────────────────────────────────────────────
  if (!articulo) {
    return { mode: 'none', origenArticulo: null, destinoArticulo: null, factor: 0, loading, error, refresh };
  }

  const equivalencia = articulo.equivalencias?.[0];

  if (equivalencia) {
    // Mode: origen — known synchronously; no flicker regardless of destinoFetched state
    return {
      mode: 'origen',
      origenArticulo: articulo,
      destinoArticulo: destinoFetched,  // may still be null while in-flight; parent shows placeholder
      factor: equivalencia.factor,
      loading,
      error,
      refresh,
    };
  }

  if (origenFetched) {
    const eq = origenFetched.equivalencias?.[0];
    return {
      mode: 'destino',
      origenArticulo: origenFetched,
      destinoArticulo: articulo,
      factor: eq?.factor ?? 0,
      loading,
      error,
      refresh,
    };
  }

  // No equivalencia on this articulo AND no origen pointing here yet.
  // If discovery is NOT yet done → return 'loading' (M5 fix — never return 'none' during in-flight).
  // If discovery IS done and there is no origen → return 'none' (terminal state).
  if (!discoveryDone) {
    return { mode: 'loading', origenArticulo: null, destinoArticulo: null, factor: 0, loading: true, error, refresh };
  }
  return { mode: 'none', origenArticulo: null, destinoArticulo: null, factor: 0, loading: false, error, refresh };
}
