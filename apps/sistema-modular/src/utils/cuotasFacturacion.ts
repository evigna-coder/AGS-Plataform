/**
 * Pure helper module for Phase 12: Esquema de Facturación Porcentual + Anticipos.
 *
 * Coverage (all pure — no Firestore, no React):
 *   BILL-01: validateEsquemaSum — Σ%=100 per moneda with 2-decimal tolerance
 *   BILL-02: recomputeCuotaEstados — hito evaluation → estado transitions
 *   BILL-04: MIXTA per-moneda independence (porcentajePorMoneda Records)
 *   BILL-05: legacy empty-array compat path (null/[] → return [])
 *   BILL-06: canFinalizeFromEsquema — strict cobrada vs lenient facturada mode
 *   W2:      cuotasEqual — structural compare ignoring nested Record key order
 *   I3:      computeTotalsByCurrency — sole source of truth, extracted from EditPresupuestoModal
 *
 * Tests: apps/sistema-modular/src/services/__tests__/cuotasFacturacion.test.ts
 * Run:   pnpm --filter sistema-modular test:cuotas-facturacion
 */

import type {
  Presupuesto,
  PresupuestoItem,
  WorkOrder,
  SolicitudFacturacion,
  PresupuestoCuotaFacturacion,
  CuotaFacturacionEstado,
  MonedaCuota,
  MonedaPresupuesto,
} from '@ags/shared';

// ── Internal utilities ────────────────────────────────────────────────────────

/**
 * Pitfall 6 mitigation: ALWAYS use this guard, never bare `if (esquema)`.
 * An empty array is falsy-like but still has length 0, so we check length.
 */
const hasEsquema = (e?: PresupuestoCuotaFacturacion[] | null): e is PresupuestoCuotaFacturacion[] =>
  (e?.length ?? 0) > 0;

/**
 * Pitfall 3 mitigation: reuse the exact fallback from presupuestosService.ts:1343-1345.
 * Used by template builders. Avoids importing crypto shims at module scope.
 */
function newCuotaId(): string {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Pitfall 4 mitigation: 2-decimal rounding before equality check.
 * Prevents 33.33+33.33+33.34 from summing to 99.99999...
 */
function roundTo2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Public types ──────────────────────────────────────────────────────────────

/** Error returned by validateEsquemaSum when a moneda column doesn't sum to 100. */
export type EsquemaValidationError = {
  moneda: MonedaCuota;
  sum: number;
  expected: 100;
};

// ── BILL-01: Σ% validator ─────────────────────────────────────────────────────

/**
 * Validates that each moneda column in the esquema sums to exactly 100.
 * Returns an array of errors — one per moneda that fails.
 * Empty return = valid.
 *
 * Uses 2-decimal rounding to tolerate 33.33+33.33+33.34 cases.
 */
export function validateEsquemaSum(
  esquema: PresupuestoCuotaFacturacion[],
  monedasActivas: MonedaCuota[],
): EsquemaValidationError[] {
  return monedasActivas.flatMap(m => {
    const sum = esquema.reduce((acc, c) => acc + (c.porcentajePorMoneda[m] ?? 0), 0);
    const rounded = roundTo2(sum);
    return rounded === 100 ? [] : [{ moneda: m, sum: rounded, expected: 100 as const }];
  });
}

/**
 * Finds cuotas where no moneda has a percentage > 0 (invalid all-zero cuota).
 * Pitfall 7 mitigation.
 */
export function findEmptyCuotas(
  esquema: PresupuestoCuotaFacturacion[],
): PresupuestoCuotaFacturacion[] {
  return esquema.filter(c =>
    !Object.values(c.porcentajePorMoneda).some(v => (v ?? 0) > 0),
  );
}

// ── W2: Structural-equality helper ───────────────────────────────────────────

/**
 * Phase 12 W2: structural compare for esquemaFacturacion idempotency check.
 * Replaces JSON.stringify (non-deterministic key order after Firestore round-trip).
 * Sorts keys before comparing nested porcentajePorMoneda / montoFacturadoPorMoneda Records.
 *
 * Used by plan 12-05 to detect whether a recompute produced a new value.
 */
export function cuotasEqual(
  a: PresupuestoCuotaFacturacion[],
  b: PresupuestoCuotaFacturacion[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ca = a[i];
    const cb = b[i];
    if (
      ca.id !== cb.id ||
      ca.numero !== cb.numero ||
      ca.descripcion !== cb.descripcion ||
      ca.hito !== cb.hito ||
      ca.estado !== cb.estado ||
      (ca.solicitudFacturacionId ?? null) !== (cb.solicitudFacturacionId ?? null)
    ) return false;
    if (!recordEqual(ca.porcentajePorMoneda, cb.porcentajePorMoneda)) return false;
    if (!recordEqual(ca.montoFacturadoPorMoneda ?? null, cb.montoFacturadoPorMoneda ?? null)) return false;
  }
  return true;
}

/** Sort-then-compare two Partial<Record<MonedaCuota, number>> objects. */
function recordEqual(
  a: Partial<Record<MonedaCuota, number>> | null,
  b: Partial<Record<MonedaCuota, number>> | null,
): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  if (ka.length !== kb.length) return false;
  for (let i = 0; i < ka.length; i++) {
    if (ka[i] !== kb[i]) return false;
    if ((a as Record<string, number>)[ka[i]] !== (b as Record<string, number>)[kb[i]]) return false;
  }
  return true;
}

// ── I3: Shared totalsByCurrency helper ───────────────────────────────────────

