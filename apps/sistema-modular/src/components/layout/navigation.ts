import type { ModuloId } from '@ags/shared';

export interface NavItem {
  name: string;
  path: string;
  icon: string;
  modulo?: ModuloId;
  children?: { name: string; path: string; separator?: boolean }[];
}

export const navigation: NavItem[] = [
  { name: 'Clientes', path: '/clientes', icon: '🏢', modulo: 'clientes' },
  { name: 'Establecimientos', path: '/establecimientos', icon: '🏭', modulo: 'establecimientos' },
  { name: 'Equipos', path: '/equipos', icon: '⚙️', modulo: 'equipos' },
  { name: 'Ordenes de Trabajo', path: '/ordenes-trabajo', icon: '📝', modulo: 'ordenes-trabajo' },
  { name: 'Tickets', path: '/leads', icon: '👥', modulo: 'leads' },
  { name: 'Presupuestos', path: '/presupuestos', icon: '📋', modulo: 'presupuestos' },
  { name: 'Biblioteca Tablas', path: '/table-catalog', icon: '📐', modulo: 'table-catalog' },
  { name: 'Ingreso Empresas', path: '/ingreso-empresas', icon: '🪪', modulo: 'ingreso-empresas' },
  { name: 'Dispositivos', path: '/dispositivos', icon: '📱', modulo: 'dispositivos' },
  { name: 'Vehículos', path: '/vehiculos', icon: '🚗', modulo: 'vehiculos' },
  { name: 'Instrumentos', path: '/instrumentos', icon: '🔬', modulo: 'instrumentos' },
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
  { name: 'Facturacion', path: '/facturacion', icon: '💰', modulo: 'facturacion' },
  { name: 'Importar Datos', path: '/admin/importar', icon: '📥', modulo: 'admin' },
];

/** Module root paths — used by keyboard shortcuts to know when to stop navigating up */
export const MODULE_ROOTS = new Set(
  navigation.flatMap(item =>
    item.children ? item.children.map(c => c.path) : [item.path]
  )
);
