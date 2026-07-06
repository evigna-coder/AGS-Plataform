/**
 * Phase 14 — Patron BOM unit suite.
 *
 * Run with: pnpm --filter @ags/sistema-modular test:patron-bom
 *   (tsx scripts/test-patron-bom.ts → re-exports this file)
 *
 * Uses node:test + node:assert/strict — no framework install needed.
 *
 * === RED baseline ===
 * This file FAILS at module load until downstream plans land:
 *   - 14-01 creates packages/shared/src/utils/patronBom.ts with the 5 pure helpers
 *     (computeSaldoComponente, computeLoteStatus, computePatronStatus,
 *      findLoteFifoDisponible, buildPatronesConsumidosSugerencia)
 *   - 14-02 adds patronesService.consumirComponentes + __setTestFirestore DI hook
 *   - 14-03 adds autoCrearRequerimientosPatron (exercised via the BOM-08 idempotency test)
 *
 * The expected failure modes during Wave 0 are:
 *   - ERR_MODULE_NOT_FOUND for '@ags/shared/utils/patronBom' (14-01 fixes)
 *   - "is not a function" for __setTestFirestore / consumirComponentes (14-02 fixes)
 *
 * That is the GREEN signal for "RED baseline is set."
 *
 * === Stdout linkage ===
 * Each suite logs a [BOM-XX label] line so a verifier can grep test stdout:
 *   pnpm --filter @ags/sistema-modular test:patron-bom 2>&1 | grep '\[BOM-'
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeSaldoComponente,
  computeLoteStatus,
  // computePatronStatus reserved for 14-05 follow-up tests; imported to lock the surface.
  computePatronStatus,
  findLoteFifoDisponible,
  buildPatronesConsumidosSugerencia,
} from '@ags/shared/utils/patronBom';
import {
  __setTestFirestore,
  consumirComponentes,
  patronesService,
} from '../services/patronesService';

import {
  legacyPatron,
  simplePatron,
  simplePatronLoteCantidad5,
  complexPatron,
  loteHealthy,
  loteWithOneComponentAtZero,
  loteAllZero,
  patronWithThreeLotes,
  patronWith2Componentes,
  buildState,
  type MockPatronBomState,
} from './fixtures/patronBom';

// Reference computePatronStatus so the import lands in the bundle even if unused
// at the per-test level — keeps the import surface honest until 14-05 wires its tests.
void computePatronStatus;

// ════════════════════════════════════════════════════════════════════════════
// BOM-02 — pure helpers (no Firestore)
// ════════════════════════════════════════════════════════════════════════════

test('[BOM-02 legacy] computeSaldoComponente returns Infinity when patron has no BOM', () => {
  const lote = (legacyPatron.lotes[0] as any);
  const saldo = computeSaldoComponente(legacyPatron as any, lote, 'any-code');
  assert.equal(saldo, Infinity, 'legacy patron (no componentes) → unbounded saldo');
});

test('[BOM-02 simple] computeSaldoComponente uses cantidad * cantidadPorKit - consumido', () => {
  // simplePatron: 1 componente, cantidadPorKit=3
  // simplePatronLoteCantidad5: cantidad=5, consumido(amp-A)=2  → 5*3 - 2 = 13
  const saldo = computeSaldoComponente(simplePatron, simplePatronLoteCantidad5, 'amp-A');
  assert.equal(saldo, 13);
});

test('[BOM-02 null] computeSaldoComponente NaN-guards when lote.cantidad is null', () => {
  const loteNullCantidad = { ...simplePatronLoteCantidad5, cantidad: null, componentesConsumidos: [] };
  const saldo = computeSaldoComponente(simplePatron, loteNullCantidad, 'amp-A');
  assert.equal(saldo, 0, 'null cantidad coerces to 0; no NaN leak');
});

test('[BOM-02 status active legacy] computeLoteStatus returns active when no BOM declared', () => {
  const status = computeLoteStatus(legacyPatron as any, legacyPatron.lotes[0] as any);
  assert.equal(status, 'active');
});

test('[BOM-02 status active healthy] computeLoteStatus returns active when all components above stockMinimo', () => {
  const status = computeLoteStatus(complexPatron, loteHealthy);
  assert.equal(status, 'active');
});

test('[BOM-02 status bloqueado] computeLoteStatus returns bloqueado when one componente saldo<=stockMinimo but others positive', () => {
  const status = computeLoteStatus(complexPatron, loteWithOneComponentAtZero);
  assert.equal(status, 'bloqueado');
});

test('[BOM-02 status agotado] computeLoteStatus returns agotado when ALL components at saldo<=0', () => {
  const status = computeLoteStatus(complexPatron, loteAllZero);
  assert.equal(status, 'agotado');
});

test('[BOM-02 FIFO] findLoteFifoDisponible returns earliest fechaVencimiento with saldo > 0 and status != bloqueado/agotado', () => {
  const pick = findLoteFifoDisponible(patronWithThreeLotes, '2026-06-01');
  assert.ok(pick, 'expected a lote pick');
  assert.equal(pick!.lote, 'L-MID', 'L-OLD has cantidad=0 → skip; L-MID earliest with saldo > 0');
});

test('[BOM-02 sugerencia] buildPatronesConsumidosSugerencia dedupes by (patronId, lote) and yields 1 entry per componente', () => {
  // 2 duplicate entries pointing to a patron with 2 componentes → should produce 2 sugerencias
  // (1 per componente of the dedupe-collapsed kit), NOT 4 (Pitfall 4 from RESEARCH).
  const sugerencias = buildPatronesConsumidosSugerencia(
    [
      { patronId: 'P-2COMP', lote: 'L1' },
      { patronId: 'P-2COMP', lote: 'L1' },
    ],
    [patronWith2Componentes],
  );
  assert.equal(sugerencias.length, 2, 'dedupe collapses duplicates; 1 sugerencia per componente of the kit');
});

// ════════════════════════════════════════════════════════════════════════════
// BOM-03 — consumirComponentes (runTransaction atómico, vía __setTestFirestore DI)
// ════════════════════════════════════════════════════════════════════════════

/** Helper: build a state with a Patron and a Lote pre-loaded. */
function stateWithPatron(patron: any, loteOverride?: any): MockPatronBomState {
  const lote = loteOverride ?? { lote: 'L1', cantidad: 10, fechaVencimiento: '2027-01-01', componentesConsumidos: [] };
  const docCopy = { ...patron, lotes: [lote] };
  const state = buildState();
  state.patrones.set(patron.id, docCopy);
  return state;
}

