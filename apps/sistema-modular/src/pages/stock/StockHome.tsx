import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import type { ModuloId } from '@ags/shared';

/**
 * Landing de /stock: redirige a la primera sub-área que el usuario puede ver, según sus
 * sub-módulos de stock (tras el split stock-operacion/compras/catalogos). Antes era un
 * Navigate fijo a /stock/articulos, que dejaba afuera a quien tuviera solo Compras u
 * Operación. Orden = catálogos (comportamiento previo) → operación → compras → pagos.
 */
const STOCK_LANDING: { modulo: ModuloId; path: string }[] = [
  { modulo: 'stock-catalogos', path: '/stock/articulos' },
  { modulo: 'stock-operacion', path: '/stock/unidades' },
  { modulo: 'stock-compras', path: '/stock/ordenes-compra' },
  { modulo: 'pagos', path: '/stock/pagos-vep' },
];

export const StockHome = () => {
  const { canAccess } = useAuth();
  const target = STOCK_LANDING.find(x => canAccess(x.modulo));
  return <Navigate to={target?.path ?? '/dashboard'} replace />;
};
