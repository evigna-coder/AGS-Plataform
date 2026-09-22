/**
 * Dirección del establecimiento → OT abiertas (2026-09-22).
 *   pnpm --filter @ags/sistema-modular test:propagar-direccion
 */
import assert from 'node:assert/strict';
import { cambioDeDireccion, otAbierta, otsQueSiguenAlEstablecimiento } from '../propagarDireccionEstablecimiento';

let pasados = 0;
function test(nombre: string, fn: () => void) {
  try { fn(); pasados++; console.log(`  ✓ ${nombre}`); }
  catch (err) { console.error(`  ✗ ${nombre}`); throw err; }
}

console.log('cambioDeDireccion');
test('solo los campos de dirección presentes en el update, recortados', () => {
  assert.deepEqual(cambioDeDireccion({ direccion: ' Yrigoyen ', nombre: 'X' }), { direccion: 'Yrigoyen' });
  assert.deepEqual(cambioDeDireccion({ direccion: 'A', localidad: 'B', provincia: 'C' }), { direccion: 'A', localidad: 'B', provincia: 'C' });
});
test('un update que no toca la dirección (sectores, activo) no propaga nada', () => {
  assert.equal(cambioDeDireccion({ sectores: [] }), null);
  assert.equal(cambioDeDireccion({ activo: false }), null);
});

console.log('otAbierta');
test('cerradas y canceladas no siguen al establecimiento', () => {
  assert.equal(otAbierta({ status: 'FINALIZADO', estadoAdmin: 'FINALIZADO' }), false);
  assert.equal(otAbierta({ status: 'BORRADOR', estadoAdmin: 'CIERRE_ADMINISTRATIVO' }), false);
  assert.equal(otAbierta({ status: 'BORRADOR', estadoAdmin: 'CANCELADA' }), false);
  assert.equal(otAbierta({ status: 'FINALIZADO', estadoAdmin: 'CIERRE_TECNICO' }), false);
});
test('creada, coordinada, en curso y legacy sin estadoAdmin son abiertas', () => {
  assert.equal(otAbierta({ status: 'BORRADOR', estadoAdmin: 'CREADA' }), true);
  assert.equal(otAbierta({ status: 'BORRADOR', estadoAdmin: 'COORDINADA' }), true);
  assert.equal(otAbierta({ status: 'BORRADOR', estadoAdmin: 'EN_CURSO' }), true);
  assert.equal(otAbierta({ status: 'BORRADOR' }), true);
});

console.log('otsQueSiguenAlEstablecimiento');
const nueva = { direccion: 'Yrigoyen', localidad: 'Puerto General San Martin', provincia: 'Santa Fe' };
const vieja = { direccion: 'Presidente Hipólito Yrigoyen', localidad: 'Florida Oeste', provincia: 'Provincia de Buenos Aires' };
test('caso 30187.01: OT coordinada con la copia vieja recibe los tres campos', () => {
  const r = otsQueSiguenAlEstablecimiento([{ otNumber: '30187.01', status: 'BORRADOR', estadoAdmin: 'COORDINADA', ...vieja }], nueva);
  assert.deepEqual(r, [{ otNumber: '30187.01', patch: nueva }]);
});
test('la OT finalizada conserva la copia histórica', () => {
  const r = otsQueSiguenAlEstablecimiento([{ otNumber: '29000.01', status: 'FINALIZADO', estadoAdmin: 'FINALIZADO', ...vieja }], nueva);
  assert.deepEqual(r, []);
});
test('solo se patchean los campos que cambian; una OT ya alineada no se reescribe', () => {
  const r = otsQueSiguenAlEstablecimiento([
    { otNumber: 'a', status: 'BORRADOR', ...nueva, provincia: 'Santa Fé' },
    { otNumber: 'b', status: 'BORRADOR', ...nueva },
  ], nueva);
  assert.deepEqual(r, [{ otNumber: 'a', patch: { provincia: 'Santa Fe' } }]);
});
test('update parcial (solo localidad) no toca los otros campos de la OT', () => {
  const r = otsQueSiguenAlEstablecimiento([{ otNumber: 'a', status: 'BORRADOR', ...vieja }], { localidad: 'Rosario' });
  assert.deepEqual(r, [{ otNumber: 'a', patch: { localidad: 'Rosario' } }]);
});

console.log(`\n${pasados} tests OK`);
