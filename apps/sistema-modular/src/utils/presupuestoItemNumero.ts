/**
 * Numeración de las líneas de un presupuesto (2026-08-23).
 *
 * Hasta ahora las líneas no se enumeraban: para pedir un cambio había que
 * describir el ítem ("sacame el del detector"). Con número, el cliente y
 * nosotros hablamos del mismo renglón.
 *
 * Dos formas, según el presupuesto:
 *  - Plano (servicios, partes, ventas): `1, 2, 3`.
 *  - Agrupado por sistema (contrato, equipos): `1.1, 1.2, 2.1` — el primer
 *    número es el sistema y el segundo la línea dentro de él.
 *
 * El número del grupo es su POSICIÓN en el presupuesto, no el valor crudo de
 * `item.grupo`. Ese valor puede tener huecos (un sistema que se sacó deja su
 * número libre) y el cliente vería "3." arriba del segundo bloque. La posición
 * es la que se imprime en el encabezado del grupo, así que encabezado y líneas
 * dicen lo mismo.
 *
 * La numeración es POSICIONAL y se recalcula siempre: no se persiste. Si se
 * borra la línea 2, la que era 3 pasa a ser 2. Es lo correcto para un
 * presupuesto —el documento se reemite entero— y es lo contrario de las OT,
 * donde el número identifica trabajo ya ejecutado y no se puede reutilizar.
 */

export interface ItemNumerable {
  id: string;
  grupo?: number | null;
}

export interface NumeracionPresupuesto {
  /** id del ítem → etiqueta a mostrar ("3" o "2.1"). */
  etiquetaPorItem: Map<string, string>;
  /** valor crudo de `grupo` → posición del grupo (1-based). */
  posicionPorGrupo: Map<number, number>;
  /** true si el presupuesto tiene líneas agrupadas por sistema. */
  agrupado: boolean;
}

export function numerarItemsPresupuesto(items: ItemNumerable[]): NumeracionPresupuesto {
  const etiquetaPorItem = new Map<string, string>();
  const posicionPorGrupo = new Map<number, number>();

  const agrupado = items.some(i => (i.grupo ?? 0) > 0);

  if (!agrupado) {
    items.forEach((item, i) => etiquetaPorItem.set(item.id, String(i + 1)));
    return { etiquetaPorItem, posicionPorGrupo, agrupado: false };
  }

  // Mismo orden que `agruparPorSistemaSimple`: por valor de grupo ascendente,
  // con el bucket 0 ("Servicios generales") primero si existe.
  const gruposOrdenados = [...new Set(items.map(i => i.grupo ?? 0))].sort((a, b) => a - b);
  gruposOrdenados.forEach((g, i) => posicionPorGrupo.set(g, i + 1));

  const contadorPorGrupo = new Map<number, number>();
  for (const item of items) {
    const g = item.grupo ?? 0;
    const n = (contadorPorGrupo.get(g) ?? 0) + 1;
    contadorPorGrupo.set(g, n);
    etiquetaPorItem.set(item.id, `${posicionPorGrupo.get(g)}.${n}`);
  }

  return { etiquetaPorItem, posicionPorGrupo, agrupado: true };
}
