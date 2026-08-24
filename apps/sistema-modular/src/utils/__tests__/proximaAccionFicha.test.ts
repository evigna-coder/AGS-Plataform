/**
 * Unit tests — próxima acción de una ficha (2026-08-23).
 *
 * Run with: pnpm --filter @ags/sistema-modular test:proxima-accion
 *
 * Lo que cuidan: que el listado NUNCA ofrezca un paso cuando hay más de una
 * cosa que podría moverse. Un botón que mueve el item equivocado es peor que no
 * tener botón, porque deja la ficha a mitad de camino sin que nadie lo note.
 */

import assert from 'node:assert/strict';
import type { FichaPropiedad } from '@ags/shared';
import { proximaAccionFicha } from '../proximaAccionFicha.js';

const deriv = (id: string, estado: 'pendiente' | 'enviado' | 'recibido', extra: Record<string, unknown> = {}) =>
  ({ id, estado, proveedorId: 'p1', proveedorNombre: 'ELS', descripcion: '', ...extra }) as never;

const item = (id: string, estado: string, derivaciones: unknown[] = []) =>
  ({ id, estado, derivaciones, historial: [] }) as never;

const ficha = (items: unknown[]) => ({ id: 'f1', items } as unknown as FichaPropiedad);

// ── Derivación abierta: el paso es que vuelva ────────────────────────────────
{
  const r = proximaAccionFicha(ficha([item('i1', 'derivado_proveedor', [deriv('d1', 'enviado')])]));
  assert.equal(r?.tipo, 'devolucion');
  assert.equal(r && 'label' in r && r.label, 'Registrar devolución');
  assert.equal(r && 'derivacionId' in r && r.derivacionId, 'd1');
  assert.equal(r && 'proveedor' in r && r.proveedor, 'ELS');
}

// Una derivación ya recibida no cuenta: el ciclo siguió.
{
  const r = proximaAccionFicha(ficha([item('i1', 'en_reparacion', [deriv('d1', 'recibido')])]));
  assert.equal(r?.tipo, 'estado', 'recibida no bloquea el paso de estado');
  assert.equal(r && 'hacia' in r && r.hacia, 'listo_para_entrega');
}

// Dos derivaciones abiertas: no se elige por el usuario.
{
  const r = proximaAccionFicha(ficha([
    item('i1', 'derivado_proveedor', [deriv('d1', 'enviado')]),
    item('i2', 'derivado_proveedor', [deriv('d2', 'enviado')]),
  ]));
  assert.equal(r?.tipo, 'ambigua');
  assert.match(r && 'motivo' in r ? r.motivo : '', /2 derivaciones/);
}

// La derivación manda aunque el item esté en otro estado (derivación de parte).
{
  const r = proximaAccionFicha(ficha([
    item('i1', 'esperando_repuesto', [deriv('d1', 'enviado', { alcance: 'parte' })]),
  ]));
  assert.equal(r?.tipo, 'devolucion', 'lo que está afuera tiene prioridad');
  assert.match(r && 'detalle' in r ? r.detalle : '', /La parte/);
}

// ── Paso del ciclo ───────────────────────────────────────────────────────────
{
  const casos: [string, string][] = [
    ['recibido', 'en_diagnostico'],
    ['en_diagnostico', 'en_reparacion'],
    ['en_reparacion', 'listo_para_entrega'],
    ['esperando_repuesto', 'en_reparacion'],
    ['listo_para_entrega', 'en_envio'],
    ['en_envio', 'entregado'],
  ];
  for (const [desde, hacia] of casos) {
    const r = proximaAccionFicha(ficha([item('i1', desde)]));
    assert.equal(r && 'hacia' in r && r.hacia, hacia, `${desde} → ${hacia}`);
  }
}

// Un `derivado_proveedor` sin derivación abierta quedó desincronizado: vuelve
// al taller en lugar de no ofrecer nada.
{
  const r = proximaAccionFicha(ficha([item('i1', 'derivado_proveedor')]));
  assert.equal(r && 'hacia' in r && r.hacia, 'en_reparacion');
}

// ── Casos donde NO hay que ofrecer nada ──────────────────────────────────────
assert.equal(proximaAccionFicha(ficha([item('i1', 'entregado')])), null, 'entregado: la ficha terminó');
assert.equal(proximaAccionFicha(ficha([])), null, 'ficha sin items');

{
  const r = proximaAccionFicha(ficha([item('i1', 'recibido'), item('i2', 'en_reparacion')]));
  assert.equal(r?.tipo, 'ambigua', 'estados distintos: al detalle');
}
{
  const r = proximaAccionFicha(ficha([item('i1', 'recibido'), item('i2', 'recibido')]));
  assert.equal(r?.tipo, 'ambigua', 'mismo estado pero dos items: no se elige uno');
}
// Los entregados no cuentan para la ambigüedad: la ficha sigue por el que queda.
{
  const r = proximaAccionFicha(ficha([item('i1', 'entregado'), item('i2', 'en_envio')]));
  assert.equal(r?.tipo, 'estado', 'el item ya entregado no genera ambigüedad');
  assert.equal(r && 'itemId' in r && r.itemId, 'i2');
}

console.log('✅ proximaAccionFicha: 20/20 OK');
