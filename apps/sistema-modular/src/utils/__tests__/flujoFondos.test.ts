/**
 * Unit tests — flujo de fondos de comercio exterior (Pagos VEP), 2026-09-10.
 *
 * Run with: pnpm --filter @ags/sistema-modular test:flujo-fondos
 *
 * Fija dos reglas que salieron de UAT:
 *  - Una importación OFICIALIZADA (despacho declarado) ya no tiene VEP ni
 *    arribo pendientes: la aduana no oficializa sin el VEP pagado. Antes la impo
 *    seguía en Pagos VEP hasta marcarse recibida.
 *  - Los giros al exterior se ven en UNA moneda: los facturados en euros se
 *    convierten a dólares al pase EUR→USD declarado en la importación. Sin pase
 *    no hay con qué convertir y quedan en euros.
 */

import assert from 'node:assert/strict';
import { buildEventos, totalPendiente, pagosPendientes, periodoDe, groupByPeriodo, filtrarEventosPorTipo } from '@ags/shared';
import type { EventoFlujo } from '@ags/shared';
import type { Importacion } from '@ags/shared';

const base = (extra: Partial<Importacion>): Importacion => ({
  id: 'imp1', numero: 'IMP-0001', estado: 'en_aduana',
  ordenCompraId: 'oc1', ordenCompraNumero: 'OC-0100', proveedorId: 'p1', proveedorNombre: 'Agilent',
  gastos: [], documentos: [], createdAt: '2026-09-01', updatedAt: '2026-09-01',
  vepMonto: 1000, vepMoneda: 'ARS', vepFechaPago: '2099-01-10',
  giroMonto: 500, giroMoneda: 'USD', giroFechaEstimada: '2099-02-10',
  fechaEstimadaArribo: '2099-01-05',
  ...extra,
} as Importacion);

const byTipo = (imp: Importacion, tipo: string) => buildEventos([imp]).find(e => e.tipo === tipo)!;

// ── Oficializada ⇒ VEP pagado y arribo ocurrido, giro sigue pendiente ───────
{
  const enAduana = base({ estado: 'en_aduana' });
  assert.equal(byTipo(enAduana, 'vep').pagado, false, 'en aduana: VEP pendiente');
  assert.equal(byTipo(enAduana, 'arribo').pagado, false, 'en aduana: arribo pendiente');

  const oficializada = base({ estado: 'despachado', despachoNumero: '26 001 IC04 000123 X' });
  assert.equal(byTipo(oficializada, 'vep').pagado, true, 'oficializada: VEP dado por pagado sin confirmar');
  assert.equal(byTipo(oficializada, 'arribo').pagado, true, 'oficializada: arribo dado por ocurrido');
  assert.equal(byTipo(oficializada, 'giro').pagado, false, 'oficializada: el giro NO se infiere');

  const { vencidos, proximos } = pagosPendientes(buildEventos([oficializada]), '2026-09-10');
  assert.deepEqual([...vencidos, ...proximos].map(e => e.tipo), ['giro'], 'en Pagos VEP solo queda el giro');

  const recibida = base({ estado: 'recibido' });
  assert.equal(byTipo(recibida, 'vep').pagado, true, 'recibida sigue implicando VEP pagado');
}

// ── Giros en euros unificados a USD al pase declarado ───────────────────────
{
  const enEuros = base({ giroMonto: 1000, giroMoneda: 'EUR', paseEurUsd: 1.08 });
  const giro = byTipo(enEuros, 'giro');
  assert.equal(giro.moneda, 'USD', 'giro en EUR se muestra en USD');
  assert.equal(giro.monto, 1080, 'monto convertido al pase');
  assert.equal(giro.montoOriginal, 1000, 'conserva el monto original');
  assert.equal(giro.monedaOriginal, 'EUR', 'conserva la moneda original');
  assert.equal(giro.paseEurUsd, 1.08, 'conserva el pase usado');

  const enUSD = base({ id: 'imp2', giroMonto: 500, giroMoneda: 'USD', paseEurUsd: 1.08 });
  assert.equal(byTipo(enUSD, 'giro').montoOriginal, undefined, 'giro en USD no se toca aunque haya pase');

  const eventos = buildEventos([enEuros, enUSD]);
  assert.equal(totalPendiente(eventos, 'giro', 'USD'), 1580, 'el KPI de giros suma todo en USD');
  assert.equal(totalPendiente(eventos, 'giro', 'EUR'), 0, 'no queda nada en EUR');
}

// ── Sin pase declarado no se convierte ──────────────────────────────────────
{
  const sinPase = base({ giroMonto: 1000, giroMoneda: 'EUR', paseEurUsd: null });
  const giro = byTipo(sinPase, 'giro');
  assert.equal(giro.moneda, 'EUR', 'sin pase queda en EUR');
  assert.equal(giro.monto, 1000);
  assert.equal(giro.montoOriginal, undefined);
  assert.equal(totalPendiente(buildEventos([sinPase]), 'giro', 'EUR'), 1000, 'y suma en el aparte de EUR');
}

// ── Vistas semanal / quincenal / mensual y filtro por tipo (2026-09-17) ──
{
  assert.deepEqual(periodoDe('2026-09-17', 'mensual'), { key: '2026-09', label: 'septiembre 2026' });
  assert.equal(periodoDe('2026-09-15', 'quincenal').key, '2026-09-Q1', 'día 15 = primera quincena');
  assert.equal(periodoDe('2026-09-16', 'quincenal').key, '2026-09-Q2', 'día 16 = segunda quincena');
  assert.equal(periodoDe('2026-09-17', 'semanal').key, '2026-09-14', 'jueves 17 → lunes 14');
  assert.equal(periodoDe('2026-09-20', 'semanal').key, '2026-09-14', 'domingo 20 → misma semana');
  assert.equal(periodoDe('2026-09-21', 'semanal').key, '2026-09-21', 'lunes 21 → semana nueva');
  assert.equal(periodoDe('2026-09-17', 'semanal').label, 'semana del 14-sep al 20-sep 2026');
  const ev = (id: string, fecha: string, tipo: EventoFlujo['tipo'], monto: number | null): EventoFlujo =>
    ({ id, fecha, tipo, impId: 'i', ocNumero: 'OC', proveedor: 'P', monto, moneda: monto == null ? null : 'USD', pagado: false });
  const evs = [ev('a', '2026-09-14', 'vep', 10), ev('b', '2026-09-20', 'giro', 20), ev('c', '2026-09-21', 'giro', 30), ev('d', '2026-09-22', 'arribo', null)];
  assert.deepEqual(groupByPeriodo(evs, 'semanal').map(p => [p.mes, p.eventos.length]), [['2026-09-14', 2], ['2026-09-21', 2]]);
  assert.deepEqual(groupByPeriodo(evs, 'mensual').map(p => p.eventos.length), [4]);
  assert.deepEqual(filtrarEventosPorTipo(evs, 'giro').map(e => e.id), ['b', 'c'], 'solo giros (sin arribos)');
  assert.deepEqual(filtrarEventosPorTipo(evs, 'vep').map(e => e.id), ['a']);
  assert.equal(filtrarEventosPorTipo(evs, '').length, 4, 'todo');
}

console.log('✓ flujoFondos: oficializada saca VEP/arribo de pendientes; giros EUR unificados a USD al pase; vistas semanal/quincenal/mensual y filtro por tipo');
