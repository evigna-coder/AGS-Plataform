/**
 * Unit tests — qué imprime cada línea del remito sobre el papel preimpreso
 * (2026-08-12).
 *
 * Run with: pnpm --filter @ags/sistema-modular test:remito-lineas
 *
 * El bug que fija: los minikits y los instrumentos salían con el Código en su
 * columna y la DESCRIPCIÓN VACÍA. La regla "no repetir el código en las dos
 * columnas" se comía el único texto disponible, porque la asignación no guarda
 * ni el nombre del kit ni qué es el instrumento. Ahora eso lo completa
 * `enriquecerItemsRemito` desde los catálogos justo antes de imprimir; estos
 * tests verifican el resultado FINAL, que es lo que sale en el papel.
 */

import assert from 'node:assert/strict';
import type { RemitoItem, UbicacionStock } from '@ags/shared';
import {
  getRemitoItemCodigo, lineaDescripcionRemito, cantidadImpresaRemito,
} from '../inventarioToRemitoItem.js';

const base: RemitoItem = { id: 'x', cantidad: 1, tipoItem: 'entrega', devuelto: false };

// ── Instrumento ya enriquecido: TER-03 · Termómetro Testo 175 · S/N 12345 ────
const termometro: RemitoItem = {
  ...base,
  tipoEntidad: 'instrumento',
  instrumentoId: 'i1',
  instrumentoCodigo: 'TER-03',
  instrumentoDescripcion: 'Termómetro Testo 175',
  serie: '12345',
};
assert.equal(getRemitoItemCodigo(termometro), 'TER-03', 'el identificador interno va a la columna Código');
const dTermo = lineaDescripcionRemito(termometro);
assert.ok(dTermo.includes('Termómetro'), `falta el tipo de instrumento: "${dTermo}"`);
assert.ok(dTermo.includes('Testo 175'), `falta marca y modelo: "${dTermo}"`);
assert.ok(dTermo.includes('S/N 12345'), `falta el número de serie: "${dTermo}"`);
assert.notEqual(dTermo.trim(), '', 'la descripción NUNCA puede salir vacía');

// ── Minikit ya enriquecido: MKLC1 · Minikit HPLC 1 ───────────────────────────
const minikit: RemitoItem = {
  ...base,
  tipoEntidad: 'minikit',
  minikitId: 'm1',
  minikitCodigo: 'MKLC1',
  minikitDescripcion: 'Minikit HPLC 1',
};
assert.equal(getRemitoItemCodigo(minikit), 'MKLC1');
assert.equal(lineaDescripcionRemito(minikit), 'Minikit HPLC 1', 'el nombre del kit va a Descripción');

// ── Regresión: el código NO se repite en las dos columnas ────────────────────
const minikitSinNombre: RemitoItem = {
  ...base, tipoEntidad: 'minikit', minikitId: 'm2', minikitCodigo: 'MKGC1', minikitDescripcion: 'MKGC1',
};
assert.equal(
  lineaDescripcionRemito(minikitSinNombre), '',
  'si lo único que hay es el código, la descripción queda vacía en vez de repetirlo',
);

// ── Instrumento SIN enriquecer (catálogo caído): igual imprime algo útil ─────
const legacy: RemitoItem = {
  ...base, tipoEntidad: 'instrumento', instrumentoId: 'i2',
  instrumentoCodigo: null, instrumentoDescripcion: 'TER-07',
};
assert.equal(getRemitoItemCodigo(legacy), 'TER-07', 'sin código propio, el nombre cae a la columna Código');

// ── Artículo de stock común: no se toca el comportamiento previo ─────────────
const articulo: RemitoItem = {
  ...base, tipoEntidad: 'articulo',
  articuloCodigo: 'G1530-67950', articuloDescripcion: 'Válvula de purga', serie: 'AB-9',
};
assert.equal(getRemitoItemCodigo(articulo), 'G1530-67950');
assert.equal(lineaDescripcionRemito(articulo), 'Válvula de purga · S/N AB-9');

