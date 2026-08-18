/**
 * Unit tests — conversión artículo comprado → unidades de patrón (2026-08-18).
 *
 * Run with: pnpm --filter @ags/sistema-modular test:patron-ingreso
 *
 * Por qué existe: un kit de cafeínas se compra de a 1 kit pero como patrón son
 * 3 ampollas. Si esta cuenta falla, el patrón queda con existencias que no
 * coinciden con lo que hay en la heladera, y eso se descubre recién cuando un
 * técnico va a usar una ampolla que el sistema decía tener.
 *
 * La otra mitad del cuidado es NO multiplicar dos veces: un patrón con BOM ya
 * desglosa el kit por sus componentes, así que el factor no aplica.
 */

import assert from 'node:assert/strict';
import { unidadesPatronDesdeCompra, cantidadEnUnidadBase } from '@ags/shared';

// ── El caso que lo motiva: kit de cafeínas, 1 kit = 3 ampollas ──
const kitCafeinas = { unidadesPorUnidadDeCompra: 3, componentes: [] };
assert.equal(unidadesPatronDesdeCompra(kitCafeinas, 1), 3, '1 kit = 3 ampollas');
assert.equal(unidadesPatronDesdeCompra(kitCafeinas, 4), 12, '4 kits = 12 ampollas');

// ── Metanol / agua HPLC: 1 a 1, no cambia nada ──
assert.equal(unidadesPatronDesdeCompra({ unidadesPorUnidadDeCompra: 1, componentes: [] }, 5), 5);
assert.equal(unidadesPatronDesdeCompra({ unidadesPorUnidadDeCompra: null, componentes: [] }, 5), 5,
  'sin factor declarado = 1 a 1');
assert.equal(unidadesPatronDesdeCompra({ componentes: [] } as never, 5), 5, 'factor ausente = 1 a 1');

// ── Un patrón con BOM ignora el factor: el desglose lo dan los componentes ──
const kitUV = {
  unidadesPorUnidadDeCompra: 4,
  componentes: [{ codigoComponente: 'A', descripcion: '', cantidadPorKit: 2, unidadMedida: 'ampolla' }],
};
assert.equal(unidadesPatronDesdeCompra(kitUV, 1), 1,
  'con BOM el kit vale 1: aplicar el factor además multiplicaría dos veces');
assert.equal(unidadesPatronDesdeCompra(kitUV, 3), 3, 'con BOM entran 3 kits, no 12');

// ── Factores inválidos no rompen ni inventan stock ──
for (const malo of [0, -2, NaN, Infinity]) {
  assert.equal(unidadesPatronDesdeCompra({ unidadesPorUnidadDeCompra: malo, componentes: [] }, 7), 7,
    `factor invalido (${malo}) cae a 1 a 1 en vez de dar 0 o NaN`);
}

// ── Composición con presentaciones: envase → unidad base → unidades de patrón ──
// Se aplican EN ESE ORDEN. Al revés cuenta mal.
const cajaDe6Kits = { codigoParte: 'CAJA-6', factor: 6 };
const base = cantidadEnUnidadBase(2, cajaDe6Kits);           // 2 cajas = 12 kits
assert.equal(base, 12, '2 cajas de 6 = 12 kits');
assert.equal(unidadesPatronDesdeCompra(kitCafeinas, base), 36, '12 kits x 3 = 36 ampollas');

console.log('✅ patronIngreso: 13/13 OK');
