import type { Importacion, ItemImportacion } from '@ags/shared';

/**
 * Estado de recepción de un embarque de importación (I3 — recepciones parciales).
 * Todo se deriva del acumulado `items[].cantidadRecibida`, que `useIngresarStock`
 * suma en cada recepción. No hay campo espejo que pueda desincronizarse.
 */

/** Cantidad que falta ingresar de un ítem (pedido − recibido acumulado, piso 0). */
export const pendienteDeItem = (it: ItemImportacion): number =>
  Math.max(0, (it.cantidadPedida || 0) - (it.cantidadRecibida ?? 0));

export interface ResumenRecepcion {
  /** Total de unidades pedidas en el embarque. */
  pedido: number;
  /** Total ingresado, capado a lo pedido por ítem (un sobrante físico no infla el avance). */
  recibido: number;
  /** Hubo al menos una recepción registrada. */
  huboRecepcion: boolean;
  /** Todo lo pedido ya ingresó al stock. */
  completo: boolean;
  /** Ítems con cantidad pendiente de ingreso. */
  faltantes: { item: ItemImportacion; pendiente: number }[];
}

/** Resume el avance de recepción del embarque a partir de sus ítems. */
export function resumenRecepcion(imp: Pick<Importacion, 'items'>): ResumenRecepcion {
  const items = imp.items ?? [];
  const pedido = items.reduce((s, it) => s + (it.cantidadPedida || 0), 0);
  const recibido = items.reduce(
    (s, it) => s + Math.min(it.cantidadRecibida ?? 0, it.cantidadPedida || 0),
    0,
  );
  const faltantes = items
    .map(item => ({ item, pendiente: pendienteDeItem(item) }))
    .filter(f => f.pendiente > 0);
  return {
    pedido,
    recibido,
    huboRecepcion: items.some(it => (it.cantidadRecibida ?? 0) > 0),
    completo: items.length > 0 && faltantes.length === 0,
    faltantes,
  };
}

/** Texto "COD — desc: faltan N um" por ítem, para la nota de cierre incompleto y confirmaciones. */
export const describirFaltantes = (faltantes: ResumenRecepcion['faltantes']): string =>
  faltantes
    .map(f => `${f.item.articuloCodigo ? `${f.item.articuloCodigo} — ` : ''}${f.item.descripcion}: faltan ${f.pendiente} ${f.item.unidadMedida}`)
    .join('\n');
