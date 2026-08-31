import type { StockSelection, UnidadStock, CondicionUnidad } from '@ags/shared';
import type { StockPosicion, PartStockInfo, PatronLoteOrigen, RemitoItemOrigen, AsignacionItemOrigen } from '../../hooks/useCierreStockUnits';

const CONDICION_LABEL: Record<CondicionUnidad, string> = {
  nuevo: 'Nuevo', bien_de_uso: 'Bien de uso', reacondicionado: 'Reacond.',
  vendible: 'Vendible', scrap: 'Scrap',
};

/** Etiqueta de una unidad para el dropdown: serie/lote + ubicación + condición. */
export function unidadLabel(u: UnidadStock): string {
  const ident = u.nroSerie
    ? `S/N ${u.nroSerie}`
    : u.nroLote
      ? `Lote ${u.nroLote}${(u.cantidad ?? 1) > 1 ? ` (×${u.cantidad})` : ''}`
      : 'Sin ident.';
  return `${ident} · ${u.ubicacion?.referenciaNombre ?? 'Sin ubicación'} · ${CONDICION_LABEL[u.condicion] ?? u.condicion}`;
}

/**
 * Para quién está apartada una unidad reservada (2026-08-20). Va al sub-rótulo
 * del desplegable: quien cierra tiene que ver a qué presupuesto le está
 * gastando la pieza antes de elegirla, no después.
 */
export function subReservaUnidad(u: UnidadStock): string | undefined {
  const partes: string[] = [];
  if (u.estado === 'reservado') {
    const cliente = u.reservadoParaClienteNombre?.trim();
    const ppto = u.reservadoParaPresupuestoNumero?.trim();
    const quien = [cliente, ppto ? `(${ppto})` : null].filter(Boolean).join(' ');
    partes.push(`RESERVADO ${quien || 'sin identificar'}`);
  }
  // De dónde salió la pieza (2026-08-20): un repuesto canibalizado de un loaner
  // se ve igual que uno comprado, y no lo es — hay que saberlo al elegirlo.
  if (u.origenLoanerCodigo) partes.push(`de ${u.origenLoanerCodigo}`);
  return partes.length > 0 ? partes.join(' · ') : undefined;
}

/** Etiqueta de un lote de patrón: lote + saldo + vencimiento. */
function loteLabel(l: PatronLoteOrigen): string {
  const saldo = l.cantidad != null ? ` (×${l.cantidad})` : '';
  const vto = l.fechaVencimiento ? ` · vto ${l.fechaVencimiento.slice(0, 10)}` : '';
  return `Lote ${l.lote}${saldo}${vto}`;
}

/** Opciones de origen unificadas (patrón + remito en campo + stock) para el select de una parte. */
export type OrigenOption =
  | { kind: 'patron'; value: string; label: string; sub?: string; lote: PatronLoteOrigen }
  | { kind: 'remito'; value: string; label: string; sub?: string; remito: RemitoItemOrigen }
  | { kind: 'asignacion'; value: string; label: string; sub?: string; asignacion: AsignacionItemOrigen }
  | { kind: 'unidad'; value: string; label: string; sub?: string; unidad: UnidadStock }
  | { kind: 'posicion'; value: string; label: string; sub?: string; pos: StockPosicion };

export function buildOptions(stock: PartStockInfo): OrigenOption[] {
  const opts: OrigenOption[] = [];
  for (const l of stock.patronLotes) {
    opts.push({ kind: 'patron', value: `patron:${l.lote}`, label: loteLabel(l), lote: l });
  }
  // Remitos en campo (2026-08-04): el material ya salió con un remito de salida —
  // descargarlo desde acá consume desde el remito y lo cierra si queda resuelto.
  for (const r of stock.remitoOrigenes) {
    opts.push({
      kind: 'remito',
      value: `remito:${r.remitoId}:${r.itemId}`,
      label: `Remito ${r.remitoNumero} — ${r.ingenieroNombre} (×${r.cantidad})${r.serie ? ` · S/N ${r.serie}` : ''}`,
      // La misma unidad puede venir de varios remitos abiertos: se ofrece una
      // sola vez y acá se dice de dónde más viene (2026-08-24).
      sub: r.tambienEn?.length ? `también en ${r.tambienEn.join(', ')}` : undefined,
      remito: r,
    });
  }
  // En poder de un ingeniero por ASIGNACIÓN (2026-08-27): consumirlo desde el
  // cierre imputa la OT en la asignación, la unidad, el remito interno y el
  // kardex — el desvío por el inventario (con la OT tipeada a mano) sobra.
  for (const a of stock.asignacionOrigenes) {
    opts.push({
      kind: 'asignacion',
      value: `asignacion:${a.asignacionId}:${a.itemId}`,
      label: `En poder de ${a.ingenieroNombre} (×${a.cantidad})${a.serie ? ` · S/N ${a.serie}` : ''}`,
      asignacion: a,
    });
  }
  if (stock.requiereTrazabilidad) {
    for (const u of stock.unidades) {
      opts.push({ kind: 'unidad', value: `unidad:${u.id}`, label: unidadLabel(u), sub: subReservaUnidad(u), unidad: u });
    }
  } else {
    // Con varias bases mezcladas (envase declarado por más de un artículo), el
    // código de cada pool va en la etiqueta — si no, dos posiciones se ven igual.
    const variasBases = new Set(stock.posiciones.map(p => p.articuloId)).size > 1;
    for (const p of stock.posiciones) {
      opts.push({
        kind: 'posicion',
        // El value lleva el artículo: la misma ubicación puede alojar pools
        // distintos y `referenciaId` solo ya no identifica la opción.
        value: `posicion:${p.referenciaId}:${p.articuloId}`,
        label: `${p.referenciaNombre} (×${p.cantidad})${variasBases ? ` · ${p.articuloCodigo}` : ''}`,
        // Una posición agrupa varias unidades: puede juntar reservas de más de
        // un presupuesto, y todas tienen que verse.
        sub: p.reservas.length > 0 ? `RESERVADO ${p.reservas.join(' · ')}` : undefined,
        pos: p,
      });
    }
  }
  return opts;
}

