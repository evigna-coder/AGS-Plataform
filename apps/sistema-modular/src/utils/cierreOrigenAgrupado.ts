/**
 * Origen AGRUPADO en el cierre de OT (2026-09-21).
 *
 * Dos unidades del mismo artículo que salieron en el mismo remito son dos
 * líneas del remito (una unidad = una línea), y el cuadro "Origen de
 * materiales" las ofrecía como dos opciones idénticas: "Remito 17519 — Ing (×1)"
 * dos veces, a elegir una por una hasta cubrir la cantidad. Acá se juntan en
 * UNA opción con la cantidad sumada; al elegirla se reparte entre las líneas
 * de abajo, así lo que se guarda y se descuenta sigue siendo una selección
 * por línea de remito (el consumo, la reversión y el kardex no cambian).
 *
 * Puro: sin Firebase, testeable con `test:cierre-origen-agrupado`.
 */

export interface OrigenAgrupable {
  /** Pendiente en campo de la línea. */
  cantidad: number;
  serie: string | null;
}

/**
 * Junta las líneas SIN serie que comparten clave (mismo remito / misma
 * asignación) en un representante con `cantidad` sumada y las líneas
 * originales en `miembros`. Las serializadas quedan sueltas: son piezas
 * distinguibles y quien cierra elige cuál salió. Un grupo de una sola
 * línea vuelve a ser la línea pelada.
 */
export function agruparOrigenes<T extends OrigenAgrupable & { miembros?: T[] }>(
  origenes: T[],
  claveDe: (o: T) => string,
): T[] {
  const out: T[] = [];
  const porClave = new Map<string, T>();
  for (const o of origenes) {
    if (o.serie) { out.push(o); continue; }
    const clave = claveDe(o);
    const grupo = porClave.get(clave);
    if (!grupo) {
      const nuevo = { ...o, miembros: [o] };
      porClave.set(clave, nuevo);
      out.push(nuevo);
      continue;
    }
    grupo.miembros!.push(o);
    grupo.cantidad += o.cantidad;
  }
  return out.map(o => (o.miembros && o.miembros.length === 1 ? o.miembros[0] : o));
}

/** Reparte `cantidad` entre miembros en orden, hasta el disponible de cada uno. */
export function repartirEntreMiembros(cantidad: number, disponibles: number[]): number[] {
  let resto = Math.max(0, cantidad);
  return disponibles.map(d => {
    const toma = Math.min(d, resto);
    resto -= toma;
    return toma;
  });
}

/** Una fila visible del cuadro: una o varias selecciones del mismo origen. */
export interface FilaOrigen {
  /** Value de la opción que la representa (agrupada o suelta). */
  value: string;
  /** Posiciones en la lista de selecciones de la parte, ascendentes. */
  indices: number[];
  cantidad: number;
  /** Ya descontada del stock: se muestra sola y bloqueada. */
  deducida: boolean;
}

/**
 * Agrupa las selecciones guardadas por el origen que las representa. Las ya
 * descontadas no se juntan con nada: cada una es su propio asiento.
 */
export function agruparSelecciones<S extends { cantidad?: number | null; deducidoAt?: string | null }>(
  selections: S[],
  valorDe: (s: S) => string,
): FilaOrigen[] {
  const filas: FilaOrigen[] = [];
  const abiertas = new Map<string, FilaOrigen>();
  selections.forEach((s, i) => {
    const value = valorDe(s);
    const cantidad = s.cantidad ?? 1;
    if (s.deducidoAt) { filas.push({ value, indices: [i], cantidad, deducida: true }); return; }
    const fila = abiertas.get(value);
    if (fila) { fila.indices.push(i); fila.cantidad += cantidad; return; }
    const nueva = { value, indices: [i], cantidad, deducida: false };
    abiertas.set(value, nueva);
    filas.push(nueva);
  });
  return filas;
}