/**
 * Phase 12 I3: extracted from EditPresupuestoModal.tsx:110-118.
 * Sole source of truth for totals-by-moneda.
 * Consumed by plans 12-02 (editor monto preview), 12-03 (service porcentajeCoberturaPorMoneda),
 * 12-04 (mini-modal default values).
 *
 * Items with no item.moneda fall back to defaultMoneda (skip if defaultMoneda === 'MIXTA').
 */
export function computeTotalsByCurrency(
  items: PresupuestoItem[],
  defaultMoneda: MonedaPresupuesto,
): Partial<Record<MonedaCuota, number>> {
  const totals: Partial<Record<MonedaCuota, number>> = {};
  for (const item of items) {
    const m = (item.moneda ?? defaultMoneda) as MonedaPresupuesto;
    if (m === 'MIXTA') continue; // pathological — items always have concrete moneda
    const k = m as MonedaCuota;
    totals[k] = (totals[k] ?? 0) + (item.precioUnitario ?? 0) * (item.cantidad ?? 0);
  }
  return totals;
}

// ── BILL-02: recomputeCuotaEstados ───────────────────────────────────────────

/**
 * Pure function that evaluates the hito conditions and mirrors solicitud estados
 * into the cuota esquema. Returns a NEW array (does not mutate input).
 *
 * Called from 4 sync points:
 *   1. presupuestosService.update() post-write
 *   2. presupuestosService.generarAvisoFacturacion() post-tx
 *   3. otService.cerrarAdministrativamente() post-tx (for linked pptos)
 *   4. facturacionService.marcarFacturada() / marcarCobrada() post-write
 */
export function recomputeCuotaEstados(
  ppto: Pick<Presupuesto, 'estado' | 'ordenesCompraIds' | 'preEmbarque' | 'esquemaFacturacion'>,
  ots: Array<Pick<WorkOrder, 'otNumber' | 'estadoAdmin' | 'budgets'>>,
  solicitudes: Array<Pick<SolicitudFacturacion, 'id' | 'cuotaId' | 'estado'>>,
): PresupuestoCuotaFacturacion[] {
  const cuotas = ppto.esquemaFacturacion ?? [];
  if (cuotas.length === 0) return []; // BILL-05: legacy Tier-1 mode

  const allOTsCerradas =
    ots.length > 0 &&
    ots.every(o =>
      o.estadoAdmin === 'CIERRE_ADMINISTRATIVO' || o.estadoAdmin === 'FINALIZADO',
    );

  return cuotas.map(c => {
    // Branch 1: cuota linked to a solicitud → mirror solicitud.estado
    if (c.solicitudFacturacionId) {
      const sol = solicitudes.find(s => s.id === c.solicitudFacturacionId);
      if (!sol) return c; // dangling ref — warn-don't-mutate (dangling solicitudFacturacionId)

      switch (sol.estado) {
        case 'cobrada':   return { ...c, estado: 'cobrada' as CuotaFacturacionEstado };
        case 'facturada': return { ...c, estado: 'facturada' as CuotaFacturacionEstado };
        case 'anulada':   return { ...c, estado: 'habilitada' as CuotaFacturacionEstado, solicitudFacturacionId: null };
        default:
          // pendiente | enviada | any intermediate → cuota is 'solicitada'
          return { ...c, estado: 'solicitada' as CuotaFacturacionEstado };
      }
    }

    // Branch 2: no solicitud → evaluate hito condition
    const habilitada = evaluateHito(c.hito, ppto, allOTsCerradas);
    return { ...c, estado: (habilitada ? 'habilitada' : 'pendiente') as CuotaFacturacionEstado };
  });
}

function evaluateHito(
  hito: PresupuestoCuotaFacturacion['hito'],
  ppto: Pick<Presupuesto, 'estado' | 'ordenesCompraIds' | 'preEmbarque'>,
  allOTsCerradas: boolean,
): boolean {
  switch (hito) {
    case 'manual':             return true;
    case 'ppto_aceptado':     return ['aceptado', 'en_ejecucion'].includes(ppto.estado as string);
    case 'oc_recibida':       return (ppto.ordenesCompraIds?.length ?? 0) > 0;
    case 'pre_embarque':      return ppto.preEmbarque === true;
    case 'todas_ots_cerradas': return allOTsCerradas;
  }
}

// ── BILL-06: canFinalizeFromEsquema ──────────────────────────────────────────

/**
 * Predicate for trySyncFinalizacion to call.
 * - empty/null esquema → true (legacy mode delegates to existing logic)
 * - default mode (finalizarConSoloFacturado === true or undefined) → requires facturada OR cobrada
 * - strict mode (finalizarConSoloFacturado === false) → requires ALL cuotas in cobrada
 */
export function canFinalizeFromEsquema(
  esquema: PresupuestoCuotaFacturacion[] | null | undefined,
  finalizarConSoloFacturado?: boolean,
): boolean {
  if (!hasEsquema(esquema)) return true; // legacy Tier-1 mode
  const strict = finalizarConSoloFacturado === false;
  const terminal: CuotaFacturacionEstado[] = strict ? ['cobrada'] : ['facturada', 'cobrada'];
  return esquema.every(c => terminal.includes(c.estado));
}

// ── Template builders ─────────────────────────────────────────────────────────
// See: cuotasFacturacionTemplates.ts (re-exported below for a single import point)

export {
  buildTemplate100AlCierre,
  buildTemplate30_70,
  buildTemplate70_30PreEmbarque,
} from './cuotasFacturacionTemplates.js';
