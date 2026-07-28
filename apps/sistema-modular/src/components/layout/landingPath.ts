import type { NavItem } from './navigation';

/**
 * Pantalla de arranque por defecto. Se respeta cuando el usuario tiene acceso,
 * para no cambiarle el landing a quien ya lo tenía (admin, admin_soporte, ventas…).
 */
export const DEFAULT_LANDING = '/clientes';

/** Último recurso: ruta sin gate de módulo (visible para cualquier usuario autenticado). */
export const FALLBACK_LANDING = '/qf-documentos';

/** Walk recursivo: paths navegables (hojas) en el orden en que se ven en el sidebar. */
function collectVisibleLeafPaths(items: NavItem[]): string[] {
  const out: string[] = [];
  const walk = (node: NavItem) => {
    if (node.children) {
      node.children.forEach(walk);
      return;
    }
    if (!node.path.startsWith('#')) out.push(node.path);
  };
  items.forEach(walk);
  return out;
}

/**
 * Resuelve a dónde entra el usuario, dado su sidebar YA filtrado por permisos.
 *
 * Antes el landing era `/clientes` hardcodeado: los usuarios sin ese módulo
 * (administracion, admin_contable) entraban directo a "Acceso denegado" aunque
 * pudieran navegar el resto (reporte UAT 2026-07-27).
 */
export function resolveLandingPath(visibleNav: NavItem[]): string {
  const leaves = collectVisibleLeafPaths(visibleNav);
  if (leaves.includes(DEFAULT_LANDING)) return DEFAULT_LANDING;
  return leaves[0] ?? FALLBACK_LANDING;
}