test('[BOM-03 happy] consumirComponentes increments componentesConsumidos and writes 1 MovimientoStock per componente', async () => {
  const state = stateWithPatron(simplePatron);
  __setTestFirestore(state);

  const result = await consumirComponentes({
    otNumber: 'OT-1',
    consumos: [
      {
        patronId: 'P-SIMPLE',
        lote: 'L1',
        componentes: [{ codigoComponente: 'amp-A', cantidad: 1 }],
      },
    ],
    creadoPor: 'u1',
  });

  assert.ok(Array.isArray(result.movimientoIds), 'returns movimientoIds[]');
  assert.equal(result.movimientoIds.length, 1, '1 componente consumido → 1 MovimientoStock');

  const patronAfter = state.patrones.get('P-SIMPLE');
  const consumidos = patronAfter.lotes[0].componentesConsumidos as Array<{ codigoComponente: string; cantidadConsumida: number }>;
  const ampA = consumidos.find(c => c.codigoComponente === 'amp-A');
  assert.ok(ampA, 'amp-A entry created in componentesConsumidos');
  assert.equal(ampA!.cantidadConsumida, 1);
});

test('[BOM-03 atomicity] consumirComponentes throws when saldo would go negative and leaves state untouched', async () => {
  // simplePatron + cantidad=1 + cantidadPorKit=3 → max consumable = 3
  // Asking for cantidad=99 must blow up before any write.
  const loteSmall = { lote: 'L1', cantidad: 1, fechaVencimiento: '2027-01-01', componentesConsumidos: [] };
  const state = stateWithPatron(simplePatron, loteSmall);
  __setTestFirestore(state);

  await assert.rejects(
    consumirComponentes({
      otNumber: 'OT-ATOMIC',
      consumos: [
        {
          patronId: 'P-SIMPLE',
          lote: 'L1',
          componentes: [{ codigoComponente: 'amp-A', cantidad: 99 }],
        },
      ],
      creadoPor: 'u1',
    }),
    /saldo|insuficiente|stock/i,
    'BOM-03: must reject when saldo would go negative',
  );

  // State unchanged
  assert.equal(state.movimientos.size, 0, 'no MovimientoStock written on rollback');
  const consumidos = state.patrones.get('P-SIMPLE').lotes[0].componentesConsumidos ?? [];
  assert.equal(consumidos.length, 0, 'componentesConsumidos untouched on rollback');
});

