// Run with: pnpm --filter @ags/sistema-modular test:presupuesto-comex
// Contrastado contra la planilla del user (2026-10-01): mismos números al centavo.
import assert from 'node:assert/strict';
import type { GastoComex, PosicionComex } from '@ags/shared';
import { calcularPresupuestoComex } from '../presupuestoComex.js';

const cerca = (real: number, esperado: number, nombre: string) =>
  assert.ok(Math.abs(real - esperado) < 0.01, `${nombre}: ${real.toFixed(2)} — esperaba ${esperado.toFixed(2)}`);

const pos = (o: Partial<PosicionComex>): PosicionComex => ({
  id: crypto.randomUUID(), descripcion: '', cif: 0, derechosPct: 0, estadisticaPct: 0,
  ivaReducido: false, gananciasPct: 6, iibbPct: 3.6, ...o,
});
const gastos: GastoComex[] = [
  { id: 'a', concepto: 'Seguro internacional y local', monto: 0 },
  { id: 'b', concepto: 'Despachante', monto: 600 },
  { id: 'c', concepto: 'Depósito fiscal', monto: 800 },
  { id: 'd', concepto: 'Gastos de descarga y traslado', monto: 400 },
  { id: 'e', concepto: 'Agente de carga', monto: 500 },
];

// ── Hoja 1: el generador entero en una sola posición (IVA reducido, 0 % derechos) ──
{
  const r = calcularPresupuestoComex({
    posiciones: [pos({ descripcion: 'Generador', cif: 89326.7, ivaReducido: true })],
    gastos, gastosBancarios: 550, costoFinancieroPct: 3,
  });
  const p = r.posiciones[0];
  cerca(p.baseImponible, 89326.7, 'BI');
  cerca(p.iva, 9379.30, 'IVA 10,5 %');
  cerca(p.ivaAdicional, 8932.67, 'IVA adicional 10 %');
  cerca(p.ganancias, 5359.60, 'Ganancias 6 %');
  cerca(p.iibb, 3215.76, 'IIBB 3,6 %');
  cerca(p.totalGravamenes, 26887.34, 'total gravámenes');
  cerca(r.totalGastos, 2300, 'gastos');
  cerca(r.noRecuperable, 6065.76, 'DI + IIBB + gastos + bancarios');
  cerca(r.costoFinanciero, 710.15, 'costo financiero 3 %');
  cerca(r.costoTotal, 96102.61, 'costo total');
}

// ── Hoja 2: con el SCD declarado aparte (dos posiciones) ──
{
  const r = calcularPresupuestoComex({
    posiciones: [
      pos({ descripcion: 'Cromatógrafo GC', cif: 52902.9, ivaReducido: true }),
      pos({ descripcion: 'Detector SCD', cif: 36423.8, derechosPct: 12.6 }),
    ],
    gastos, gastosBancarios: 550, costoFinancieroPct: 3,
  });
  const [gc, scd] = r.posiciones;
  cerca(gc.iva, 5554.80, 'GC IVA'); cerca(gc.ivaAdicional, 5290.29, 'GC IVA adic.');
  cerca(gc.ganancias, 3174.17, 'GC Gs'); cerca(gc.iibb, 1904.50, 'GC IIBB');
  cerca(gc.totalGravamenes, 15923.77, 'GC total gravámenes');
  cerca(scd.derechos, 4589.40, 'SCD derechos 12,6 %');
  cerca(scd.baseImponible, 41013.2, 'SCD BI');
  cerca(scd.iva, 8612.77, 'SCD IVA 21 %'); cerca(scd.ivaAdicional, 8202.64, 'SCD IVA adic. 20 %');
  cerca(scd.ganancias, 2460.79, 'SCD Gs'); cerca(scd.iibb, 1476.48, 'SCD IIBB');
  cerca(scd.totalGravamenes, 25342.08, 'SCD total gravámenes');
  cerca(r.valorCif, 89326.7, 'valor');
  cerca(r.noRecuperable, 10820.38, 'DI + IIBB + gastos + bancarios');
  cerca(r.costoFinanciero, 998.86, 'costo financiero');
  cerca(r.costoTotal, 101145.94, 'costo total');
}

// Bancarios como renglón de gastos (2026-10-01): mismo resultado que el campo aparte.
{
  const r = calcularPresupuestoComex({
    posiciones: [pos({ descripcion: 'Generador', cif: 89326.7, ivaReducido: true })],
    gastos: [...gastos, { id: 'f', concepto: 'Gastos bancarios', monto: 550 }], gastosBancarios: 0, costoFinancieroPct: 3,
  });
  cerca(r.costoTotal, 96102.61, 'costo total con bancarios en la lista');
}

console.log('✅ presupuestoComex: OK (las dos hojas de la planilla)');
