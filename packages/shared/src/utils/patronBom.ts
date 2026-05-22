/**
 * Phase 14 — BOM-02 pure helpers for Patron BOM (composición + saldo + status + FIFO + sugerencia).
 *
 * All 5 functions are pure: no async, no Firestore, no side effects, no imports beyond shared types.
 * Shared between sistema-modular (admin descuento) y reportes-ot (selector bloqueo).
 *
 * Backwards-compat: legacy patrones (componentes = [] o undefined) producen `Infinity` saldo y
 * `'active'` status — los consumidores existentes que no migraron siguen funcionando sin cambio.
 */
import type { Patron, PatronLote } from '../types';

/**
 * Saldo de un componente en un lote.
 * - Legacy (patron sin BOM): retorna `Infinity` (sin restricción de composición).
 * - Con BOM: `lote.cantidad × cantidadPorKit - cantidadConsumida` (NaN-guard via `?? 0`).
 */
export function computeSaldoComponente(
  patron: Patron,
  lote: PatronLote,
  codigoComponente: string,
): number {
  const componentes = patron.componentes ?? [];
  if (componentes.length === 0) return Infinity;
  const comp = componentes.find(c => c.codigoComponente === codigoComponente);
  if (!comp) return Infinity;
  const stockTotal = (lote.cantidad ?? 0) * comp.cantidadPorKit;
  const consumido =
    (lote.componentesConsumidos ?? []).find(c => c.codigoComponente === codigoComponente)
      ?.cantidadConsumida ?? 0;
  return stockTotal - consumido;
}

/**
 * Estado de un lote calculado desde el BOM:
 *   - 'active'     → todos los componentes con saldo > stockMinimo
 *   - 'bloqueado'  → al menos un componente con saldo <= stockMinimo (otros aún positivos)
 *   - 'agotado'   → todos los componentes con saldo <= stockMinimo
 *
 * Legacy (sin BOM) → siempre `'active'` (sin restricción).
 */
export function computeLoteStatus(
  patron: Patron,
  lote: PatronLote,
): 'active' | 'bloqueado' | 'agotado' {
  const componentes = patron.componentes ?? [];
  if (componentes.length === 0) return 'active';
  let allAgotado = true;
  let algunoBloqueado = false;
  for (const comp of componentes) {
    const saldo = computeSaldoComponente(patron, lote, comp.codigoComponente);
    const minimo = comp.stockMinimo ?? 0;
    if (saldo > minimo) allAgotado = false;
    else algunoBloqueado = true;
  }
  if (allAgotado) return 'agotado';
  if (algunoBloqueado) return 'bloqueado';
  return 'active';
}

/**
 * Estado agregado del patrón = peor estado entre sus lotes.
 *   - todos 'agotado'         → 'agotado'
 *   - alguno 'bloqueado'/'agotado' → 'bloqueado'
 *   - resto                   → 'active'
 */
export function computePatronStatus(patron: Patron): 'active' | 'bloqueado' | 'agotado' {
  const statuses = (patron.lotes ?? []).map(l => computeLoteStatus(patron, l));
  if (statuses.length === 0) return 'active';
  if (statuses.every(s => s === 'agotado')) return 'agotado';
  if (statuses.some(s => s === 'bloqueado' || s === 'agotado')) return 'bloqueado';
  return 'active';
}

/**
 * FIFO por vencimiento ascendente.
 * Filtra lotes sin saldo (cantidad <= 0) y lotes en estado 'bloqueado'/'agotado'.
 * Lotes sin fechaVencimiento van al final ('9999-12-31' sentinel).
 *
 * @param _fechaActualIso reservado para extensiones futuras (filtro por no-vencidos);
 *                        en v1 no se usa para mantener la helper pura y testeable sin reloj.
 */
export function findLoteFifoDisponible(
  patron: Patron,
  _fechaActualIso?: string,
): PatronLote | null {
  const candidatos = (patron.lotes ?? []).filter(l => {
    const status = computeLoteStatus(patron, l);
    if (status === 'agotado' || status === 'bloqueado') return false;
    if ((l.cantidad ?? 0) <= 0) return false;
    return true;
  });
  candidatos.sort((a, b) => {
    const da = a.fechaVencimiento ?? '9999-12-31';
    const db = b.fechaVencimiento ?? '9999-12-31';
    return da.localeCompare(db);
  });
  return candidatos[0] ?? null;
}

/**
 * Sugerencia inicial para el paso admin "Patrones consumidos":
 * Dedupe por `(patronId, lote)` y emite 1 unidad por componente del kit.
 *
 * Pitfall 4 (RESEARCH): el reporte técnico puede registrar el mismo (patronId, lote)
 * en múltiples protocolos — sin dedupe el admin vería N copias de cada componente.
 */
export function buildPatronesConsumidosSugerencia(
  patronesSeleccionados: Array<{ patronId: string; lote: string }>,
  patrones: Patron[],
): Array<{ patronId: string; lote: string; codigoComponente: string; cantidadSugerida: number }> {
  const dedup = new Map<string, { patronId: string; lote: string }>();
  for (const ps of patronesSeleccionados) dedup.set(`${ps.patronId}::${ps.lote}`, ps);
  const out: Array<{
    patronId: string;
    lote: string;
    codigoComponente: string;
    cantidadSugerida: number;
  }> = [];
  for (const { patronId, lote } of dedup.values()) {
    const patron = patrones.find(p => p.id === patronId);
    if (!patron) continue;
    for (const comp of patron.componentes ?? []) {
      out.push({ patronId, lote, codigoComponente: comp.codigoComponente, cantidadSugerida: 1 });
    }
  }
  return out;
}
