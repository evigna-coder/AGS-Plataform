/**
 * Unit tests — cupo anual por servicio y equipo de un contrato (2026-08-17).
 *
 * Run with: pnpm --filter @ags/sistema-modular test:contrato-cupo
 *
 * Lo que fijan: el cupo es POR EQUIPO y POR AÑO DE CONTRATO (aniversario de
 * fechaInicio, no 1 de enero), las canceladas no consumen, y un servicio sin
 * cupo declarado no bloquea nunca.
 */

import assert from 'node:assert/strict';
import type { Contrato, WorkOrder } from '@ags/shared';
import { anioDeContrato } from '@ags/shared';
import { consumoDelAnio, puedeCrearOTBajoContrato } from '../contratoCupo.js';

// ── anioDeContrato: aniversario, no año calendario ───────────────────────────
assert.equal(anioDeContrato('2026-03-15', '2026-03-15'), 0, 'el día de inicio es año 0');
assert.equal(anioDeContrato('2026-03-15', '2026-12-31'), 0, 'diciembre sigue siendo el año 0');
assert.equal(anioDeContrato('2026-03-15', '2027-03-14'), 0, 'un día antes del aniversario, todavía año 0');
assert.equal(anioDeContrato('2026-03-15', '2027-03-15'), 1, 'el aniversario abre el año 1');
assert.equal(anioDeContrato('2026-03-15', '2028-06-01'), 2);
assert.equal(anioDeContrato('2026-03-15', '2025-01-01'), 0, 'una fecha previa al inicio no da negativo');

const contrato = {
  estado: 'activo',
  fechaInicio: '2026-03-15',
  fechaFin: '2028-03-14',
  sistemaIds: ['sisA', 'sisB'],
  serviciosIncluidos: [
    { tipoServicioId: 't1', tipoServicioNombre: 'Mantenimiento preventivo', cantidadAnualPorEquipo: 1 },
    { tipoServicioId: 't2', tipoServicioNombre: 'Visita correctiva' },
  ],
} as unknown as Contrato;

const ot = (n: string, sistemaId: string, tipoServicio: string, fecha: string,
  estadoAdmin: WorkOrder['estadoAdmin'] = 'COORDINADA'): WorkOrder =>
  ({ otNumber: n, sistemaId, tipoServicio, fechaServicioAprox: fecha, estadoAdmin } as WorkOrder);

// ── El cupo es por equipo: sisA lo gastó, sisB no ────────────────────────────
const ots = [ot('30001.01', 'sisA', 'Mantenimiento preventivo', '2026-05-10')];

const filas = consumoDelAnio(contrato, ots, '2026-06-01');
assert.equal(filas.length, 4, 'una fila por equipo × servicio, incluidas las de cero');
const fA = filas.find(f => f.sistemaId === 'sisA' && f.cupo === 1)!;
const fB = filas.find(f => f.sistemaId === 'sisB' && f.cupo === 1)!;
assert.equal(fA.usadas, 1); assert.equal(fA.restantes, 0);
assert.equal(fB.usadas, 0); assert.equal(fB.restantes, 1, 'el equipo B no gastó nada');

assert.equal(puedeCrearOTBajoContrato(contrato, ots,
  { sistemaId: 'sisA', tipoServicio: 'Mantenimiento preventivo', fecha: '2026-06-01' }).allowed, false,
  'sisA ya consumió su preventivo del año');
assert.equal(puedeCrearOTBajoContrato(contrato, ots,
  { sistemaId: 'sisB', tipoServicio: 'Mantenimiento preventivo', fecha: '2026-06-01' }).allowed, true,
  'sisB todavía tiene el suyo');

// ── El cupo se renueva en el ANIVERSARIO, no el 1 de enero ───────────────────
assert.equal(puedeCrearOTBajoContrato(contrato, ots,
  { sistemaId: 'sisA', tipoServicio: 'Mantenimiento preventivo', fecha: '2027-01-05' }).allowed, false,
  'enero del año siguiente sigue siendo el mismo año de contrato');
assert.equal(puedeCrearOTBajoContrato(contrato, ots,
  { sistemaId: 'sisA', tipoServicio: 'Mantenimiento preventivo', fecha: '2027-03-15' }).allowed, true,
  'el aniversario renueva el cupo');

// ── Una OT CANCELADA no consume ──────────────────────────────────────────────
const otsCancelada = [ot('30001.01', 'sisA', 'Mantenimiento preventivo', '2026-05-10', 'CANCELADA')];
assert.equal(puedeCrearOTBajoContrato(contrato, otsCancelada,
  { sistemaId: 'sisA', tipoServicio: 'Mantenimiento preventivo', fecha: '2026-06-01' }).allowed, true,
  'cancelar devuelve el cupo sin tocar ningún contador');

// ── Servicio SIN cupo declarado: nunca bloquea ───────────────────────────────
const muchosCorrectivos = Array.from({ length: 9 }, (_, i) =>
  ot(`3010${i}.01`, 'sisA', 'Visita correctiva', '2026-05-10'));
assert.equal(puedeCrearOTBajoContrato(contrato, muchosCorrectivos,
  { sistemaId: 'sisA', tipoServicio: 'Visita correctiva', fecha: '2026-06-01' }).allowed, true,
  'un servicio sin cupo no tiene tope');

// ── Servicio que NO está en el contrato ──────────────────────────────────────
const fuera = puedeCrearOTBajoContrato(contrato, [],
  { sistemaId: 'sisA', tipoServicio: 'Calificación de operación', fecha: '2026-06-01' });
assert.equal(fuera.allowed, false);
assert.ok(fuera.reason?.includes('no está incluido'), fuera.reason);

// ── Vigencia del contrato ────────────────────────────────────────────────────
assert.equal(puedeCrearOTBajoContrato(contrato, [],
  { sistemaId: 'sisB', tipoServicio: 'Visita correctiva', fecha: '2029-01-01' }).allowed, false,
  'después de fechaFin no se crea nada');
assert.equal(puedeCrearOTBajoContrato({ ...contrato, estado: 'suspendido' } as Contrato, [],
  { sistemaId: 'sisB', tipoServicio: 'Visita correctiva', fecha: '2026-06-01' }).allowed, false,
  'contrato no activo no habilita OTs');

// ── Sin equipo: no se puede imputar, pero tampoco se bloquea ─────────────────
assert.equal(puedeCrearOTBajoContrato(contrato, ots,
  { sistemaId: null, tipoServicio: 'Mantenimiento preventivo', fecha: '2026-06-01' }).allowed, true,
  'una OT sin equipo no consume cupo de ningún equipo');

console.log('✅ contratoCupo: 18/18 OK');
