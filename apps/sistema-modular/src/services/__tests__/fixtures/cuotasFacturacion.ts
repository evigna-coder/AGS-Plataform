/**
 * Test fixtures for cuotasFacturacion unit tests.
 * Used by cuotasFacturacion.test.ts.
 *
 * Phase 12 — Esquema Facturación Porcentual + Anticipos (Wave 0 RED).
 *
 * Types declared here mirror the locked shapes from 12-CONTEXT.md.
 * They will land in `@ags/shared` via plan 12-01. The type imports below
 * will fail (RED baseline) until 12-01 ships the canonical types.
 *
 * Fixture naming convention:
 *   FIXTURE_<SCENARIO>: describes the state being tested.
 *   Each fixture traces back to a specific BILL-XX requirement and/or a
 *   row in 12-VALIDATION.md "Per-Task Verification Map".
 */

import type {
  Presupuesto,
  WorkOrder,
  SolicitudFacturacion,
  PresupuestoCuotaFacturacion,
  PresupuestoItem,
  MonedaPresupuesto,
} from '@ags/shared';

// ── Minimal pick types matching helper signatures ──────────────────────────

type RecomputePpto = Pick<Presupuesto, 'estado' | 'ordenesCompraIds' | 'preEmbarque' | 'esquemaFacturacion'>;
type RecomputeOT = Pick<WorkOrder, 'otNumber' | 'estadoAdmin' | 'budgets'>;
type RecomputeSolicitud = Pick<SolicitudFacturacion, 'id' | 'cuotaId' | 'estado'>;

// ── Helper: factory for a minimal cuota ───────────────────────────────────

