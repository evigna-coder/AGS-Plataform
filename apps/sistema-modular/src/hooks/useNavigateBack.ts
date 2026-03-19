import { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Navigates to the module root (e.g. /clientes, /stock/articulos).
 * Unlike navigate(-1), this is deterministic and doesn't depend on
 * browser history — so tabs can't interfere with each other.
 *
 * For /stock sub-modules, goes to the sub-module root:
 *   /stock/articulos/abc123   → /stock/articulos
 *   /stock/ordenes-compra/x/y → /stock/ordenes-compra
 *
 * For everything else, goes to the top-level module:
 *   /clientes/abc123           → /clientes
 *   /table-catalog/abc/edit    → /table-catalog
 *   /presupuestos/nuevo        → /presupuestos
 */
export function useNavigateBack() {
  const navigate = useNavigate();
  const { pathname, state } = useLocation();

  return useCallback(() => {
    // If the caller passed { from: '/some/path' } via Link state, go back there
    if (state?.from && typeof state.from === 'string') {
      navigate(state.from);
      return;
    }

    const segments = pathname.split('/').filter(Boolean);
    if (segments.length <= 1) return; // already at module root

    // /stock sub-modules have 2-segment roots: /stock/articulos, /stock/remitos, etc.
    if (segments[0] === 'stock' && segments.length > 2) {
      navigate('/' + segments[0] + '/' + segments[1]);
      return;
    }

    // Everything else: go to /<module>
    navigate('/' + segments[0]);
  }, [navigate, pathname, state]);
}
