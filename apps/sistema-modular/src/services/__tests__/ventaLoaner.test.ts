/**
 * Phase 15 — Venta loaner espejo a stock — unit suite (Wave 0 RED baseline).
 *
 * Run with: pnpm --filter @ags/sistema-modular test:venta-loaner
 *   (tsx scripts/test-venta-loaner.ts → side-effect import this file)
 *
 * Uses node:test + node:assert/strict — no framework install needed.
 * Firestore is replaced via __setTestFirestore() DI hook (no emulator required).
 *
 * === RED baseline ===
 * This file FAILS at module load until Wave 2 (plan 15-02) lands the new exports
 * on loanersService:
 *   - `registrarVenta(params: RegistrarVentaParams): Promise<RegistrarVentaResult>`
 *     (transactional replacement of the current `loanersService.registrarVenta`)
 *   - `__setTestFirestore(state: MockVentaLoanerState | null): void` (DI hook)
 *
 * The expected failure modes during Wave 0 are:
 *   - SyntaxError: requested module '../loanersService' does not provide an export
 *     named 'registrarVenta' (the current `registrarVenta` is a method on the
 *     `loanersService` object, not a named export — Wave 2 lifts it as a named export
 *     OR re-exports it for tests).
 *   - Or: TypeError __setTestFirestore is not a function.
 *
 * That is the GREEN signal for "RED baseline is set."
 *
 * Test names match the `--test-name-pattern` filters in 15-VALIDATION.md
 * Per-Task Verification Map (VLN-02a..e).
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// NOTE (Wave 0 RED): These imports DO NOT EXIST YET on loanersService.
// Wave 2 (plan 15-02) lands `registrarVenta` as a named export + `__setTestFirestore`
// DI hook. Until then this import throws at module load — that IS the RED signal.
import { registrarVenta, __setTestFirestore } from '../loanersService';

import {
  buildFixturePreVinculado,
  buildFixtureSinArticulo,
  buildFixtureYaVendido,
  type MockVentaLoanerState,
} from './fixtures/ventaLoaner';

// Suppress unused-type warning while keeping the import for type surface.
void (null as MockVentaLoanerState | null);

describe('registrarVenta — Phase 15 venta loaner espejo a stock', () => {
  beforeEach(() => {
    // Reset DI hook between tests so no state leaks across cases.
    __setTestFirestore(null);
  });

  // ── VLN-02a ────────────────────────────────────────────────────────────────
  test('happy path pre-vinculado: crea unidad+movimiento y marca loaner vendido', async () => {
    const state = buildFixturePreVinculado();
    __setTestFirestore(state);

    const result = await registrarVenta({
      loanerId: 'lnr-1',
      venta: {
        fecha: '2026-05-24T10:00:00.000Z',
        clienteId: 'cli-1',
        clienteNombre: 'Cliente Test',
        precio: 1000,
        moneda: 'USD',
        costoUnitario: 700,
        monedaCosto: 'USD',
      },
    });

    // Return value contract
    assert.ok(result, 'expected result object');
    assert.ok(result.unidadId, 'expected unidadId in result');
    assert.ok(result.movimientoId, 'expected movimientoId in result');

    // Loaner update assertions
    const loaner = state.collections.loaners.find(l => l.id === 'lnr-1')!;
    assert.equal(loaner.estado, 'vendido', 'loaner.estado must transition to vendido');
    assert.equal(loaner.activo, false, 'loaner.activo must be false after sale');
    assert.ok(loaner.venta, 'loaner.venta must be populated');

    // UnidadStock espejo assertions
    assert.equal(state.collections.unidades.length, 1, 'must create exactly 1 unidad espejo');
    const unidad = state.collections.unidades[0];
    assert.equal(unidad.id, result.unidadId, 'unidad.id must match result.unidadId');
    assert.equal(unidad.articuloId, 'art-A', 'unidad inherits articuloId from loaner');
    assert.equal(unidad.estado, 'vendido', 'unidad.estado must be vendido');
    assert.equal(unidad.condicion, 'bien_de_uso', 'unidad.condicion must be bien_de_uso');
    assert.equal(unidad.ubicacion?.tipo, 'cliente', 'unidad.ubicacion.tipo must be cliente');
    assert.equal(unidad.costoUnitario, 700, 'unidad.costoUnitario must come from venta.costoUnitario');

    // MovimientoStock espejo assertions
    assert.equal(state.collections.movimientosStock.length, 1, 'must create exactly 1 movimiento espejo');
    const mov = state.collections.movimientosStock[0];
    assert.equal(mov.id, result.movimientoId, 'movimiento.id must match result.movimientoId');
    assert.equal(mov.tipo, 'egreso', 'movimiento.tipo must be egreso');
    assert.equal(mov.subtipo, 'venta_loaner', 'movimiento.subtipo must be venta_loaner');
    assert.equal(mov.referenciaLoanerId, 'lnr-1', 'movimiento must reference loaner');
    assert.equal(mov.cantidad, 1, 'cantidad must be 1 (loaner = individual)');
    assert.equal(mov.destinoTipo, 'cliente', 'destino must be cliente');
    assert.equal(mov.origenTipo, 'baja', 'origen must be baja');
  });

  // ── VLN-02b ────────────────────────────────────────────────────────────────
  test('happy path sin vinculo: denormaliza articuloId/Codigo/Descripcion en loaner', async () => {
    const state = buildFixtureSinArticulo();
    __setTestFirestore(state);

    await registrarVenta({
      loanerId: 'lnr-1',
      venta: {
        fecha: '2026-05-24T10:00:00.000Z',
        clienteId: 'cli-1',
        clienteNombre: 'Cliente Test',
        precio: 1500,
        moneda: 'USD',
        costoUnitario: 900,
        monedaCosto: 'USD',
      },
      articuloRecienVinculado: {
        articuloId: 'art-B',
        articuloCodigo: 'EQ-NEW',
        articuloDescripcion: 'HPLC nuevo vinculado',
      },
    });

    // Loaner now has articulo denormalized
    const loaner = state.collections.loaners.find(l => l.id === 'lnr-1')!;
    assert.equal(loaner.articuloId, 'art-B', 'loaner.articuloId must be denormalized from recienVinculado');
    assert.equal(loaner.articuloCodigo, 'EQ-NEW', 'loaner.articuloCodigo must be denormalized');
    assert.equal(loaner.articuloDescripcion, 'HPLC nuevo vinculado', 'loaner.articuloDescripcion must be denormalized');

    // Unidad inherits from the just-linked artículo
    const unidad = state.collections.unidades[0];
    assert.equal(unidad.articuloId, 'art-B', 'unidad inherits articuloId from articuloRecienVinculado');
    assert.equal(unidad.articuloCodigo, 'EQ-NEW', 'unidad inherits articuloCodigo');

    // Movimiento inherits articuloId
    const mov = state.collections.movimientosStock[0];
    assert.equal(mov.articuloId, 'art-B', 'movimiento.articuloId must be the just-linked artículo');
  });

  // ── VLN-02c ────────────────────────────────────────────────────────────────
  test('guard ya vendido: throw "Loaner ya vendido" y no crea docs nuevos', async () => {
    const state = buildFixtureYaVendido();
    __setTestFirestore(state);

    const ventaOriginal = state.collections.loaners[0].venta;

    await assert.rejects(
      () =>
        registrarVenta({
          loanerId: 'lnr-1',
          venta: {
            fecha: '2026-05-24T10:00:00.000Z',
            clienteId: 'cli-2',
            clienteNombre: 'Cliente Doble',
            costoUnitario: 700,
            monedaCosto: 'USD',
          },
        }),
      /Loaner ya vendido/,
      'must throw "Loaner ya vendido" when loaner.estado already is vendido',
    );

    // No new docs created
    assert.equal(state.collections.unidades.length, 0, 'must NOT create any unidad when guard rejects');
    assert.equal(state.collections.movimientosStock.length, 0, 'must NOT create any movimiento when guard rejects');

    // Loaner remains intact (original venta not overwritten)
    const loaner = state.collections.loaners.find(l => l.id === 'lnr-1')!;
    assert.equal(loaner.estado, 'vendido', 'loaner.estado must remain vendido');
    assert.deepEqual(loaner.venta, ventaOriginal, 'loaner.venta must NOT be overwritten');
  });

  // ── VLN-02d ────────────────────────────────────────────────────────────────
  test('rollback atómico: si write falla mid-tx, ningún doc se crea ni modifica', async () => {
    // RED placeholder — Wave 2 must add `_throwOnUnidadCreate` mock hook to the
    // in-memory tx simulator so this test can drive a mid-tx throw.
    //
    // Expected behaviour once Wave 2 lands:
    //   1. Build state with fixturePreVinculado + state._throwOnUnidadCreate = true
    //   2. Call registrarVenta(...) → rejects with some error
    //   3. Assert: loaner.estado === 'en_base' (unchanged), activo === true
    //   4. Assert: unidades.length === 0, movimientosStock.length === 0
    //
    // The mock support requires Wave 2 to wrap unidades.create / movimientos.create
    // in conditional throw paths gated by `state._throwOnUnidadCreate`. Until then
    // we hard-fail to keep VLN-02d in the RED bucket.
    assert.fail('RED: requires Wave 2 mock support for _throwOnUnidadCreate');
  });

  // ── VLN-02e ────────────────────────────────────────────────────────────────
  test('costo requerido: throw "Costo requerido" antes de la tx si falta costoUnitario o monedaCosto', async () => {
    // Case 1: missing costoUnitario
    {
      const state = buildFixturePreVinculado();
      __setTestFirestore(state);

      await assert.rejects(
        () =>
          registrarVenta({
            loanerId: 'lnr-1',
            venta: {
              fecha: '2026-05-24T10:00:00.000Z',
              clienteId: 'cli-1',
              clienteNombre: 'Cliente Test',
              // costoUnitario omitted intentionally
              monedaCosto: 'USD',
            } as any,
          }),
        /Costo requerido/i,
        'must throw "Costo requerido" when costoUnitario is missing',
      );

      assert.equal(state.collections.unidades.length, 0, 'no unidad must be created on validation failure');
      assert.equal(state.collections.movimientosStock.length, 0, 'no movimiento must be created on validation failure');
    }

    // Case 2: missing monedaCosto
    {
      const state = buildFixturePreVinculado();
      __setTestFirestore(state);

      await assert.rejects(
        () =>
          registrarVenta({
            loanerId: 'lnr-1',
            venta: {
              fecha: '2026-05-24T10:00:00.000Z',
              clienteId: 'cli-1',
              clienteNombre: 'Cliente Test',
              costoUnitario: 700,
              monedaCosto: undefined,
            } as any,
          }),
        /Costo requerido/i,
        'must throw "Costo requerido" when monedaCosto is missing',
      );

      assert.equal(state.collections.unidades.length, 0, 'no unidad must be created on validation failure');
      assert.equal(state.collections.movimientosStock.length, 0, 'no movimiento must be created on validation failure');
    }
  });
});
