// Run with: pnpm --filter @ags/sistema-modular test:donde-viene
import assert from 'node:assert/strict';
import type { Importacion, OrdenCompra, RequerimientoCompra, UnidadStock } from '@ags/shared';
import { buscarDondeViene, paraDeRequerimiento } from '../dondeViene.js';

const req = (o: Partial<RequerimientoCompra>): RequerimientoCompra => ({ id: 'r', numero: 'REQ-1', articuloId: 'A', articuloDescripcion: 'x', cantidad: 1, origen: 'presupuesto', estado: 'en_compra', ...o } as RequerimientoCompra);

// Para quién: desglose > presupuesto > origen.
assert.deepEqual(paraDeRequerimiento(req({ desglose: [{ concepto: 'cliente', cantidad: 2, clienteNombre: 'Synthon', presupuestoNumero: 'P3-005063-01' }, { concepto: 'stock_minimo', cantidad: 3 }] })),
  ['Synthon (P3-005063-01) × 2', 'Reposición de stock mínimo × 3']);
assert.deepEqual(paraDeRequerimiento(req({ presupuestoNumero: 'P1-000010-01' })), ['Presupuesto P1-000010-01']);
assert.deepEqual(paraDeRequerimiento(req({ origen: 'stock_minimo' })), ['Reposición de stock mínimo']);

const requerimientos: RequerimientoCompra[] = [
  req({ id: 'r1', numero: 'REQ-1', estado: 'en_compra', ordenCompraId: 'oc1', desglose: [{ concepto: 'cliente', cantidad: 4, clienteNombre: 'Synthon', presupuestoNumero: 'P3-1' }] }),
  req({ id: 'r2', numero: 'REQ-2', estado: 'en_compra', ordenCompraId: 'oc1', origen: 'stock_minimo' }),
  req({ id: 'r3', numero: 'REQ-3', estado: 'pendiente', presupuestoNumero: 'P1-9' }),
  req({ id: 'r4', numero: 'REQ-4', estado: 'pendiente', articuloId: 'OTRO' }),
];
const ocs: OrdenCompra[] = [
  { id: 'oc1', numero: 'OC-1', tipo: 'importacion', estado: 'enviada_proveedor', proveedorNombre: 'Agilent', fechaEntregaEstimada: '2026-11-15',
    items: [
      { id: 'i1', articuloId: 'A', descripcion: 'x', cantidad: 10, cantidadRecibida: 0, unidadMedida: 'u', requerimientoIds: ['r1', 'r2'] },
      { id: 'i2', articuloId: 'OTRO', descripcion: 'y', cantidad: 5, cantidadRecibida: 0, unidadMedida: 'u' },
    ] } as unknown as OrdenCompra,
  { id: 'oc2', numero: 'OC-2', tipo: 'nacional', estado: 'recibida', proveedorNombre: 'Local', items: [{ id: 'i3', articuloId: 'A', descripcion: 'x', cantidad: 3, cantidadRecibida: 3, unidadMedida: 'u' }] } as unknown as OrdenCompra,
];
const importaciones: Importacion[] = [
  { id: 'imp1', numero: 'IMP-1', estado: 'en_transito', ordenCompraId: 'oc1', ordenCompraNumero: 'OC-1', proveedorNombre: 'Agilent', fechaEstimadaArribo: '2026-10-20',
    items: [{ id: 'x1', itemOCId: 'i1', articuloId: 'A', descripcion: 'x', cantidadPedida: 4, cantidadRecibida: 0, unidadMedida: 'u', requerimientoIds: ['r1'] }] } as unknown as Importacion,
  { id: 'imp2', numero: 'IMP-2', estado: 'recibido', ordenCompraId: 'oc1', items: [{ id: 'x2', itemOCId: 'i1', articuloId: 'A', descripcion: 'x', cantidadPedida: 2, cantidadRecibida: 2, unidadMedida: 'u' }] } as unknown as Importacion,
];
const unidades: UnidadStock[] = [
  { id: 'u1', articuloId: 'A', estado: 'en_transito', activo: true, cantidad: 4, importacionNumero: 'IMP-1', ordenCompraNumero: 'OC-1' } as unknown as UnidadStock,
  { id: 'u2', articuloId: 'A', estado: 'reservado', activo: true, cantidad: 2, reservadoParaClienteNombre: 'GSK', reservadoParaPresupuestoNumero: 'P2-7', ubicacion: { tipo: 'posicion', referenciaId: 'p', referenciaNombre: 'Cajón 2' } } as unknown as UnidadStock,
  { id: 'u3', articuloId: 'A', estado: 'disponible', activo: true, cantidad: 10, nroLote: 'L77', ubicacion: { tipo: 'posicion', referenciaId: 'p', referenciaNombre: 'Cajón 2' } } as unknown as UnidadStock,
  { id: 'u4', articuloId: 'A', estado: 'consumido', activo: true, cantidad: 1 } as unknown as UnidadStock,
  { id: 'u5', articuloId: 'OTRO', estado: 'disponible', activo: true, cantidad: 1 } as unknown as UnidadStock,
];

const lineas = buscarDondeViene('A', { importaciones, ocs, requerimientos, unidades });
assert.deepEqual(lineas.map(l => [l.fuente, l.referencia, l.cantidad]), [
  ['importacion', 'OC-1', 4],       // referencia = N° de OC; el N° de importación va en la nota
  ['oc', 'OC-1', 6],            // 10 pedidas − 4 ya embarcadas en IMP-1 (la IMP-2 ya se recibió)
  ['requerimiento', 'REQ-3', 1],
  ['unidad', 'Importación IMP-1', 4],
  ['unidad', 'Cajón 2', 2],
  ['unidad', 'Cajón 2', 10],
]);
const imp = lineas[0];
assert.equal(imp.fecha, '2026-10-20');
assert.deepEqual(imp.para, ['Synthon (P3-1) × 4'], 'para quién desde el requerimiento del ítem de la importación');
assert.equal(imp.ruta, '/stock/importaciones/imp1');
assert.ok(imp.nota?.includes('Importación IMP-1'), 'la nota lleva el N° de importación');
const oc = lineas[1];
assert.deepEqual(oc.para, ['Synthon (P3-1) × 4', 'Reposición de stock mínimo']);
assert.ok(oc.nota?.includes('parte ya embarcada'));
assert.equal(oc.fecha, '2026-11-15');
assert.deepEqual(lineas[2].para, ['Presupuesto P1-9']);
assert.deepEqual(lineas[4].para, ['GSK (P2-7)']);
assert.deepEqual(lineas[5].para, ['Libre']);
assert.equal(lineas[5].nota, 'Lote L77');

// Nada en camino: solo unidades.
assert.deepEqual(buscarDondeViene('OTRO', { importaciones, ocs: [], requerimientos, unidades }).map(l => l.fuente), ['requerimiento', 'unidad']);

console.log('✅ dondeViene: OK');