// ── Envase: el papel declara el código del cliente, no el del stock ─────────
// El cliente compra 1 × 5183-2067; el stock son 10 unidades del 5182-0715.
const porEnvase: RemitoItem = {
  ...base, tipoEntidad: 'articulo', unidadId: 'u1', articuloId: 'a1',
  articuloCodigo: '5182-0715', articuloDescripcion: 'Vial ámbar 2 mL',
  cantidad: 10, presentacion: { codigoParte: '5183-2067', factor: 10 },
};
assert.equal(getRemitoItemCodigo(porEnvase), '5183-2067', 'imprime el N° de parte del envase');
assert.equal(cantidadImpresaRemito(porEnvase), 1, '10 unidades base = 1 envase ×10');
assert.equal(lineaDescripcionRemito(porEnvase), 'Vial ámbar 2 mL', 'la descripción no cambia');

// Sin envase declarado: nada cambia respecto de antes.
const porUnidad: RemitoItem = { ...porEnvase, presentacion: null };
assert.equal(getRemitoItemCodigo(porUnidad), '5182-0715');
assert.equal(cantidadImpresaRemito(porUnidad), 10);

// Envase incompleto: se imprime el decimal real, no un redondeo silencioso.
assert.equal(cantidadImpresaRemito({ ...porEnvase, cantidad: 15 }), 1.5);
// Factor basura: nunca dividir por cero ni imprimir Infinity.
assert.equal(cantidadImpresaRemito({ ...porEnvase, presentacion: { codigoParte: 'X', factor: 0 } }), 10);

// ── La descripción va en UNA línea con letra fija (2026-09-11) ──────────────
// Antes se achicaba la letra y se partía en dos renglones para que entrara
// todo; ahora la descripción se corta por caracteres y el detalle (serie,
// loaner, módulo de origen) queda entero al final.
const { componerDescripcionRemito, MAX_DESC_CARACTERES } =
  await import('../../components/remitos/pdf/RemitoOverlayPDF.js');
const MAX_LINEA = Math.floor(280 / (8.5 * 0.5));
for (const t of [
  'Válvula de purga · S/N AB-9',
  'GC 7890 SN: DE64559987   ·   Orden cliente: 4500123456   ·   Ref: LAB-CROMATO',
  'Mantenimiento preventivo anual del cromatógrafo gaseoso con reemplazo de septa, liner y ferrules — Ppto PRE-0422',
  'x'.repeat(500),
]) {
  const final = componerDescripcionRemito(t);
  assert.ok(final.length <= MAX_LINEA, `se sale de la línea: "${final}"`);
}
assert.equal(componerDescripcionRemito('Válvula de purga · S/N AB-9'), 'Válvula de purga · S/N AB-9',
  'una descripción normal NO se recorta: la serie tiene que estar entera');
const largaConSerie = componerDescripcionRemito(`${'Detector de fluorescencia con celda de flujo de 8 µl y lámpara de xenón'} · S/N DE123`);
assert.ok(largaConSerie.endsWith(' · S/N DE123'), 'la serie queda entera al final');
assert.ok(largaConSerie.indexOf(' · S/N') <= MAX_DESC_CARACTERES, 'la descripción se corta al tope');

