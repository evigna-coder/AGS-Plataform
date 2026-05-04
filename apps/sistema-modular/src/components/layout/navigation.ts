import type { ModuloId } from '@ags/shared';
import { useFeatureFlags } from '../../contexts/FeatureFlagsContext';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Tipo recursivo. Soporta árboles de cualquier profundidad.
 *
 * - `path` con prefijo `#` = grupo sintético sin ruta navegable (ej: `#comercial`).
 *   Existe sólo para agrupar visualmente.
 * - `modulo` se hereda hacia children que NO tengan modulo propio. Un child con modulo
 *   propio decide solo su gate (independiente del parent).
 * - `children` permite anidar grupos dentro de grupos.
 */
export interface NavItem {
  name: string;
  path: string;
  icon?: string;
  modulo?: ModuloId;
  separator?: boolean;
  children?: NavItem[];
}

export const navigation: NavItem[] = [
  {
    name: 'Comercial', path: '#comercial', icon: '🤝',
    children: [
      { name: 'Clientes', path: '/clientes', icon: '🏢', modulo: 'clientes' },
      { name: 'Ingreso Empresas', path: '/ingreso-empresas', icon: '🏗️', modulo: 'ingreso-empresas' },
      { name: 'Tickets', path: '/leads', icon: '👥', modulo: 'leads' },
      { name: 'Presupuestos', path: '/presupuestos', icon: '📋', modulo: 'presupuestos' },
      { name: 'Contratos', path: '/contratos', icon: '📑', modulo: 'contratos' },
      { name: 'Facturación', path: '/facturacion', icon: '💰', modulo: 'facturacion' },
    ],
  },
  {
    name: 'Operaciones', path: '#operaciones', icon: '🛠️',
    children: [
      { name: 'Órdenes de Trabajo', path: '/ordenes-trabajo', icon: '📝', modulo: 'ordenes-trabajo' },
      { name: 'Equipos', path: '/equipos', icon: '⚙️', modulo: 'equipos' },
      { name: 'Agenda', path: '/agenda', icon: '📅', modulo: 'agenda' },
      { name: 'Pendientes', path: '/pendientes', icon: '📋', modulo: 'pendientes' },
    ],
  },
  {
    name: 'Stock', path: '/stock', icon: '📦', modulo: 'stock',
    children: [
      {
        name: 'Operación', path: '#stock-operacion', icon: '🔁',
        children: [
          { name: 'Articulos', path: '/stock/articulos' },
          { name: 'Unidades', path: '/stock/unidades' },
          { name: 'Minikits', path: '/stock/minikits' },
          { name: 'Faltantes en minikits', path: '/stock/minikits/faltantes' },
          { name: 'Asignaciones', path: '/stock/asignaciones' },
          { name: 'Historial asig.', path: '/stock/asignaciones/historial' },
          { name: 'Remitos', path: '/stock/remitos' },
          { name: 'Movimientos', path: '/stock/movimientos' },
          { name: 'Alertas', path: '/stock/alertas' },
        ],
      },
      {
        name: 'Compras', path: '#stock-compras', icon: '🛒',
        children: [
          { name: 'Requerimientos', path: '/stock/requerimientos' },
          { name: 'Planificación', path: '/stock/planificacion' },
          { name: 'Ordenes de Compra', path: '/stock/ordenes-compra' },
          { name: 'Importaciones', path: '/stock/importaciones' },
        ],
      },
      {
        name: 'Activos', path: '#stock-activos', icon: '🔬',
        children: [
          { name: 'Instrumentos', path: '/instrumentos', icon: '🔬', modulo: 'instrumentos' },
          { name: 'Patrones', path: '/patrones', icon: '⚗️', modulo: 'instrumentos' },
          { name: 'Columnas', path: '/columnas', icon: '📊', modulo: 'instrumentos' },
          { name: 'Dispositivos', path: '/dispositivos', icon: '📱', modulo: 'dispositivos' },
          { name: 'Vehículos', path: '/vehiculos', icon: '🚗', modulo: 'vehiculos' },
          { name: 'Fichas Propiedad', path: '/fichas', icon: '🔧', modulo: 'fichas' },
          { name: 'Loaners', path: '/loaners', icon: '🔄', modulo: 'loaners' },
        ],
      },
      {
        name: 'Catálogos', path: '#stock-catalogos', icon: '📇',
        children: [
          { name: 'Proveedores', path: '/stock/proveedores' },
          { name: 'Calif. Proveedores', path: '/calificacion-proveedores', icon: '⭐', modulo: 'calificacion-proveedores' },
          { name: 'Posiciones', path: '/stock/posiciones' },
          { name: 'Pos. Arancelarias', path: '/stock/posiciones-arancelarias' },
          { name: 'Marcas', path: '/stock/marcas' },
        ],
      },
    ],
  },
  {
    name: 'Personas', path: '#personas', icon: '🧑‍💼',
    children: [
      { name: 'Usuarios', path: '/usuarios', icon: '👤', modulo: 'usuarios' },
      // Ingenieros usa el gate de `usuarios` — mismo "padrón de personal".
      { name: 'Ingenieros', path: '/stock/ingenieros', icon: '👷', modulo: 'usuarios' },
    ],
  },
  { name: 'Documentos QF', path: '/qf-documentos', icon: '📄' },
  {
    name: 'Admin', path: '/admin', icon: '⚙️', modulo: 'admin',
    children: [
      { name: 'Biblioteca Tablas', path: '/table-catalog', icon: '📐', modulo: 'table-catalog' },
      { name: 'Importar Excel', path: '/admin/importar', separator: true },
      { name: 'Revisión clienteId', path: '/admin/revision-clienteid' },
      { name: 'Módulos', path: '/admin/modulos' },
      { name: 'Config Flujos', path: '/admin/config-flujos', separator: true },
      { name: 'Acciones Pendientes', path: '/admin/acciones-pendientes' },
      { name: 'Re-linkear artículos', path: '/admin/relinkear-articulos' },
      { name: 'Backfill numeros tickets', path: '/admin/backfill-ticket-numeros' },
      { name: 'Backfill clienteId tickets', path: '/admin/backfill-cliente-ids' },
      { name: 'Backfill responsables área', path: '/admin/backfill-responsables' },
      { name: 'Backfill derivador venta insumos', path: '/admin/backfill-ventas-insumos-derivador' },
    ],
  },
];