function mkCuota(
  overrides: Partial<PresupuestoCuotaFacturacion> & Pick<PresupuestoCuotaFacturacion, 'id' | 'numero' | 'hito'>,
): PresupuestoCuotaFacturacion {
  return {
    porcentajePorMoneda: { ARS: 100 },
    descripcion: 'Cuota de prueba',
    estado: 'pendiente',
    solicitudFacturacionId: null,
    montoFacturadoPorMoneda: null,
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// RECOMPUTE FIXTURES (≥10) — for recomputeCuotaEstados()
// BILL-02 (hito branches), BILL-04 (MIXTA), BILL-05 (legacy empty)
// ════════════════════════════════════════════════════════════════════════════

// ── FIXTURE 1: Empty schema (BILL-05 legacy Tier-1 mode) ─────────────────
// ppto with esquemaFacturacion = [] → helper must return []
export const FIXTURE_EMPTY_LEGACY: {
  ppto: RecomputePpto;
  ots: RecomputeOT[];
  solicitudes: RecomputeSolicitud[];
} = {
  ppto: {
    estado: 'borrador',
    ordenesCompraIds: [],
    preEmbarque: false,
    esquemaFacturacion: [],
  },
  ots: [],
  solicitudes: [],
};

// ── FIXTURE 2: 30/70 ppto in borrador (no hito triggered yet) ────────────
// cuota 1 = 30% ppto_aceptado (still pendiente while borrador)
// cuota 2 = 70% todas_ots_cerradas (still pendiente)
export const FIXTURE_30_70_BORRADOR: {
  ppto: RecomputePpto;
  ots: RecomputeOT[];
  solicitudes: RecomputeSolicitud[];
} = {
  ppto: {
    estado: 'borrador',
    ordenesCompraIds: [],
    preEmbarque: false,
    esquemaFacturacion: [
      mkCuota({ id: 'cuota-1', numero: 1, hito: 'ppto_aceptado', porcentajePorMoneda: { ARS: 30 }, descripcion: 'Anticipo 30%' }),
      mkCuota({ id: 'cuota-2', numero: 2, hito: 'todas_ots_cerradas', porcentajePorMoneda: { ARS: 70 }, descripcion: 'Saldo 70%' }),
    ],
  },
  ots: [],
  solicitudes: [],
};

// ── FIXTURE 3: 30/70 ppto ACEPTADO (BILL-02 hito ppto_aceptado) ──────────
// cuota 1 hito=ppto_aceptado → MUST be 'habilitada' (ppto.estado=aceptado)
// cuota 2 hito=todas_ots_cerradas → MUST be 'pendiente' (no OT cerrada yet)
export const FIXTURE_30_70_ACEPTADO: {
  ppto: RecomputePpto;
  ots: RecomputeOT[];
  solicitudes: RecomputeSolicitud[];
} = {
  ppto: {
    estado: 'aceptado',
    ordenesCompraIds: [],
    preEmbarque: false,
    esquemaFacturacion: [
      mkCuota({ id: 'cuota-1', numero: 1, hito: 'ppto_aceptado', porcentajePorMoneda: { ARS: 30 }, descripcion: 'Anticipo 30%' }),
      mkCuota({ id: 'cuota-2', numero: 2, hito: 'todas_ots_cerradas', porcentajePorMoneda: { ARS: 70 }, descripcion: 'Saldo 70%' }),
    ],
  },
  ots: [],
  solicitudes: [],
};

// ── FIXTURE 4: Todas las OTs cerradas (BILL-02 hito todas_ots_cerradas) ──
// All OTs in CIERRE_ADMINISTRATIVO or FINALIZADO → cuota 2 becomes 'habilitada'
export const FIXTURE_30_70_TODAS_OTS_CERRADAS: {
  ppto: RecomputePpto;
  ots: RecomputeOT[];
  solicitudes: RecomputeSolicitud[];
} = {
  ppto: {
    estado: 'en_ejecucion',
    ordenesCompraIds: [],
    preEmbarque: false,
    esquemaFacturacion: [
      mkCuota({ id: 'cuota-1', numero: 1, hito: 'ppto_aceptado', porcentajePorMoneda: { ARS: 30 }, estado: 'solicitada', solicitudFacturacionId: 'sol-1' }),
      mkCuota({ id: 'cuota-2', numero: 2, hito: 'todas_ots_cerradas', porcentajePorMoneda: { ARS: 70 }, descripcion: 'Saldo 70%' }),
    ],
  },
  ots: [
    { otNumber: 'OT-001', estadoAdmin: 'FINALIZADO', budgets: ['PRES-001'] },
    { otNumber: 'OT-002', estadoAdmin: 'CIERRE_ADMINISTRATIVO', budgets: ['PRES-001'] },
  ],
  solicitudes: [
    { id: 'sol-1', cuotaId: 'cuota-1', estado: 'solicitada' },
  ],
};

// ── FIXTURE 5: Pre-embarque toggled ON (BILL-02 hito pre_embarque) ────────
// ppto.preEmbarque = true → cuota with hito=pre_embarque becomes 'habilitada'
export const FIXTURE_PRE_EMBARQUE_TOGGLED: {
  ppto: RecomputePpto;
  ots: RecomputeOT[];
  solicitudes: RecomputeSolicitud[];
} = {
  ppto: {
    estado: 'aceptado',
    ordenesCompraIds: [],
    preEmbarque: true,
    esquemaFacturacion: [
      mkCuota({ id: 'cuota-1', numero: 1, hito: 'pre_embarque', porcentajePorMoneda: { ARS: 70 }, descripcion: 'Pre-embarque 70%' }),
      mkCuota({ id: 'cuota-2', numero: 2, hito: 'todas_ots_cerradas', porcentajePorMoneda: { ARS: 30 }, descripcion: 'Saldo 30%' }),
    ],
  },
  ots: [],
  solicitudes: [],
};

// ── FIXTURE 6: Anulada → regeneración (BILL-02 anulada-regen) ────────────
// Cuota with solicitudFacturacionId pointing to an 'anulada' solicitud
// → cuota must become 'habilitada' and solicitudFacturacionId cleared
export const FIXTURE_ANULADA_REGEN: {
  ppto: RecomputePpto;
  ots: RecomputeOT[];
  solicitudes: RecomputeSolicitud[];
} = {
  ppto: {
    estado: 'aceptado',
    ordenesCompraIds: [],
    preEmbarque: false,
    esquemaFacturacion: [
      mkCuota({ id: 'cuota-1', numero: 1, hito: 'ppto_aceptado', porcentajePorMoneda: { ARS: 100 }, estado: 'solicitada', solicitudFacturacionId: 'sol-anulada' }),
    ],
  },
  ots: [],
  solicitudes: [
    { id: 'sol-anulada', cuotaId: 'cuota-1', estado: 'anulada' },
  ],
};

// ── FIXTURE 7: Cobrada mirror (BILL-02 cobrada-mirror) ────────────────────
// Cuota with solicitudFacturacionId pointing to 'cobrada' → cuota = 'cobrada'
export const FIXTURE_COBRADA_MIRROR: {
  ppto: RecomputePpto;
  ots: RecomputeOT[];
  solicitudes: RecomputeSolicitud[];
} = {
  ppto: {
    estado: 'en_ejecucion',
    ordenesCompraIds: [],
    preEmbarque: false,
    esquemaFacturacion: [
      mkCuota({ id: 'cuota-1', numero: 1, hito: 'ppto_aceptado', porcentajePorMoneda: { ARS: 30 }, estado: 'facturada', solicitudFacturacionId: 'sol-cobrada' }),
      mkCuota({ id: 'cuota-2', numero: 2, hito: 'todas_ots_cerradas', porcentajePorMoneda: { ARS: 70 } }),
    ],
  },
  ots: [],
  solicitudes: [
    { id: 'sol-cobrada', cuotaId: 'cuota-1', estado: 'cobrada' },
  ],
};

// ── FIXTURE 8: MIXTA solo-USD (BILL-04) ───────────────────────────────────
// Cuota with porcentajePorMoneda = { USD: 100 } — no ARS bucket
export const FIXTURE_MIXTA_SOLO_USD: {
  ppto: RecomputePpto;
  ots: RecomputeOT[];
  solicitudes: RecomputeSolicitud[];
} = {
  ppto: {
    estado: 'aceptado',
    ordenesCompraIds: [],
    preEmbarque: false,
    esquemaFacturacion: [
      mkCuota({ id: 'cuota-1', numero: 1, hito: 'ppto_aceptado', porcentajePorMoneda: { USD: 100 }, descripcion: 'Anticipo USD 100%' }),
    ],
  },
  ots: [],
  solicitudes: [],
};

// ── FIXTURE 9: MIXTA solo-ARS (BILL-04) ───────────────────────────────────
// Cuota with porcentajePorMoneda = { ARS: 100 } — only ARS bucket
export const FIXTURE_MIXTA_SOLO_ARS: {
  ppto: RecomputePpto;
  ots: RecomputeOT[];
  solicitudes: RecomputeSolicitud[];
} = {
  ppto: {
    estado: 'aceptado',
    ordenesCompraIds: [],
    preEmbarque: false,
    esquemaFacturacion: [
      mkCuota({ id: 'cuota-1', numero: 1, hito: 'ppto_aceptado', porcentajePorMoneda: { ARS: 100 }, descripcion: 'Anticipo ARS 100%' }),
    ],
  },
  ots: [],
  solicitudes: [],
};

// ── FIXTURE 10: MIXTA combinada (BILL-04) ────────────────────────────────
// Cuota with porcentajePorMoneda = { ARS: 30, USD: 50 } — both currencies in 1 cuota
// + complementary cuotas to bring each to 100%
export const FIXTURE_MIXTA_COMBINADA: {
  ppto: RecomputePpto;
  ots: RecomputeOT[];
  solicitudes: RecomputeSolicitud[];
} = {
  ppto: {
    estado: 'aceptado',
    ordenesCompraIds: [],
    preEmbarque: false,
    esquemaFacturacion: [
      mkCuota({ id: 'cuota-1', numero: 1, hito: 'ppto_aceptado', porcentajePorMoneda: { ARS: 30, USD: 50 }, descripcion: 'Anticipo mixto' }),
      mkCuota({ id: 'cuota-2', numero: 2, hito: 'todas_ots_cerradas', porcentajePorMoneda: { ARS: 70, USD: 50 }, descripcion: 'Saldo mixto' }),
    ],
  },
  ots: [],
  solicitudes: [],
};

// ── FIXTURE 11: OC recibida (BILL-02 hito oc_recibida) ────────────────────
// ppto.ordenesCompraIds.length > 0 → cuota with hito=oc_recibida → 'habilitada'
export const FIXTURE_OC_RECIBIDA: {
  ppto: RecomputePpto;
  ots: RecomputeOT[];
  solicitudes: RecomputeSolicitud[];
} = {
  ppto: {
    estado: 'aceptado',
    ordenesCompraIds: ['oc-cliente-1'],
    preEmbarque: false,
    esquemaFacturacion: [
      mkCuota({ id: 'cuota-1', numero: 1, hito: 'oc_recibida', porcentajePorMoneda: { ARS: 100 }, descripcion: 'Cuota OC' }),
    ],
  },
  ots: [],
  solicitudes: [],
};

// ── FIXTURE 12: Manual always habilitada (BILL-02 hito manual) ────────────
// Cuota with hito='manual' → always 'habilitada' regardless of ppto state
export const FIXTURE_MANUAL_ALWAYS_HABILITADA: {
  ppto: RecomputePpto;
  ots: RecomputeOT[];
  solicitudes: RecomputeSolicitud[];
} = {
  ppto: {
    estado: 'borrador',
    ordenesCompraIds: [],
    preEmbarque: false,
    esquemaFacturacion: [
      mkCuota({ id: 'cuota-1', numero: 1, hito: 'manual', porcentajePorMoneda: { ARS: 100 }, descripcion: 'Manual siempre habilitada' }),
    ],
  },
  ots: [],
  solicitudes: [],
};

// ════════════════════════════════════════════════════════════════════════════
// VALIDATOR FIXTURES (≥4) — for validateEsquemaSum()
// BILL-01 (Σ%=100 per moneda)
// ════════════════════════════════════════════════════════════════════════════

// ── Validator 1: Happy path mono-ARS (BILL-01) ────────────────────────────
// 30 + 70 = 100 ARS → no validation errors
export const FIXTURE_VALIDATOR_OK_MONO: PresupuestoCuotaFacturacion[] = [
  mkCuota({ id: 'v1-c1', numero: 1, hito: 'ppto_aceptado', porcentajePorMoneda: { ARS: 30 }, descripcion: 'Anticipo' }),
  mkCuota({ id: 'v1-c2', numero: 2, hito: 'todas_ots_cerradas', porcentajePorMoneda: { ARS: 70 }, descripcion: 'Saldo' }),
];

// ── Validator 2: Float tolerance (BILL-01) ────────────────────────────────
// 33.33 + 33.33 + 33.34 = 100.00 ARS (2-decimal rounding) → should pass (0 errors)
export const FIXTURE_VALIDATOR_FLOAT: PresupuestoCuotaFacturacion[] = [
  mkCuota({ id: 'v2-c1', numero: 1, hito: 'ppto_aceptado', porcentajePorMoneda: { ARS: 33.33 }, descripcion: 'Tercio 1' }),
  mkCuota({ id: 'v2-c2', numero: 2, hito: 'ppto_aceptado', porcentajePorMoneda: { ARS: 33.33 }, descripcion: 'Tercio 2' }),
  mkCuota({ id: 'v2-c3', numero: 3, hito: 'todas_ots_cerradas', porcentajePorMoneda: { ARS: 33.34 }, descripcion: 'Tercio 3' }),
];

// ── Validator 3: MIXTA both ok (BILL-04 Σ% per moneda independent) ────────
// ARS: 30 + 70 = 100. USD: 50 + 50 = 100. Both ok → 0 errors
export const FIXTURE_VALIDATOR_MIXTA_BOTH_OK: PresupuestoCuotaFacturacion[] = [
  mkCuota({ id: 'v3-c1', numero: 1, hito: 'ppto_aceptado', porcentajePorMoneda: { ARS: 30, USD: 50 }, descripcion: 'Anticipo mixto' }),
  mkCuota({ id: 'v3-c2', numero: 2, hito: 'todas_ots_cerradas', porcentajePorMoneda: { ARS: 70, USD: 50 }, descripcion: 'Saldo mixto' }),
];

// ── Validator 4: MIXTA USD fails (BILL-04) ────────────────────────────────
// ARS: 50 + 50 = 100 (ok). USD: 40 + 50 = 90 (fails) → 1 error: { moneda:'USD', sum:90, expected:100 }
export const FIXTURE_VALIDATOR_MIXTA_USD_FAILS: PresupuestoCuotaFacturacion[] = [
  mkCuota({ id: 'v4-c1', numero: 1, hito: 'ppto_aceptado', porcentajePorMoneda: { ARS: 50, USD: 40 }, descripcion: 'Anticipo' }),
  mkCuota({ id: 'v4-c2', numero: 2, hito: 'todas_ots_cerradas', porcentajePorMoneda: { ARS: 50, USD: 50 }, descripcion: 'Saldo' }),
];

// ════════════════════════════════════════════════════════════════════════════
// cuotasEqual FIXTURES (W2) — for cuotasEqual()
// Proves key-order independence of porcentajePorMoneda / montoFacturadoPorMoneda records
// ════════════════════════════════════════════════════════════════════════════

// ── Base cuotas set (canonical ordering) ─────────────────────────────────
export const FIXTURE_CUOTAS_EQUAL_SAME_ORDER: PresupuestoCuotaFacturacion[] = [
  mkCuota({ id: 'eq-c1', numero: 1, hito: 'ppto_aceptado', porcentajePorMoneda: { ARS: 30, USD: 50 }, descripcion: 'Anticipo', estado: 'habilitada' }),
  mkCuota({ id: 'eq-c2', numero: 2, hito: 'todas_ots_cerradas', porcentajePorMoneda: { ARS: 70, USD: 50 }, descripcion: 'Saldo', estado: 'pendiente' }),
];

// ── Same data but porcentajePorMoneda keys in different order ─────────────
// (Simulates Firestore round-trip: key insertion order may change)
// cuotasEqual MUST return true (order-independent comparison)
export const FIXTURE_CUOTAS_EQUAL_SHUFFLED_KEYS: PresupuestoCuotaFacturacion[] = [
  {
    id: 'eq-c1',
    numero: 1,
    hito: 'ppto_aceptado',
    // Keys: USD first, then ARS (reversed from canonical)
    porcentajePorMoneda: { USD: 50, ARS: 30 },
    descripcion: 'Anticipo',
    estado: 'habilitada',
    solicitudFacturacionId: null,
    montoFacturadoPorMoneda: null,
  },
  {
    id: 'eq-c2',
    numero: 2,
    hito: 'todas_ots_cerradas',
    // Keys: USD first, then ARS
    porcentajePorMoneda: { USD: 50, ARS: 70 },
    descripcion: 'Saldo',
    estado: 'pendiente',
    solicitudFacturacionId: null,
    montoFacturadoPorMoneda: null,
  },
];

// ── Different cuotas — must return false ─────────────────────────────────
// cuota-1 descripcion differs from FIXTURE_CUOTAS_EQUAL_SAME_ORDER
export const FIXTURE_CUOTAS_NOT_EQUAL: PresupuestoCuotaFacturacion[] = [
  mkCuota({ id: 'eq-c1', numero: 1, hito: 'ppto_aceptado', porcentajePorMoneda: { ARS: 30, USD: 50 }, descripcion: 'DIFERENTE', estado: 'habilitada' }),
  mkCuota({ id: 'eq-c2', numero: 2, hito: 'todas_ots_cerradas', porcentajePorMoneda: { ARS: 70, USD: 50 }, descripcion: 'Saldo', estado: 'pendiente' }),
];

// ════════════════════════════════════════════════════════════════════════════
// computeTotalsByCurrency FIXTURES (I3) — for computeTotalsByCurrency()
// ════════════════════════════════════════════════════════════════════════════

// ── Mono ARS — expect { ARS: 5000 } ──────────────────────────────────────
export const FIXTURE_TOTALS_MONO_ARS: {
  items: PresupuestoItem[];
  defaultMoneda: MonedaPresupuesto;
} = {
  items: [
    { id: 'item-1', precioUnitario: 2000, cantidad: 1, moneda: 'ARS' } as unknown as PresupuestoItem,
    { id: 'item-2', precioUnitario: 1500, cantidad: 2, moneda: 'ARS' } as unknown as PresupuestoItem,
  ],
  defaultMoneda: 'ARS',
};

// ── MIXTA — items with different item.moneda → expect { ARS: 3000, USD: 1500 } ─
export const FIXTURE_TOTALS_MIXTA: {
  items: PresupuestoItem[];
  defaultMoneda: MonedaPresupuesto;
} = {
  items: [
    { id: 'item-1', precioUnitario: 1000, cantidad: 3, moneda: 'ARS' } as unknown as PresupuestoItem,
    { id: 'item-2', precioUnitario: 1500, cantidad: 1, moneda: 'USD' } as unknown as PresupuestoItem,
  ],
  defaultMoneda: 'MIXTA',
};
