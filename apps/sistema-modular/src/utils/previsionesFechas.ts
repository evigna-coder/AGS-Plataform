/**
 * Aritmética de fechas para las previsiones de agenda (recurrencia anual).
 *
 * Todo se opera sobre strings 'YYYY-MM-DD' con math propia, sin `Date` local:
 * `new Date('2026-03-01')` se parsea como UTC y al leerlo con getDate() en AR
 * (UTC-3) devuelve el día anterior. Ese off-by-one ya mordió en agenda, así que
 * acá no se usa Date más que para calcular el día de semana (vía UTC explícito).
 */

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Parte 'YYYY-MM-DD' en [año, mes(1-12), día]. */
function parseISODate(fecha: string): [number, number, number] {
  const [y, m, d] = fecha.split('-').map(Number);
  return [y, m, d];
}

const fmt = (y: number, m: number, d: number) => `${y}-${pad2(m)}-${pad2(d)}`;

/** Cantidad de días del mes (1-12) de un año. */
function diasDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

/** Suma `n` días (puede ser negativo) a una fecha 'YYYY-MM-DD'. */
export function sumarDias(fecha: string, n: number): string {
  const [y, m, d] = parseISODate(fecha);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return fmt(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Días calendario entre dos fechas ('YYYY-MM-DD'), `hasta - desde`. */
export function diffDias(desde: string, hasta: string): number {
  const [y1, m1, d1] = parseISODate(desde);
  const [y2, m2, d2] = parseISODate(hasta);
  const ms = Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1);
  return Math.round(ms / 86400000);
}

/**
 * Misma fecha del año siguiente.
 *
 * Borde 29/2: el año siguiente no es bisiesto → se clampea al último día del mes
 * (28/2). No se corre al 1/3 a propósito: el servicio "de febrero" tiene que
 * seguir cayendo en febrero.
 */
export function mismaFechaAnioSiguiente(fecha: string): string {
  const [y, m, d] = parseISODate(fecha);
  const anio = y + 1;
  return fmt(anio, m, Math.min(d, diasDelMes(anio, m)));
}

/** true si la fecha es sábado, domingo o feriado cargado. */
export function esDiaNoHabil(fecha: string, feriados: ReadonlySet<string>): boolean {
  if (feriados.has(fecha)) return true;
  const [y, m, d] = parseISODate(fecha);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = domingo, 6 = sábado
  return dow === 0 || dow === 6;
}

/** Primer día hábil >= `fecha`. Corta a los 30 intentos por si la lista de feriados delira. */
export function siguienteDiaHabil(fecha: string, feriados: ReadonlySet<string>): string {
  let actual = fecha;
  for (let i = 0; i < 30; i++) {
    if (!esDiaNoHabil(actual, feriados)) return actual;
    actual = sumarDias(actual, 1);
  }
  return actual;
}

/**
 * Fecha destino de una previsión: el mismo bloque, un año después.
 *
 * - Preserva la duración (`fechaFin - fechaInicio` en días calendario).
 * - Si el INICIO cae sábado/domingo/feriado, corre TODO el bloque al siguiente día
 *   hábil manteniéndolo contiguo (no se parte ni se estira: fechaFin se recalcula
 *   como inicio + duración original).
 */
export function calcularFechasPrevision(
  fechaInicio: string,
  fechaFin: string,
  feriados: ReadonlySet<string>,
): { fechaInicio: string; fechaFin: string; corridoPorDiaNoHabil: boolean } {
  const duracion = Math.max(0, diffDias(fechaInicio, fechaFin));
  const tentativa = mismaFechaAnioSiguiente(fechaInicio);
  const inicio = siguienteDiaHabil(tentativa, feriados);
  return {
    fechaInicio: inicio,
    fechaFin: sumarDias(inicio, duracion),
    corridoPorDiaNoHabil: inicio !== tentativa,
  };
}