/** Walk recursivo: devuelve todos los paths de leaves (excluye grupos sintéticos). */
function collectLeafPaths(node: NavItem): string[] {
  if (!node.children) {
    return node.path.startsWith('#') ? [] : [node.path];
  }
  return node.children.flatMap(collectLeafPaths);
}

/** Module root paths — used by keyboard shortcuts to know when to stop navigating up. */
export const MODULE_ROOTS = new Set(navigation.flatMap(collectLeafPaths));

/**
 * MVP Desktop: solo estos paths se muestran en el sidebar cuando
 * `VITE_DESKTOP_MVP=true`. Se evalúa contra leaf paths individuales.
 */
export const DESKTOP_MVP_ALLOWED = new Set<string>([
  '/clientes',
  '/equipos',
  '/leads',           // Tickets
  '/table-catalog',   // Biblioteca de Tablas
  '/pendientes',
  '/usuarios',
]);

/** Aplica feature-flag override + MVP env. Devuelve si la ruta está habilitada por config. */
function isPathFlagAllowed(
  path: string,
  flags: ReturnType<typeof useFeatureFlags>,
  isDesktopMvp: boolean,
): boolean {
  const override = flags?.modules?.[path];
  if (override !== undefined) return override.enabled;
  if (isDesktopMvp) return DESKTOP_MVP_ALLOWED.has(path);
  return true;
}

/** Versión sin auth/feature-flags reactivos (para callers fuera de React). */
export function getNavigation(): NavItem[] {
  const isDesktopMvp = import.meta.env.VITE_DESKTOP_MVP === 'true';
  if (!isDesktopMvp) return navigation;
  const filterTree = (node: NavItem): NavItem | null => {
    if (!node.children) {
      return DESKTOP_MVP_ALLOWED.has(node.path) ? node : null;
    }
    const visible = node.children.map(filterTree).filter((c): c is NavItem => c !== null);
    if (visible.length === 0) return null;
    return { ...node, children: visible };
  };
  return navigation.map(filterTree).filter((c): c is NavItem => c !== null);
}

