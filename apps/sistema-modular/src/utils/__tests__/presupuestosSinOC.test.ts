/**
 * Seguimiento de la OC del cliente (2026-09-18): quién está "sin OC", desde
 * cuándo está aprobado y desde cuándo se hizo el trabajo.
 *   pnpm --filter @ags/sistema-modular test:presupuestos-sin-oc
 */
import assert from 'node:assert/strict';
import type { Presupuesto, WorkOrder } from '@ags/shared';
import { computeSinOC, esPresupuestoSinOC, colorDiasSinOC } from '../presupuestosSinOC';

let pasados = 0;
function test(nombre: string, fn: () => void) {
  try { fn(); pasados++; console.log(`  ✓ ${nombre}`); }
  catch (err) { console.error(`  ✗ ${nombre}`); throw err; }
}

const hoy = new Date();
const hace = (dias: number) => {
  // A las 0:00 (no a las 12:00): la analítica cuenta períodos de 24 h enteros
  // y a la mañana daba un día menos que el conteo por calendario (2026-09-22).
  const d = new Date(hoy); d.setDate(d.getDate() - dias); d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

const ppto = (p: Partial<Presupuesto>): Presupuesto => ({
  id: p.numero ?? 'x', numero: 'P1-000001-01', estado: 'pendiente_oc', tipo: 'servicio', moneda: 'USD', total: 100,
  items: [], clienteId: 'c1', ordenesCompraIds: [], adjuntos: [], createdAt: hace(40), updatedAt: hace(1),
  ...p,
} as unknown as Presupuesto);

const ot = (o: Partial<WorkOrder>): WorkOrder => ({
  otNumber: '30000.01', budgets: [], estadoAdmin: 'CIERRE_TECNICO',
  ...o,
} as unknown as WorkOrder);

console.log('esPresupuestoSinOC');
test('aprobado sin OC → sí', () => assert.equal(esPresupuestoSinOC(ppto({})), true));
test('en ejecución sin OC → sí', () => assert.equal(esPresupuestoSinOC(ppto({ estado: 'en_ejecucion' })), true));
test('enviado (no aprobado) → no', () => assert.equal(esPresupuestoSinOC(ppto({ estado: 'enviado' })), false));
test('solo el número a mano, sin archivo → sí (2026-09-22)', () => assert.equal(esPresupuestoSinOC(ppto({ ordenCompraNumero: 'OC-77' })), true));
test('con el PDF adjunto → no', () => assert.equal(esPresupuestoSinOC(ppto({ ordenCompraNumero: 'OC-77', adjuntos: [{ tipo: 'orden_compra' }] } as Partial<Presupuesto>)), false));
test('con OC formal vinculada → no', () => assert.equal(esPresupuestoSinOC(ppto({ ordenesCompraIds: ['oc1'] })), false));
test('respaldo por certificación → no', () => assert.equal(esPresupuestoSinOC(ppto({ respaldoFacturacion: 'certificacion' } as Partial<Presupuesto>)), false));

console.log('computeSinOC');
test('días desde la aprobación', () => {
  const m = computeSinOC([ppto({ id: 'a', fechaAceptacion: hace(20) })], [], hoy);
  assert.equal(m.get('a')?.diasSinOC, 20);
  assert.equal(m.get('a')?.otsCerradas.length, 0);
  assert.equal(m.get('a')?.diasDesdeCierre, null);
});
test('aceptado legacy sin fecha → diasSinOC null pero figura', () => {
  const m = computeSinOC([ppto({ id: 'a' })], [], hoy);
  assert.equal(m.has('a'), true);
  assert.equal(m.get('a')?.diasSinOC, null);
  assert.equal(m.get('a')?.fechaAceptacionAprox, false);
});
test('sin fecha de aprobación pero con envío → aproxima por la fecha de envío', () => {
  const i = computeSinOC([ppto({ id: 'a', fechaEnvio: hace(12) })], [], hoy).get('a');
  assert.equal(i?.diasSinOC, 12);
  assert.equal(i?.fechaAceptacionAprox, true);
});
test('con fecha de aprobación no aproxima', () => {
  const i = computeSinOC([ppto({ id: 'a', fechaAceptacion: hace(5), fechaEnvio: hace(12) })], [], hoy).get('a');
  assert.equal(i?.diasSinOC, 5);
  assert.equal(i?.fechaAceptacionAprox, false);
});
test('con OT cerrada: primer cierre técnico y días', () => {
  const p = ppto({ id: 'a', numero: 'P1-000009-01', fechaAceptacion: hace(30) });
  const ots = [
    ot({ otNumber: '30001.01', budgets: ['P1-000009-01'], estadoHistorial: [{ estado: 'CIERRE_TECNICO', fecha: hace(10) }] as WorkOrder['estadoHistorial'] }),
    ot({ otNumber: '30001.02', budgets: ['P1-000009-01'], estadoHistorial: [{ estado: 'CIERRE_TECNICO', fecha: hace(4) }] as WorkOrder['estadoHistorial'] }),
    ot({ otNumber: '30002.01', budgets: ['OTRO'], estadoHistorial: [{ estado: 'CIERRE_TECNICO', fecha: hace(50) }] as WorkOrder['estadoHistorial'] }),
  ];
  const i = computeSinOC([p], ots, hoy).get('a');
  assert.deepEqual(i?.otsCerradas, ['30001.01', '30001.02']);
  assert.equal(i?.diasDesdeCierre, 10);
  assert.equal(i?.diasSinOC, 30);
});
test('OT abierta no cuenta como trabajo hecho', () => {
  const p = ppto({ id: 'a', numero: 'P1-000009-01', fechaAceptacion: hace(3) });
  const i = computeSinOC([p], [ot({ budgets: ['P1-000009-01'], estadoAdmin: 'EN_CURSO' })], hoy).get('a');
  assert.equal(i?.otsCerradas.length, 0);
});
test('con OC no entra al mapa', () => {
  assert.equal(computeSinOC([ppto({ id: 'a', ordenesCompraIds: ['oc1'] })], [], hoy).has('a'), false);
});

console.log('colorDiasSinOC');
test('semáforo 15/30', () => {
  assert.match(colorDiasSinOC(10), /slate/);
  assert.match(colorDiasSinOC(20), /amber/);
  assert.match(colorDiasSinOC(31), /red/);
  assert.match(colorDiasSinOC(null), /slate/);
});

console.log(`\n${pasados} tests OK`);
