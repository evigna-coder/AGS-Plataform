/**
 * Unit tests for cuotasFacturacion helpers — Phase 12 (BILL-01 through BILL-08, W2, I3).
 *
 * Run with: pnpm --filter sistema-modular test:cuotas-facturacion
 *   (tsx src/services/__tests__/cuotasFacturacion.test.ts)
 *
 * Uses node:assert/strict — no framework install needed.
 *
 * Wave 0 RED baseline: this file FAILS until plan 12-01 creates
 *   apps/sistema-modular/src/utils/cuotasFacturacion.ts
 * The import below deliberately references the missing module.
 *
 * W1 stdout linkage: each assertion block is preceded by console.log('[BILL-XX label]')
 * so a verifier can grep test stdout:
 *   pnpm --filter sistema-modular test:cuotas-facturacion 2>&1 | grep '\[BILL-' | sort -u
 */

import assert from 'node:assert/strict';
import {
  recomputeCuotaEstados,
  validateEsquemaSum,
  canFinalizeFromEsquema,
  cuotasEqual,
  computeTotalsByCurrency,
} from '../../utils/cuotasFacturacion.js';

import {
  // Recompute fixtures
  FIXTURE_EMPTY_LEGACY,
  FIXTURE_30_70_BORRADOR,
  FIXTURE_30_70_ACEPTADO,
  FIXTURE_30_70_TODAS_OTS_CERRADAS,
  FIXTURE_PRE_EMBARQUE_TOGGLED,
  FIXTURE_ANULADA_REGEN,
  FIXTURE_COBRADA_MIRROR,
  FIXTURE_MIXTA_SOLO_USD,
  FIXTURE_MIXTA_SOLO_ARS,
  FIXTURE_MIXTA_COMBINADA,
  FIXTURE_OC_RECIBIDA,
  FIXTURE_MANUAL_ALWAYS_HABILITADA,
  // Validator fixtures
  FIXTURE_VALIDATOR_OK_MONO,
  FIXTURE_VALIDATOR_FLOAT,
  FIXTURE_VALIDATOR_MIXTA_BOTH_OK,
  FIXTURE_VALIDATOR_MIXTA_USD_FAILS,
  // cuotasEqual fixtures (W2)
  FIXTURE_CUOTAS_EQUAL_SAME_ORDER,
  FIXTURE_CUOTAS_EQUAL_SHUFFLED_KEYS,
  FIXTURE_CUOTAS_NOT_EQUAL,
  // computeTotalsByCurrency fixtures (I3)
  FIXTURE_TOTALS_MONO_ARS,
  FIXTURE_TOTALS_MIXTA,
} from './fixtures/cuotasFacturacion.js';

