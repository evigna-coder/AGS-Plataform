/**
 * Remito de servicio: estado según sus OT (2026-09-21).
 *   pnpm --filter @ags/sistema-modular test:remito-servicio
 */
import assert from 'node:assert/strict';
import { clasificarOTParaRemito, estadoRemitoServicioSegunOTs } from '../resolverRemitoServicio';

let pasados = 0;
function test(nombre: string, fn: () => void) {
  try { fn(); pasados++; console.log(`  ✓ ${nombre}`); }
  catch (err) { console.error(`  ✗ ${nombre}`); throw err; }
}

console.log('clasificarOTParaRemito');
test('cerrada = cierre administrativo o finalizada', () => {
  assert.equal(clasificarOTParaRemito({ estadoAdmin: 'CIERRE_ADMINISTRATIVO' }), 'cerrada');
  assert.equal(clasificarOTParaRemito({ estadoAdmin: 'FINALIZADO' }), 'cerrada');
});
test('cancelada, abierta (incluido cierre técnico y legacy sin estado) e inexistente', () => {
  assert.equal(clasificarOTParaRemito({ estadoAdmin: 'CANCELADA' }), 'cancelada');
  assert.equal(clasificarOTParaRemito({ estadoAdmin: 'CIERRE_TECNICO' }), 'abierta');
  assert.equal(clasificarOTParaRemito({ estadoAdmin: 'CREADA' }), 'abierta');
  assert.equal(clasificarOTParaRemito({}), 'abierta');
  assert.equal(clasificarOTParaRemito(null), 'inexistente');
});

console.log('estadoRemitoServicioSegunOTs');
test('la última OT cerrada completa el remito', () => {
  assert.equal(estadoRemitoServicioSegunOTs(['cerrada']), 'completado');
  assert.equal(estadoRemitoServicioSegunOTs(['cerrada', 'cerrada']), 'completado');
});
test('una OT abierta lo deja esperando (caso 17433: OT en CREADA)', () => {
  assert.equal(estadoRemitoServicioSegunOTs(['abierta']), null);
  assert.equal(estadoRemitoServicioSegunOTs(['cerrada', 'abierta']), null);
});
test('todas canceladas → cancelado; cancelada + cerrada → completado', () => {
  assert.equal(estadoRemitoServicioSegunOTs(['cancelada']), 'cancelado');
  assert.equal(estadoRemitoServicioSegunOTs(['cancelada', 'cancelada']), 'cancelado');
  assert.equal(estadoRemitoServicioSegunOTs(['cancelada', 'cerrada']), 'completado');
});
test('OT inexistente o sin OTs: no se resuelve a ciegas', () => {
  assert.equal(estadoRemitoServicioSegunOTs(['cerrada', 'inexistente']), null);
  assert.equal(estadoRemitoServicioSegunOTs([]), null);
});

console.log(`\n${pasados} tests OK`);
