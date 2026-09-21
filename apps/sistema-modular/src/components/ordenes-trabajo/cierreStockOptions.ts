import type { StockSelection, UnidadStock, CondicionUnidad } from '@ags/shared';
import type { StockPosicion, PartStockInfo, PatronLoteOrigen, RemitoItemOrigen, AsignacionItemOrigen } from '../../hooks/useCierreStockUnits';
import { agruparOrigenes, repartirEntreMiembros } from '../../utils/cierreOrigenAgrupado';

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

function opcionRemito(r: RemitoItemOrigen): OrigenOption {
  const miembros = r.miembros ?? [r];
  const tambienEn = Array.from(new Set(miembros.flatMap(m => m.tambienEn ?? [])));
  return {
    kind: 'remito',
    // Agrupado: los ids de todas las líneas, así el value sigue siendo único.
    value: `remito:${r.remitoId}:${miembros.map(m => m.itemId).join('+')}`,
    label: `Remito ${r.remitoNumero} — ${r.ingenieroNombre} (×${r.cantidad})${r.serie ? ` · S/N ${r.serie}` : ''}`,
    // La misma unidad puede venir de varios remitos abiertos: se ofrece una
    // sola vez y acá se dice de dónde más viene (2026-08-24).
    sub: tambienEn.length ? `también en ${tambienEn.join(', ')}` : undefined,
    remito: r,
  };
}

function opcionAsignacion(a: AsignacionItemOrigen): OrigenOption {
  const miembros = a.miembros ?? [a];
  return {
    kind: 'asignacion',
    value: `asignacion:${a.asignacionId}:${miembros.map(m => m.itemId).join('+')}`,
    label: `En poder de ${a.ingenieroNombre} (×${a.cantidad})${a.serie ? ` · S/N ${a.serie}` : ''}`,
    asignacion: a,
  };
}

export function buildOptions(stock: PartStockInfo): OrigenOption[] {
  const opts: OrigenOption[] = [];
  for (const l of stock.patronLotes) {
    opts.push({ kind: 'patron', value: `patron:${l.lote}`, label: loteLabel(l), lote: l });
  }
  // Remitos en campo (2026-08-04): el material ya salió con un remito de salida —
  // descargarlo desde acá consume desde el remito y lo cierra si queda resuelto.
  // Varias líneas sin serie del mismo remito = UNA opción con la suma (2026-09-21):
  // dos unidades que salieron juntas se eligen de una, no una por una.
  for (const r of agruparOrigenes(stock.remitoOrigenes, r => r.remitoId)) opts.push(opcionRemito(r));
  // En poder de un ingeniero por ASIGNACIÓN (2026-08-27): consumirlo desde el
  // cierre imputa la OT en la asignación, la unidad, el remito interno y el
  // kardex — el desvío por el inventario (con la OT tipeada a mano) sobra.
  for (const a of agruparOrigenes(stock.asignacionOrigenes, a => a.asignacionId)) opts.push(opcionAsignacion(a));
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
/** Cuanto puede aportar un origen como maximo (lo que tiene). */
export function disponibleDeOpcion(opt: OrigenOption): number {
  switch (opt.kind) {
    case 'unidad': return opt.unidad.cantidad ?? 1;
    case 'remito': return opt.remito.cantidad;
    case 'asignacion': return opt.asignacion.cantidad;
    case 'posicion': return opt.pos.cantidad;
    case 'patron': return opt.lote.cantidad ?? Infinity;
  }
}

export function aporteDeOpcion(opt: OrigenOption, pendiente: number): number {
  // Sin piso de 1 (2026-09-03): con `Math.max(1, pendiente)` un faltante de
  // 0,5 se convertia en 1 y el cierre descontaba de mas. Si no falta nada,
  // el origen aporta lo minimo que tenga sentido (su disponible, capado a 0).
  const cap = Math.max(0, pendiente);
  return Math.min(disponibleDeOpcion(opt), cap);
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

/**
 * Líneas reales detrás de una opción: un origen agrupado se abre en una opción
 * por línea de remito/asignación; el resto es su propia única línea.
 */
export function miembrosDeOpcion(opt: OrigenOption): OrigenOption[] {
  if (opt.kind === 'remito' && opt.remito.miembros) return opt.remito.miembros.map(opcionRemito);
  if (opt.kind === 'asignacion' && opt.asignacion.miembros) return opt.asignacion.miembros.map(opcionAsignacion);
  return [opt];
}

/**
 * Selecciones que produce elegir `opt` con `cantidad`: una por línea real,
 * repartida en orden hasta lo pendiente de cada una. Si no hay nada que
 * repartir (ya está todo cubierto), queda la primera línea en 0 para que el
 * usuario cargue la cantidad a mano, como siempre.
 */
export function seleccionesDeOpcion(
  opt: OrigenOption, stock: PartStockInfo, cantidad: number, base: (cantidad: number) => StockSelection,
): StockSelection[] {
  const miembros = miembrosDeOpcion(opt);
  const reparto = repartirEntreMiembros(cantidad, miembros.map(disponibleDeOpcion));
  const out = miembros.flatMap((m, i) => (reparto[i] > 0 ? [{ ...base(reparto[i]), ...patchFromOption(m, stock) }] : []));
  return out.length > 0 ? out : [{ ...base(0), ...patchFromOption(miembros[0], stock) }];
}

/** Opción que representa una selección guardada: la suya o el grupo que la contiene. */
export function opcionDeSeleccion(sel: StockSelection, options: OrigenOption[]): OrigenOption | undefined {
  const v = selectionValue(sel);
  return options.find(o => o.value === v || miembrosDeOpcion(o).some(m => m.value === v));
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
