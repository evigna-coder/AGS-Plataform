/**
 * Unit tests for computeStockAmplio() — Phase 9 (STKP-01, STKP-05).
 *
 * Run with: pnpm --filter sistema-modular test:stock-amplio
 *   (tsx src/services/__tests__/stockAmplio.test.ts)
 *
 * Uses node:assert/strict — no framework install needed.
 * Firestore is replaced via __setTestFirestore() DI hook (no emulator required).
 *
 * Wave 0 RED baseline: this file FAILS until 09-01 Task 2 creates stockAmplioService.ts.
 */

import assert from 'node:assert/strict';
import { computeStockAmplio, atpUnidades, __setTestFirestore } from '../stockAmplioService.js';
import { atpFromStockAmplio, itemRequiresImportacionFromUnidades } from '../atpHelpers.js';
import {
  FIXTURE_HAPPY_PATH,
  FIXTURE_DOUBLE_COUNT_REGRESSION,
  FIXTURE_EMPTY,
  FIXTURE_STALE_REQS,
  FIXTURE_CLOSED_OCS,
  FIXTURE_LOTES_Y_ASIGNADOS,
  FIXTURE_SOLO_ASIGNADOS,
} from './fixtures/stockAmplio.js';

async function run() {
  // ── Test 1: STKP-01 Happy Path ───────────────────────────────────────────
  // 3 disponibles, 1 reservado, 2 unit en_transito + 4 OC-pending = enTransito 6, comprometido 2
  __setTestFirestore(FIXTURE_HAPPY_PATH);
  const r1 = await computeStockAmplio('art-1');
  assert.equal(r1.disponible, 3, 'happy: disponible must be 3');
  assert.equal(r1.enTransito, 6, 'happy: enTransito (2 unit-estado + 4 OC-pending) must be 6');
  assert.equal(r1.reservado, 1, 'happy: reservado must be 1');
  assert.equal(r1.comprometido, 2, 'happy: comprometido (req pendiente, cantidad=2) must be 2');
  assert.equal(r1.breakdown.ocsAbiertas.length, 1, 'happy: 1 OC in breakdown');
  assert.equal(r1.breakdown.requerimientosCondicionales.length, 1, 'happy: 1 req in breakdown');
  console.log('  ✓ Test 1 passed: STKP-01 happy path');

  // ── Test 2: STKP-05 Double-Count Regression ──────────────────────────────
  // 1 unit en_transito + 1 OC pending 1 unit → enTransito MUST be 2 (NOT 1)
  __setTestFirestore(FIXTURE_DOUBLE_COUNT_REGRESSION);
  const r2 = await computeStockAmplio('art-1');
  assert.equal(
    r2.enTransito,
    2,
    'STKP-05: unit-estado en_transito + OC-pending are separate additive sources — must NOT double-count (expected 2)',
  );
  console.log('  ✓ Test 2 passed: STKP-05 no double counting');

  // ── Test 3: Empty State ───────────────────────────────────────────────────
  __setTestFirestore(FIXTURE_EMPTY);
  const r3 = await computeStockAmplio('art-1');
  assert.equal(r3.disponible, 0, 'empty: disponible must be 0');
  assert.equal(r3.enTransito, 0, 'empty: enTransito must be 0');
  assert.equal(r3.reservado, 0, 'empty: reservado must be 0');
  assert.equal(r3.comprometido, 0, 'empty: comprometido must be 0');
  assert.equal(r3.breakdown.ocsAbiertas.length, 0, 'empty: no OCs in breakdown');
  assert.equal(r3.breakdown.requerimientosCondicionales.length, 0, 'empty: no reqs in breakdown');
  console.log('  ✓ Test 3 passed: empty state all zeros');

  // ── Test 4: Stale reqs excluded from comprometido ─────────────────────────
  // cancelado, comprado, en_compra → should NOT count toward comprometido
  __setTestFirestore(FIXTURE_STALE_REQS);
  const r4 = await computeStockAmplio('art-1');
  assert.equal(r4.comprometido, 0, 'stale reqs: cancelado/comprado/en_compra must NOT count as comprometido');
  assert.equal(r4.breakdown.requerimientosCondicionales.length, 0, 'stale reqs: no active reqs in breakdown');
  console.log('  ✓ Test 4 passed: stale reqs excluded');

  // ── Test 5: Closed OCs excluded from enTransito ───────────────────────────
  // recibida, cancelada → should NOT count toward enTransito
  __setTestFirestore(FIXTURE_CLOSED_OCS);
  const r5 = await computeStockAmplio('art-1');
  assert.equal(r5.enTransito, 0, 'closed OCs: recibida/cancelada must NOT count as enTransito');
  assert.equal(r5.breakdown.ocsAbiertas.length, 0, 'closed OCs: no OCs in breakdown');
  console.log('  ✓ Test 5 passed: closed OCs excluded');

  // ── Test 6: Auditoría I7 — lotes suman cantidad, 'asignado' excluido ──────
  __setTestFirestore(FIXTURE_LOTES_Y_ASIGNADOS);
  const r6 = await computeStockAmplio('art-1');
  assert.equal(r6.disponible, 100, 'I7: lote de 100 debe sumar 100 (cantidades, no docs)');
  assert.equal(r6.reservado, 5, 'I7: lote reservado de 5 debe sumar 5');
  assert.equal(r6.enTransito, 0, 'I7: sin en_transito');
  assert.equal(r6.comprometido, 0, 'I7: sin requerimientos');
  // La variante sincrónica debe dar el MISMO componente-unidades del ATP
  const rows6 = FIXTURE_LOTES_Y_ASIGNADOS.unidades;
  assert.equal(
    atpUnidades(rows6),
    r6.disponible + r6.reservado + 0 /* unidades en_transito */,
    'I7: atpUnidades debe coincidir con los buckets de unidades de computeStockAmplio (105)',
  );
  assert.equal(atpUnidades(rows6), 105, 'I7: asignado(20)/consumido/inactivo(50) NO cuentan');
  assert.equal(
    itemRequiresImportacionFromUnidades(rows6), false,
    'I7: con 105 unidades ATP no requiere importación',
  );
  console.log('  ✓ Test 6 passed: I7 lotes por cantidad + asignado excluido');

  // ── Test 7: Auditoría I7 — solo 'asignado' → ambas fórmulas coinciden ─────
  __setTestFirestore(FIXTURE_SOLO_ASIGNADOS);
  const r7 = await computeStockAmplio('art-1');
  assert.equal(
    atpFromStockAmplio(r7), 0,
    'I7: stock solo asignado a ingenieros → ATP async = 0',
  );
  assert.equal(
    itemRequiresImportacionFromUnidades(FIXTURE_SOLO_ASIGNADOS.unidades), true,
    'I7: stock solo asignado → la variante sync también debe decir "requiere importación"',
  );
  console.log('  ✓ Test 7 passed: I7 async y sync coinciden con stock solo asignado');

  console.log('\n✅ All stockAmplio tests passed');
}

run().catch(err => {
  console.error('\n❌ stockAmplio tests FAILED:', err.message ?? err);
  process.exit(1);
});
