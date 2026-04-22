import { useEffect, useState } from 'react';
import type { StockAmplio, Articulo } from '@ags/shared';
import { articulosService } from '../services/stockService';
import { computeStockAmplio } from '../services/stockAmplioService';

export interface UseStockAmplioResult {
  stockAmplio: StockAmplio | null;
  loading: boolean;
  source: 'firestore' | 'computed' | null;
  error: Error | null;
}

/**
 * Live hook for per-articulo extended stock position.
 * Priority: artículo.resumenStock (populated by CF 09-02) → client-side computeStockAmplio() fallback.
 * Uses onSnapshot via articulosService.subscribeById — NEVER serviceCache.ts.
 */
export function useStockAmplio(articuloId: string | null): UseStockAmplioResult {
  const [state, setState] = useState<UseStockAmplioResult>({
    stockAmplio: null,
    loading: true,
    source: null,
    error: null,
  });

  useEffect(() => {
    if (!articuloId) {
      setState({ stockAmplio: null, loading: false, source: null, error: null });
      return;
    }

    setState(s => ({ ...s, loading: true, error: null }));
    let disposed = false;

    const unsub = articulosService.subscribeById(
      articuloId,
      async (art: Articulo | null) => {
        if (disposed) return;

        if (art?.resumenStock) {
          setState({
            stockAmplio: art.resumenStock,
            loading: false,
            source: 'firestore',
            error: null,
          });
          return;
        }

        // Fallback: compute client-side when resumenStock not yet populated by CF
        try {
          const computed = await computeStockAmplio(articuloId);
          if (!disposed) {
            setState({ stockAmplio: computed, loading: false, source: 'computed', error: null });
          }
        } catch (err) {
          if (!disposed) {
            setState(s => ({ ...s, loading: false, error: err as Error }));
          }
        }
      },
    );

    return () => {
      disposed = true;
      unsub();
    };
  }, [articuloId]);

  return state;
}
