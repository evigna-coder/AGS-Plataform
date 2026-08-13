/**
 * Unit tests — bloqueo de coordinación en fin de semana (2026-08-12).
 *
 * Run with: pnpm --filter @ags/sistema-modular test:finde
 *   (tsx src/utils/__tests__/finDeSemana.test.ts)
 *
 * node:assert/strict, sin framework (mismo patrón que landingPath.test.ts).
 *
 * Lo que protege: las fechas viajan como 'YYYY-MM-DD' y `new Date('2026-08-15')`
 * se parsea como UTC — en UTC-3 eso cae el día anterior y un sábado se leía como
 * viernes, dejando pasar justo lo que hay que bloquear.
 */

import assert from 'node:assert/strict';
import { esFinDeSemana, primerFinDeSemanaEnRango, mensajeFinDeSemana } from '../finDeSemana.js';

// Agosto 2026: 14 = viernes, 15 = sábado, 16 = domingo, 17 = lunes.

// 1. Días hábiles no se bloquean.
assert.equal(esFinDeSemana('2026-08-14'), false, 'viernes es hábil');
assert.equal(esFinDeSemana('2026-08-17'), false, 'lunes es hábil');

// 2. Sábado y domingo sí — el caso que rompía con el parseo UTC.
assert.equal(esFinDeSemana('2026-08-15'), true, 'sábado debe bloquearse');
assert.equal(esFinDeSemana('2026-08-16'), true, 'domingo debe bloquearse');

// 3. Vacío = sin fecha cargada: no bloquea (la OT puede guardarse sin coordinar).
assert.equal(esFinDeSemana(''), false, 'sin fecha no hay nada que bloquear');

// 4. Rango que solo toca días hábiles pasa limpio.
assert.equal(
  primerFinDeSemanaEnRango('2026-08-12', '2026-08-14'),
  null,
  'mié a vie no toca fin de semana',
);

// 5. Rango que CRUZA el fin de semana devuelve el primero (un trabajo de varios
//    días arrancado en viernes no puede estirarse hasta el lunes).
assert.equal(
  primerFinDeSemanaEnRango('2026-08-14', '2026-08-17'),
  '2026-08-15',
  'debe reportar el sábado, no el domingo ni el lunes',
);

// 6. Rango de un solo día en sábado.
assert.equal(
  primerFinDeSemanaEnRango('2026-08-15', '2026-08-15'),
  '2026-08-15',
  'un solo día en sábado se bloquea',
);

// 7. El mensaje sale en criollo y con la fecha legible (no ISO ni corrida).
const msg = mensajeFinDeSemana('2026-08-15');
assert.ok(msg.includes('15/08/2026'), `el mensaje debe traer la fecha legible: ${msg}`);
assert.ok(/s[áa]bado/i.test(msg), `el mensaje debe nombrar el día: ${msg}`);

console.log('✅ finDeSemana: 7/7 OK');
