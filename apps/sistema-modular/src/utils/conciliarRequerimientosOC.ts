import type { ItemOC, OrdenCompra, RequerimientoCompra } from '@ags/shared';
import { ORIGEN_REQUERIMIENTO_LABELS } from '@ags/shared';

/**
 * Conciliación OC ↔ requerimientos (2026-09-10).
 *
 * El sistema genera requerimientos (stock mínimo, presupuestos aceptados) y el
 * camino previsto es marcarlos en la planilla y generar la OC desde ahí, que
 * los deja `en_compra`. Pero el comprador muchas veces arma la OC directo, sin
 * pasar por la planilla, y el requerimiento queda vivo para siempre.
 *
 * Al pasar la OC a ENVIADA (en borrador puede cambiar cualquier cosa) se
 * buscan requerimientos abiertos del mismo artículo para cada ítem de la OC
 * que todavía no tiene requerimiento. Con un solo candidato se propone
 * vinculado; con varios el comprador elige a cuál (o cuáles) corresponde.
 *
 * La cantidad de la OC se reparte entre los requerimientos elegidos en orden.
 * Si no alcanza (caso 5181-8830: requerimiento de 4, OC de 3) el requerimiento
 * vinculado queda por lo cubierto y nace otro, pendiente, por el saldo — la
 * unidad que falta no se pierde.
 *
 * Ítems YA vinculados (2026-09-30, caso XRW219 / 92814-618): antes se
 * salteaban y el comprador veía "no hay requerimientos" aunque hubiera otro
 * abierto del mismo artículo (REQ-0098 detrás de REQ-0049). Ahora se ofrecen
 * igual, con la cantidad que la OC todavía puede cubrir (`disponible` =
 * cantidad del ítem − lo que ya cubren sus vinculados). Con disponible 0 se
 * muestran pero no se pueden vincular: hay que subir la cantidad del ítem.
 */

/** Estados en los que un requerimiento todavía espera una OC. */
export const REQ_ESTADOS_CONCILIABLES: ReadonlySet<string> = new Set(['pendiente', 'aprobado']);

export interface GrupoConciliacion {
  item: ItemOC;
  candidatos: RequerimientoCompra[];
  /** Requerimientos que el ítem ya tiene vinculados (los que se pudieron leer). */
  vinculados: RequerimientoCompra[];
  /** Unidades base del ítem que todavía no cubre ningún requerimiento vinculado. */
  disponible: number;
}

/** Selección del usuario: ítem de OC → ids de requerimientos a vincular. */
export type SeleccionConciliacion = Map<string, string[]>;

const norm = (s?: string | null) => (s ?? '').trim().toUpperCase();

/**
 * Todos los requerimientos que un ítem de OC tiene vinculados: el principal
 * (`requerimientoId`, el que cierran los ingresos históricos) más los
 * adicionales de una conciliación múltiple. Sin duplicados ni vacíos.
 */
export function requerimientosDeItem(item: { requerimientoId?: string | null; requerimientoIds?: string[] | null }): string[] {
  return [...new Set([item.requerimientoId, ...(item.requerimientoIds ?? [])].filter((id): id is string => !!id))];
}

/**
 * Para cada ítem de la OC sin requerimiento, los requerimientos abiertos del
 * mismo artículo (por id, o por código si el ítem no tiene id). Un
 * requerimiento ya vinculado a otra OC, o ya referenciado por otro ítem de
 * ESTA OC, no es candidato. Si dos ítems son del mismo artículo, los
 * candidatos se ofrecen en el primero.
 *
 * Solo devuelve los ítems que tienen al menos un candidato.
 */
export function candidatosConciliacion(
  oc: Pick<OrdenCompra, 'items'>,
  reqs: RequerimientoCompra[],
  /** Requerimientos ya vinculados a los ítems, leídos por id (para saber cuánto cubren). */
  vinculadosConocidos: RequerimientoCompra[] = [],
): GrupoConciliacion[] {
  const items = oc.items ?? [];
  const yaVinculados = new Set(items.flatMap(requerimientosDeItem));
  const abiertos = reqs.filter(r =>
    REQ_ESTADOS_CONCILIABLES.has(r.estado) && !r.ordenCompraId && !yaVinculados.has(r.id));
  const conocidos = new Map(vinculadosConocidos.map(r => [r.id, r]));

  const usados = new Set<string>();
  const grupos: GrupoConciliacion[] = [];
  for (const item of items) {
    const idsVinculados = requerimientosDeItem(item);
    const vinculados = idsVinculados.map(id => conocidos.get(id)).filter((r): r is RequerimientoCompra => !!r);
    // Un vinculado que no se pudo leer: no se sabe cuánto cubre → se asume que cubre todo.
    const disponible = idsVinculados.length > vinculados.length
      ? 0
      : Math.max(0, cantidadBaseItem(item) - vinculados.reduce((a, r) => a + r.cantidad, 0));
    const codigo = norm(item.articuloCodigo);
    const candidatos = abiertos.filter(r => {
      if (usados.has(r.id)) return false;
      if (item.articuloId && r.articuloId) return r.articuloId === item.articuloId;
      return !!codigo && norm(r.articuloCodigo) === codigo;
    });
    if (candidatos.length === 0) continue;
    candidatos.forEach(r => usados.add(r.id));
    grupos.push({ item, candidatos, vinculados, disponible });
  }
  return grupos;
}

