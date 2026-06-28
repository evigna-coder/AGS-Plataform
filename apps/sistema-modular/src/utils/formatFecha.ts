/**
 * Fecha de HOY en zona local, formato 'YYYY-MM-DD'. Usar en vez de
 * `new Date().toISOString().split('T')[0]` (que devuelve la fecha UTC y, en
 * Argentina UTC-3, puede adelantar un día de noche → fecha de envío incorrecta).
 */
export function hoyLocalISODate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Devuelve la fecha en 'YYYY-MM-DD' (zona LOCAL) a partir de un Firestore Timestamp,
 * un map `{seconds}`, un ISO con hora, o un string 'YYYY-MM-DD'. '' si no se puede parsear.
 *
 * Sirve para comparar/filtrar/mostrar por día sin que el offset UTC corra la fecha:
 * un Timestamp se compara mal como string, y `new Date('YYYY-MM-DD')` (medianoche UTC)
 * en UTC-3 cae en el día anterior.
 */
export function fechaLocalYMD(value: unknown): string {
  if (!value) return '';
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const ts = value as { toDate?: () => Date; seconds?: number };
  if (typeof ts?.toDate === 'function') return ymd(ts.toDate());
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;          // ya es fecha-solo (local)
    const d = new Date(value);
    return isNaN(d.getTime()) ? value.slice(0, 10) : ymd(d);      // ISO con hora → día local del instante
  }
  if (typeof ts?.seconds === 'number') return ymd(new Date(ts.seconds * 1000));
  return '';
}

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
