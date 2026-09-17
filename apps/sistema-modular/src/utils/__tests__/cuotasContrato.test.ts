/**
 * Cuotas mensuales de contrato (2026-09-16): fecha derivada, estado por
 * solicitudes, un aviso por moneda, primer día hábil.
 * Correr con: pnpm --filter @ags/sistema-modular test:cuotas-contrato
 */
import assert from 'node:assert/strict';
import type { Presupuesto, SolicitudFacturacion } from '@ags/shared';
import {
  fechaCuotaContrato, finDeMes, estadoCuotaContrato, solicitudDeCuota, cuotasDeContrato,
  cuotasContratoPorFacturar, primerDiaHabil, esDesdePrimerDiaHabil,
} from '../cuotasContrato';

// ── Fecha de la cuota ──
assert.equal(fechaCuotaContrato('2026-09-15', 1), '2026-09-01', 'cuota 1 = mes de inicio');
assert.equal(fechaCuotaContrato('2026-09-15', 2), '2026-10-01', 'cuota 2 = mes siguiente');
assert.equal(fechaCuotaContrato('2026-11-01', 3), '2027-01-01', 'cruza el año');
assert.equal(finDeMes('2026-02'), '2026-02-28');
assert.equal(finDeMes('2028-02-10'), '2028-02-29', 'bisiesto');

// ── Contrato TEVA: 4 cuotas en ARS y USD, cuota 1 hecha por fuera ──
const teva = {
  id: 'p1', numero: 'P5-005179-01', tipo: 'contrato', estado: 'aceptado', clienteId: 'c1', moneda: 'MIXTA',
  contratoFechaInicio: '2026-09-01',
  cuotas: [1, 2, 3, 4].flatMap(n => [
    { numero: n, moneda: 'ARS', monto: 1000, descripcion: `Cuota ${n}/4` },
    { numero: n, moneda: 'USD', monto: 100, descripcion: `Cuota ${n}/4` },
  ]),
} as unknown as Presupuesto;
const sol = (numero: number, moneda: string, estado: string): SolicitudFacturacion =>
  ({ id: `s-${numero}-${moneda}`, cuotaNumero: numero, cuotaMoneda: moneda, estado } as unknown as SolicitudFacturacion);
const sols = [sol(1, 'ARS', 'facturada'), sol(1, 'USD', 'facturada'), sol(9, 'ARS', 'anulada')];

assert.equal(solicitudDeCuota(sols, 1, 'ARS')?.id, 's-1-ARS');
assert.equal(solicitudDeCuota(sols, 9, 'ARS'), null, 'anulada no cuenta');
assert.equal(estadoCuotaContrato('2026-10-01', null, '2026-09-30'), 'futura');
assert.equal(estadoCuotaContrato('2026-10-01', null, '2026-10-31'), 'por_facturar');
assert.equal(estadoCuotaContrato('2026-09-01', sol(1, 'ARS', 'pendiente'), '2026-09-30'), 'solicitada');
assert.equal(estadoCuotaContrato('2026-09-01', sol(1, 'ARS', 'cobrada'), '2026-09-30'), 'cobrada');

// En septiembre: la 1 está facturada (por fuera), nada pendiente.
const sep = cuotasContratoPorFacturar([teva], new Map([['p1', sols]]), '2026-09-30');
assert.deepEqual(sep, [], 'septiembre: cuota 1 ya facturada → nada por facturar');
// En octubre: cuota 2 en las dos monedas → DOS avisos.
const oct = cuotasContratoPorFacturar([teva], new Map([['p1', sols]]), '2026-10-31');
assert.deepEqual(oct.map(r => `${r.cuota.numero}-${r.cuota.moneda}`), ['2-ARS', '2-USD'], 'octubre: cuota 2 por moneda');
// Cuota 2 ARS ya avisada → queda solo la USD.
const octParcial = cuotasContratoPorFacturar([teva], new Map([['p1', [...sols, sol(2, 'ARS', 'pendiente')]]]), '2026-10-31');
assert.deepEqual(octParcial.map(r => `${r.cuota.numero}-${r.cuota.moneda}`), ['2-USD']);
// Todas las cuotas con estado derivado.
const todas = cuotasDeContrato(teva, sols, '2026-10-31');
assert.equal(todas.length, 8);
assert.equal(todas.filter(r => r.estado === 'facturada').length, 2);
assert.equal(todas.filter(r => r.estado === 'futura').length, 4, 'cuotas 3 y 4 son futuras');
// Un contrato sin aceptar o sin fecha de inicio no entra.
assert.deepEqual(cuotasContratoPorFacturar([{ ...teva, estado: 'borrador' } as Presupuesto], new Map(), '2026-12-31'), []);
assert.deepEqual(cuotasContratoPorFacturar([{ ...teva, contratoFechaInicio: null } as Presupuesto], new Map(), '2026-12-31'), []);

// ── Primer día hábil ──
assert.equal(primerDiaHabil(2026, 11, new Set()), '2026-11-02', 'nov 2026 arranca domingo → lunes 2');
assert.equal(primerDiaHabil(2026, 10, new Set()), '2026-10-01', 'oct 2026: jueves 1');
assert.equal(primerDiaHabil(2026, 10, new Set(['2026-10-01'])), '2026-10-02', 'feriado el 1 → viernes 2');
assert.equal(primerDiaHabil(2026, 8, new Set()), '2026-08-03', 'ago 2026 arranca sábado → lunes 3');
assert.equal(esDesdePrimerDiaHabil('2026-11-01', new Set()), false, 'domingo 1: todavía no');
assert.equal(esDesdePrimerDiaHabil('2026-11-02', new Set()), true);
assert.equal(esDesdePrimerDiaHabil('2026-11-20', new Set()), true, 'después del primer hábil, siempre');

console.log('✅ cuotasContrato: 26 checks OK');
