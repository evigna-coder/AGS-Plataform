/**
 * Unit tests — numeración de las líneas del presupuesto (2026-08-23).
 *
 * Run with: pnpm --filter @ags/sistema-modular test:ppto-items
 *
 * Lo que cuidan: que el número que ve el cliente en el PDF sea el mismo que ve
 * quien carga el presupuesto, y que el prefijo del ítem coincida con el número
 * del encabezado del grupo. Si esos dos se separan, el cliente pide "el 2.1" y
 * nadie sabe cuál es.
 */

import assert from 'node:assert/strict';
import { numerarItemsPresupuesto } from '../presupuestoItemNumero.js';

const item = (id: string, grupo?: number) => ({ id, grupo });

// ── Presupuesto plano ────────────────────────────────────────────────────────
{
  const r = numerarItemsPresupuesto([item('a'), item('b'), item('c')]);
  assert.equal(r.agrupado, false, 'sin grupos: no es agrupado');
  assert.equal(r.etiquetaPorItem.get('a'), '1');
  assert.equal(r.etiquetaPorItem.get('b'), '2');
  assert.equal(r.etiquetaPorItem.get('c'), '3', 'plano numera corrido');
}

// `grupo: 0` es el bucket "sin sistema", no un grupo real.
{
  const r = numerarItemsPresupuesto([item('a', 0), item('b', 0)]);
  assert.equal(r.agrupado, false, 'grupo 0 en todas = presupuesto plano');
  assert.equal(r.etiquetaPorItem.get('b'), '2');
}

assert.equal(numerarItemsPresupuesto([]).etiquetaPorItem.size, 0, 'sin items no explota');

// ── Presupuesto agrupado por sistema ─────────────────────────────────────────
{
  const r = numerarItemsPresupuesto([
    item('a', 1), item('b', 1),
    item('c', 2), item('d', 2), item('e', 2),
  ]);
  assert.equal(r.agrupado, true);
  assert.equal(r.etiquetaPorItem.get('a'), '1.1');
  assert.equal(r.etiquetaPorItem.get('b'), '1.2');
  assert.equal(r.etiquetaPorItem.get('c'), '2.1', 'cada grupo reinicia el contador');
  assert.equal(r.etiquetaPorItem.get('e'), '2.3');
}

// El número del grupo es su POSICIÓN, no el valor crudo: con huecos, el
// encabezado del segundo bloque tiene que decir "2" y no "7".
{
  const r = numerarItemsPresupuesto([item('a', 3), item('b', 7)]);
  assert.equal(r.posicionPorGrupo.get(3), 1, 'el grupo 3 es el primero del documento');
  assert.equal(r.posicionPorGrupo.get(7), 2, 'el grupo 7 es el segundo');
  assert.equal(r.etiquetaPorItem.get('a'), '1.1');
  assert.equal(r.etiquetaPorItem.get('b'), '2.1',
    'el prefijo del ítem sigue la posición, igual que el encabezado del grupo');
}

// Los generales (grupo 0) van primero, como en `agruparPorSistemaSimple`.
{
  const r = numerarItemsPresupuesto([item('sistema', 2), item('general', 0)]);
  assert.equal(r.posicionPorGrupo.get(0), 1, 'servicios generales encabeza');
  assert.equal(r.etiquetaPorItem.get('general'), '1.1');
  assert.equal(r.etiquetaPorItem.get('sistema'), '2.1');
}

// El orden de las líneas dentro del grupo es el de carga, aunque vengan
// intercaladas con las de otro sistema.
{
  const r = numerarItemsPresupuesto([item('a', 1), item('x', 2), item('b', 1)]);
  assert.equal(r.etiquetaPorItem.get('a'), '1.1');
  assert.equal(r.etiquetaPorItem.get('b'), '1.2', 'intercalado no rompe el contador del grupo');
  assert.equal(r.etiquetaPorItem.get('x'), '2.1');
}

console.log('✅ presupuestoItemNumero: 16/16 OK');
