import type { ModuloId } from '@ags/shared';
import { useFeatureFlags } from '../../contexts/FeatureFlagsContext';

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
      { name: 'Planificación', path: '/stock/planificacion' },
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
  {
    name: 'Admin', path: '/admin', icon: '⚙️', modulo: 'admin',
    children: [
      { name: 'Importar Excel', path: '/admin/importar' },
      { name: 'Revisión clienteId', path: '/admin/revision-clienteid' },
      { name: 'Módulos', path: '/admin/modulos' },
      { name: 'Config Flujos', path: '/admin/config-flujos', separator: true },
      { name: 'Acciones Pendientes', path: '/admin/acciones-pendientes' },
    ],
  },
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
 *
 * Exportado (antes era privado) para que la UI admin de `/admin/modulos` calcule
 * el "default" de cada módulo sin duplicar el set localmente — ver `isMvpDefault()`.
 */
export const DESKTOP_MVP_ALLOWED = new Set<string>([
  '/clientes',
  '/equipos',
  '/leads',           // Tickets
  '/table-catalog',   // Biblioteca de Tablas
  '/pendientes',
  '/usuarios',        // Solo admin (filtrado por rol en SidebarNav)
]);

/**
 * Devuelve la navegación filtrada según el flag de build (VITE_DESKTOP_MVP).
 * NO combina con Firestore — mantiene el comportamiento legacy para callers fuera de React.
 * Los componentes React deben usar `useNavigation()` para el filtro reactivo.
 */
export function getNavigation(): NavItem[] {
  const isDesktopMvp = import.meta.env.VITE_DESKTOP_MVP === 'true';
  if (!isDesktopMvp) return navigation;
  return navigation.filter(item => DESKTOP_MVP_ALLOWED.has(item.path));
}

/**
 * Hook reactivo: combina build flag (VITE_DESKTOP_MVP) con featureFlags de Firestore.
 * Override Firestore (si existe para un `item.path`) gana sobre env. Es el entry point
 * nuevo del sidebar; `getNavigation()` se mantiene para compat con call sites fuera de
 * React.
 *
 * Orden de precedencia:
 *   1. Firestore override → `enabled` del override
 *   2. Fallback env: si `VITE_DESKTOP_MVP === 'true'` → DESKTOP_MVP_ALLOWED.has(path)
 *   3. Si ninguno aplica → visible
 *
 * Mientras el context devuelve `null` (primer snapshot pendiente) se cae directo al
 * fallback env, evitando flicker.
 */
export function useNavigation(): NavItem[] {
  const flags = useFeatureFlags();
  const isDesktopMvp = import.meta.env.VITE_DESKTOP_MVP === 'true';

  return navigation.filter(item => {
    const override = flags?.modules?.[item.path];
    if (override) return override.enabled;
    if (isDesktopMvp) return DESKTOP_MVP_ALLOWED.has(item.path);
    return true;
  });
}

/**
 * Lista completa de paths + nombres + icons (para la UI admin de toggles).
 * No filtra por MVP — el admin ve TODOS los módulos para poder activarlos/desactivarlos.
 */
export function getAllModulePaths(): Array<{ path: string; name: string; icon: string }> {
  return navigation.map(n => ({ path: n.path, name: n.name, icon: n.icon }));
}

/**
 * Devuelve el valor default de `enabled` para un módulo cuando NO hay override en Firestore.
 * Combina env flag con el set MVP. Usado por la UI admin para mostrar el estado "base" del
 * toggle antes de que el admin lo modifique.
 *
 *   - Si VITE_DESKTOP_MVP === 'true' → `DESKTOP_MVP_ALLOWED.has(path)`
 *   - Si no                          → `true` (todos visibles por default)
 */
export function isMvpDefault(path: string): boolean {
  const isDesktopMvp = import.meta.env.VITE_DESKTOP_MVP === 'true';
  if (!isDesktopMvp) return true;
  return DESKTOP_MVP_ALLOWED.has(path);
}
