/**
 * Bloqueo de coordinación en fin de semana (2026-08-12).
 *
 * Módulo propio y SIN dependencias a propósito: lo consumen tanto la agenda
 * como los formularios de OT, y hacer que esos hooks importaran
 * `agendaDateUtils` (que arrastra date-fns + su locale) rompía el build de vite
 * con un "Parse error @:1:1" al analizar el chunk. Con date math a mano el
 * módulo pesa nada y no mueve nada de lugar en el bundle.
 *
 * Las fechas viajan como 'YYYY-MM-DD'. Se ancla al MEDIODÍA local porque
 * `new Date('2026-08-15')` se parsea como UTC y en UTC-3 cae el día anterior:
 * un sábado se leía como viernes, justo lo que hay que bloquear.
 */

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function aFechaLocal(fecha: string): Date {
  return new Date(`${fecha}T12:00:00`);
}

/** Sábado o domingo. Vacío = sin fecha cargada → no bloquea. */
export function esFinDeSemana(fecha: string): boolean {
  if (!fecha) return false;
  const dia = aFechaLocal(fecha).getDay();
  return dia === 0 || dia === 6;
}

/** dd/mm/aaaa desde 'YYYY-MM-DD', sin pasar por Date (que corre el día). */
export function fechaLegible(fecha: string): string {
  const [a, m, d] = fecha.split('-');
  return d && m && a ? `${d}/${m}/${a}` : fecha;
}

/** Nombre del día en español. */
export function nombreDia(fecha: string): string {
  const d = aFechaLocal(fecha).getDay();
  return DIAS[d] ?? 'ese día';
}

/**
 * Primer sábado/domingo del rango, o null. Mismo contrato que
 * `primerFeriadoEnRango`: guardia dura antes de agendar.
 */
export function primerFinDeSemanaEnRango(inicio: string, fin: string): string | null {
  if (!inicio || !fin) return null;
  const d = aFechaLocal(inicio);
  const end = aFechaLocal(fin);
  for (let guard = 0; d <= end && guard < 120; guard++) {
    const dia = d.getDay();
    if (dia === 0 || dia === 6) {
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${d.getFullYear()}-${mm}-${dd}`;
    }
    d.setDate(d.getDate() + 1);
  }
  return null;
}

/** Mensaje único del bloqueo (mismo texto en agenda y en OT). */
export function mensajeFinDeSemana(fecha: string): string {
  return `El ${fechaLegible(fecha)} es ${nombreDia(fecha)}: no se coordinan servicios los fines de semana. Elegí un día hábil.`;
}
