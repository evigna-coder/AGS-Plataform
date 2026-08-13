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
import { getRemitoItemCodigo, lineaDescripcionRemito } from '../inventarioToRemitoItem.js';

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

console.log('✅ remitoLineas: 10/10 OK');
