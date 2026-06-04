/**
 * Formatea una fecha a DD/MM/AA para la UI.
 *
 * Maneja dos formatos sin que se corra el día por timezone:
 *  - Date-only "YYYY-MM-DD" (fechaInicio/fechaFin que carga el técnico en el
 *    reporte): `new Date("2026-06-03")` se interpreta como medianoche UTC y en
 *    Argentina (UTC-3) retrocede al 02/06. Por eso lo parseamos como fecha LOCAL.
 *  - ISO con hora ("2026-06-03T12:38:33.552Z", updatedAt/createdAt): conversión
 *    normal a la zona del usuario.
 */
export function formatDateShort(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    const d = m
      ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) // local, sin shift
      : new Date(dateStr);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch {
    return dateStr;
  }
}
