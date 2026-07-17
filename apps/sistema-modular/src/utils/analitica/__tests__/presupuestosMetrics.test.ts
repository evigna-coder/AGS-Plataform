/**
 * Unit tests — analítica de presupuestos (funciones puras).
 *
 * Run with: pnpm --filter @ags/sistema-modular test:analitica
 *   (tsx src/utils/analitica/__tests__/presupuestosMetrics.test.ts)
 *
 * Uses node:assert/strict — no framework needed (mismo patrón que
 * cuotasFacturacion.test.ts). Fixtures inline vía factories.
 */

import assert from 'node:assert/strict';
import type { PresupuestoItem } from '@ags/shared';
import {
  montoPresupuesto,
  formatMonto,
  mediana,
  enRango,
  aplicarFiltros,
  computePeriodo,
  computeSerieMensual,
  computeAgingEnviados,
  computeOCAdeudada,
  getFechaCierreOT,
  type PresupuestoMetricas,
  type OTMetricas,
} from '../presupuestosMetrics.js';

// ── Factories ─────────────────────────────────────────────────────────────────

const NOW = new Date('2026-07-17T12:00:00.000Z');

function ppto(over: Partial<PresupuestoMetricas> & { id: string }): PresupuestoMetricas {
  return {
    numero: over.id,
    estado: 'enviado',
    tipo: 'servicio',
    moneda: 'USD',
    total: 100,
    items: [],
    clienteId: 'C1',
    responsableId: null,
    responsableNombre: null,
    fechaEnvio: undefined,
    fechaAceptacion: null,
    ordenesCompraIds: [],
    otsVinculadasNumbers: null,
    anuladoPorId: null,
    validUntil: undefined,
    validezDias: 15,
    ...over,
  };
}

function ot(over: Partial<OTMetricas> & { otNumber: string }): OTMetricas {
  return {
    budgets: [],
    estadoAdmin: 'CIERRE_TECNICO',
    estadoHistorial: undefined,
    estadoAdminFecha: undefined,
    fechaCierre: undefined,
    cierreAdmin: undefined,
    ...over,
  };
}

// ── montoPresupuesto / formatMonto ───────────────────────────────────────────

console.log('[M-01 monto-mono]');
{
  const m = montoPresupuesto(ppto({ id: 'PRE-0001.01', moneda: 'ARS', total: 5000 }));
  assert.deepEqual(m, { ARS: 5000 }, 'M-01: ppto mono-moneda aporta total a su moneda');
  console.log('  ✓ M-01 monto-mono passed');
}

console.log('[M-02 monto-MIXTA-desglosado]');
{
  const items = [
    { moneda: 'USD', precioUnitario: 100, cantidad: 2 },
    { moneda: 'ARS', precioUnitario: 500, cantidad: 1 },
  ] as PresupuestoItem[];
  const m = montoPresupuesto(ppto({ id: 'PRE-0002.01', moneda: 'MIXTA', total: 999999, items }));
  assert.deepEqual(m, { USD: 200, ARS: 500 }, 'M-02: MIXTA se desglosa por items, nunca suma monedas');
  console.log('  ✓ M-02 monto-MIXTA-desglosado passed');
}

console.log('[M-03 formatMonto]');
{
  assert.equal(formatMonto({ USD: 1200, ARS: 500 }), 'U$S 1.200 · $ 500');
  assert.equal(formatMonto({}), '—');
  console.log('  ✓ M-03 formatMonto passed');
}

// ── mediana / enRango ────────────────────────────────────────────────────────

console.log('[M-04 mediana]');
{
  assert.equal(mediana([]), null);
  assert.equal(mediana([2, 30, 10]), 10, 'impar → valor central');
  assert.equal(mediana([2, 10, 20, 30]), 15, 'par → promedio de centrales');
  console.log('  ✓ M-04 mediana passed');
}

console.log('[M-05 enRango]');
{
  assert.equal(enRango('2026-07-10T15:30:00.000Z', { desde: '2026-07-01', hasta: '2026-07-31' }), true);
  assert.equal(enRango('2026-06-30', { desde: '2026-07-01' }), false);
  assert.equal(enRango('2020-01-01', {}), true, 'rango vacío = histórico completo');
  assert.equal(enRango(undefined, {}), false, 'sin fecha nunca entra en rango');
  console.log('  ✓ M-05 enRango passed');
}

