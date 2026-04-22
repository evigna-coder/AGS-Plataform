/**
 * stockAmplioService — Phase 9 pure-function core for ATP extended stock.
 *
 * `computeStockAmplio(articuloId)` is the single source of truth for the
 * 4-bucket StockAmplio shape. It replaces:
 *   - The inline formula in presupuestosService.ts:252-258 (bug fix STKP-05)
 *   - The TODO(STKP-01) in atpHelpers.ts
 *
 * The function fetches from three Firestore collections:
 *   1. `unidades` — physical units per articuloId + activo=true
 *   2. `ordenes_compra` — open OCs with pending items (not yet received)
 *   3. `requerimientos_compra` — conditional requirements (comprometido bucket)
 *
 * Design:
 *   - NO serviceCache.ts (per STKP-04 decision — planning views need live data)
 *   - `__setTestFirestore()` DI hook replaces Firestore reads in unit tests (no emulator)
 *   - OC_OPEN_STATES + REQ_COMPROMETIDO_EXCL are exported constants — Cloud Function
 *     (09-02) mirrors them in functions/src/computeStockAmplioAdmin.ts with a sync-contract
 *     comment. These are the CLIENT-SIDE copies; keep in sync manually.
 *
 * IMPORTANT: enTransito = unidades.en_transito + OC-pending-items (ADDITIVE, not merged).
 *   unidades with estado='en_transito' are PHYSICAL units already in the DB.
 *   OC pending items are EXPECTED units NOT yet received — they CANNOT be the same item.
 *   Merging (deduplication) would under-count; summing is the correct formula.
 *   STKP-05 regression test enforces this: see __tests__/stockAmplio.test.ts Test 2.
 */

import type { StockAmplio, StockAmplioBreakdownEntry } from '@ags/shared';

// Firebase imports are deferred (lazy) so that unit tests can call __setTestFirestore()
// and bypass Firestore entirely — avoiding import.meta.env errors in plain Node.js / tsx.
// In production (Vite), these are tree-shaken and bundled normally.
let _db: any = null;
let _collection: any = null;
let _query: any = null;
let _where: any = null;
let _getDocs: any = null;

async function getFirebaseModules() {
  if (!_db) {
    const [firebaseFirestore, firebaseModule] = await Promise.all([
      import('firebase/firestore'),
      import('./firebase'),
    ]);
    _collection = firebaseFirestore.collection;
    _query = firebaseFirestore.query;
    _where = firebaseFirestore.where;
    _getDocs = firebaseFirestore.getDocs;
    _db = firebaseModule.db;
  }
  return { db: _db, collection: _collection, query: _query, where: _where, getDocs: _getDocs };
}

// ── State filter constants ────────────────────────────────────────────────────

/**
 * OC estados that count as "open" (pending delivery) for the enTransito bucket.
 * Mirror copy lives in `functions/src/computeStockAmplioAdmin.ts` — keep in sync.
 * 'recibida' and 'cancelada' are intentionally EXCLUDED.
 */
export const OC_OPEN_STATES = new Set<string>([
  'borrador',
  'pendiente_aprobacion',
  'aprobada',
  'enviada_proveedor',
  'confirmada',
  'en_transito',
  'recibida_parcial',
]);

/**
 * Requerimiento estados that are EXCLUDED from the comprometido bucket
 * (terminal/already-handled states — no longer pending).
 * Mirror copy lives in `functions/src/computeStockAmplioAdmin.ts` — keep in sync.
 */
export const REQ_COMPROMETIDO_EXCL = new Set<string>(['cancelado', 'comprado', 'en_compra']);

// ── Test injection hook ───────────────────────────────────────────────────────

/**
 * Shape of the mock Firestore state used by unit tests.
 * Mirrors the data that the private fetchers return from Firestore.
 */
interface MockState {
  unidades: Array<{ articuloId: string; estado: string; activo?: boolean }>;
  ocs: Array<{
    id: string;
    estado: string;
    numero?: string | null;
    items: Array<{ articuloId: string; cantidad: number; cantidadRecibida: number }>;
  }>;
  requerimientos: Array<{
    id: string;
    articuloId: string;
    condicional: boolean;
    estado: string;
    cantidad: number;
    presupuestoId?: string | null;
  }>;
}

let __testState: MockState | null = null;

/**
 * Dependency injection hook for unit tests.
 * Call with a mock state to bypass Firestore; call with null to reset.
 * PREFIX underscore signals "test-only" — never call from production code.
 */