test('[BOM-03 granularidad] consumirComponentes writes 1 MovimientoStock per componente across N patrones', async () => {
  // 2 patrones × 3 componentes each = 6 MovimientoStock writes
  const patron1 = {
    ...complexPatron,
    id: 'P-A',
    componentes: complexPatron.componentes.slice(0, 3),
  };
  const patron2 = {
    ...complexPatron,
    id: 'P-B',
    componentes: complexPatron.componentes.slice(0, 3),
  };
  const state = buildState();
  state.patrones.set('P-A', { ...patron1, lotes: [{ lote: 'L1', cantidad: 5, fechaVencimiento: '2027-01-01', componentesConsumidos: [] }] });
  state.patrones.set('P-B', { ...patron2, lotes: [{ lote: 'L1', cantidad: 5, fechaVencimiento: '2027-01-01', componentesConsumidos: [] }] });
  __setTestFirestore(state);

  const result = await consumirComponentes({
    otNumber: 'OT-GRAN',
    consumos: [
      {
        patronId: 'P-A',
        lote: 'L1',
        componentes: [
          { codigoComponente: 'amp-0', cantidad: 1 },
          { codigoComponente: 'amp-1', cantidad: 1 },
          { codigoComponente: 'amp-2', cantidad: 1 },
        ],
      },
      {
        patronId: 'P-B',
        lote: 'L1',
        componentes: [
          { codigoComponente: 'amp-0', cantidad: 1 },
          { codigoComponente: 'amp-1', cantidad: 1 },
          { codigoComponente: 'amp-2', cantidad: 1 },
        ],
      },
    ],
    creadoPor: 'u1',
  });

  assert.equal(result.movimientoIds.length, 6, '2 patrones × 3 componentes = 6 MovimientoStock');
  assert.equal(state.movimientos.size, 6, 'mock state mirrors 6 writes');
});

// ════════════════════════════════════════════════════════════════════════════
// BOM-08 — idempotency (re-cierre admin + auto-requerimiento)
// ════════════════════════════════════════════════════════════════════════════

test('[BOM-08 idempotency] consumirComponentes throws when MovimientoStock already exists for otNumber+entidadTipo=patron', async () => {
  const state = stateWithPatron(simplePatron);
  // Pre-seed a MovimientoStock as if a previous cierre admin had already discounted
  state.movimientos.set('prev-mov', {
    id: 'prev-mov',
    entidadTipo: 'patron',
    otNumber: 'OT-DUP',
    patronId: 'P-SIMPLE',
    codigoComponente: 'amp-A',
    cantidad: 1,
  });
  __setTestFirestore(state);

  await assert.rejects(
    consumirComponentes({
      otNumber: 'OT-DUP',
      consumos: [
        {
          patronId: 'P-SIMPLE',
          lote: 'L1',
          componentes: [{ codigoComponente: 'amp-A', cantidad: 1 }],
        },
      ],
      creadoPor: 'u1',
    }),
    /ya descontados|already|duplicado|idempot/i,
    'BOM-08: must reject re-cierre on same otNumber',
  );

  // No new movimientos written
  assert.equal(state.movimientos.size, 1, 'only the pre-existing movimiento remains');
});

test('[BOM-08 auto-req idempotency] crossing stockMinimo twice (across two OTs) yields only 1 RequerimientoCompra', async () => {
  // simplePatron: cantidadPorKit=3, stockMinimo=1
  // lote.cantidad=1, consumido starts at 0 → saldo=3. Consume 2 → saldo=1 (<=stockMinimo).
  // First OT triggers auto-req. Second OT (different otNumber) on the same patron/lote/componente
  // must SKIP because an open REQ already exists.
  const lote = { lote: 'L1', cantidad: 1, fechaVencimiento: '2027-01-01', componentesConsumidos: [] };
  const state = stateWithPatron(simplePatron, lote);
  state.adminConfigFlujos = { usuarioRequerimientosPatronId: 'admin-stock' };
  __setTestFirestore(state);

  // First consumption: saldo 3 → 1 (hits stockMinimo)
  await consumirComponentes({
    otNumber: 'OT-REQ-1',
    consumos: [
      {
        patronId: 'P-SIMPLE',
        lote: 'L1',
        componentes: [{ codigoComponente: 'amp-A', cantidad: 2 }],
      },
    ],
    creadoPor: 'u1',
  });
  const reqsAfter1 = state.requerimientos.size;
  assert.equal(reqsAfter1, 1, 'first cierre admin creates 1 RequerimientoCompra (origen=patron_minimo)');

  // Second consumption (different OT): saldo 1 → still 1 minus something else → still below min.
  // Idempotent helper must skip because an open REQ exists for (patronId, loteId, codigoComponente).
  await consumirComponentes({
    otNumber: 'OT-REQ-2',
    consumos: [
      {
        patronId: 'P-SIMPLE',
        lote: 'L1',
        componentes: [{ codigoComponente: 'amp-A', cantidad: 1 }],
      },
    ],
    creadoPor: 'u1',
  });
  assert.equal(state.requerimientos.size, 1, 'second OT does NOT create a duplicate REQ (auto-req idempotent)');
});

