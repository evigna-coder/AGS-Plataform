/**
 * Una unidad física = UNA opción de origen al cerrar la OT (2026-08-24).
 *
 * Una misma unidad puede estar referida por más de un remito abierto: sale a
 * campo con el ingeniero (`salida_campo`) y después se entrega al cliente
 * (`entrega_cliente`). Las dos líneas son legítimas —son movimientos distintos
 * del mismo bien— pero el cierre ofrecía DOS lugares de descarga para una sola
 * placa, y elegir cualquiera consumía la misma unidad.
 *
 * Vive acá y no en `useCierreStockUnits` para poder testearlo sin arrastrar
 * Firebase, igual que el resto de la lógica pura del repo.
 */

export interface RemitoItemOrigen {
  remitoId: string;
  remitoNumero: string;
  itemId: string;
  ingenieroNombre: string;
  /** Cantidad pendiente del item (cantidad − consumida). */
  cantidad: number;
  serie: string | null;
  /** Unidad física que respalda la línea. Es la clave para no ofrecerla dos veces. */
  unidadId?: string | null;
  /** Otros remitos abiertos que refieren la MISMA unidad, para no ocultar el dato. */
  tambienEn?: string[];
}

/**
 * Deja una opción por unidad: la del remito MÁS RECIENTE, que es donde está el
 * bien ahora. Los otros quedan en `tambienEn` — se ocultan de la lista, no del
 * usuario.
 *
 * Las líneas sin `unidadId` (documentales: loaner, ficha, instrumento) pasan
 * enteras: sin unidad no hay forma de saber si son la misma cosa.
 */
export function dedupPorUnidad(origenes: RemitoItemOrigen[]): RemitoItemOrigen[] {
  const porUnidad = new Map<string, RemitoItemOrigen[]>();
  const sinUnidad: RemitoItemOrigen[] = [];
  for (const o of origenes) {
    if (!o.unidadId) { sinUnidad.push(o); continue; }
    const lista = porUnidad.get(o.unidadId) ?? [];
    lista.push(o);
    porUnidad.set(o.unidadId, lista);
  }

  const dedup: RemitoItemOrigen[] = [];
  for (const lista of porUnidad.values()) {
    if (lista.length === 1) { dedup.push(lista[0]); continue; }
    // Se recorre en el orden en que vienen los remitos; el último que refiere
    // la unidad es el movimiento más nuevo.
    const ultimo = lista[lista.length - 1];
    dedup.push({ ...ultimo, tambienEn: lista.slice(0, -1).map(o => o.remitoNumero) });
  }
  return [...dedup, ...sinUnidad];
}
