import type { RequerimientoCompra } from '@ags/shared';

/**
 * Requerimientos que quedan de más cuando la reserva de stock cubre lo que el
 * presupuesto necesita (2026-09-30).
 *
 * El circuito crea el requerimiento al aceptar el presupuesto por lo que NO se
 * pudo reservar en ese momento. Si después entra mercadería y se reserva para
 * ese presupuesto (auto-reserva al ingresar, o a mano desde el presupuesto), el
 * requerimiento ya no pide nada real: hay que cerrarlo, no comprarlo. Antes
 * quedaba vivo en la planilla (casos Roemmers REQ-0045 y Bernabó
 * REQ-0080/81/82 del cruce del 2026-09-30).
 *
 * Regla: se cancelan TODOS los requerimientos abiertos (pendiente/aprobado, sin
 * OC) del presupuesto y el artículo cuando lo reservado + entregado cubre la
 * cantidad que el presupuesto necesita. Con cobertura parcial no se toca nada:
 * el requerimiento sigue pidiendo el saldo y el comprador decide.
 */
export const REQ_ESTADOS_CERRABLES_POR_RESERVA: ReadonlySet<string> = new Set(['pendiente', 'aprobado']);

export function requerimientosCubiertosPorReserva(
  reqs: RequerimientoCompra[],
  presupuestoId: string,
  articuloId: string,
  /** Unidades base que el presupuesto necesita de este artículo (suma de sus ítems). */
  necesarias: number,
  /** Unidades base ya reservadas o entregadas para ese presupuesto y artículo. */
  cubiertas: number,
): { cancelar: RequerimientoCompra[]; motivo: string } {
  const abiertos = reqs.filter(r =>
    r.presupuestoId === presupuestoId && r.articuloId === articuloId
    && REQ_ESTADOS_CERRABLES_POR_RESERVA.has(r.estado) && !r.ordenCompraId);
  if (abiertos.length === 0) return { cancelar: [], motivo: '' };
  // Sin ítem en el presupuesto (dato viejo) se compara contra lo que piden los requerimientos.
  const objetivo = necesarias > 0 ? necesarias : abiertos.reduce((a, r) => a + r.cantidad, 0);
  if (cubiertas < objetivo) return { cancelar: [], motivo: '' };
  return {
    cancelar: abiertos,
    motivo: `Cubierto con stock reservado: ${cubiertas} u. reservadas/entregadas para el presupuesto (necesita ${objetivo}).`,
  };
}
