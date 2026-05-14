import { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTabs } from '../contexts/TabsContext';

/**
 * Navega "hacia atrás" siguiendo la jerarquía semántica, no el history.
 *
 * Orden de prioridad:
 *  1. Parent declarado por el Detail page via `useDeclareParent`. Esto es
 *     el padre jerárquico real (equipo → su establecimiento, establecimiento
 *     → su cliente, etc.) y NO depende del history. Soluciona el loop
 *     equipo↔establecimiento que aparecía cuando se entraba a un mismo
 *     Detail desde distintos referrers.
 *  2. `state.from` del Link — referrer inmediato. Fallback para Detail pages
 *     que no declararon parent.
 *  3. `navigate(-1)` — history del MemoryRouter. Solo para casos sin parent
 *     ni state.from (ej. listados que tienen su botón "Volver" propio).
 *  4. Module root deterministic — si no hay history en absoluto.
 *
 * El parent y el state.from sí preservan filtros: cuando se hace navigate al
 * path completo (con search params si los tiene), React Router restaura la
 * URL completa.
 */
export function useNavigateBack() {
  const navigate = useNavigate();
  const { pathname, state, key } = useLocation();
  const { getActiveTabParent } = useTabs();

  return useCallback(() => {
    // 1. Parent jerárquico declarado por el Detail page.
    const parent = getActiveTabParent();
    if (parent) {
      navigate(parent);
      return;
    }

    // 2. state.from del Link (fallback para pages que no declararon parent).
    if (state?.from && typeof state.from === 'string') {
      navigate(state.from);
      return;
    }

    // 3. History del MemoryRouter (key !== 'default' indica que hay history).
    if (key !== 'default') {
      navigate(-1);
      return;
    }

    // 4. Sin historial: ir al module root inferido del pathname.
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length <= 1) return;

    if (segments[0] === 'stock' && segments.length > 2) {
      navigate('/' + segments[0] + '/' + segments[1]);
      return;
    }

    navigate('/' + segments[0]);
  }, [navigate, pathname, state, key, getActiveTabParent]);
}