// ════════════════════════════════════════════════════════════════════════════
// BOM-04 — service-layer rename guard (defense-in-depth contra UI bypass)
// ════════════════════════════════════════════════════════════════════════════

/** Helper for BOM-04: patron con componentes BOM y lotes con consumos previos */
function buildPatronConConsumos(): any {
  return {
    id: 'P-RENAME',
    codigoArticulo: 'RENAME-001',
    descripcion: 'Patron con consumos previos',
    marca: 'Test',
    categorias: [],
    activo: true,
    componentes: [
      { codigoComponente: 'amp-A', descripcion: 'Ampolla A', cantidadPorKit: 1, unidadMedida: 'amp', stockMinimo: 0 },
    ],
    lotes: [
      {
        lote: 'L1',
        cantidad: 5,
        fechaVencimiento: '2027-01-01',
        componentesConsumidos: [{ codigoComponente: 'amp-A', cantidadConsumida: 1 }],
      },
    ],
  };
}

test('[BOM-04 service guard] rename of consumed componente throws orphan error', async () => {
  const state = buildState();
  state.patrones.set('P-RENAME', buildPatronConConsumos());
  __setTestFirestore(state);

  await assert.rejects(
    () => patronesService.update('P-RENAME', {
      componentes: [
        { codigoComponente: 'amp-B', descripcion: 'B', cantidadPorKit: 1, unidadMedida: 'amp', stockMinimo: 0 },
      ],
    }),
    /hu[eé]rfan.*amp-A/i,
    'BOM-04: must reject rename when amp-A still has consumos in lotes',
  );

  __setTestFirestore(null);
});

test('[BOM-04 service guard] keeping all consumed codigos does NOT throw (rename + add new is fine)', async () => {
  const state = buildState();
  state.patrones.set('P-RENAME', buildPatronConConsumos());
  __setTestFirestore(state);

  // Keep amp-A (still has consumos) + add amp-B (new) — must succeed
  await patronesService.update('P-RENAME', {
    componentes: [
      { codigoComponente: 'amp-A', descripcion: 'Ampolla A (renamed desc)', cantidadPorKit: 2, unidadMedida: 'amp', stockMinimo: 1 },
      { codigoComponente: 'amp-B', descripcion: 'B', cantidadPorKit: 1, unidadMedida: 'amp', stockMinimo: 0 },
    ],
  });

  const updated = state.patrones.get('P-RENAME');
  assert.equal(updated.componentes.length, 2, 'both componentes persisted');
  assert.equal(updated.componentes[0].codigoComponente, 'amp-A', 'amp-A retained');
  assert.equal(updated.componentes[0].descripcion, 'Ampolla A (renamed desc)', 'desc/cantidad updates allowed');

  __setTestFirestore(null);
});

test('[BOM-04 service guard] patches WITHOUT componentes key do NOT trigger guard', async () => {
  const state = buildState();
  state.patrones.set('P-RENAME', buildPatronConConsumos());
  __setTestFirestore(state);

  // Only update unrelated fields → guard must NOT inspect consumos, must NOT throw
  await patronesService.update('P-RENAME', {
    descripcion: 'Descripción actualizada',
  });

  const updated = state.patrones.get('P-RENAME');
  assert.equal(updated.descripcion, 'Descripción actualizada', 'unrelated field updated');
  assert.equal(updated.componentes.length, 1, 'componentes untouched');

  __setTestFirestore(null);
});

test('[BOM-04 service guard] patron with no consumos allows free rename', async () => {
  const state = buildState();
  // Patron with componente BUT lotes have no componentesConsumidos
  state.patrones.set('P-FREE', {
    ...buildPatronConConsumos(),
    id: 'P-FREE',
    lotes: [{ lote: 'L1', cantidad: 5, fechaVencimiento: '2027-01-01', componentesConsumidos: [] }],
  });
  __setTestFirestore(state);

  // Free to rename amp-A → amp-X because no consumos referencen amp-A
  await patronesService.update('P-FREE', {
    componentes: [
      { codigoComponente: 'amp-X', descripcion: 'X', cantidadPorKit: 1, unidadMedida: 'amp', stockMinimo: 0 },
    ],
  });

  const updated = state.patrones.get('P-FREE');
  assert.equal(updated.componentes[0].codigoComponente, 'amp-X', 'rename allowed when no consumos');

  __setTestFirestore(null);
});
