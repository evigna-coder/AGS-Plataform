/**
 * Phase 8 FLOW-03 ATP helpers
 *
 * Determina si un artículo de stock requiere importación — usado al agregar ítems
 * a un presupuesto para flagear `itemRequiereImportacion: true`. Al aceptar el
 * presupuesto, estos flags disparan la creación automática de requerimientos
 * condicionales via `presupuestosService.aceptarConRequerimientos`.
 *
 * TODO(STKP-01): replace with computeStockAmplio() in Phase 9.
 *   Hoy contamos manualmente unidades por estado (disponible + reservado + en_transito + asignado).
 *   Phase 9 introducirá una función pure `computeStockAmplio(articuloId)` que consolida
 *   la fuente de verdad (unidades + OCs en tránsito + reservas explícitas). Cuando eso
 *   exista, `itemRequiresImportacion(articuloId)` debería llamar a esa API y eliminar
 *   la consulta directa a `unidades`.
 */

import { unidadesService } from './stockService';

/**
 * Retorna `true` si un artículo de stock tiene ATP === 0 y por lo tanto requiere importación.
 *
 * ATP (Available To Promise) = disponible + reservado + en_transito (+ asignado).
 * Si la suma es 0, el artículo no tiene stock ni camino — comprar / importar.
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
    const unidades = await unidadesService.getAll({ articuloId: stockArticuloId, activoOnly: true });
    // Estados que cuentan como ATP positivo — el artículo está o estará disponible.
    const atpEstados = new Set<string>(['disponible', 'reservado', 'en_transito', 'asignado']);
    const atp = unidades.reduce((acc, u) => acc + (atpEstados.has(u.estado) ? 1 : 0), 0);
    return atp === 0;
  } catch (err) {
    console.warn('[atpHelpers.itemRequiresImportacion] fallo al consultar unidades:', err);
    return false;
  }
}

/**
 * Variante síncrona para cuando ya tenemos el array de unidades precargado (evita round-trip).
 * Usado por UI que ya suscribió a `unidadesService.subscribe` para rendering.
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