/**
 * Cuántas unidades cubre una opción de origen, acotado a lo que todavía falta
 * cubrir de la parte. Una unidad serializada aporta 1; un lote, un remito o una
 * posición aportan hasta su saldo. Mínimo 1 — elegir un origen siempre cuenta.
 */
export function aporteDeOpcion(opt: OrigenOption, pendiente: number): number {
  const cap = Math.max(1, pendiente);
  switch (opt.kind) {
    case 'unidad': return Math.min(opt.unidad.cantidad ?? 1, cap);
    case 'remito': return Math.min(opt.remito.cantidad, cap);
    case 'asignacion': return Math.min(opt.asignacion.cantidad, cap);
    case 'posicion': return Math.min(opt.pos.cantidad, cap);
    case 'patron': return Math.min(opt.lote.cantidad ?? cap, cap);
  }
}

/** Campos de la StockSelection que define el origen elegido. */
export function patchFromOption(opt: OrigenOption, stock: PartStockInfo): Partial<StockSelection> {
  switch (opt.kind) {
    // Unidad puntual (artículos con serie/lote). La unidad define el origen.
    case 'unidad':
      return {
        articuloId: opt.unidad.articuloId,
        origenTipo: opt.unidad.ubicacion?.tipo === 'ingeniero' ? 'ingeniero' : 'posicion',
        origenId: opt.unidad.ubicacion?.referenciaId ?? '',
        origenNombre: opt.unidad.ubicacion?.referenciaNombre ?? 'Sin ubicación',
        unidadStockId: opt.unidad.id,
        nroSerie: opt.unidad.nroSerie ?? null,
        nroLote: opt.unidad.nroLote ?? null,
        origenLoanerCodigo: opt.unidad.origenLoanerCodigo ?? null,
        patronId: null,
        patronLote: null,
      };
    // Remito en campo: al cerrar se consume desde el remito.
    case 'remito':
      return {
        articuloId: stock.articulo?.id ?? null,
        origenTipo: 'remito',
        origenId: opt.remito.remitoId,
        origenNombre: `Remito ${opt.remito.remitoNumero} — ${opt.remito.ingenieroNombre}`,
        remitoId: opt.remito.remitoId,
        remitoNumero: opt.remito.remitoNumero,
        remitoItemId: opt.remito.itemId,
        unidadStockId: null,
        nroSerie: opt.remito.serie,
        nroLote: null,
        patronId: null,
        patronLote: null,
      };
    // Ítem asignado a un ingeniero: al cerrar se consume vía la asignación
    // (asignacionesService.consumirItems con la OT).
    case 'asignacion':
      return {
        articuloId: stock.articulo?.id ?? null,
        origenTipo: 'ingeniero',
        origenId: opt.asignacion.asignacionId,
        origenNombre: `En poder de ${opt.asignacion.ingenieroNombre}`,
        asignacionId: opt.asignacion.asignacionId,
        asignacionItemId: opt.asignacion.itemId,
        unidadStockId: null,
        nroSerie: opt.asignacion.serie,
        nroLote: null,
        patronId: null,
        patronLote: null,
      };
    // Lote de patrón (activo). Descuenta la cantidad del lote al cerrar.
    case 'patron':
      return {
        articuloId: null,
        unidadStockId: null,
        origenTipo: 'patron',
        origenId: opt.lote.patronId,
        origenNombre: `Patrón ${opt.lote.patronCodigo} · Lote ${opt.lote.lote}`,
        patronId: opt.lote.patronId,
        patronLote: opt.lote.lote,
        nroSerie: null,
        nroLote: opt.lote.lote,
      };
    // Posición de descarga (artículos sin trazabilidad). El artículo es el de la
    // posición, no el "principal" de la parte: con varias bases cada posición
    // descuenta de su propio pool.
    case 'posicion':
      return {
        articuloId: opt.pos.articuloId || (stock.articulo?.id ?? null),
        origenTipo: opt.pos.tipo === 'ingeniero' ? 'ingeniero' : 'posicion',
        origenId: opt.pos.referenciaId,
        origenNombre: opt.pos.referenciaNombre,
        unidadStockId: null,
        patronId: null,
        patronLote: null,
      };
  }
}

/** Value del select que refleja una selección guardada (espejo de buildOptions). */
export function selectionValue(sel: StockSelection): string {
  if (sel.origenTipo === 'patron' && sel.patronLote) return `patron:${sel.patronLote}`;
  if (sel.origenTipo === 'remito' && sel.remitoId && sel.remitoItemId) return `remito:${sel.remitoId}:${sel.remitoItemId}`;
  if (sel.asignacionId && sel.asignacionItemId) return `asignacion:${sel.asignacionId}:${sel.asignacionItemId}`;
  if (sel.unidadStockId) return `unidad:${sel.unidadStockId}`;
  if (sel.origenId) return `posicion:${sel.origenId}:${sel.articuloId ?? ''}`;
  return '';
}

/** Texto corto de una selección ya guardada, para la vista read-only del cierre. */
export function selectionResumen(sel: StockSelection): string {
  if (sel.origenTipo === 'patron' || sel.origenTipo === 'remito') return sel.origenNombre || '—';
  if (sel.nroSerie) return `S/N ${sel.nroSerie}`;
  if (sel.nroLote) return `Lote ${sel.nroLote}`;
  return sel.origenNombre || '—';
}
