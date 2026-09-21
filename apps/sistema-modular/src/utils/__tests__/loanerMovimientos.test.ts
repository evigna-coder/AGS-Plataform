/**
 * Historial de movimientos de loaners (2026-09-21).
 *   pnpm --filter @ags/sistema-modular test:loaner-movimientos
 */
import assert from 'node:assert/strict';
import type { Loaner } from '@ags/shared';
import { armarMovimientosLoaners, filtrarMovimientos } from '../loanerMovimientos';

let pasados = 0;
function test(nombre: string, fn: () => void) {
  try { fn(); pasados++; console.log(`  ✓ ${nombre}`); }
  catch (err) { console.error(`  ✗ ${nombre}`); throw err; }
}

const loaner = (l: Partial<Loaner>): Loaner => ({
  id: 'L1', codigo: 'LNR-0033', descripcion: 'Detector de arreglo de diodos (DAD)', serie: 'DE61801141', moduloCodigo: 'G1315A',
  estado: 'en_base', activo: true, prestamos: [], derivaciones: [], extracciones: [], venta: null,
  ...l,
} as unknown as Loaner);

const L = loaner({
  prestamos: [
    { id: 'p1', clienteId: 'c1', clienteNombre: 'Laboratorios Bagó S.A.', establecimientoNombre: 'La Plata', fechaSalida: '2026-08-01', fechaRetornoReal: '2026-08-20', estado: 'devuelto', otNumber: '30100.01', remitoSalidaNumero: '0001-00000010' },
    { id: 'p2', clienteId: 'c2', clienteNombre: 'Saporiti SA', fechaSalida: '2026-09-10', estado: 'activo', alcance: 'parte',
      partes: [{ id: 'x1', descripcion: 'Lámpara de deuterio', codigoArticulo: 'G1314-60100', serie: 'LMP1' }] },
    { id: 'p3', clienteId: '', clienteNombre: '', fechaSalida: '2026-09-21', estado: 'activo', alcance: 'parte', destino: 'ingeniero', ingenieroNombre: 'Fanely Blain',
      partes: [{ id: 'x2', descripcion: 'Bandeja de viales completa' }] },
  ],
  derivaciones: [{ id: 'd1', proveedorId: 'els', proveedorNombre: 'ELS', remitoId: 'r', remitoNumero: '0003-00000005', fechaEnvio: '2026-07-01', alcance: 'modulo', fechaRetorno: null }],
  extracciones: [{ id: 'e1', fecha: '2026-06-15', descripcion: 'Placa de comunicación', codigoArticulo: 'G1315-66505', destino: 'OT 30050.01 — Corteva', extraidoPor: 'MB', fechaReposicion: '2026-07-01' }],
} as Partial<Loaner>);

console.log('armarMovimientosLoaners');
const movs = armarMovimientosLoaners([L]);
test('una fila por préstamo de módulo, por parte, por derivación y por extracción', () => {
  assert.deepEqual(movs.map(m => m.tipo).sort(), ['asignacion', 'derivacion', 'extraccion', 'parte', 'prestamo']);
});
test('orden: más reciente primero', () => {
  assert.equal(movs[0].fechaSalida, '2026-09-21');
  assert.equal(movs[movs.length - 1].fechaSalida, '2026-06-15');
});
test('préstamo de módulo: cliente, establecimiento, retorno, OT y remito', () => {
  const p = movs.find(m => m.tipo === 'prestamo')!;
  assert.equal(p.destino, 'Laboratorios Bagó S.A.');
  assert.equal(p.establecimiento, 'La Plata');
  assert.equal(p.fechaRetorno, '2026-08-20');
  assert.equal(p.estado, 'cerrado');
  assert.equal(p.otNumber, '30100.01');
  assert.equal(p.remitoSalida, '0001-00000010');
});
test('parte prestada a cliente: descripción, código y serie de la parte; abierta', () => {
  const p = movs.find(m => m.tipo === 'parte')!;
  assert.equal(p.parteDescripcion, 'Lámpara de deuterio');
  assert.equal(p.parteCodigo, 'G1314-60100');
  assert.equal(p.parteSerie, 'LMP1');
  assert.equal(p.estado, 'abierto');
});
test('parte a ingeniero: destino = ingeniero', () => {
  const p = movs.find(m => m.tipo === 'asignacion')!;
  assert.equal(p.destino, 'Fanely Blain');
});
test('derivación abierta a proveedor', () => {
  const d = movs.find(m => m.tipo === 'derivacion')!;
  assert.equal(d.destino, 'ELS');
  assert.equal(d.estado, 'abierto');
  assert.equal(d.remitoSalida, '0003-00000005');
});
test('extracción repuesta = cerrada, con destino y código', () => {
  const e = movs.find(m => m.tipo === 'extraccion')!;
  assert.equal(e.estado, 'cerrado');
  assert.equal(e.parteCodigo, 'G1315-66505');
});

console.log('filtrarMovimientos');
test('por cliente sin acentos ni mayúsculas', () => {
  assert.equal(filtrarMovimientos(movs, 'bago').length, 1);
});
test('por serie del módulo: todos los movimientos del loaner', () => {
  assert.equal(filtrarMovimientos(movs, 'DE61801141').length, movs.length);
});
test('por N° de parte y por descripción de parte', () => {
  assert.equal(filtrarMovimientos(movs, 'G1314-60100').length, 1);
  assert.equal(filtrarMovimientos(movs, 'lampara deuterio').length, 1);
});
test('varias palabras = todas deben estar', () => {
  assert.equal(filtrarMovimientos(movs, 'detector bago').length, 1);
  assert.equal(filtrarMovimientos(movs, 'detector saporiti bago').length, 0);
});
test('vacío = todo', () => {
  assert.equal(filtrarMovimientos(movs, '  ').length, movs.length);
});

console.log(`\n${pasados} tests OK`);
