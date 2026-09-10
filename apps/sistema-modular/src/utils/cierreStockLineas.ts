import type { CierreAdministrativo, StockSelection } from '@ags/shared';

/**
 * Deducción de stock POR LÍNEA en el cierre de OT (fase 2 de la reapertura,
 * 2026-09-10 — ver .claude/plans/reapertura-ot.md §4.3).
 *
 * Antes había un solo flag `cierreAdmin.stockDeducido` para toda la OT: tras
 * una reapertura no se podía saber qué selecciones ya habían salido del stock
 * y cuáles eran nuevas, así que el re-cierre o descontaba todo de nuevo o no
 * descontaba nada. Ahora cada `StockSelection` lleva `deducidoAt` +
 * `movimientoIds` (los asientos que generó) y el flag global es derivado.
 *
 * OTs cerradas ANTES de esto (flag prendido, ninguna selección con
 * `deducidoAt`): se consideran todas descontadas —lo estaban— y se marcan
 * `deducidoLegacy` para que solo lo agregado después se descuente.
 */

export interface ResultadoDeduccionLinea {
  /** Índice dentro del array de selecciones PENDIENTES que se pasó a deducir. */
  indice: number;
  deducidas: number;
  /** Cubiertas por reservas del presupuesto (no generan asiento; cuentan como hechas). */
  cubiertas: number;
  movimientoIds: string[];
}

/**
 * Selecciones a descontar en esta corrida y el array completo normalizado
 * (con el marcado legacy aplicado si corresponde).
 */
export function seleccionesPendientesDeDeduccion(
  cierreAdmin: CierreAdministrativo | undefined,
  fechaLegacy: string,
): { todas: StockSelection[]; pendientes: { sel: StockSelection; indiceGlobal: number }[]; legacyMarcado: boolean } {
  const originales = cierreAdmin?.stockSelections ?? [];
  const legacy = !!cierreAdmin?.stockDeducido && originales.length > 0 && !originales.some(s => s.deducidoAt);
  const todas = legacy
    ? originales.map(s => ({ ...s, deducidoAt: fechaLegacy, cantidadDeducida: s.cantidad ?? 1, deducidoLegacy: true }))
    : originales;
  const pendientes = todas
    .map((sel, indiceGlobal) => ({ sel, indiceGlobal }))
    .filter(({ sel }) => !sel.deducidoAt);
  return { todas, pendientes, legacyMarcado: legacy };
}

/**
 * Estampa los resultados de la deducción en las selecciones. Una selección
 * queda "deducida" si salió al menos una unidad (aunque sea parcial: reintentar
 * lo que faltó volvería a tomar otras unidades, y eso es el doble descuento) o
 * si las reservas del presupuesto la cubrieron entera.
 */
export function marcarSeleccionesDeducidas(
  todas: StockSelection[],
  pendientes: { sel: StockSelection; indiceGlobal: number }[],
  resultados: ResultadoDeduccionLinea[],
  fecha: string,
): StockSelection[] {
  const out = [...todas];
  for (const r of resultados) {
    const p = pendientes[r.indice];
    if (!p) continue;
    if (r.deducidas <= 0 && r.cubiertas <= 0) continue;
    out[p.indiceGlobal] = {
      ...p.sel,
      deducidoAt: fecha,
      cantidadDeducida: r.deducidas,
      movimientoIds: r.movimientoIds,
    };
  }
  return out;
}

/** El flag global de la OT: todas las selecciones descontadas (y hay al menos una). */
export function todasDeducidas(selecciones: StockSelection[]): boolean {
  return selecciones.length > 0 && selecciones.every(s => !!s.deducidoAt);
}
