/**
 * Parser decimal tolerante (2026-08-06): acepta punto Y coma como separador
 * ("0.5" y "0,5" → 0.5). Los inputs type="number" con locale es-AR rechazaban
 * el punto y `Number("0,5")` daba NaN — mínimos/stock con decimales eran
 * incargables según el navegador.
 */
export function parseDecimal(v: string | number | null | undefined): number {
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  const n = parseFloat(String(v ?? '').trim().replace(',', '.'));
  return isNaN(n) ? 0 : n;
}
