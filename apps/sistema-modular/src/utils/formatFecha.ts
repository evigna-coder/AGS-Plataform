/** Formato de fecha argentino: DD/MM/AAAA. Acepta ISO ("2026-05-08[T...]") o yyyy-mm-dd. */
export function formatFechaAR(iso: string | null | undefined): string {
  if (!iso) return '';
  const parte = iso.slice(0, 10);
  const m = parte.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/**
 * Días de calendario transcurridos desde una fecha ISO hasta hoy. `null` si no
 * hay fecha válida. Nunca negativo (una fecha futura devuelve 0). Se compara a
 * medianoche local para contar días enteros sin tropezar con la hora.
 */
export function diasDesde(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const m = iso.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const desde = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  desde.setHours(0, 0, 0, 0);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const diff = Math.floor((hoy.getTime() - desde.getTime()) / 86_400_000);
  return diff < 0 ? 0 : diff;
}

/** Etiqueta legible de días fuera de la oficina (instrumento en calibración). */
export function labelDiasFuera(dias: number): string {
  if (dias <= 0) return 'Enviado hoy';
  return `${dias} día${dias === 1 ? '' : 's'} fuera`;
}