// ── Código adelante de la descripción, con o sin separador (2026-09-12) ──────
// Caso FPC-0002145: "G3430-60590 Fan" salía S/C; "G3430-61050 - Board" no.
{
  const { partirCodigoDescripcion: partir } = await import('../inventarioToRemitoItem.js');
  assert.deepEqual(partir('G3430-60590 Fan'), { codigo: 'G3430-60590', resto: 'Fan' });
  assert.deepEqual(partir('G3430-61010 Agilent Logic Board, 7890B GC'), { codigo: 'G3430-61010', resto: 'Agilent Logic Board, 7890B GC' });
  assert.deepEqual(partir('G3430-61050 - Board Assembly'), { codigo: 'G3430-61050', resto: 'Board Assembly' });
  assert.deepEqual(partir('7890B GC'), { codigo: '7890B', resto: 'GC' });
  assert.equal(partir('10 viales ámbar').codigo, null, 'una cantidad no es un código');
  assert.equal(partir('2 trampas de purga').codigo, null, 'una cantidad no es un código');
  assert.equal(partir('Detector de fluorescencia (FLD)').codigo, null, 'una palabra no es un código');
  assert.equal(partir('Bomba cuaternaria 1260').codigo, null, 'el código tiene que ir ADELANTE');
}

// ── Domicilio: no repetir lo que ya sale en su propia casilla (2026-08-18) ──
// El papel tiene casillas separadas y varios proveedores tienen la dirección
// entera en un campo: salía todo junto Y repetido al lado.
const { domicilioSinLocalidadNiProvincia: limpiar } = await import('../domicilioRemito.js');

assert.equal(
  limpiar('Arenales 605, B1638 Vicente López, Provincia de Buenos Aires', 'Vicente López', 'Provincia de Buenos Aires'),
  'Arenales 605, B1638',
  'el caso del papel real: quedan calle y CP');
assert.equal(limpiar('Av. Mitre 1234', 'Berisso', 'Buenos Aires'), 'Av. Mitre 1234',
  'si no aparecen, no toca nada');
assert.equal(limpiar('Arenales 605, VICENTE LOPEZ', 'Vicente López', null), 'Arenales 605',
  'ignora mayúsculas y acentos');
assert.equal(limpiar('Vicente López', 'Vicente López', null), 'Vicente López',
  'si el domicilio ES solo la localidad se deja: es el único dato que hay');
assert.equal(limpiar('', 'X', 'Y'), '', 'vacío queda vacío');
assert.equal(limpiar('Calle 1', null, null), 'Calle 1', 'sin localidad ni provincia no rompe');

// ── El minikit no puede pisarse a sí mismo (2026-08-19) ──────────────────────
// Varios minikits tienen `nombre` IGUAL al código: MKGC2 se llama "MKGC2", y el
// texto útil está en `descripcion` ("Minikit GC 2"). Tomando `nombre` primero,
// el filtro que evita repetir el código en las dos columnas lo borraba y la
// Descripción salía VACÍA en el papel y en las tres vistas.
const elegirTextoMinikit = (cod: string, nombre: string, descripcion: string) =>
  [descripcion, nombre].map(t => (t || '').trim())
    .find(t => t && t.toLowerCase() !== cod.trim().toLowerCase()) || null;

assert.equal(elegirTextoMinikit('MKGC2', 'MKGC2', 'Minikit GC 2'), 'Minikit GC 2',
  'con el nombre igual al codigo, gana la descripcion');
assert.equal(elegirTextoMinikit('MKLC1', 'Kit HPLC basico', ''), 'Kit HPLC basico',
  'sin descripcion, cae al nombre');
assert.equal(elegirTextoMinikit('MKGC2', 'mkgc2', 'MKGC2'), null,
  'si los dos son el codigo (ignorando mayusculas) queda vacio, no repite');
assert.equal(elegirTextoMinikit('MK1', '', ''), null, 'sin datos, null');

// ── Emitir NUNCA cierra el remito (2026-08-18) ───────────────────────────────
// Hubo una regla `remitoSinRetorno` que cerraba al emitir los remitos sin
// líneas que volvieran, para frenar la acumulación de remitos abiertos. Estaba
// mal: el remito lo cierra el consumo contra la OT, no la impresión. Se eliminó.
// El helper de abajo es el que quedó y es el que hay que cuidar.

