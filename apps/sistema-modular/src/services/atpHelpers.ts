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

import { computeStockAmplio, atpUnidades, type UnidadStockRow } from './stockAmplioService';
import type { StockAmplio } from '@ags/shared';

/**
 * ATP (Available To Promise) = disponible + enTransito + reservado + comprometido.
 * Fórmula canónica STKP-01 sobre el snapshot de `computeStockAmplio()`.
 */
export function atpFromStockAmplio(sa: StockAmplio): number {
  return sa.disponible + sa.enTransito + sa.reservado + sa.comprometido;
}

/**
 * ATP neto = lo prometible a demanda nueva: disponible + enTransito − comprometido.
 *
 * `reservado` NO se resta: reservar una unidad le cambia el estado
 * (disponible → reservado), o sea que ya salió del bucket `disponible`.
 * Restarla de nuevo la descontaba dos veces (5 físicas con 2 reservadas
 * mostraba ATP 1 en vez de 3). Fórmula única para toda la app — no
 * reimplementar inline.
 */
export function atpNetoFromStockAmplio(sa: StockAmplio): number {
  return sa.disponible + sa.enTransito - sa.comprometido;
}

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
    return atpFromStockAmplio(sa) === 0;
  } catch (err) {
    console.warn('[atpHelpers.itemRequiresImportacion] fallo:', err);
    return false;
  }
}

/**
 * Variante síncrona para cuando ya tenemos el array de unidades precargado (evita round-trip).
 *
 * Fix auditoría I7: antes tenía su propia fórmula (contaba DOCS en vez de cantidades
 * e incluía `'asignado'`), lo que podía contradecir al stock amplio. Ahora deriva de
 * `atpUnidades()` — el mismo criterio de `computeStockAmplio` (suma `cantidad ?? 1`
 * sobre disponible/reservado/en_transito; 'asignado' excluido, ver
 * `UNIDAD_ATP_ESTADOS` en stockAmplioService.ts).
 *
 * Limitación inherente al camino sincrónico: solo ve `unidades` — no suma OCs
 * pendientes ni requerimientos condicionales, así que puede reportar "requiere
 * importación" cuando hay stock entrante por OC. Si podés esperar un round-trip,
 * usá `itemRequiresImportacion()` (async, ATP completo de 4 buckets).
 */
export function itemRequiresImportacionFromUnidades(
  unidades: UnidadStockRow[],
): boolean {
  return atpUnidades(unidades) === 0;
}