/**
 * Hook reactivo: combina build flag (VITE_DESKTOP_MVP), featureFlags de Firestore y RBAC.
 * Filtrado recursivo — soporta grupos anidados a cualquier profundidad.
 *
 * Reglas:
 *   - Leaf con modulo propio: visible si flag-allowed AND canAccess(modulo).
 *   - Leaf sin modulo: hereda el modulo del ancestro más cercano que tenga uno.
 *   - Grupo: visible si tiene al menos un descendiente leaf visible.
 */
export function useNavigation(): NavItem[] {
  const flags = useFeatureFlags();
  const { canAccess } = useAuth();
  const isDesktopMvp = import.meta.env.VITE_DESKTOP_MVP === 'true';

  const filterNode = (node: NavItem, inheritedModulo: ModuloId | undefined): NavItem | null => {
    const effectiveModulo = node.modulo ?? inheritedModulo;
    if (!node.children) {
      if (!isPathFlagAllowed(node.path, flags, isDesktopMvp)) return null;
      if (effectiveModulo && !canAccess(effectiveModulo)) return null;
      return node;
    }
    const visibleChildren = node.children
      .map(c => filterNode(c, effectiveModulo))
      .filter((c): c is NavItem => c !== null);
    if (visibleChildren.length === 0) return null;
    return { ...node, children: visibleChildren };
  };

  return navigation.map(n => filterNode(n, undefined)).filter((c): c is NavItem => c !== null);
}

export interface ModuleEntry {
  path: string;
  name: string;
  icon: string;
  parentName?: string;
}

/**
 * Lista plana de unidades togleables para la UI admin de `/admin/modulos`.
 *
 * Una unidad togleable es:
 *   - Top-level leaf
 *   - Grupo real (parent con path navegable, ej: `/stock`, `/admin`)
 *   - Leaf con modulo propio distinto al modulo heredado del ancestro real
 *   - Cualquier leaf bajo un grupo sintético (no hay modulo heredado que ya lo gobierne)
 *
 * Se descartan: grupos sintéticos (no toggleables) y leafs que sólo heredan modulo del parent
 * real (el toggle del parent ya los gobierna).
 */
export function getAllModulePaths(): ModuleEntry[] {
  const out: ModuleEntry[] = [];
  const walk = (
    node: NavItem,
    inheritedRealModulo: ModuloId | undefined,
    breadcrumbs: string[],
  ) => {
    const isSynthetic = node.path.startsWith('#');
    const myEffectiveModulo = node.modulo ?? inheritedRealModulo;

    if (!node.children) {
      const distinctFromParent = node.modulo && node.modulo !== inheritedRealModulo;
      const isUnderRealGroup = inheritedRealModulo !== undefined;
      if (!isUnderRealGroup || distinctFromParent) {
        out.push({
          path: node.path,
          name: node.name,
          icon: node.icon ?? '📄',
          parentName: breadcrumbs.length > 0 ? breadcrumbs.join(' › ') : undefined,
        });
      }
      return;
    }

    if (!isSynthetic) {
      out.push({
        path: node.path,
        name: node.name,
        icon: node.icon ?? '📂',
        parentName: breadcrumbs.length > 0 ? breadcrumbs.join(' › ') : undefined,
      });
    }
    const childBreadcrumbs = [...breadcrumbs, node.name];
    for (const c of node.children) {
      walk(c, myEffectiveModulo, childBreadcrumbs);
    }
  };
  for (const n of navigation) walk(n, undefined, []);
  return out;
}

/** Default `enabled` cuando no hay override en Firestore (usado por la UI admin). */
export function isMvpDefault(path: string): boolean {
  const isDesktopMvp = import.meta.env.VITE_DESKTOP_MVP === 'true';
  if (!isDesktopMvp) return true;
  return DESKTOP_MVP_ALLOWED.has(path);
}
