/**
 * Unit tests — prorrateo de costo y herencia de factor al explotar un kit
 * (2026-09-10).
 *
 * Run with: pnpm --filter @ags/sistema-modular test:kit-prorrateo
 *
 * La regla que fija: la suma del costo de los componentes es SIEMPRE lo que
 * costó el kit (los precios sueltos solo deciden la proporción), y el factor
 * se hereda del embarque.
 */

import assert from 'node:assert/strict';
import type { KitComponente } from '@ags/shared';
import { rellenarParticipacion, validarParticipacion, participacionEfectiva, costoComponente, costeoKitConsumido } from '../kitProrrateo';

const comp = (id: string, cantidadPorKit: number, pct?: number | null): KitComponente =>
  ({ articuloId: id, articuloCodigo: id, articuloDescripcion: id, cantidadPorKit, ...(pct !== undefined ? { participacionPct: pct } : {}) });

// ── Rellenos ────────────────────────────────────────────────────────────────
{
  const bom = [comp('a', 1), comp('b', 3)];
  assert.deepEqual(rellenarParticipacion(bom, 'iguales').map(c => c.participacionPct), [50, 50]);
  assert.deepEqual(rellenarParticipacion(bom, 'por_cantidad').map(c => c.participacionPct), [25, 75]);
  // Por costo: precios sueltos 400 y 200 (×3 = 600) → 40% / 60%. El total sigue siendo el del kit.
  const porCosto = rellenarParticipacion(bom, 'por_costo', new Map([['a', 400], ['b', 200]]));
  assert.deepEqual(porCosto.map(c => c.participacionPct), [40, 60]);
  // Tres iguales: 33,33 + 33,33 + 33,34 = 100.
  const tres = rellenarParticipacion([comp('a', 1), comp('b', 1), comp('c', 1)], 'iguales');
  assert.equal(tres.reduce((s, c) => s + (c.participacionPct ?? 0), 0), 100);
  // Sin costos conocidos: no se inventa nada.
  assert.deepEqual(rellenarParticipacion(bom, 'por_costo').map(c => c.participacionPct), [null, null]);
}

// ── Validación ──────────────────────────────────────────────────────────────
{
  assert.equal(validarParticipacion([comp('a', 1), comp('b', 1)]).ok, true, 'sin ninguna cargada se acepta');
  assert.equal(validarParticipacion([comp('a', 1, 60), comp('b', 1, 40)]).ok, true);
  assert.equal(validarParticipacion([comp('a', 1, 60), comp('b', 1)]).ok, false, 'a medias no');
  assert.equal(validarParticipacion([comp('a', 1, 60), comp('b', 1, 50)]).ok, false, 'suma 110 no');
  assert.deepEqual(participacionEfectiva([comp('a', 1), comp('b', 3)]).map(c => c.participacionPct), [25, 75], 'default por cantidad');
}

// ── Costo por componente: la suma es el costo del kit ───────────────────────
{
  // Kit de 300, componentes que sueltos valdrían 400 y 200 (el ejemplo del user).
  const a = costoComponente(300, 66.67, 1);
  const b = costoComponente(300, 33.33, 1);
  assert.equal(a, 200.01);
  assert.equal(b, 99.99);
  assert.ok(Math.abs((a! + b!) - 300) < 0.05, 'nunca 600: la suma es lo que se pagó');
  // Con cantidad por kit: 60% de 300 repartido en 3 unidades = 60 c/u.
  assert.equal(costoComponente(300, 60, 3), 60);
  assert.equal(costoComponente(null, 60, 3), null, 'kit sin costo → componente sin costo');
}

// ── Costeo del kit consumido: ponderado por lo que sale de cada unidad ──────
{
  const c = costeoKitConsumido([
    [{ costoUnitario: 100, costoUnitarioReal: 110, factorImportacion: 1.5, factorImportacionReal: 1.6, monedaCosto: 'USD', costeoConfirmadoAt: '2026-08-01', importacionNumero: 'IMP-0001' }, 3],
    [{ costoUnitario: 200, costoUnitarioReal: null, factorImportacion: 2.5, factorImportacionReal: null, monedaCosto: 'USD', costeoConfirmadoAt: null, importacionNumero: 'IMP-0001' }, 1],
  ]);
  assert.equal(c.costoUnitario, 125, '(100×3 + 200×1) / 4');
  assert.equal(c.factorImportacion, 1.75);
  assert.equal(c.costoUnitarioReal, 110, 'el real solo pondera lo que lo tiene');
  assert.equal(c.costeoConfirmadoAt, null, 'no todas confirmadas → estimado');
  assert.equal(c.importacionNumero, 'IMP-0001');
  const sinCosto = costeoKitConsumido([[{ costoUnitario: null, costoUnitarioReal: null, factorImportacion: null, factorImportacionReal: null, monedaCosto: null, costeoConfirmadoAt: null, importacionNumero: null }, 2]]);
  assert.equal(sinCosto.costoUnitario, null);
}

console.log('✓ kitProrrateo: rellenos, validación, suma = costo del kit, ponderación del kit consumido');