// ── Qué se revierte al ANULAR un remito (2026-08-17) ─────────────────────────
// Cada exclusión de esta lista evita inventar stock. Un falso positivo acá
// duplica existencias sin que nadie se entere hasta el próximo inventario.
const { itemsARevertirEnAnulacion } = await import('@ags/shared');
const item = (extra: Record<string, unknown>) =>
  ({ id: 'x', tipoItem: 'entrega', devuelto: false, cantidad: 1,
     unidadId: 'u1', articuloId: 'a1', ...extra }) as unknown as RemitoItem;

assert.equal(itemsARevertirEnAnulacion([item({ stockAplicado: true })]).length, 1,
  'una salida aplicada se revierte');
assert.equal(itemsARevertirEnAnulacion([item({})]).length, 0,
  'sin stockAplicado no salió nada: no hay qué devolver');
assert.equal(itemsARevertirEnAnulacion([item({ stockAplicado: true, devuelto: true })]).length, 0,
  'ya devuelto: revertirlo otra vez DUPLICA el stock');
assert.equal(itemsARevertirEnAnulacion([item({ stockAplicado: true, consumido: true })]).length, 0,
  'consumido: ese stock se gastó de verdad, no vuelve');
assert.equal(itemsARevertirEnAnulacion([item({ stockAplicado: true, tipoItem: 'sale_y_vuelve' })]).length, 1,
  'sale_y_vuelve todavía afuera: vuelve a su posición de origen');
assert.equal(itemsARevertirEnAnulacion([]).length, 0, 'remito sin items');

// ── Cómo se revierte cada línea al anular (2026-08-21) ──────────────────────
// El bug que fija: anular un remito con línea de ENTREGA le SUMABA la cantidad
// a la unidad y no la devolvía a su posición. Resultado real: 3 unidades en
// stock pasaron a 4, y la pieza quedó "adentro" del remito cancelado.
// La rama separada por tipo de línea era correcta con el modelo viejo (la
// salida marcaba el doc `entregado`); dejó de serlo cuando emitir pasó a MOVER
// la unidad. Si alguien vuelve a separar las ramas, estos tests fallan.
const { parcheReversaDeLinea } = await import('@ags/shared');
const EST12 = { tipo: 'posicion', referenciaId: 'p12', referenciaNombre: 'EST. 12' } as UbicacionStock;
const STOCK = { tipo: 'posicion', referenciaId: '', referenciaNombre: 'Stock' } as UbicacionStock;

const rEntrega = parcheReversaDeLinea(
  { salidaUbicacionOrigen: EST12 } as RemitoItem, { estado: 'disponible' }, STOCK);
assert.deepEqual(rEntrega.ubicacion, EST12,
  'entrega anulada: la unidad vuelve a la posición de donde salió');
assert.equal('cantidad' in rEntrega, false,
  'entrega anulada: NO se toca la cantidad — emitir movió la unidad, no la descontó (bug 2026-08-21)');
assert.equal(rEntrega.estado, undefined,
  'entrega anulada de un remito nuevo: la unidad ya estaba disponible, no hay estado que pisar');

const rSaleYVuelve = parcheReversaDeLinea(
  { salidaUbicacionOrigen: EST12 } as RemitoItem, { estado: 'disponible' }, STOCK);
assert.deepEqual(rSaleYVuelve, rEntrega,
  'las dos clases de línea se revierten IGUAL: la unidad vuelve a su origen');

const rLegacy = parcheReversaDeLinea(
  { salidaUbicacionOrigen: EST12 } as RemitoItem, { estado: 'entregado' }, STOCK);
assert.equal(rLegacy.estado, 'disponible',
  'remito viejo (modelo `entregado`): además de volver, la unidad se reactiva');

const rSinOrigen = parcheReversaDeLinea({} as RemitoItem, { estado: 'disponible' }, STOCK);
assert.deepEqual(rSinOrigen.ubicacion, STOCK,
  'sin metadata de origen: cae al fallback, nunca queda en la posición del remito anulado');

console.log('✅ remitoLineas: 45/45 OK');