// ── aplicarFiltros ───────────────────────────────────────────────────────────

console.log('[M-06 aplicarFiltros]');
{
  const lista = [
    ppto({ id: 'A', clienteId: 'C1', tipo: 'servicio', responsableId: 'U1' }),
    ppto({ id: 'B', clienteId: 'C2', tipo: 'contrato', responsableId: 'U2' }),
  ];
  assert.deepEqual(aplicarFiltros(lista, { clienteId: 'C2' }).map(p => p.id), ['B']);
  assert.deepEqual(aplicarFiltros(lista, { tipo: 'servicio' }).map(p => p.id), ['A']);
  assert.deepEqual(aplicarFiltros(lista, { responsableId: 'U1' }).map(p => p.id), ['A']);
  assert.deepEqual(aplicarFiltros(lista, {}).map(p => p.id), ['A', 'B']);
  console.log('  ✓ M-06 aplicarFiltros passed');
}

// ── computePeriodo ───────────────────────────────────────────────────────────

console.log('[M-07 periodo-enviados-aceptados]');
{
  const rango = { desde: '2026-07-01', hasta: '2026-07-31' };
  const lista = [
    // Enviado en rango, sigue enviado
    ppto({ id: 'P1', estado: 'enviado', fechaEnvio: '2026-07-05', total: 100 }),
    // Enviado en rango Y aceptado en rango, hoy en ejecución (cuenta en ambos)
    ppto({ id: 'P2', estado: 'en_ejecucion', fechaEnvio: '2026-07-01', fechaAceptacion: '2026-07-11', total: 200 }),
    // Enviado FUERA de rango, aceptado en rango (aprobado por fechaAceptacion — decisión #1)
    ppto({ id: 'P3', estado: 'aceptado', fechaEnvio: '2026-06-10', fechaAceptacion: '2026-07-10', total: 300 }),
    // Anulado con fechaEnvio en rango: cuenta como enviado (actividad comercial real)
    ppto({ id: 'P4', estado: 'anulado', fechaEnvio: '2026-07-08', anuladoPorId: 'P5', total: 50 }),
    // Pipeline activo SIN fechaEnvio → badge de higiene, fuera del conteo
    ppto({ id: 'P6', estado: 'aceptado', fechaEnvio: undefined, total: 999 }),
    // Aceptación con fecha negativa vs envío (datos sucios) → muestra descartada, ppto cuenta
    ppto({ id: 'P7', estado: 'aceptado', fechaEnvio: '2026-07-20', fechaAceptacion: '2026-07-15', total: 80 }),
    // Fuera de rango por completo
    ppto({ id: 'P8', estado: 'enviado', fechaEnvio: '2026-05-01', total: 1000 }),
  ];
  const r = computePeriodo(lista, rango);
  assert.equal(r.enviados.count, 4, 'M-07: enviados = P1,P2,P4,P7');
  assert.deepEqual(r.enviados.monto, { USD: 430 });
  assert.equal(r.aceptados.count, 3, 'M-07: aceptados = P2,P3,P7 (por fechaAceptacion)');
  assert.deepEqual(r.aceptados.monto, { USD: 580 });
  assert.equal(r.sinFechaEnvio, 1, 'M-07: P6 sin fechaEnvio en pipeline activo');
  // P6 es aceptado sin fechaAceptacion → higiene
  assert.equal(r.sinFechaAceptacion, 1, 'M-07: P6 aceptado sin fechaAceptacion');
  // Tiempos: P2 = 10d, P3 = 30d; P7 descartado (negativo)
  assert.equal(r.tiempoAprobacion.muestras, 2);
  assert.equal(r.tiempoAprobacion.mediana, 20);
  assert.equal(r.tiempoAprobacion.promedio, 20);
  assert.equal(r.conversion, 3 / 4);
  console.log('  ✓ M-07 periodo-enviados-aceptados passed');
}

// ── computeSerieMensual ──────────────────────────────────────────────────────

