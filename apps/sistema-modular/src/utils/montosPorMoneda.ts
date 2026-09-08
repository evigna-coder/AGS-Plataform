import { MONEDA_SIMBOLO } from '@ags/shared';

/**
 * Sumas por moneda (2026-09-08). Regla de la casa: NUNCA se suman pesos con
 * dólares en un mismo número. Antes las cards de Facturación sumaban todo y
 * lo rotulaban "U$S": 9,7 millones de pesos aparecían como dólares.
 */
export function sumarPorMoneda<T extends { moneda?: string | null; montoTotal: number }>(items: T[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const it of items) {
    const m = it.moneda || 'USD';
    out[m] = (out[m] ?? 0) + (it.montoTotal || 0);
  }
  return out;
}

/** "U$S 4.967,00 · $ 9.749.836,94" — solo las monedas con monto; vacío si no hay. */
export function fmtPorMoneda(map: Record<string, number>, decimales = 2): string {
  const orden = ['USD', 'ARS', 'EUR'];
  return Object.entries(map)
    .filter(([, v]) => v > 0)
    .sort(([a], [b]) => (orden.indexOf(a) + 99) % 99 - (orden.indexOf(b) + 99) % 99)
    .map(([m, v]) => `${MONEDA_SIMBOLO[m] || m} ${v.toLocaleString('es-AR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })}`)
    .join(' · ');
}
