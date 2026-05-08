/** Formato de fecha argentino: DD/MM/AAAA. Acepta ISO ("2026-05-08[T...]") o yyyy-mm-dd. */
export function formatFechaAR(iso: string | null | undefined): string {
  if (!iso) return '';
  const parte = iso.slice(0, 10);
  const m = parte.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}
