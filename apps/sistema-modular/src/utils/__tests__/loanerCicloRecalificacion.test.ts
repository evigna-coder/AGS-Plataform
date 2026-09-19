/**
 * Ciclo de recalificación de loaners (2026-09-18): origen vigente, qué OT
 * libera y patch del retorno desde proveedor.
 *   pnpm --filter @ags/sistema-modular test:loaner-recalificacion
 */
import assert from 'node:assert/strict';
import type { Loaner, LoanerDerivacion, PrestamoLoaner } from '@ags/shared';
import {
  OT_RECALIFICACION_CLAIM, origenPendienteDeRecalificacion, otRecalificacionVigente,
  otCierraElCiclo, patchRetornoProveedor,
} from '../loanerCicloRecalificacion';

let pasados = 0;
function test(nombre: string, fn: () => void) {
  try { fn(); pasados++; console.log(`  ✓ ${nombre}`); }
  catch (err) { console.error(`  ✗ ${nombre}`); throw err; }
}

const prestamo = (p: Partial<PrestamoLoaner>): PrestamoLoaner => ({
  id: 'p1', clienteId: 'c1', clienteNombre: 'Cliente', fechaSalida: '2026-09-01',
  estado: 'devuelto', fechaRetornoReal: '2026-09-10T10:00:00.000Z', requiereRecalificacion: true,
  ...p,
} as PrestamoLoaner);

const derivacion = (d: Partial<LoanerDerivacion>): LoanerDerivacion => ({
  id: 'd1', proveedorId: 'els', proveedorNombre: 'ELS', remitoId: 'r1', remitoNumero: '0003-00000010',
  fechaEnvio: '2026-09-12', alcance: 'modulo', fechaRetorno: '2026-09-17T10:00:00.000Z', requiereRecalificacion: true,
  ...d,
});

const loaner = (l: Partial<Loaner>): Loaner => ({
  id: 'L1', codigo: 'LNR-0001', estado: 'en_recalificacion', prestamos: [], derivaciones: [], enProveedor: null,
  ...l,
} as unknown as Loaner);

console.log('origen pendiente');
test('préstamo devuelto sin OT → pendiente', () => {
  const o = origenPendienteDeRecalificacion(loaner({ prestamos: [prestamo({})] }));
  assert.equal(o?.tipo, 'prestamo');
});
test('derivación retornada sin OT → pendiente (más reciente que el préstamo)', () => {
  const o = origenPendienteDeRecalificacion(loaner({ prestamos: [prestamo({ otRecalificacionNumber: '30200' })], derivaciones: [derivacion({})] }));
  assert.equal(o?.tipo, 'derivacion');
});
test('derivación de PARTE también cuenta (la parte reparada afuera rearma el módulo)', () => {
  const o = origenPendienteDeRecalificacion(loaner({ derivaciones: [derivacion({ alcance: 'parte' })] }));
  assert.equal(o?.tipo, 'derivacion');
});
test('derivación abierta (sin fechaRetorno) no cuenta', () => {
  const o = origenPendienteDeRecalificacion(loaner({ derivaciones: [derivacion({ fechaRetorno: null })] }));
  assert.equal(o, null);
});
test('con claim no está pendiente', () => {
  const o = origenPendienteDeRecalificacion(loaner({ derivaciones: [derivacion({ otRecalificacionNumber: OT_RECALIFICACION_CLAIM })] }));
  assert.equal(o, null);
});

console.log('OT vigente y liberación');
test('vigente = OT del origen más reciente (ítem de la derivación)', () => {
  const l = loaner({ prestamos: [prestamo({ otRecalificacionNumber: '30200' })], derivaciones: [derivacion({ otRecalificacionNumber: '30255.03' })] });
  assert.equal(otRecalificacionVigente(l), '30255.03');
});
test('claim no es OT vigente; cae al préstamo', () => {
  const l = loaner({ prestamos: [prestamo({ otRecalificacionNumber: '30200' })], derivaciones: [derivacion({ otRecalificacionNumber: OT_RECALIFICACION_CLAIM })] });
  assert.equal(otRecalificacionVigente(l), '30200');
});
test('ciclo por ÍTEM: solo ese ítem libera (el .02 del proveedor externo no)', () => {
  const l = loaner({ derivaciones: [derivacion({ otRecalificacionNumber: '30255.03' })] });
  assert.equal(otCierraElCiclo(l, '30255.02'), false);
  assert.equal(otCierraElCiclo(l, '30255.03'), true);
});
test('ciclo por PADRE: cualquier hija cuenta', () => {
  const l = loaner({ prestamos: [prestamo({ otRecalificacionNumber: '30200' })] });
  assert.equal(otCierraElCiclo(l, '30200.01'), true);
  assert.equal(otCierraElCiclo(l, '30199.01'), false);
});
test('sin ciclo anotado (legacy) libera', () => {
  assert.equal(otCierraElCiclo(loaner({}), '30100.01'), true);
});

console.log('patch de retorno desde proveedor');
test('módulo completo → en_recalificacion, derivación cerrada y marcada', () => {
  const l = loaner({ estado: 'en_proveedor', enProveedor: derivacion({ fechaRetorno: null }), derivaciones: [derivacion({ fechaRetorno: null, requiereRecalificacion: null })] });
  const p = patchRetornoProveedor(l, 'r1', '2026-09-18T12:00:00.000Z');
  assert.equal(p.estado, 'en_recalificacion');
  assert.equal(p.enProveedor, null);
  assert.equal(p.derivaciones[0].fechaRetorno, '2026-09-18T12:00:00.000Z');
  assert.equal(p.derivaciones[0].requiereRecalificacion, true);
});
test('parte → también en_recalificacion (LNR-0013)', () => {
  const l = loaner({ estado: 'en_proveedor', enProveedor: derivacion({ alcance: 'parte', fechaRetorno: null }), derivaciones: [derivacion({ alcance: 'parte', fechaRetorno: null, requiereRecalificacion: null })] });
  const p = patchRetornoProveedor(l, 'r1', '2026-09-18T12:00:00.000Z');
  assert.equal(p.estado, 'en_recalificacion');
  assert.equal(p.derivaciones[0].fechaRetorno, '2026-09-18T12:00:00.000Z');
  assert.equal(p.derivaciones[0].requiereRecalificacion, true);
});
test('otras derivaciones no se tocan', () => {
  const l = loaner({ derivaciones: [derivacion({ id: 'd0', remitoId: 'r0', fechaRetorno: '2026-08-01' }), derivacion({ fechaRetorno: null })] });
  const p = patchRetornoProveedor(l, 'r1', 'ahora');
  assert.equal(p.derivaciones[0].fechaRetorno, '2026-08-01');
  assert.equal(p.derivaciones[1].fechaRetorno, 'ahora');
});

console.log(`\n${pasados} tests OK`);
