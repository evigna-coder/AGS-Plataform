/**
 * Origen agrupado en el cierre de OT (2026-09-21).
 *   pnpm --filter @ags/sistema-modular test:cierre-origen-agrupado
 *
 * Caso real: 2 × G3430-60818 salieron en el remito 0001-00017519 con el
 * ingeniero. Antes eran dos opciones idénticas a elegir una por una; ahora es
 * una opción ×2 que al elegirla deja una selección por línea del remito.
 */
import assert from 'node:assert/strict';
import type { StockSelection } from '@ags/shared';
import type { PartStockInfo } from '../../hooks/useCierreStockUnits';
import type { RemitoItemOrigen } from '../origenRemitoDedup';
import { agruparOrigenes, agruparSelecciones, repartirEntreMiembros } from '../cierreOrigenAgrupado';
import { buildOptions, disponibleDeOpcion, opcionDeSeleccion, seleccionesDeOpcion, selectionValue } from '../../components/ordenes-trabajo/cierreStockOptions';

let pasados = 0;
function test(nombre: string, fn: () => void) {
  try { fn(); pasados++; console.log(`  ✓ ${nombre}`); }
  catch (err) { console.error(`  ✗ ${nombre}`); throw err; }
}

const linea = (itemId: string, extra: Partial<RemitoItemOrigen> = {}): RemitoItemOrigen => ({
  remitoId: 'R1', remitoNumero: '0001-00017519', itemId, ingenieroNombre: 'Fanely Blain', cantidad: 1, serie: null, unidadId: `u-${itemId}`, ...extra,
});

console.log('agruparOrigenes');
test('dos líneas sin serie del mismo remito = una con la suma y sus miembros', () => {
  const g = agruparOrigenes([linea('i1'), linea('i2')], r => r.remitoId);
  assert.equal(g.length, 1);
  assert.equal(g[0].cantidad, 2);
  assert.deepEqual(g[0].miembros!.map(m => m.itemId), ['i1', 'i2']);
});
test('remitos distintos no se juntan', () => {
  const g = agruparOrigenes([linea('i1'), linea('i2', { remitoId: 'R2', remitoNumero: '0001-00017520' })], r => r.remitoId);
  assert.equal(g.length, 2);
  assert.equal(g[0].miembros, undefined);
});
test('las serializadas quedan sueltas aunque compartan remito', () => {
  const g = agruparOrigenes([linea('i1', { serie: 'A' }), linea('i2', { serie: 'B' }), linea('i3'), linea('i4')], r => r.remitoId);
  assert.equal(g.length, 3);
  assert.equal(g.filter(o => o.serie).length, 2);
  assert.equal(g.find(o => !o.serie)!.cantidad, 2);
});
test('no muta las líneas originales', () => {
  const a = linea('i1');
  agruparOrigenes([a, linea('i2')], r => r.remitoId);
  assert.equal(a.cantidad, 1);
  assert.equal(a.miembros, undefined);
});

console.log('repartirEntreMiembros');
test('llena en orden hasta el disponible de cada uno', () => {
  assert.deepEqual(repartirEntreMiembros(2, [1, 1]), [1, 1]);
  assert.deepEqual(repartirEntreMiembros(1, [1, 1]), [1, 0]);
  assert.deepEqual(repartirEntreMiembros(3, [1, 1]), [1, 1]);
  assert.deepEqual(repartirEntreMiembros(0.5, [1, 1]), [0.5, 0]);
  assert.deepEqual(repartirEntreMiembros(0, [1, 1]), [0, 0]);
});

// ── Integración con las opciones del cierre ──
const stock: PartStockInfo = {
  articulo: { id: 'art', codigo: 'G3430-60818' } as PartStockInfo['articulo'],
  presentacionFactor: 1, presentacionBaseCodigo: null, requiereTrazabilidad: false,
  unidades: [], posiciones: [], patron: null, patronLotes: [],
  remitoOrigenes: [linea('i1'), linea('i2', { tambienEn: ['0001-00017400'] })],
  asignacionOrigenes: [
    { asignacionId: 'A1', itemId: 'a1', ingenieroNombre: 'Fanely Blain', cantidad: 1, serie: null, unidadId: 'u-a1' },
    { asignacionId: 'A1', itemId: 'a2', ingenieroNombre: 'Fanely Blain', cantidad: 2, serie: null, unidadId: 'u-a2' },
  ],
};
const base = (cantidad: number): StockSelection => ({
  partId: 'p', partCodigo: 'G3430-60818', partDescripcion: 'Lámpara', cantidad, origenTipo: 'posicion', origenId: '', origenNombre: '',
});

