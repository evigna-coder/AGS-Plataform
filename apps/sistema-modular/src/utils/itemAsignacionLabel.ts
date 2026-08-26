import type { ItemAsignacion } from '@ags/shared';

/** Campos que puede traer un item asignado, según el tipo de entidad. */
type ItemLike = Partial<Pick<ItemAsignacion,
  | 'articuloDescripcion' | 'instrumentoNombre' | 'instrumentoDetalle' | 'dispositivoDescripcion'
  | 'minikitCodigo' | 'loanerCodigo' | 'vehiculoPatente'
  | 'patronDescripcion' | 'patronCodigo' | 'patronLote'
  | 'columnaDescripcion' | 'columnaCodigo' | 'columnaSerie' | 'tipo'
>>;

/**
 * Nombre visible de un item asignado (2026-08-08).
 *
 * Existía repetido en cinco pantallas y ninguna contemplaba los PATRONES, que
 * recién son asignables: la card mostraba "patron" (el tipo) en vez del nombre
 * del patrón. Centralizado acá para que el próximo tipo de item que se agregue
 * se arregle en un solo lugar.
 *
 * @param fallback qué devolver si no hay ningún nombre ('' o el tipo, según la pantalla)
 */
export function descripcionItemAsignacion(item: ItemLike, fallback = ''): string {
  return item.articuloDescripcion
    // Marca/modelo antes que el nombre interno: `instrumentoNombre` es el código
    // (TER-07) y repetirlo como descripción no dice qué equipo es.
    || item.instrumentoDetalle
    || item.instrumentoNombre
    || item.dispositivoDescripcion
    // El LOTE identifica la instancia física del patrón: sin él, dos lotes del
    // mismo kit son indistinguibles en la lista.
    || (item.patronDescripcion
      ? [item.patronDescripcion, item.patronLote ? `Lote ${item.patronLote}` : null].filter(Boolean).join(' · ')
      : '')
    || item.patronCodigo
    // La SERIE identifica la columna física, igual que el lote al patrón.
    || (item.columnaDescripcion
      ? [item.columnaDescripcion, item.columnaSerie ? `S/N ${item.columnaSerie}` : null].filter(Boolean).join(' · ')
      : '')
    || item.columnaCodigo
    || item.minikitCodigo
    || item.loanerCodigo
    || item.vehiculoPatente
    || fallback;
}
