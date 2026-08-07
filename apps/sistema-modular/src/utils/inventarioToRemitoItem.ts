import type { RemitoItem, TipoRemitoItem } from '@ags/shared';
import type { InventarioItem } from '../hooks/useInventarioIngeniero';

/**
 * Convierte un InventarioItem (del inventario de ingeniero) a RemitoItem.
 * Mapea los campos según el tipo de entidad y usa `?? null` para Firestore safety.
 */
export function inventarioToRemitoItem(
  item: InventarioItem,
  tipoRemitoItem: TipoRemitoItem = 'entrega',
): RemitoItem {
  const cantidadNeta = item.cantidad - item.cantidadDevuelta - item.cantidadConsumida;

  return {
    id: crypto.randomUUID(),
    unidadId: item.unidadId ?? '',
    articuloId: item.articuloId ?? '',
    // Un patrón no tiene unidad de stock: su código de kit va a la columna
    // Producto y el LOTE a la descripción, que es lo que identifica la
    // instancia física que se llevó el IST (2026-08-07).
    articuloCodigo: item.articuloCodigo ?? item.patronCodigo ?? '',
    articuloDescripcion: item.articuloDescripcion ?? [
      item.patronDescripcion,
      item.patronLote ? `Lote ${item.patronLote}` : null,
    ].filter(Boolean).join(' · ') ?? '',
    cantidad: cantidadNeta > 0 ? cantidadNeta : 1,
    tipoItem: tipoRemitoItem,
    devuelto: false,
    fechaDevolucion: null,
    // Multi-tipo
    minikitId: item.minikitId ?? null,
    minikitCodigo: item.minikitCodigo ?? null,
    instrumentoId: item.instrumentoId ?? null,
    // Sin código en la asignación: NO estampar el ID (2026-08-06 — el remito
    // salía impreso con la clave primaria como "código"). El nombre va en la
    // descripción.
    instrumentoCodigo: null,
    instrumentoDescripcion: item.instrumentoNombre ?? null,
    dispositivoId: item.dispositivoId ?? null,
    dispositivoCodigo: null,
    dispositivoDescripcion: item.dispositivoDescripcion ?? null,
    vehiculoId: item.vehiculoId ?? null,
    vehiculoCodigo: item.vehiculoPatente ?? null,
    vehiculoDescripcion: null,
    loanerId: item.loanerId ?? null,
    loanerCodigo: item.loanerCodigo ?? null,
    loanerDescripcion: null,
    tipoEntidad: item.tipo ?? null,
    asignacionId: item.asignacionId ?? null,
    asignacionItemId: item.id ?? null,
    // OT de la línea: la asignación ya la trae por item (2026-08-07).
    otNumber: item.otNumber ?? null,
  };
}

/**
 * Muchos items de ficha se cargaron sin código de artículo, con el modelo
 * escrito al principio de la descripción: "G7129A — Inyector automático"
 * (2026-08-07). Este helper lo rescata para la columna Producto en vez de
 * imprimir S/C teniendo el código a la vista.
 *
 * Es deliberadamente restrictivo — solo matchea un prefijo que PARECE código:
 * sin espacios, con al menos un dígito, separado por guión largo o medio. Así
 * "Detector de fluorescencia (FLD) — ..." no se confunde con un código.
 */
const CODIGO_EN_DESCRIPCION = /^([^\s·]{2,20})\s+[—-]\s+(.+)$/;

export function partirCodigoDescripcion(texto: string | null | undefined): { codigo: string | null; resto: string } {
  const t = (texto || '').trim();
  const m = t.match(CODIGO_EN_DESCRIPCION);
  if (!m) return { codigo: null, resto: t };
  const posibleCodigo = m[1];
  if (!/\d/.test(posibleCodigo)) return { codigo: null, resto: t };
  return { codigo: posibleCodigo, resto: m[2].trim() };
}

/** Resuelve código para display según tipoEntidad del RemitoItem */
export function getRemitoItemCodigo(item: RemitoItem): string {
  if (item.tipoEntidad === 'instrumento') return item.instrumentoCodigo || '';
  if (item.tipoEntidad === 'dispositivo') return item.dispositivoCodigo || '';
  if (item.tipoEntidad === 'vehiculo') return item.vehiculoCodigo || '';
  if (item.tipoEntidad === 'minikit') return item.minikitCodigo || '';
  // Loaner: SIEMPRE el código de artículo. El identificador interno del loaner
  // (LNR-xxxx) no se declara en ningún remito. Sin código queda vacío; el "S/C"
  // del papel lo pone remitoImprimir (2026-08-07).
  if (item.tipoEntidad === 'loaner') {
    return item.articuloCodigo
      || partirCodigoDescripcion(item.loanerDescripcion).codigo
      || '';
  }
  // Items de ficha: si no tiene código cargado, se intenta rescatar del texto.
  return item.articuloCodigo
    || partirCodigoDescripcion(item.articuloDescripcion || item.fichaDescripcion).codigo
    || '';
}

/** Resuelve descripción para display según tipoEntidad del RemitoItem */
export function getRemitoItemDescripcion(item: RemitoItem): string {
  if (item.tipoEntidad === 'instrumento') return item.instrumentoDescripcion || '';
  if (item.tipoEntidad === 'dispositivo') return item.dispositivoDescripcion || '';
  if (item.tipoEntidad === 'vehiculo') return item.vehiculoDescripcion || '';
  if (item.tipoEntidad === 'minikit') return item.minikitCodigo || '';
  // Loaner: nunca el LNR como descripción (2026-08-07) — es un identificador
  // interno, no dice qué equipo es. Si no hay descripción, mejor vacío.
  if (item.tipoEntidad === 'loaner') {
    return sinCodigoRedundante(item, item.loanerDescripcion || item.articuloDescripcion);
  }
  // Items de ficha (devolución / derivación): su texto vive en fichaDescripcion
  // — sin este fallback la columna Descripción salía VACÍA en el detalle y en
  // el listado desplegable de remitos (2026-08-07).
  return sinCodigoRedundante(item, item.articuloDescripcion || item.fichaDescripcion);
}

/**
 * Si el código se rescató del propio texto, se lo saca de la descripción: ya
 * tiene su columna y repetirlo ocupa el ancho útil del papel (2026-08-07).
 * Si el item traía código propio, la descripción no se toca.
 */
function sinCodigoRedundante(item: RemitoItem, texto: string | null | undefined): string {
  if (item.articuloCodigo) return (texto || '').trim();
  const { codigo, resto } = partirCodigoDescripcion(texto);
  return codigo ? resto : (texto || '').trim();
}

const TIPO_ENTIDAD_LABELS: Record<string, string> = {
  articulo: 'Artículo',
  minikit: 'Minikit',
  loaner: 'Loaner',
  instrumento: 'Instrumento',
  dispositivo: 'Dispositivo',
  vehiculo: 'Vehículo',
  patron: 'Patrón',
};

export function getTipoEntidadLabel(tipo: string): string {
  return TIPO_ENTIDAD_LABELS[tipo] || tipo;
}
