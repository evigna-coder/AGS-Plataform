import { useCallback, useMemo } from 'react';
import type { Articulo } from '@ags/shared';

interface Params {
  articulos: Articulo[];
  searchTerm: string;
}

interface Result {
  /** O(1) reverse map: destino articuloId → origen Articulo. */
  destinoLookup: Map<string, Articulo>;
  /** True if the article has either side of a 1→1 equivalencia link. */
  hasEquivalencia: (a: Articulo) => boolean;
  /**
   * True only when the search term is an exact match (case-insensitive) for
   * either the articulo.codigo or its linked partner's codigo, AND the row
   * has an equivalencia. Exact-match-only is intentional per CONTEXT spec —
   * prevents every linked row from exploding into dual cards simultaneously.
   */
  shouldExpandRow: (a: Articulo) => boolean;
}

/**
 * Phase 13 STKE-07 — hook owning the equivalencia expansion logic for ArticulosList.
 *
 * Extracted UNCONDITIONALLY from ArticulosList.tsx (m3 fix) — not a "if-LOC-budget"
 * conditional extraction. Keeps the list page rendering pure and the logic testable.
 *
 * - destinoLookup: built from articulos[]; articles with articuloIdDestinoEquivalencia
 *   are indexed by that id, enabling fast O(1) destino→origen resolution.
 * - hasEquivalencia: covers both directions (origen has equivalencias[], destino is
 *   referenced by articuloIdDestinoEquivalencia on the origen).
 * - shouldExpandRow: exact-match-only (prevents visual stampede).
 */
export function useEquivalenciaListExpansion({ articulos, searchTerm }: Params): Result {
  const destinoLookup = useMemo<Map<string, Articulo>>(() => {
    const m = new Map<string, Articulo>();
    for (const a of articulos) {
      if (a.articuloIdDestinoEquivalencia) {
        m.set(a.articuloIdDestinoEquivalencia, a);
      }
    }
    return m;
  }, [articulos]);

  const hasEquivalencia = useCallback((a: Articulo): boolean => {
    return !!(a.equivalencias?.length) || destinoLookup.has(a.id);
  }, [destinoLookup]);

  const shouldExpandRow = useCallback((a: Articulo): boolean => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return false;
    // Direct exact match on this article's codigo
    if (a.codigo.toLowerCase() === q) {
      return hasEquivalencia(a);
    }
    // Indirect match via the partner's codigo
    const linkedCode =
      a.equivalencias?.[0]?.articuloCodigoDestino?.toLowerCase() ??
      destinoLookup.get(a.id)?.codigo.toLowerCase();
    return !!linkedCode && linkedCode === q;
  }, [searchTerm, destinoLookup, hasEquivalencia]);

  return { destinoLookup, hasEquivalencia, shouldExpandRow };
}
