/**
 * Phase 8 FLOW-03 ATP helpers (refactored in Phase 9 per STKP-01).
 *
 * Determina si un artículo de stock requiere importación — usado al agregar ítems
 * a un presupuesto para flagear `itemRequiereImportacion: true`. Al aceptar el
 * presupuesto, estos flags disparan la creación automática de requerimientos
 * condicionales via `presupuestosService.aceptarConRequerimientos`.
 *
 * Phase 9 refactor: `itemRequiresImportacion` now delegates to `computeStockAmplio()`
 * as established by STKP-01. The ATP formula is now: disponible + enTransito + reservado +
 * comprometido. If the sum is 0, no stock is available or incoming → requires importation.
 */

import { computeStockAmplio } from './stockAmplioService';

/**
 * Retorna `true` si un artículo de stock tiene ATP === 0 y por lo tanto requiere importación.
 *
 * ATP (Available To Promise) = disponible + enTransito + reservado + comprometido.
 * `computeStockAmplio()` is the single source of truth for these 4 buckets (Phase 9).
 *
 * - Consumibles/servicios sin `stockArticuloId`: devolver `false` desde el caller (no aplica).
 * - Si la consulta falla (network / permisos): `false` (conservador — no flagear falsos positivos).
 *
 * @param stockArticuloId FK al artículo en la colección `articulos`
 * @returns `true` si ATP === 0
 */
export async function itemRequiresImportacion(
  stockArticuloId: string | null | undefined,
): Promise<boolean> {
  if (!stockArticuloId) return false;
  try {
    const sa = await computeStockAmplio(stockArticuloId);
    const total = sa.disponible + sa.enTransito + sa.reservado + sa.comprometido;
    return total === 0;
  } catch (err) {
    console.warn('[atpHelpers.itemRequiresImportacion] fallo:', err);
    return false;
  }
}

/**
 * Variante síncrona para cuando ya tenemos el array de unidades precargado (evita round-trip).
 * Usado por UI que ya suscribió a `unidadesService.subscribe` para rendering.
 * KEEP as-is — called by handlePickArticulo with pre-loaded unidades (different caller path).
 */
export function itemRequiresImportacionFromUnidades(
  unidades: Array<{ estado: string; activo?: boolean }>,
): boolean {
  const atpEstados = new Set<string>(['disponible', 'reservado', 'en_transito', 'asignado']);
  const atp = unidades.reduce(
    (acc, u) => acc + (u.activo !== false && atpEstados.has(u.estado) ? 1 : 0),
    0,
  );
  return atp === 0;
}