console.log('buildOptions');
const opts = buildOptions(stock);
test('una opción por remito y por asignación, con la suma y el value compuesto', () => {
  assert.deepEqual(opts.map(o => o.value), ['remito:R1:i1+i2', 'asignacion:A1:a1+a2']);
  assert.equal(opts[0].label, 'Remito 0001-00017519 — Fanely Blain (×2)');
  assert.equal(opts[0].sub, 'también en 0001-00017400');
  assert.equal(disponibleDeOpcion(opts[0]), 2);
  assert.equal(disponibleDeOpcion(opts[1]), 3);
});

console.log('seleccionesDeOpcion');
test('elegir el remito ×2 deja una selección por línea del remito', () => {
  const sels = seleccionesDeOpcion(opts[0], stock, 2, base);
  assert.deepEqual(sels.map(s => [s.remitoItemId, s.cantidad, s.origenTipo]), [['i1', 1, 'remito'], ['i2', 1, 'remito']]);
  assert.equal(sels[0].remitoNumero, '0001-00017519');
});
test('con 1 sola necesaria, solo la primera línea', () => {
  const sels = seleccionesDeOpcion(opts[0], stock, 1, base);
  assert.deepEqual(sels.map(s => s.remitoItemId), ['i1']);
});
test('con 0 (todo cubierto) queda la primera línea en 0 para cargar a mano', () => {
  const sels = seleccionesDeOpcion(opts[0], stock, 0, base);
  assert.deepEqual(sels.map(s => [s.remitoItemId, s.cantidad]), [['i1', 0]]);
});
test('asignación agrupada reparte según el neto de cada ítem', () => {
  const sels = seleccionesDeOpcion(opts[1], stock, 3, base);
  assert.deepEqual(sels.map(s => [s.asignacionItemId, s.cantidad, s.origenTipo]), [['a1', 1, 'ingeniero'], ['a2', 2, 'ingeniero']]);
});

console.log('opcionDeSeleccion + agruparSelecciones');
test('una selección guardada por línea vuelve a su opción agrupada', () => {
  const sels = seleccionesDeOpcion(opts[0], stock, 2, base);
  assert.equal(selectionValue(sels[1]), 'remito:R1:i2');
  assert.equal(opcionDeSeleccion(sels[1], opts)?.value, 'remito:R1:i1+i2');
});
test('las dos selecciones del remito son UNA fila ×2; la descontada va sola', () => {
  const sels = [
    ...seleccionesDeOpcion(opts[0], stock, 2, base),
    { ...base(1), origenTipo: 'posicion' as const, origenId: 'CJ3', origenNombre: 'Cajón 3', deducidoAt: '2026-09-20T10:00:00.000Z' },
  ];
  const filas = agruparSelecciones(sels, s => opcionDeSeleccion(s, opts)?.value ?? selectionValue(s));
  assert.equal(filas.length, 2);
  assert.deepEqual(filas[0], { value: 'remito:R1:i1+i2', indices: [0, 1], cantidad: 2, deducida: false });
  assert.equal(filas[1].deducida, true);
  assert.deepEqual(filas[1].indices, [2]);
});
test('selección sin opción vigente (stock que cambió) queda como fila propia', () => {
  const vieja = { ...base(1), origenTipo: 'remito' as const, remitoId: 'R9', remitoItemId: 'x', origenId: 'R9', origenNombre: 'Remito viejo' };
  const filas = agruparSelecciones([vieja], s => opcionDeSeleccion(s, opts)?.value ?? selectionValue(s));
  assert.deepEqual(filas[0].value, 'remito:R9:x');
});

console.log(`\n${pasados} tests OK`);
