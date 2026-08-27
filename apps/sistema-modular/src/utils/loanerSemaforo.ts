/**
 * Semáforo de días de las acciones de loaner (2026-08-27) — mismo espíritu que
 * el de tickets: el número siempre visible, el color dice si ya es un problema.
 *
 * Escalas pedidas por operaciones:
 *  - Préstamo a cliente:        verde ≤14 · naranja 15–25 · rojo >25
 *  - Derivación a proveedor:    verde ≤10 · naranja 11–20 · rojo >20
 */

export function diasDesde(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

// Texto plano coloreado, sin burbuja — mismo formato que los días de tickets
// (getAgeBadgeColor en leadHelpers).
const VERDE = 'text-green-600';
const NARANJA = 'text-amber-600';
const ROJO = 'text-red-600';

export function semaforoPrestamoCls(dias: number): string {
  return dias <= 14 ? VERDE : dias <= 25 ? NARANJA : ROJO;
}

export function semaforoProveedorCls(dias: number): string {
  return dias <= 10 ? VERDE : dias <= 20 ? NARANJA : ROJO;
}