console.log('[M-08 serie-mensual-gap-fill]');
{
  const lista = [
    ppto({ id: 'S1', fechaEnvio: '2026-04-10' }),
    ppto({ id: 'S2', fechaEnvio: '2026-04-20', fechaAceptacion: '2026-06-05' }),
    ppto({ id: 'S3', fechaEnvio: '2026-06-01' }),
  ];
  const serie = computeSerieMensual(lista, {});
  assert.deepEqual(serie.map(s => s.mes), ['2026-04', '2026-05', '2026-06'], 'meses continuos con gap-fill');
  assert.deepEqual(serie.map(s => s.enviados), [2, 0, 1]);
  assert.deepEqual(serie.map(s => s.aceptados), [0, 0, 1]);
  assert.deepEqual(computeSerieMensual([], {}), [], 'sin datos → serie vacía');
  console.log('  ✓ M-08 serie-mensual-gap-fill passed');
}

// ── computeAgingEnviados ─────────────────────────────────────────────────────

console.log('[M-09 aging-enviados]');
{
  const lista = [
    ppto({ id: 'A1', estado: 'enviado', fechaEnvio: '2026-07-12', total: 100 }),            // 5d → 0-7
    ppto({ id: 'A2', estado: 'enviado', fechaEnvio: '2026-06-27', total: 200 }),            // 20d → 16-30
    ppto({ id: 'A3', estado: 'enviado', fechaEnvio: '2026-03-01', total: 300, moneda: 'ARS' }), // +60
    ppto({ id: 'A4', estado: 'aceptado', fechaEnvio: '2026-07-01' }),  // no está en 'enviado' → afuera
    ppto({ id: 'A5', estado: 'enviado', fechaEnvio: undefined }),      // sin fecha → afuera
    ppto({ id: 'A6', estado: 'anulado', fechaEnvio: '2026-07-01' }),   // anulado → afuera
  ];
  const r = computeAgingEnviados(lista, NOW);
  assert.deepEqual(r.rows.map(x => x.presupuesto.id), ['A3', 'A2', 'A1'], 'ordenado por días desc');
  assert.equal(r.rows[2].dias, 5);
  assert.equal(r.totalCount, 3);
  assert.deepEqual(r.totalMonto, { USD: 300, ARS: 300 });
  const byKey = Object.fromEntries(r.buckets.map(b => [b.key, b.count]));
  assert.deepEqual(byKey, { '0-7': 1, '8-15': 0, '16-30': 1, '31-60': 0, '+60': 1 });
  // Vencimiento: A1 enviado 2026-07-12 + 15d validez → vence 2026-07-27 (≈10d)
  assert.ok((r.rows[2].diasHastaVencer ?? 0) > 0, 'A1 todavía no vencido');
  assert.ok((r.rows[0].diasHastaVencer ?? 0) < 0, 'A3 vencido hace rato');
  console.log('  ✓ M-09 aging-enviados passed');
}

// ── getFechaCierreOT (cadena de fallbacks) ───────────────────────────────────

console.log('[M-10 fecha-cierre-fallbacks]');
{
  const conHistorial = ot({
    otNumber: '30001',
    estadoHistorial: [
      { estado: 'EN_CURSO', fecha: '2026-06-01' },
      { estado: 'CIERRE_TECNICO', fecha: '2026-06-10' },
      { estado: 'CIERRE_TECNICO', fecha: '2026-06-20' }, // re-cierre: gana el primero
    ],
    estadoAdminFecha: '2026-07-01',
  });
  assert.equal(getFechaCierreOT(conHistorial), '2026-06-10', 'historial CIERRE_TECNICO manda');
  const sinHistorial = ot({ otNumber: '30002', estadoAdminFecha: '2026-06-15' });
  assert.equal(getFechaCierreOT(sinHistorial), '2026-06-15', 'fallback estadoAdminFecha');
  const soloFechaCierre = ot({ otNumber: '30003', fechaCierre: '2026-06-01' });
  assert.equal(getFechaCierreOT(soloFechaCierre), '2026-06-01', 'fallback fechaCierre');
  assert.equal(getFechaCierreOT(ot({ otNumber: '30004' })), null, 'sin ninguna fecha → null');
  console.log('  ✓ M-10 fecha-cierre-fallbacks passed');
}

