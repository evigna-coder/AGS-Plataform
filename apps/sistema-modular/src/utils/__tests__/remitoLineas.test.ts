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
import type { RemitoItem } from '@ags/shared';
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

// ── La descripción entra en UNA línea y no se pasa del borde (2026-08-14) ────
// El bug: se envolvía y la segunda línea se pisaba con el item siguiente. Lo que
// se perdía era el final de la línea, o sea el N° de serie.
const { fontSizeDescripcion, recortarDescripcion } =
  await import('../../components/remitos/pdf/RemitoOverlayPDF.js');
const ANCHO_PT = 280;
const anchoDe = (t: string) => t.length * fontSizeDescripcion(t) * 0.5;

for (const t of [
  'Válvula de purga · S/N AB-9',
  'GC 7890 SN: DE64559987   ·   Orden cliente: 4500123456   ·   Ref: LAB-CROMATO',
  'Mantenimiento preventivo anual del cromatógrafo gaseoso con reemplazo de septa, liner y ferrules — Ppto PRE-0422',
  'x'.repeat(500),
]) {
  const final = recortarDescripcion(t);
  assert.ok(anchoDe(final) <= ANCHO_PT + 0.01, `se sale de la columna: "${final}"`);
  assert.ok(fontSizeDescripcion(final) >= 6, 'nunca por debajo de 6pt (ilegible)');
}
assert.equal(fontSizeDescripcion('corto'), 8.5, 'una línea corta va al cuerpo normal');
assert.ok(recortarDescripcion('Válvula de purga · S/N AB-9').endsWith('S/N AB-9'),
  'una descripción normal NO se recorta: la serie tiene que estar entera');

console.log('✅ remitoLineas: 23/23 OK');
