/**
 * Control semanal: "Informado a facturación" en la semana del servicio (2026-09-22).
 *   pnpm --filter @ags/sistema-modular test:control-informado
 */
import assert from 'node:assert/strict';
import { fechaAvisoPorPresupuesto, semanaDe, semanaInformadoPosterior, textoInformado } from '../controlSemanalInformado';

let pasados = 0;
function test(nombre: string, fn: () => void) {
  try { fn(); pasados++; console.log(`  ✓ ${nombre}`); }
  catch (err) { console.error(`  ✗ ${nombre}`); throw err; }
}

// Fechas locales explícitas (sin Z) para no depender del huso de la máquina.
console.log('semanaDe');
test('martes 22/09/2026 → lunes 21 a domingo 27', () => {
  assert.deepEqual(semanaDe('2026-09-22T10:00:00'), { inicio: '2026-09-21', fin: '2026-09-27' });
});
test('domingo pertenece a la semana que empieza el lunes anterior', () => {
  assert.deepEqual(semanaDe('2026-09-27T23:00:00'), { inicio: '2026-09-21', fin: '2026-09-27' });
});
test('lunes es el inicio de su propia semana', () => {
  assert.deepEqual(semanaDe('2026-09-28T00:30:00'), { inicio: '2026-09-28', fin: '2026-10-04' });
});
test('fecha inválida → null', () => assert.equal(semanaDe('no-es-fecha'), null));

console.log('semanaInformadoPosterior');
const semanaVisibleFin = '2026-09-20'; // semana 14/09 al 20/09
test('aviso la semana siguiente → se informa esa semana', () => {
  assert.deepEqual(semanaInformadoPosterior('2026-09-22T11:00:00', semanaVisibleFin), { inicio: '2026-09-21', fin: '2026-09-27' });
});
test('aviso dos semanas después también', () => {
  assert.deepEqual(semanaInformadoPosterior('2026-10-01T11:00:00', semanaVisibleFin), { inicio: '2026-09-28', fin: '2026-10-04' });
});
test('aviso en la misma semana → null (sale de la sección como siempre)', () => {
  assert.equal(semanaInformadoPosterior('2026-09-18T11:00:00', semanaVisibleFin), null);
});
test('aviso anterior a la semana visible → null', () => {
  assert.equal(semanaInformadoPosterior('2026-09-10T11:00:00', semanaVisibleFin), null);
});
test('sin aviso → null', () => {
  assert.equal(semanaInformadoPosterior(null, semanaVisibleFin), null);
  assert.equal(semanaInformadoPosterior('', semanaVisibleFin), null);
});

console.log('textoInformado');
test('texto con dd/mm', () => {
  assert.equal(textoInformado({ inicio: '2026-09-21', fin: '2026-09-27' }), 'Informado a facturación · semana 21/09 al 27/09');
});

console.log('fechaAvisoPorPresupuesto');
test('la última solicitud viva; las anuladas no cuentan', () => {
  const m = fechaAvisoPorPresupuesto([
    { presupuestoId: 'a', estado: 'pendiente', createdAt: '2026-09-15T10:00:00' },
    { presupuestoId: 'a', estado: 'facturada', createdAt: '2026-09-22T10:00:00' },
    { presupuestoId: 'a', estado: 'anulada', createdAt: '2026-09-30T10:00:00' },
    { presupuestoId: 'b', estado: 'anulada', createdAt: '2026-09-30T10:00:00' },
  ]);
  assert.equal(m.get('a'), '2026-09-22T10:00:00');
  assert.equal(m.has('b'), false);
});

console.log(`\n${pasados} tests OK`);