export function __setTestFirestore(state: MockState | null): void {
  __testState = state;
}

// ── Core pure function ────────────────────────────────────────────────────────

/**
 * Computes the 4-bucket extended stock shape for a given articuloId.
 *
 * Buckets:
 *   - disponible: units with estado='disponible'
 *   - enTransito: units with estado='en_transito' PLUS pending OC items (additive)
 *   - reservado: units with estado='reservado'
 *   - comprometido: active conditional requirements (excluding REQ_COMPROMETIDO_EXCL states)
 *
 * @param articuloId FK to the articulo document
 * @returns StockAmplio snapshot (point-in-time — caller responsible for refresh cadence)
 */
export async function computeStockAmplio(articuloId: string): Promise<StockAmplio> {
  // 1. Unidades — physical stock rows for this articuloId
  const unidades = __testState
    ? __testState.unidades.filter(u => u.articuloId === articuloId && u.activo !== false)
    : await fetchUnidades(articuloId);

  const disponible = unidades.filter(u => u.estado === 'disponible').length;
  const reservado = unidades.filter(u => u.estado === 'reservado').length;
  const unidadesEnTransito = unidades.filter(u => u.estado === 'en_transito').length;

  // 2. OCs abiertas — pending items NOT yet received (not yet in DB as units)
  // These are SEPARATE from unidades.en_transito — DO NOT deduplicate.
  const ocs = __testState
    ? __testState.ocs.filter(oc => OC_OPEN_STATES.has(oc.estado))
    : await fetchOpenOCs();

  let ocEnTransito = 0;
  const ocsBreakdown: StockAmplioBreakdownEntry[] = [];

  for (const oc of ocs) {
    for (const item of (oc.items ?? [])) {
      if (item.articuloId !== articuloId) continue;
      const pendiente = Math.max((item.cantidad ?? 0) - (item.cantidadRecibida ?? 0), 0);
      if (pendiente > 0) {
        ocEnTransito += pendiente;
        ocsBreakdown.push({
          id: oc.id,
          cantidad: pendiente,
          referencia: oc.numero ?? null,
        });
      }
    }
  }

  // 3. Requerimientos condicionales — comprometido bucket
  // Only conditional requirements in active (non-terminal) states count.
  const reqs = __testState
    ? __testState.requerimientos.filter(
        r => r.articuloId === articuloId && r.condicional === true,
      )
    : await fetchCondicionales(articuloId);

  const activeReqs = reqs.filter(r => !REQ_COMPROMETIDO_EXCL.has(r.estado));
  const comprometido = activeReqs.reduce((acc, r) => acc + (r.cantidad ?? 1), 0);
  const reqsBreakdown: StockAmplioBreakdownEntry[] = activeReqs.map(r => ({
    id: r.id,
    cantidad: r.cantidad ?? 1,
    referencia: r.presupuestoId ?? null,
  }));

  return {
    disponible,
    // enTransito: unit-estado + OC-pending (additive — these are different data sources)
    enTransito: unidadesEnTransito + ocEnTransito,
    reservado,
    comprometido,
    breakdown: {
      // `reservas` section DEFERRED in v2.0 per 09-CONTEXT.md deferred list.
      // The type marks it optional — omit here intentionally.
      // 09-03 drawer renders only the two populated sections.
      requerimientosCondicionales: reqsBreakdown,
      ocsAbiertas: ocsBreakdown,
    },
  };
}

// ── Private Firestore fetchers ────────────────────────────────────────────────
// These are ONLY called when __testState is null (production path).
// NO serviceCache — planning views need live data (STKP-04 decision).

async function fetchUnidades(articuloId: string) {
  const { db, collection, query, where, getDocs } = await getFirebaseModules();
  const q = query(
    collection(db, 'unidades'),
    where('articuloId', '==', articuloId),
    where('activo', '==', true),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
}

async function fetchOpenOCs() {
  // Firestore `in` operator supports up to 30 values — OC_OPEN_STATES has 7 values.
  const { db, collection, query, where, getDocs } = await getFirebaseModules();
  const openStates = Array.from(OC_OPEN_STATES);
  const q = query(
    collection(db, 'ordenes_compra'),
    where('estado', 'in', openStates),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
}

async function fetchCondicionales(articuloId: string) {
  const { db, collection, query, where, getDocs } = await getFirebaseModules();
  const q = query(
    collection(db, 'requerimientos_compra'),
    where('articuloId', '==', articuloId),
    where('condicional', '==', true),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
}
