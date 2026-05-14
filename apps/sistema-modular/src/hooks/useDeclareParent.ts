import { useEffect } from 'react';
import { useTabs } from '../contexts/TabsContext';

/**
 * Declara el padre jerárquico semántico del Detail page actual.
 *
 * `useNavigateBack` (y el Escape global) priorizan este valor sobre el
 * `state.from` del Link. Eso evita el loop equipo↔establecimiento que pasaba
 * cuando se entraba a un mismo Detail desde distintos referrers — el
 * `state.from` se "rota" en history pero el padre semántico es siempre el
 * mismo (cliente, establecimiento, listado, según corresponda).
 *
 * Pasá `null` mientras los datos del Detail no estén cargados todavía; el
 * hook va a hacer la limpieza correctamente cuando el componente se desmonte.
 *
 * Ej. para EquipoDetail:
 *
 *   useDeclareParent(
 *     sistema?.establecimientoId ? `/establecimientos/${sistema.establecimientoId}`
 *       : sistema?.clienteId ? `/clientes/${sistema.clienteId}`
 *       : '/equipos'
 *   );
 */
export function useDeclareParent(parentPath: string | null) {
  const { setActiveTabParent } = useTabs();
  useEffect(() => {
    setActiveTabParent(parentPath);
    return () => setActiveTabParent(null);
  }, [parentPath, setActiveTabParent]);
}
