import type { ModuloId } from '@ags/shared';

export interface NavItem {
  name: string;
  path: string;
  icon: string;
  modulo?: ModuloId;
  children?: { name: string; path: string; separator?: boolean }[];
}

export const navigation: NavItem[] = [
  {
    name: 'Clientes', path: '/clientes', icon: '🏢', modulo: 'clientes',
    children: [
      { name: 'Todos los clientes', path: '/clientes' },
      { name: 'Ingreso Empresas', path: '/ingreso-empresas' },
    ],
  },
  // Establecimientos se accede desde el detalle de cada Cliente — no tiene entrada propia en el sidebar.
  { name: 'Equipos', path: '/equipos', icon: '⚙️', modulo: 'equipos' },
  { name: 'Ordenes de Trabajo', path: '/ordenes-trabajo', icon: '📝', modulo: 'ordenes-trabajo' },
  { name: 'Tickets', path: '/leads', icon: '👥', modulo: 'leads' },
  { name: 'Presupuestos', path: '/presupuestos', icon: '📋', modulo: 'presupuestos' },
  { name: 'Biblioteca Tablas', path: '/table-catalog', icon: '📐', modulo: 'table-catalog' },
  { name: 'Dispositivos', path: '/dispositivos', icon: '📱', modulo: 'dispositivos' },
  { name: 'Vehículos', path: '/vehiculos', icon: '🚗', modulo: 'vehiculos' },
  { name: 'Instrumentos', path: '/instrumentos', icon: '🔬', modulo: 'instrumentos' },
  { name: 'Patrones', path: '/patrones', icon: '⚗️', modulo: 'instrumentos' },
  { name: 'Columnas', path: '/columnas', icon: '📊', modulo: 'instrumentos' },
  { name: 'Fichas Propiedad', path: '/fichas', icon: '🔧', modulo: 'fichas' },
  { name: 'Loaners', path: '/loaners', icon: '🔄', modulo: 'loaners' },
  {
    name: 'Stock', path: '/stock', icon: '📦', modulo: 'stock',
    children: [
      { name: 'Articulos', path: '/stock/articulos' },
      { name: 'Unidades', path: '/stock/unidades' },
      { name: 'Minikits', path: '/stock/minikits' },
      { name: 'Plantillas minikit', path: '/stock/minikit-plantillas' },
      { name: 'Asignaciones', path: '/stock/asignaciones' },
      { name: 'Historial asig.', path: '/stock/asignaciones/historial' },
      { name: 'Remitos', path: '/stock/remitos' },
      { name: 'Movimientos', path: '/stock/movimientos' },
      { name: 'Alertas', path: '/stock/alertas' },
      { name: 'Requerimientos', path: '/stock/requerimientos', separator: true },
      { name: 'Ordenes de Compra', path: '/stock/ordenes-compra' },
      { name: 'Importaciones', path: '/stock/importaciones' },
      { name: 'Ingenieros', path: '/stock/ingenieros', separator: true },
      { name: 'Proveedores', path: '/stock/proveedores' },
      { name: 'Posiciones', path: '/stock/posiciones' },
      { name: 'Pos. Arancelarias', path: '/stock/posiciones-arancelarias' },
      { name: 'Marcas', path: '/stock/marcas' },
    ],
  },
  { name: 'Calif. Proveedores', path: '/calificacion-proveedores', icon: '⭐', modulo: 'calificacion-proveedores' },
  { name: 'Usuarios', path: '/usuarios', icon: '👤', modulo: 'usuarios' },
  { name: 'Agenda', path: '/agenda', icon: '📅', modulo: 'agenda' },
  { name: 'Pendientes', path: '/pendientes', icon: '📝', modulo: 'pendientes' },
  { name: 'Contratos', path: '/contratos', icon: '📑', modulo: 'contratos' },
  { name: 'Facturacion', path: '/facturacion', icon: '💰', modulo: 'facturacion' },
  { name: 'Importar Datos', path: '/admin/importar', icon: '📥', modulo: 'admin' },
];

/** Module root paths — used by keyboard shortcuts to know when to stop navigating up */
export const MODULE_ROOTS = new Set(
  navigation.flatMap(item =>
    item.children ? item.children.map(c => c.path) : [item.path]
  )
);

/**
 * MVP Desktop: solo estos módulos se muestran en el sidebar cuando
 * `VITE_DESKTOP_MVP=true`. El resto sigue existiendo en código pero sin entrada.
 * Establecimientos queda fuera — se accede desde el detalle de cada Cliente.
 */
const DESKTOP_MVP_ALLOWED = new Set<string>([
  '/clientes',
  '/equipos',
  '/leads',           // Tickets
  '/table-catalog',   // Biblioteca de Tablas
  '/pendientes',
  '/usuarios',        // Solo admin (filtrado por rol en SidebarNav)
]);

/** Devuelve la navegación filtrada según el flag de build. */
export function getNavigation(): NavItem[] {
  const isDesktopMvp = import.meta.env.VITE_DESKTOP_MVP === 'true';
  if (!isDesktopMvp) return navigation;
  return navigation.filter(item => DESKTOP_MVP_ALLOWED.has(item.path));
}