async function run() {

  // ════════════════════════════════════════════════════════════════════════
  // validateEsquemaSum — BILL-01 (Σ%=100 per moneda)
  // ════════════════════════════════════════════════════════════════════════

  console.log('[BILL-01 validator-mono-ok]');
  {
    const errors = validateEsquemaSum(FIXTURE_VALIDATOR_OK_MONO, ['ARS']);
    assert.deepEqual(errors, [], 'BILL-01: 30+70 mono ARS must validate OK (0 errors)');
    console.log('  ✓ BILL-01 validator-mono-ok passed');
  }

  console.log('[BILL-01 validator-float-tolerance]');
  {
    const errors = validateEsquemaSum(FIXTURE_VALIDATOR_FLOAT, ['ARS']);
    assert.deepEqual(errors, [], 'BILL-01: 33.33+33.33+33.34 must pass via 2-decimal rounding (0 errors)');
    console.log('  ✓ BILL-01 validator-float-tolerance passed');
  }

  console.log('[BILL-04 validator-MIXTA-independent]');
  {
    const errors = validateEsquemaSum(FIXTURE_VALIDATOR_MIXTA_BOTH_OK, ['ARS', 'USD']);
    assert.deepEqual(errors, [], 'BILL-04: MIXTA ARS=100, USD=100 → 0 errors (each moneda validated independently)');
    console.log('  ✓ BILL-04 validator-MIXTA-independent passed');
  }

  console.log('[BILL-04 validator-MIXTA-USD-fails]');
  {
    const errors = validateEsquemaSum(FIXTURE_VALIDATOR_MIXTA_USD_FAILS, ['ARS', 'USD']);
    assert.equal(errors.length, 1, 'BILL-04: ARS ok, USD 90 → exactly 1 error');
    assert.equal(errors[0].moneda, 'USD', 'BILL-04: failing moneda must be USD');
    assert.equal(errors[0].sum, 90, 'BILL-04: reported sum must be 90');
    assert.equal(errors[0].expected, 100, 'BILL-04: expected must be 100');
    console.log('  ✓ BILL-04 validator-MIXTA-USD-fails passed');
  }

  console.log('[BILL-01 all-zero-guard]');
  {
    const emptyEsquema = validateEsquemaSum([], ['ARS']);
    // Empty schema has no cuotas — sum is 0, which is != 100. Validator must flag it.
    assert.equal(emptyEsquema.length, 1, 'BILL-01: empty esquema (0%) must be flagged as invalid for ARS');
    assert.equal(emptyEsquema[0].sum, 0, 'BILL-01: sum of empty esquema is 0');
    console.log('  ✓ BILL-01 all-zero-guard passed');
  }

  // ════════════════════════════════════════════════════════════════════════
  // recomputeCuotaEstados — BILL-02 (all hito branches), BILL-05 (legacy)
  // BILL-04 (MIXTA)
  // ════════════════════════════════════════════════════════════════════════

  console.log('[BILL-05 empty-legacy]');
  {
    const out = recomputeCuotaEstados(
      FIXTURE_EMPTY_LEGACY.ppto,
      FIXTURE_EMPTY_LEGACY.ots,
      FIXTURE_EMPTY_LEGACY.solicitudes,
    );
    assert.deepEqual(out, [], 'BILL-05: empty esquemaFacturacion must return []');
    console.log('  ✓ BILL-05 empty-legacy passed');
  }

  console.log('[BILL-02 borrador-all-pendiente]');
  {
    const out = recomputeCuotaEstados(
      FIXTURE_30_70_BORRADOR.ppto,
      FIXTURE_30_70_BORRADOR.ots,
      FIXTURE_30_70_BORRADOR.solicitudes,
    );
    assert.equal(out.length, 2, 'BILL-02: borrador must return 2 cuotas');
    assert.equal(out[0].estado, 'pendiente', 'BILL-02: cuota ppto_aceptado while borrador must be pendiente');
    assert.equal(out[1].estado, 'pendiente', 'BILL-02: cuota todas_ots_cerradas while borrador must be pendiente');
    console.log('  ✓ BILL-02 borrador-all-pendiente passed');
  }

  console.log('[BILL-02 hito-aceptado]');
  {
    const out = recomputeCuotaEstados(
      FIXTURE_30_70_ACEPTADO.ppto,
      FIXTURE_30_70_ACEPTADO.ots,
      FIXTURE_30_70_ACEPTADO.solicitudes,
    );
    assert.equal(out[0].estado, 'habilitada', 'BILL-02: hito ppto_aceptado must move cuota to habilitada');
    assert.equal(out[1].estado, 'pendiente', 'BILL-02: cuota todas_ots_cerradas must stay pendiente (no OT closed)');
    console.log('  ✓ BILL-02 hito-aceptado passed');
  }

  console.log('[BILL-02 todas-ots-cerradas]');
  {
    const out = recomputeCuotaEstados(
      FIXTURE_30_70_TODAS_OTS_CERRADAS.ppto,
      FIXTURE_30_70_TODAS_OTS_CERRADAS.ots,
      FIXTURE_30_70_TODAS_OTS_CERRADAS.solicitudes,
    );
    // cuota-1 has solicitudFacturacionId → should mirror solicitud estado 'solicitada'
    assert.equal(out[0].estado, 'solicitada', 'BILL-02: cuota with linked solicitud must mirror solicitud.estado');
    // cuota-2 has hito todas_ots_cerradas and all OTs are FINALIZADO/CIERRE_ADMINISTRATIVO
    assert.equal(out[1].estado, 'habilitada', 'BILL-02: all OTs closed must move cuota to habilitada');
    console.log('  ✓ BILL-02 todas-ots-cerradas passed');
  }

  console.log('[BILL-02 pre-embarque]');
  {
    const out = recomputeCuotaEstados(
      FIXTURE_PRE_EMBARQUE_TOGGLED.ppto,
      FIXTURE_PRE_EMBARQUE_TOGGLED.ots,
      FIXTURE_PRE_EMBARQUE_TOGGLED.solicitudes,
    );
    assert.equal(out[0].estado, 'habilitada', 'BILL-02: preEmbarque=true must move cuota with hito pre_embarque to habilitada');
    assert.equal(out[1].estado, 'pendiente', 'BILL-02: cuota todas_ots_cerradas must stay pendiente (no OT closed)');
    console.log('  ✓ BILL-02 pre-embarque passed');
  }

  console.log('[BILL-02 oc-recibida]');
  {
    const out = recomputeCuotaEstados(
      FIXTURE_OC_RECIBIDA.ppto,
      FIXTURE_OC_RECIBIDA.ots,
      FIXTURE_OC_RECIBIDA.solicitudes,
    );
    assert.equal(out[0].estado, 'habilitada', 'BILL-02: ordenesCompraIds.length>0 must move cuota with hito oc_recibida to habilitada');
    console.log('  ✓ BILL-02 oc-recibida passed');
  }

  console.log('[BILL-02 manual-always-habilitada]');
  {
    const out = recomputeCuotaEstados(
      FIXTURE_MANUAL_ALWAYS_HABILITADA.ppto,
      FIXTURE_MANUAL_ALWAYS_HABILITADA.ots,
      FIXTURE_MANUAL_ALWAYS_HABILITADA.solicitudes,
    );
    assert.equal(out[0].estado, 'habilitada', 'BILL-02: hito=manual must always be habilitada regardless of ppto.estado');
    console.log('  ✓ BILL-02 manual-always-habilitada passed');
  }

  console.log('[BILL-02 anulada-regen]');
  {
    const out = recomputeCuotaEstados(
      FIXTURE_ANULADA_REGEN.ppto,
      FIXTURE_ANULADA_REGEN.ots,
      FIXTURE_ANULADA_REGEN.solicitudes,
    );
    assert.equal(out[0].estado, 'habilitada', 'BILL-02: anulada solicitud must cause cuota to revert to habilitada');
    assert.ok(
      out[0].solicitudFacturacionId == null,
      'BILL-02: anulada regen must clear solicitudFacturacionId',
    );
    console.log('  ✓ BILL-02 anulada-regen passed');
  }

  console.log('[BILL-02 cobrada-mirror]');
  {
    const out = recomputeCuotaEstados(
      FIXTURE_COBRADA_MIRROR.ppto,
      FIXTURE_COBRADA_MIRROR.ots,
      FIXTURE_COBRADA_MIRROR.solicitudes,
    );
    assert.equal(out[0].estado, 'cobrada', 'BILL-02: cobrada solicitud must mirror to cuota.estado=cobrada');
    console.log('  ✓ BILL-02 cobrada-mirror passed');
  }

  console.log('[BILL-04 MIXTA-solo-USD]');
  {
    const out = recomputeCuotaEstados(
      FIXTURE_MIXTA_SOLO_USD.ppto,
      FIXTURE_MIXTA_SOLO_USD.ots,
      FIXTURE_MIXTA_SOLO_USD.solicitudes,
    );
    assert.equal(out.length, 1, 'BILL-04: solo-USD schema must return 1 cuota');
    assert.equal(out[0].estado, 'habilitada', 'BILL-04: solo-USD cuota with ppto_aceptado hito must be habilitada');
    assert.ok('USD' in out[0].porcentajePorMoneda, 'BILL-04: porcentajePorMoneda must contain USD key');
    assert.ok(!('ARS' in out[0].porcentajePorMoneda), 'BILL-04: solo-USD cuota must NOT have ARS bucket');
    console.log('  ✓ BILL-04 MIXTA-solo-USD passed');
  }

  console.log('[BILL-04 MIXTA-solo-ARS]');
  {
    const out = recomputeCuotaEstados(
      FIXTURE_MIXTA_SOLO_ARS.ppto,
      FIXTURE_MIXTA_SOLO_ARS.ots,
      FIXTURE_MIXTA_SOLO_ARS.solicitudes,
    );
    assert.equal(out.length, 1, 'BILL-04: solo-ARS schema must return 1 cuota');
    assert.equal(out[0].estado, 'habilitada', 'BILL-04: solo-ARS cuota with ppto_aceptado hito must be habilitada');
    assert.ok('ARS' in out[0].porcentajePorMoneda, 'BILL-04: porcentajePorMoneda must contain ARS key');
    console.log('  ✓ BILL-04 MIXTA-solo-ARS passed');
  }

  console.log('[BILL-04 MIXTA-combinada]');
  {
    const out = recomputeCuotaEstados(
      FIXTURE_MIXTA_COMBINADA.ppto,
      FIXTURE_MIXTA_COMBINADA.ots,
      FIXTURE_MIXTA_COMBINADA.solicitudes,
    );
    assert.equal(out.length, 2, 'BILL-04: combinada schema must return 2 cuotas');
    assert.equal(out[0].estado, 'habilitada', 'BILL-04: combinada cuota 1 ppto_aceptado must be habilitada');
    assert.equal(out[1].estado, 'pendiente', 'BILL-04: combinada cuota 2 todas_ots_cerradas must be pendiente');
    assert.equal(out[0].porcentajePorMoneda.ARS, 30, 'BILL-04: combinada cuota 1 ARS% must be 30');
    assert.equal(out[0].porcentajePorMoneda.USD, 50, 'BILL-04: combinada cuota 1 USD% must be 50');
    console.log('  ✓ BILL-04 MIXTA-combinada passed');
  }

  // ════════════════════════════════════════════════════════════════════════
  // canFinalizeFromEsquema — BILL-06 (strict cobrada mode)
  // ════════════════════════════════════════════════════════════════════════

  console.log('[BILL-06 strict-cobrada]');
  {
    // Build inline esquema: all cuotas 'cobrada'
    const allCobrada = [
      { id: 'c1', numero: 1, hito: 'ppto_aceptado' as const, porcentajePorMoneda: { ARS: 30 }, descripcion: 'A', estado: 'cobrada' as const, solicitudFacturacionId: 'sol-1', montoFacturadoPorMoneda: null },
      { id: 'c2', numero: 2, hito: 'todas_ots_cerradas' as const, porcentajePorMoneda: { ARS: 70 }, descripcion: 'B', estado: 'cobrada' as const, solicitudFacturacionId: 'sol-2', montoFacturadoPorMoneda: null },
    ];
    assert.equal(
      canFinalizeFromEsquema(allCobrada, false),
      true,
      'BILL-06: all cuotas cobrada + strict=false (cobrada required) must allow finalize',
    );

    // Cuota in 'facturada' (not 'cobrada') — strict=false means must be cobrada → must NOT finalize
    const oneFacturada = [
      { id: 'c1', numero: 1, hito: 'ppto_aceptado' as const, porcentajePorMoneda: { ARS: 30 }, descripcion: 'A', estado: 'facturada' as const, solicitudFacturacionId: 'sol-1', montoFacturadoPorMoneda: null },
      { id: 'c2', numero: 2, hito: 'todas_ots_cerradas' as const, porcentajePorMoneda: { ARS: 70 }, descripcion: 'B', estado: 'cobrada' as const, solicitudFacturacionId: 'sol-2', montoFacturadoPorMoneda: null },
    ];
    assert.equal(
      canFinalizeFromEsquema(oneFacturada, false),
      false,
      'BILL-06: strict mode (finalizarConSoloFacturado=false) must return false when any cuota is facturada (not cobrada)',
    );

    // With finalizarConSoloFacturado=true, 'facturada' counts as terminal
    assert.equal(
      canFinalizeFromEsquema(oneFacturada, true),
      true,
      'BILL-06: lenient mode (finalizarConSoloFacturado=true) must accept facturada as terminal',
    );

    // Null/undefined esquema → legacy Tier-1 flow → should return true (no blocking)
    assert.equal(
      canFinalizeFromEsquema(null),
      true,
      'BILL-06: null esquema (legacy Tier-1) must not block finalize',
    );

    console.log('  ✓ BILL-06 strict-cobrada passed');
  }

  // ════════════════════════════════════════════════════════════════════════
  // cuotasEqual — W2 (key-order independence)
  // ════════════════════════════════════════════════════════════════════════

  console.log('[BILL-W2 cuotasEqual-same-order]');
  {
    assert.equal(
      cuotasEqual(FIXTURE_CUOTAS_EQUAL_SAME_ORDER, FIXTURE_CUOTAS_EQUAL_SAME_ORDER),
      true,
      'W2: identical arrays must be equal',
    );
    console.log('  ✓ BILL-W2 cuotasEqual-same-order passed');
  }

  console.log('[BILL-W2 cuotasEqual-shuffled]');
  {
    assert.equal(
      cuotasEqual(FIXTURE_CUOTAS_EQUAL_SAME_ORDER, FIXTURE_CUOTAS_EQUAL_SHUFFLED_KEYS),
      true,
      'W2: cuotasEqual must be order-independent for nested porcentajePorMoneda record keys',
    );
    console.log('  ✓ BILL-W2 cuotasEqual-shuffled passed');
  }

  console.log('[BILL-W2 cuotasEqual-not-equal]');
  {
    assert.equal(
      cuotasEqual(FIXTURE_CUOTAS_EQUAL_SAME_ORDER, FIXTURE_CUOTAS_NOT_EQUAL),
      false,
      'W2: cuotasEqual must return false when a field differs (descripcion changed)',
    );
    console.log('  ✓ BILL-W2 cuotasEqual-not-equal passed');
  }

  // ════════════════════════════════════════════════════════════════════════
  // computeTotalsByCurrency — I3
  // ════════════════════════════════════════════════════════════════════════

  console.log('[BILL-I3 computeTotals-mono-ARS]');
  {
    const result = computeTotalsByCurrency(
      FIXTURE_TOTALS_MONO_ARS.items,
      FIXTURE_TOTALS_MONO_ARS.defaultMoneda,
    );
    assert.deepEqual(
      result,
      { ARS: 5000 },
      'I3: mono ARS items (2000*1 + 1500*2) must yield { ARS: 5000 }',
    );
    console.log('  ✓ BILL-I3 computeTotals-mono-ARS passed');
  }

  console.log('[BILL-I3 computeTotals-MIXTA]');
  {
    const result = computeTotalsByCurrency(
      FIXTURE_TOTALS_MIXTA.items,
      FIXTURE_TOTALS_MIXTA.defaultMoneda,
    );
    assert.deepEqual(
      result,
      { ARS: 3000, USD: 1500 },
      'I3: MIXTA items (1000*3 ARS + 1500*1 USD) must yield { ARS: 3000, USD: 1500 }',
    );
    console.log('  ✓ BILL-I3 computeTotals-MIXTA passed');
  }

  // ════════════════════════════════════════════════════════════════════════
  // Summary
  // ════════════════════════════════════════════════════════════════════════

  console.log('\n✅ All cuotasFacturacion tests passed (this message should NOT appear in Wave 0 RED baseline)');
}

run().catch(err => {
  console.error('\n❌ cuotasFacturacion tests FAILED:', err.message ?? err);
  process.exit(1);
});