// ── computeOCAdeudada ────────────────────────────────────────────────────────

console.log('[M-11 oc-adeudada-join]');
{
  const pptos = [
    // Caso base: aceptado sin OC, OT cerrada por budgets
    ppto({ id: 'O1', numero: 'PRE-0100.01', estado: 'aceptado', total: 100 }),
    // Decisión #3: pendiente_facturacion sin OC también entra
    ppto({ id: 'O2', numero: 'PRE-0200.01', estado: 'pendiente_facturacion', total: 200 }),
    // Con OC cargada → afuera
    ppto({ id: 'O3', numero: 'PRE-0300.01', estado: 'aceptado', ordenesCompraIds: ['oc1'] }),
    // Anulado (por revisión) → afuera aunque tenga OT cerrada
    ppto({ id: 'O4', numero: 'PRE-0400.01', estado: 'anulado', anuladoPorId: 'O5' }),
    // Rescate por otsVinculadasNumbers (budgets mal cargado en la OT)
    ppto({ id: 'O5', numero: 'PRE-0500.01', estado: 'en_ejecucion', otsVinculadasNumbers: ['30020'], total: 500 }),
    // Sin OT cerrada (solo EN_CURSO) → afuera
    ppto({ id: 'O6', numero: 'PRE-0600.01', estado: 'aceptado' }),
  ];
  const ots = [
    ot({ otNumber: '30010', budgets: ['PRE-0100.01'], estadoAdmin: 'CIERRE_TECNICO',
      estadoHistorial: [{ estado: 'CIERRE_TECNICO', fecha: '2026-07-07' }] }),                 // 10d
    // Multi-OT para O2: gana la fecha MÁS ANTIGUA (2026-05-18 → 60d)
    ot({ otNumber: '30011', budgets: ['PRE-0200.01'], estadoAdmin: 'FINALIZADO',
      estadoHistorial: [{ estado: 'CIERRE_TECNICO', fecha: '2026-05-18' }] }),
    ot({ otNumber: '30012', budgets: ['PRE-0200.01'], estadoAdmin: 'CIERRE_ADMINISTRATIVO',
      estadoHistorial: [{ estado: 'CIERRE_TECNICO', fecha: '2026-07-01' }] }),
    ot({ otNumber: '30013', budgets: ['PRE-0300.01', 'PRE-0400.01'], estadoAdmin: 'CIERRE_TECNICO',
      estadoAdminFecha: '2026-07-01' }),
    ot({ otNumber: '30020', budgets: [], estadoAdmin: 'CIERRE_TECNICO', estadoAdminFecha: '2026-07-12' }), // 5d, rescate O5
    ot({ otNumber: '30030', budgets: ['PRE-0600.01'], estadoAdmin: 'EN_CURSO' }),
  ];
  const r = computeOCAdeudada(pptos, ots, NOW);
  assert.deepEqual(r.rows.map(x => x.presupuesto.id), ['O2', 'O1', 'O5'], 'ordenado por días de deuda desc');

  const o2 = r.rows[0];
  assert.deepEqual(o2.otsCerradas, ['30011', '30012'], 'contratos multi-OT: lista todas las cerradas');
  assert.equal(o2.fechaPrimerCierre, '2026-05-18', 'fecha del PRIMER cierre técnico');
  assert.equal(o2.dias, 60);

  assert.equal(r.rows[1].dias, 10);
  assert.equal(r.rows[2].dias, 5, 'rescate por otsVinculadasNumbers con fallback estadoAdminFecha');

  assert.equal(r.totalCount, 3);
  assert.deepEqual(r.totalMonto, { USD: 800 });
  const byKey = Object.fromEntries(r.buckets.map(b => [b.key, b.count]));
  assert.deepEqual(byKey, { '0-7': 1, '8-15': 1, '16-30': 0, '31-60': 1, '+60': 0 });
  console.log('  ✓ M-11 oc-adeudada-join passed');
}

console.log('\n✅ All presupuestosMetrics tests passed');
