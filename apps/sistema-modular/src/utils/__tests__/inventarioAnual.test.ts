// Run with: pnpm --filter @ags/sistema-modular test:inventario-anual
import assert from 'node:assert/strict';
import { armarInventario, estaBajo, precioExwTanda, rutaPosicion, tieneSufijoNoVendible, type UnidadInv } from '../inventarioAnual.js';

// Sufijo B / C con o sin guion.
assert.equal(tieneSufijoNoVendible('5062-2484'), false);
assert.equal(tieneSufijoNoVendible('5062-2484B'), true);
assert.equal(tieneSufijoNoVendible('5062-2484-C'), true);
assert.equal(tieneSufijoNoVendible('G1311b'), true, 'minúscula también');
assert.equal(tieneSufijoNoVendible('G1311A'), false);
assert.equal(tieneSufijoNoVendible('CTS-10494 '), false, 'termina en dígito aunque tenga C adentro');

// Precio EXW: costo ÷ factor, real antes que estimado, solo USD.
assert.equal(precioExwTanda({ articuloId: 'a', estado: 'disponible', costoUnitario: 130, factorImportacion: 1.3 }), 100);
assert.equal(precioExwTanda({ articuloId: 'a', estado: 'disponible', costoUnitario: 130, factorImportacion: 1.3, costoUnitarioReal: 150, factorImportacionReal: 1.5 }), 100);
assert.equal(precioExwTanda({ articuloId: 'a', estado: 'disponible', costoUnitario: 130 }), null, 'sin factor no se separa el costo de importación');
assert.equal(precioExwTanda({ articuloId: 'a', estado: 'disponible', costoUnitario: 130, factorImportacion: 1.3, monedaCosto: 'ARS' }), null);

// Ruta de posición.
const posiciones = [
  { id: 'd', codigo: 'D1', nombre: 'Depósito 1' },
  { id: 'e', codigo: 'E3', nombre: 'Estante 3', parentId: 'd' },
  { id: 'c', codigo: 'C2', nombre: 'Cajón 2', parentId: 'e' },
  { id: 'x', codigo: 'X', nombre: 'Vitrina' },
];
assert.equal(rutaPosicion('c', new Map(posiciones.map(p => [p.id, p]))), 'Depósito 1 / Estante 3 / Cajón 2');

const articulos = [
  { id: 'A1', codigo: '5062-2484', descripcion: 'Frit', marcaId: 'm1', categoriaEquipo: 'HPLC' },
  { id: 'A2', codigo: 'G1311B', descripcion: 'Bomba usada', marcaId: 'm1', categoriaEquipo: 'HPLC' },
  { id: 'A3', codigo: '5183-4647', descripcion: 'Liner', categoriaEquipo: 'GC' },
  { id: 'A4', codigo: '0100-1853', descripcion: 'Válvula', categoriaEquipo: 'HPLC' },
];
const u = (o: Partial<UnidadInv> & { articuloId: string }): UnidadInv => ({ estado: 'disponible', condicion: 'nuevo', activo: true, ubicacion: { tipo: 'posicion', referenciaId: 'c', referenciaNombre: 'Cajón 2' }, ...o });
const unidades: UnidadInv[] = [
  // A1: dos tandas con precio (100 y 120), una sin factor.
  u({ articuloId: 'A1', cantidad: 10, costoUnitario: 130, factorImportacion: 1.3 }),
  u({ articuloId: 'A1', cantidad: 5, costoUnitario: 180, factorImportacion: 1.5, ubicacion: { tipo: 'posicion', referenciaId: 'x', referenciaNombre: 'Vitrina' } }),
  u({ articuloId: 'A1', cantidad: 3, costoUnitario: 99 }),
  // A1 en cliente: no entra. A1 consumida: no entra.
  u({ articuloId: 'A1', cantidad: 50, ubicacion: { tipo: 'cliente', referenciaId: 'k', referenciaNombre: 'Cliente' } }),
  u({ articuloId: 'A1', cantidad: 50, estado: 'consumido' }),
  // A2: sufijo B → excluida por sufijo.
  u({ articuloId: 'A2', cantidad: 1, costoUnitario: 1000, factorImportacion: 2 }),
  // A3: reservada + asignada a ingeniero; condición reacondicionado en una tanda.
  u({ articuloId: 'A3', cantidad: 4, estado: 'reservado' }),
  u({ articuloId: 'A3', cantidad: 2, estado: 'asignado', ubicacion: { tipo: 'ingeniero', referenciaId: 'ing1', referenciaNombre: 'Gabriel' }, condicion: 'reacondicionado' }),
  // A4: inactiva → no entra.
  u({ articuloId: 'A4', cantidad: 1, activo: false }),
];
const marcas = new Map([['m1', 'Agilent']]);
const base = { posicionIds: [] as string[], posicionesExcluidas: [] as string[], articulosExcluidos: [] as string[], incluirFueraDePosicion: true, excluirSufijo: true, excluirCondicion: true };

