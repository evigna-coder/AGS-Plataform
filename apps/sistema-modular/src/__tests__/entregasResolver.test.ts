/**
 * Phase 16 — Entregas Resolver unit suite (Wave 0 RED baseline).
 *
 * Run with: pnpm --filter @ags/sistema-modular test:entregas
 *
 * Uses node:test + node:assert/strict — no framework install.
 *
 * === RED baseline ===
 * Tests fail until:
 *   - 16-03 implements computeSemaforo, computeEtaFecha, buildEntregaRows
 *   - 16-02 ensures Presupuesto.fechaAceptacion + RequerimientoCompra.presupuestoItemId
 *     are written by aceptarConRequerimientos (only affects ENT-03 integration via fixtures)
 *
 * Each test logs [ENT-XX label] for stdout grep:
 *   pnpm --filter @ags/sistema-modular test:entregas 2>&1 | grep '\[ENT-'
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeSemaforo,
  computeEtaFecha,
  buildEntregaRows,
} from '../utils/entregasResolver.ts';
import {
  FIXTURE_NOW,
  makePresupuestoBase,
  makeItem,
  makeRequerimiento,
  makeOC,
  makeImportacion,
  CLIENTE_NOMBRE_BY_ID,
} from './fixtures/entregas.ts';

test('[ENT-01] computeSemaforo classifies verde/amarillo/rojo/sin_eta correctly', () => {
  assert.equal(computeSemaforo(10), 'verde',     'diasRestantes=10 → verde (>5)');
  assert.equal(computeSemaforo(6),  'verde',     'diasRestantes=6  → verde (>5)');
  assert.equal(computeSemaforo(5),  'amarillo',  'diasRestantes=5  → amarillo (0..5)');
  assert.equal(computeSemaforo(0),  'amarillo',  'diasRestantes=0  → amarillo (boundary)');
  assert.equal(computeSemaforo(-1), 'rojo',      'diasRestantes=-1 → rojo (<0)');
  assert.equal(computeSemaforo(null), 'sin_eta', 'diasRestantes=null → sin_eta');
});

test('[ENT-02] computeEtaFecha computes fechaAceptacion + etaDiasEstimados correctly', () => {
  // 2026-05-15 + 30 = 2026-06-14
  const eta = computeEtaFecha('2026-05-15T10:00:00.000Z', 30);
  assert.ok(eta && eta.startsWith('2026-06-14'), `expected 2026-06-14, got ${eta}`);

  // null inputs → null
  assert.equal(computeEtaFecha(null, 30), null, 'fechaAceptacion null → null');
  assert.equal(computeEtaFecha('2026-05-15T10:00:00.000Z', null), null, 'etaDiasEstimados null → null');
});

test('[ENT-03] buildEntregaRows resolves ppto→req→oc→imp chain via presupuestoItemId', () => {
  const ppto = makePresupuestoBase({
    items: [makeItem({ id: 'ITEM-1', etaDiasEstimados: 30 })],
  });
  const req = makeRequerimiento({ presupuestoItemId: 'ITEM-1', ordenCompraId: 'OC-001', ordenCompraNumero: 'OC-2025-0042' });
  const oc = makeOC();
  const imp = makeImportacion();

  const rows = buildEntregaRows({
    presupuestos: [ppto],
    requerimientos: [req],
    ordenesCompra: [oc],
    importaciones: [imp],
    clienteNombreById: CLIENTE_NOMBRE_BY_ID,
    now: FIXTURE_NOW,
  });

  assert.equal(rows.length, 1, 'exactly 1 row per item');
  const r = rows[0];
  assert.equal(r.presupuestoNumero, 'PRE-0001');
  assert.equal(r.clienteNombre, 'Bayer S.A.', 'clienteNombre resolved from map');
  assert.equal(r.requerimientoId, 'REQ-001', 'req joined by presupuestoItemId');
  assert.equal(r.ocNumero, 'OC-2025-0042', 'oc joined via requerimientoId on ocItem');
  assert.equal(r.importacionId, 'IMP-001');
  assert.equal(r.importacionNumero, 'IMP-0001');
  assert.equal(r.importacionEstado, 'en_transito');
  assert.ok(r.etaFecha && r.etaFecha.startsWith('2026-06-14'), `etaFecha computed: ${r.etaFecha}`);
  assert.equal(r.diasRestantes, 13, 'diasRestantes from FIXTURE_NOW (2026-06-01) to 2026-06-14');
  assert.equal(r.semaforo, 'verde', '13 días → verde');
});

test('[ENT-04] items sin etaDiasEstimados → semaforo = sin_eta (no crash)', () => {
  const ppto = makePresupuestoBase({
    items: [makeItem({ id: 'ITEM-X', etaDiasEstimados: null })],
  });
  const rows = buildEntregaRows({
    presupuestos: [ppto],
    requerimientos: [],
    ordenesCompra: [],
    importaciones: [],
    clienteNombreById: CLIENTE_NOMBRE_BY_ID,
    now: FIXTURE_NOW,
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].etaFecha, null);
  assert.equal(rows[0].diasRestantes, null);
  assert.equal(rows[0].semaforo, 'sin_eta');
});

test('[ENT-05] item con importacion.estado=recibido → semaforo = entregado', () => {
  const ppto = makePresupuestoBase({
    items: [makeItem({ id: 'ITEM-1', etaDiasEstimados: 10 /* would be rojo without entregado override */ })],
  });
  const req = makeRequerimiento({ presupuestoItemId: 'ITEM-1' });
  const oc = makeOC();
  const imp = makeImportacion({ estado: 'recibido', items: [
    { id: 'IMPITEM-1', itemOCId: 'OCITEM-1', articuloId: 'ART-1', articuloCodigo: 'G1312-60067',
      descripcion: 'Columna', cantidadPedida: 1, cantidadRecibida: 1, unidadMedida: 'unidad', requerimientoId: 'REQ-001' },
  ] });

  const rows = buildEntregaRows({
    presupuestos: [ppto],
    requerimientos: [req],
    ordenesCompra: [oc],
    importaciones: [imp],
    clienteNombreById: CLIENTE_NOMBRE_BY_ID,
    now: FIXTURE_NOW,
  });
  assert.equal(rows[0].importacionEstado, 'recibido');
  assert.equal(rows[0].semaforo, 'entregado', 'recibido → entregado (no rojo)');
});

test('[ENT-06] item sin requerimiento (stock available) sigue mostrando row (sin cadena req/oc/imp)', () => {
  const ppto = makePresupuestoBase({
    items: [makeItem({ id: 'ITEM-S', disponibilidad: 'stock', etaDiasEstimados: 2 })],
  });
  const rows = buildEntregaRows({
    presupuestos: [ppto],
    requerimientos: [],
    ordenesCompra: [],
    importaciones: [],
    clienteNombreById: CLIENTE_NOMBRE_BY_ID,
    now: FIXTURE_NOW,
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].disponibilidad, 'stock');
  assert.equal(rows[0].requerimientoId, null);
  assert.equal(rows[0].ocNumero, null);
  assert.equal(rows[0].importacionId, null);
  // etaDiasEstimados=2, fechaAceptacion=2026-05-15 → eta=2026-05-17 → diasRestantes=-15 → rojo
  assert.equal(rows[0].semaforo, 'rojo');
});
