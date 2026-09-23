/**
 * Pool de envíos (2026-09-23).
 *   pnpm --filter @ags/sistema-modular test:pool-envios
 */
import assert from 'node:assert/strict';
import type { GastoEnvio } from '@ags/shared';
import { arsAUsd, entradasPoolEnvios, envioContempladoUSD, ledgerPoolEnvios, resumenPoolEnvios, salidasPoolEnvios, type PresupuestoPool } from '../poolEnvios';

let pasados = 0;
function test(nombre: string, fn: () => void) {
  try { fn(); pasados++; console.log(`  ✓ ${nombre}`); }
  catch (err) { console.error(`  ✗ ${nombre}`); throw err; }
}

const ppto = (p: Partial<PresupuestoPool>): PresupuestoPool => ({
  id: p.numero ?? 'x', numero: 'P1-000001-01', estado: 'aceptado', moneda: 'USD', clienteNombre: 'Cliente', fechaAceptacion: '2026-09-10T12:00:00.000Z', updatedAt: '2026-09-10', items: [], ...p,
} as unknown as PresupuestoPool);
const gasto = (g: Partial<GastoEnvio>): GastoEnvio => ({
  id: g.id ?? 'g', fecha: '2026-09-20', montoARS: 45000, tipoCambio: 1500, montoUSD: 30, remitoIds: [], remitoNumeros: ['0001-00017530'], otNumbers: ['30300.01'], presupuestoIds: [], presupuestoNumeros: [], createdAt: '', updatedAt: '', ...g,
} as GastoEnvio);

console.log('envioContempladoUSD');
test('en dólares se toma tal cual; cero o vacío no entra', () => {
  assert.equal(envioContempladoUSD(ppto({ envioContemplado: 50 })), 50);
  assert.equal(envioContempladoUSD(ppto({ envioContemplado: 0 })), null);
  assert.equal(envioContempladoUSD(ppto({ envioContemplado: null })), null);
});
test('en pesos se convierte con el tipo de cambio del presupuesto; sin TC no se valúa', () => {
  assert.equal(envioContempladoUSD(ppto({ moneda: 'ARS', envioContemplado: 75000, tipoCambio: 1500 })), 50);
  assert.equal(envioContempladoUSD(ppto({ moneda: 'ARS', envioContemplado: 75000 })), null);
});

console.log('entradasPoolEnvios');
test('solo presupuestos aceptados (incluidos los posteriores: en ejecución, facturado…)', () => {
  const e = entradasPoolEnvios([
    ppto({ numero: 'A', envioContemplado: 50, estado: 'enviado' }),
    ppto({ numero: 'B', envioContemplado: 50, estado: 'pendiente_oc' }),
    ppto({ numero: 'C', envioContemplado: 20, estado: 'facturado' }),
    ppto({ numero: 'D', envioContemplado: 20, estado: 'anulado' }),
  ]);
  assert.deepEqual(e.map(m => m.presupuestoNumero), ['B', 'C']);
  assert.equal(e[0].fecha, '2026-09-10');
});

console.log('ledgerPoolEnvios / resumenPoolEnvios');
test('caso del user: 50 contemplados, 30 gastados, un chico con 0 usa los 20 que sobran', () => {
  const pptos = [ppto({ numero: 'GRANDE', envioContemplado: 50 }), ppto({ numero: 'CHICO', envioContemplado: 0, fechaAceptacion: '2026-09-15' })];
  const gastos = [gasto({ id: 'g1', fecha: '2026-09-12', montoARS: 45000, tipoCambio: 1500, montoUSD: 30, presupuestoNumeros: ['GRANDE'] }),
    gasto({ id: 'g2', fecha: '2026-09-18', montoARS: 30000, tipoCambio: 1500, montoUSD: 20, presupuestoNumeros: ['CHICO'] })];
  const l = ledgerPoolEnvios(pptos, gastos);
  assert.deepEqual(l.map(m => [m.tipo, m.montoUSD, m.saldoUSD]), [['entrada', 50, 50], ['salida', 30, 20], ['salida', 20, 0]]);
  const r = resumenPoolEnvios(l, '2026-09-23');
  assert.equal(r.saldoUSD, 0);
  assert.equal(r.entradasMesUSD, 50);
  assert.equal(r.salidasMesUSD, 50);
  assert.equal(r.salidasMesARS, 75000);
});
test('misma fecha: la entrada va antes que la salida', () => {
  const l = ledgerPoolEnvios([ppto({ numero: 'A', envioContemplado: 10, fechaAceptacion: '2026-09-20' })], [gasto({ fecha: '2026-09-20', montoUSD: 4 })]);
  assert.deepEqual(l.map(m => m.tipo), ['entrada', 'salida']);
  assert.equal(l[1].saldoUSD, 6);
});
test('el saldo puede quedar negativo y se ve', () => {
  const l = ledgerPoolEnvios([], [gasto({ montoUSD: 12 })]);
  assert.equal(resumenPoolEnvios(l, '2026-09-23').saldoUSD, -12);
});
test('salida: referencia con remitos y OT; sin nada = sin referencia', () => {
  const s = salidasPoolEnvios([gasto({}), gasto({ remitoNumeros: [], otNumbers: [] })]);
  assert.equal(s[0].referencia, 'Remito 0001-00017530 · OT 30300.01');
  assert.equal(s[1].referencia, 'Sin referencia');
});
test('resumen: solo cuenta el mes pedido', () => {
  const l = ledgerPoolEnvios([ppto({ numero: 'A', envioContemplado: 10, fechaAceptacion: '2026-08-30' })], [gasto({ fecha: '2026-09-02', montoUSD: 3 })]);
  const r = resumenPoolEnvios(l, '2026-09-23');
  assert.equal(r.entradasMesUSD, 0);
  assert.equal(r.salidasMesUSD, 3);
  assert.equal(r.saldoUSD, 7);
});

console.log('arsAUsd');
test('redondea a dos decimales y tolera TC cero', () => {
  assert.equal(arsAUsd(100000, 1470), 68.03);
  assert.equal(arsAUsd(100, 0), 0);
});

console.log(`\n${pasados} tests OK`);
