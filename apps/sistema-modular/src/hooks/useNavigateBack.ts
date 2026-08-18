import { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTabs } from '../contexts/TabsContext';

/**
 * Navega "hacia atrás" siguiendo la jerarquía semántica, no el history.
 *
 * REGLA GENERAL (2026-08-14): volver SIEMPRE al lugar donde estabas, con los
 * filtros que tenías. El padre semántico es el plan B, no el plan A.
 *
 * Orden de prioridad:
 *  1. `state.from` del Link — cuando quien navegó lo declaró explícitamente.
 *  2. `navigate(-1)` — el history de ESTA pestaña. Devuelve la URL completa,
 *     query string incluida, sin depender de que nadie pase nada.
 *  3. Parent declarado via `useDeclareParent` — solo cuando no hay history
 *     (pestaña recién abierta, link profundo, F5).
 *  4. Raíz del módulo, inferida del pathname.
 *
 * Por qué cambió el orden: el parent se declara ESTÁTICO en 16 de los 17 Detail
 * pages (`useDeclareParent('/remitos')`, `'/ordenes-trabajo'`, …). Al ganarle a
 * todo, entrar a un remito DESDE una ficha y volver te dejaba en el listado de
 * remitos, no en la ficha; lo mismo de agenda a una OT. Y hay 147 `<Link>` que
 * no pasan `state.from`, así que para ellos el parent era el único camino.
 *
 * El loop equipo↔establecimiento que motivó el orden anterior no vuelve: se
 * corta ignorando un `from` que apunte a la pantalla actual, y el parent sigue
 * cubriendo el caso sin history, que es donde de verdad hacía falta.
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

    // 1. De dónde vino el usuario. Se descarta un `from` que apunte a esta
    //    misma pantalla: sería un back que no va a ningún lado.
    const from = typeof state?.from === 'string' ? state.from : null;
    if (from && from.split('?')[0] !== pathname) {
      navigate(withStoredSearch(from));
      return;
    }

    // 2. History de ESTA pestaña. Es literalmente "el lugar donde estabas", con
    //    su URL completa —filtros incluidos— sin depender de que quien te trajo
    //    se haya acordado de pasar el origen. Hay 147 `<Link>` en la app que no
    //    lo pasan; sin esto, todos caían al padre estático del destino.
    if (key !== 'default') {
      navigate(-1);
      return;
    }

    // 3. Padre jerárquico declarado — pestaña recién abierta o link profundo,
    //    donde no hay a dónde volver y el padre semántico es la mejor apuesta.
    const parent = getActiveTabParent();
    if (parent) {
      navigate(withStoredSearch(parent));
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
