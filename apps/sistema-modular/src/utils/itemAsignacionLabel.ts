import type { ItemAsignacion } from '@ags/shared';

/** Campos que puede traer un item asignado, según el tipo de entidad. */
type ItemLike = Partial<Pick<ItemAsignacion,
  | 'articuloDescripcion' | 'instrumentoNombre' | 'dispositivoDescripcion'
  | 'minikitCodigo' | 'loanerCodigo' | 'vehiculoPatente'
  | 'patronDescripcion' | 'patronCodigo' | 'patronLote' | 'tipo'
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
    || item.instrumentoNombre
    || item.dispositivoDescripcion
    // El LOTE identifica la instancia física del patrón: sin él, dos lotes del
    // mismo kit son indistinguibles en la lista.
    || (item.patronDescripcion
      ? [item.patronDescripcion, item.patronLote ? `Lote ${item.patronLote}` : null].filter(Boolean).join(' · ')
      : '')
    || item.patronCodigo
    || item.minikitCodigo
    || item.loanerCodigo
    || item.vehiculoPatente
    || fallback;
}