{
  const r = armarInventario(unidades, articulos, posiciones, marcas, base);
  assert.deepEqual(r.vendibles.map(f => f.codigo), ['5062-2484']);
  const a1 = r.vendibles[0];
  assert.equal(a1.cantidad, 18, '10 + 5 + 3 (sin cliente ni consumida)');
  // Promedio ponderado solo de las tandas con precio: (10×100 + 5×120) / 15 = 106.67
  assert.equal(Math.round(a1.precioExw! * 100) / 100, 106.67);
  assert.equal(a1.tandasConPrecio, 2);
  assert.equal(a1.tandasSinPrecio, 1);
  assert.equal(Math.round(a1.valor!), Math.round(106.6667 * 18), 'valor = precio promedio × cantidad total');
  assert.deepEqual(a1.ubicaciones, ['Depósito 1 / Estante 3 / Cajón 2', 'Vitrina']);
  assert.equal(a1.marca, 'Agilent');
  assert.deepEqual(r.excluidas.map(f => [f.codigo, f.excluida]), [['5183-4647', 'condicion'], ['G1311B', 'sufijo']]);
  const a3 = r.excluidas[0];
  assert.equal(a3.cantidad, 6, 'reservada + asignada entran');
  assert.deepEqual(a3.condiciones, ['nuevo', 'reacondicionado']);
  assert.equal(a3.precioExw, null);
  assert.equal(r.sinPrecio, 0);
  assert.equal(Math.round(r.totalValor), Math.round(106.6667 * 18));
}
// Sin excluir por condición ni sufijo: todo vendible; sin precio cuenta A2? no, A2 tiene precio 500.
{
  const r = armarInventario(unidades, articulos, posiciones, marcas, { ...base, excluirSufijo: false, excluirCondicion: false });
  assert.deepEqual(r.vendibles.map(f => f.codigo), ['5062-2484', '5183-4647', 'G1311B']);
  assert.equal(r.sinPrecio, 1, 'el liner no tiene precio');
  assert.equal(r.vendibles.find(f => f.codigo === 'G1311B')!.precioExw, 500);
}
// Filtro por posición: solo Vitrina → A1 con 5; el asignado a ingeniero entra igual si se incluye fuera de posición.
{
  const r = armarInventario(unidades, articulos, posiciones, marcas, { ...base, posicionIds: ['x'], excluirCondicion: false });
  assert.deepEqual(r.vendibles.map(f => [f.codigo, f.cantidad]), [['5062-2484', 5], ['5183-4647', 2]]);
  const r2 = armarInventario(unidades, articulos, posiciones, marcas, { ...base, posicionIds: ['x'], excluirCondicion: false, incluirFueraDePosicion: false });
  assert.deepEqual(r2.vendibles.map(f => [f.codigo, f.cantidad]), [['5062-2484', 5]]);
}

// Jerarquía: incluir el depósito incluye el cajón; excluir el depósito lo saca.
{
  const posById = new Map(posiciones.map(p => [p.id, p]));
  assert.equal(estaBajo('c', new Set(['d']), posById), true);
  assert.equal(estaBajo('x', new Set(['d']), posById), false);
  const r = armarInventario(unidades, articulos, posiciones, marcas, { ...base, posicionIds: ['d'], excluirCondicion: false, incluirFueraDePosicion: false });
  assert.deepEqual(r.vendibles.map(f => [f.codigo, f.cantidad]), [['5062-2484', 13], ['5183-4647', 4]], 'depósito 1 incluye el cajón 2; la vitrina queda afuera');
  const r2 = armarInventario(unidades, articulos, posiciones, marcas, { ...base, posicionesExcluidas: ['d'], excluirCondicion: false, incluirFueraDePosicion: false });
  assert.deepEqual(r2.vendibles.map(f => [f.codigo, f.cantidad]), [['5062-2484', 5]], 'excluir el depósito deja solo la vitrina');
}
// Quitado a mano: pasa a excluidos con motivo manual.
{
  const r = armarInventario(unidades, articulos, posiciones, marcas, { ...base, excluirCondicion: false, articulosExcluidos: ['A3'] });
  assert.deepEqual(r.vendibles.map(f => f.codigo), ['5062-2484']);
  assert.deepEqual(r.excluidas.map(f => [f.codigo, f.excluida]), [['5183-4647', 'manual'], ['G1311B', 'sufijo']]);
}

// Confirmado vendible: entra aunque termine en B; quitarlo a mano sigue pudiendo.
{
  const arts = articulos.map(a => a.id === 'A2' ? { ...a, vendibleConfirmado: true } : a);
  const r = armarInventario(unidades, arts, posiciones, marcas, { ...base, excluirCondicion: false });
  assert.deepEqual(r.vendibles.map(f => f.codigo), ['5062-2484', '5183-4647', 'G1311B']);
  assert.equal(r.vendibles.find(f => f.codigo === 'G1311B')!.vendibleConfirmado, true);
  const r2 = armarInventario(unidades, arts, posiciones, marcas, { ...base, excluirCondicion: false, articulosExcluidos: ['A2'] });
  assert.deepEqual(r2.excluidas.map(f => [f.codigo, f.excluida]), [['G1311B', 'manual']]);
}

console.log('✅ inventarioAnual: OK');
