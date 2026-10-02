// Run with: pnpm --filter @ags/sistema-modular test:actividad-usuario
import assert from 'node:assert/strict';
import {
  ACTIVIDAD_VACIA, haceCuanto, masUsadas, pantallaDeRuta, puntaje, registrarPantalla, registrarReciente,
} from '../actividadUsuario.js';

const dia = (n: number) => new Date(Date.UTC(2026, 9, 1 + n, 12));

// ── Puntaje con decaimiento ──
assert.equal(puntaje({ n: 4, t: dia(0).toISOString() }, dia(14)), 2, 'vida media 14 días');

// ── Más usadas: lo reciente le gana a lo viejo ──
{
  let a = ACTIVIDAD_VACIA;
  for (let i = 0; i < 10; i++) a = registrarPantalla(a, '/agenda', dia(0)); // 10 visitas hace 60 días
  for (let i = 0; i < 3; i++) a = registrarPantalla(a, '/entregas', dia(60));
  a = registrarPantalla(a, '/stock/requerimientos', dia(60));
  const top = masUsadas(a, new Set(['/agenda', '/entregas', '/stock/requerimientos']), dia(60), 3);
  assert.deepEqual(top, ['/entregas', '/stock/requerimientos', '/agenda']);
  // Sin permiso, no aparece aunque la haya usado.
  assert.deepEqual(masUsadas(a, new Set(['/agenda']), dia(60), 3), ['/agenda']);
}

// ── Recientes: sin duplicados, más nuevo primero, tope 10 ──
{
  let a = ACTIVIDAD_VACIA;
  for (let i = 0; i < 12; i++) a = registrarReciente(a, { path: `/ordenes-trabajo/${i}`, titulo: `OT ${i}`, tipo: 'OT' }, dia(i));
  assert.equal(a.recientes.length, 10);
  a = registrarReciente(a, { path: '/ordenes-trabajo/5', titulo: 'OT 5', tipo: 'OT' }, dia(20));
  assert.equal(a.recientes[0].path, '/ordenes-trabajo/5');
  assert.equal(a.recientes.filter(r => r.path === '/ordenes-trabajo/5').length, 1);
  assert.equal(registrarReciente(a, { path: '/x', titulo: '  ', tipo: 'OT' }, dia(21)), a, 'sin título no se registra');
}

// ── Pantalla de una ruta: el prefijo más largo ──
const menu = ['/stock', '/stock/requerimientos', '/presupuestos', '/agenda'];
assert.equal(pantallaDeRuta('/stock/requerimientos/abc', menu), '/stock/requerimientos');
assert.equal(pantallaDeRuta('/stock', menu), '/stock');
assert.equal(pantallaDeRuta('/stockeo', menu), null, 'no confunde prefijos de palabra');
assert.equal(pantallaDeRuta('/clientes/1', menu), null);

// ── Tiempo relativo ──
assert.equal(haceCuanto(new Date(dia(0).getTime() - 5 * 60_000).toISOString(), dia(0)), 'hace 5 min');
assert.equal(haceCuanto(dia(0).toISOString(), dia(1)), 'ayer');

console.log('✅ actividadUsuario: OK');
