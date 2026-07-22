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
 * Restauración de filtros: los parents se declaran como paths pelados
 * ('/clientes'), pero las listas persisten sus filtros en la query string
 * (useUrlFilters). Antes el back navegaba al path pelado y los filtros se
 * perdían. Ahora se restaura la última search vista en este tab para ese
 * pathname (TabsContext la registra en cada cambio de location).
 */
export function useNavigateBack() {
  const navigate = useNavigate();
  const { pathname, state, key } = useLocation();
  const { getActiveTabParent, getActiveTabStoredSearch } = useTabs();

  return useCallback(() => {
    // Path pelado → path con la última query string vista ahí en este tab.
    // Si el destino ya trae su propia search, se respeta.
    const withStoredSearch = (path: string) =>
      path.includes('?') ? path : path + getActiveTabStoredSearch(path);

    // 1. Parent jerárquico declarado por el Detail page.
    const parent = getActiveTabParent();
    if (parent) {
      navigate(withStoredSearch(parent));
      return;
    }

    // 2. state.from del Link (fallback para pages que no declararon parent).
    if (state?.from && typeof state.from === 'string') {
      navigate(withStoredSearch(state.from));
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
      navigate(withStoredSearch('/' + segments[0] + '/' + segments[1]));
      return;
    }

    navigate(withStoredSearch('/' + segments[0]));
  }, [navigate, pathname, state, key, getActiveTabParent, getActiveTabStoredSearch]);
}