/**
 * Por qué no hay nada para vincular, para decirlo en vez de un genérico
 * "no hay requerimientos": o todos los ítems ya tienen el suyo, o los que no
 * tienen no matchean ningún requerimiento abierto.
 */
export function motivoSinCandidatos(items: ItemOC[]): string {
  const sinReq = items.filter(it => requerimientosDeItem(it).length === 0);
  if (items.length > 0 && sinReq.length === 0) return 'Todos los ítems de esta OC ya tienen requerimiento vinculado y no hay otros abiertos de los mismos artículos.';
  const codigos = sinReq.map(it => it.articuloCodigo || it.descripcion).filter(Boolean).slice(0, 4).join(', ');
  return `No hay requerimientos abiertos para los ítems sin requerimiento de esta OC${codigos ? ` (${codigos}${sinReq.length > 4 ? '…' : ''})` : ''}.`;
}

/** "1 para Basf (Ppto P3-005225-01) + 2 stock mínimo", o el presupuesto, o el origen. */
export function resumenRequerimiento(r: RequerimientoCompra): string {
  const partes = (r.desglose ?? []).map(d =>
    d.concepto === 'cliente'
      ? `${d.cantidad} para ${d.clienteNombre || 'cliente'}${d.presupuestoNumero ? ` (Ppto ${d.presupuestoNumero})` : ''}`
      : `${d.cantidad} stock mínimo`);
  if (partes.length > 0) return partes.join(' + ');
  if (r.presupuestoNumero) return `Ppto ${r.presupuestoNumero}`;
  return ORIGEN_REQUERIMIENTO_LABELS[r.origen] ?? r.origen;
}

/**
 * Propuesta inicial: con UN candidato se propone vinculado (es el match
 * automático); con varios no se propone nada — el comprador elige. Si la OC
 * ya está cubierta por lo vinculado, tampoco se propone.
 */
export function seleccionInicial(grupos: GrupoConciliacion[]): SeleccionConciliacion {
  const sel: SeleccionConciliacion = new Map();
  for (const g of grupos) {
    sel.set(g.item.id, g.candidatos.length === 1 && g.disponible > 0 ? [g.candidatos[0].id] : []);
  }
  return sel;
}

/**
 * Ítems de la OC con los requerimientos elegidos estampados. El primero va en
 * `requerimientoId` (lo que cierran los ingresos de siempre) y la lista
 * completa en `requerimientoIds`.
 */
export function aplicarSeleccionAItems(items: ItemOC[], seleccion: SeleccionConciliacion): ItemOC[] {
  return items.map(it => {
    const nuevos = seleccion.get(it.id) ?? [];
    if (nuevos.length === 0) return it;
    // Se SUMAN a los ya vinculados: el principal sigue siendo el de siempre
    // (es el que cierran los ingresos históricos).
    const previos = requerimientosDeItem(it);
    const ids = [...new Set([...previos, ...nuevos])];
    return { ...it, requerimientoId: ids[0], requerimientoIds: ids };
  });
}

export interface RepartoRequerimiento {
  req: RequerimientoCompra;
  /** Unidades del requerimiento que cubre esta OC. */
  cubierta: number;
  /** Unidades que quedan sin cubrir (→ requerimiento nuevo pendiente). */
  saldo: number;
}

/** Cantidad del ítem en unidades BASE (las del requerimiento): envase × factor. */
export function cantidadBaseItem(item: Pick<ItemOC, 'cantidad' | 'presentacion'>): number {
  const factor = item.presentacion?.factor;
  return factor && factor > 0 ? item.cantidad * factor : item.cantidad;
}

/**
 * Reparte la cantidad del ítem entre los requerimientos elegidos, en el orden
 * dado: el primero se cubre entero antes de pasar al siguiente. Lo que sobra
 * de la OC (compra de más) no se asigna a nadie.
 */
export function repartirCantidad(item: Pick<ItemOC, 'cantidad' | 'presentacion'>, reqs: RequerimientoCompra[], disponible?: number): RepartoRequerimiento[] {
  // `disponible`: lo que la OC todavía puede cubrir descontando vinculados previos.
  let resto = disponible ?? cantidadBaseItem(item);
  return reqs.map(req => {
    const cubierta = Math.min(req.cantidad, Math.max(0, resto));
    resto -= cubierta;
    return { req, cubierta, saldo: req.cantidad - cubierta };
  });
}

/** Ids de requerimientos elegidos en toda la selección, sin repetir. */
export function idsSeleccionados(seleccion: SeleccionConciliacion): string[] {
  return [...new Set([...seleccion.values()].flat())];
}
