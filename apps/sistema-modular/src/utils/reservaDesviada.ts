/**
 * Reserva desviada (2026-10-01, caso Roemmers / 2140-0820).
 *
 * Una unidad reservada para un presupuesto puede asignarse a un ingeniero (la
 * reserva viaja con ella, a propósito). Si después se consume en una OT que
 * NO es de ese presupuesto, el cliente original se queda sin su parte y nadie
 * se entera: las 2 lámparas de Roemmers terminaron en OTs de Bagó y el
 * requerimiento de Roemmers ya estaba cancelado porque "la reserva lo cubría".
 *
 * Estas funciones puras deciden si un consumo desvía una reserva y cuánto le
 * falta al presupuesto original después. El servicio
 * `reservaDesviadaService` las usa para volver a cubrirlo.
 */

export interface PresupuestoParaDesvio {
  otsVinculadasNumbers?: string[] | null;
  items?: Array<{
    otNumeroVinculada?: string | null;
    stockArticuloId?: string | null;
    cantidad?: number | null;
    presentacion?: { factor?: number | null } | null;
  }> | null;
}

export interface UnidadParaDesvio {
  articuloId: string;
  estado: string;
  cantidad?: number | null;
  activo?: boolean | null;
  consumidoEnOt?: string | null;
}

export interface ReqParaDesvio {
  articuloId?: string | null;
  estado: string;
  cantidad: number;
}

/** OTs que son del presupuesto: las vinculadas más las de cada ítem. */
export function otsDelPresupuesto(p: PresupuestoParaDesvio | null | undefined): Set<string> {
  const s = new Set<string>(p?.otsVinculadasNumbers ?? []);
  for (const it of p?.items ?? []) if (it.otNumeroVinculada) s.add(it.otNumeroVinculada);
  return s;
}

/** ¿Consumir en esta OT desvía la reserva? Sin OT no se puede saber: no se marca. */
export function esConsumoDesviado(p: PresupuestoParaDesvio | null | undefined, otNumber: string | null | undefined): boolean {
  if (!p || !otNumber) return false;
  return !otsDelPresupuesto(p).has(otNumber);
}

const REQ_QUE_CUBREN = new Set(['pendiente', 'aprobado', 'en_compra']);

/**
 * Unidades base del artículo que al presupuesto le faltan cubrir: lo que
 * necesitan sus ítems, menos lo reservado o asignado para él (todavía en
 * camino al cliente), menos lo consumido/entregado en SUS OTs, menos lo que ya
 * piden sus requerimientos abiertos o en compra.
 */
export function faltanteDelPresupuesto(
  p: PresupuestoParaDesvio | null | undefined,
  articuloId: string,
  unidadesDelPresupuesto: UnidadParaDesvio[],
  reqsDelPresupuesto: ReqParaDesvio[],
): number {
  if (!p) return 0;
  const necesarias = (p.items ?? [])
    .filter(i => i.stockArticuloId === articuloId)
    .reduce((a, i) => a + (i.cantidad || 0) * ((i.presentacion?.factor ?? 0) > 0 ? i.presentacion!.factor! : 1), 0);
  if (necesarias <= 0) return 0;
  const ots = otsDelPresupuesto(p);
  const cubiertas = unidadesDelPresupuesto
    .filter(u => u.articuloId === articuloId && u.activo !== false)
    .filter(u => u.estado === 'reservado' || u.estado === 'asignado'
      || ((u.estado === 'consumido' || u.estado === 'entregado') && (!u.consumidoEnOt || ots.has(u.consumidoEnOt))))
    .reduce((a, u) => a + (u.cantidad ?? 1), 0);
  const enReq = reqsDelPresupuesto
    .filter(r => r.articuloId === articuloId && REQ_QUE_CUBREN.has(r.estado))
    .reduce((a, r) => a + (r.cantidad || 0), 0);
  return Math.max(0, necesarias - cubiertas - enReq);
}
