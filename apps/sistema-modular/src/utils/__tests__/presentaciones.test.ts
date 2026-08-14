/**
 * Unit tests — conversión de presentaciones a unidad base (Fase 2, 2026-08-13).
 *
 * Run with: pnpm --filter @ags/sistema-modular test:presentaciones
 *
 * Por qué existe: comprar "1 × 5183-2067" cuando ese envase trae 10 de la
 * unidad base tiene que ingresar 10 al pool. Si esta cuenta falla o se saltea,
 * el stock queda mal contado y hay que reconstruirlo a mano — es el motivo por
 * el que la Fase 2 no puede entrar a medias.
 */

import assert from 'node:assert/strict';
import { cantidadEnUnidadBase } from '@ags/shared';

// ── El caso del usuario: base 5182-0714 (vial x100), presentación 5183-2067 ──
const vialX1000 = { codigoParte: '5183-2067', factor: 10 };

assert.equal(cantidadEnUnidadBase(1, vialX1000), 10, '1 vial de 1000 = 10 unidades base');
assert.equal(cantidadEnUnidadBase(3, vialX1000), 30);

// ── Sin presentación: la cantidad YA está en unidad base ──
assert.equal(cantidadEnUnidadBase(5, null), 5);
assert.equal(cantidadEnUnidadBase(5, undefined), 5);

// ── Fracciones: se cotiza y se compra medio kit ──
assert.equal(cantidadEnUnidadBase(0.5, vialX1000), 5, 'medio envase de 10 = 5 base');

// ── Factores inválidos NO deben anular el stock: se cae a la unidad base ──
// (un factor 0 multiplicando daría 0 unidades ingresadas, en silencio)
assert.equal(cantidadEnUnidadBase(4, { codigoParte: 'X', factor: 0 }), 4);
assert.equal(cantidadEnUnidadBase(4, { codigoParte: 'X', factor: -2 }), 4);
assert.equal(cantidadEnUnidadBase(4, { codigoParte: 'X', factor: NaN }), 4);

// ── Factor 1 = la presentación ES la unidad base (código alternativo) ──
assert.equal(cantidadEnUnidadBase(7, { codigoParte: '5182-0714', factor: 1 }), 7);

console.log('✅ presentaciones: 9/9 OK');
