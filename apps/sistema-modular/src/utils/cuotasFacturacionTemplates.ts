/**
 * Quick-template builders for Phase 12 esquema de facturación.
 * Split from cuotasFacturacion.ts to respect the 250-line component budget.
 *
 * See: apps/sistema-modular/src/utils/cuotasFacturacion.ts
 * See: 12-CONTEXT.md — UI: Quick-templates
 * See: 12-RESEARCH.md — Code Examples
 */

import type { PresupuestoCuotaFacturacion, MonedaCuota } from '@ags/shared';

/** Reuse the exact fallback from presupuestosService.ts:1343-1345. */
function newCuotaId(): string {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Builds a uniform porcentajePorMoneda record where all active monedas have `val`. */
function mkPorcUniform(
  monedasActivas: MonedaCuota[],
  val: number,
): Partial<Record<MonedaCuota, number>> {
  return Object.fromEntries(monedasActivas.map(m => [m, val])) as Partial<Record<MonedaCuota, number>>;
}

/**
 * Template: 100% al cierre.
 * 1 cuota with hito `todas_ots_cerradas` at 100% for each active moneda.
 * Functionally equivalent to Tier-1 mode (BILL-05 — 100% al cierre as equivalence test).
 */
export function buildTemplate100AlCierre(
  monedasActivas: MonedaCuota[],
): PresupuestoCuotaFacturacion[] {
  return [{
    id: newCuotaId(),
    numero: 1,
    porcentajePorMoneda: mkPorcUniform(monedasActivas, 100),
    descripcion: '100% al cierre',
    hito: 'todas_ots_cerradas',
    estado: 'pendiente',
    solicitudFacturacionId: null,
    montoFacturadoPorMoneda: null,
  }];
}

/**
 * Template: 30% anticipo + 70% saldo.
 * Cuota 1: 30% at hito `ppto_aceptado`.
 * Cuota 2: 70% at hito `todas_ots_cerradas`.
 */
export function buildTemplate30_70(
  monedasActivas: MonedaCuota[],
): PresupuestoCuotaFacturacion[] {
  return [
    {
      id: newCuotaId(),
      numero: 1,
      porcentajePorMoneda: mkPorcUniform(monedasActivas, 30),
      descripcion: 'Anticipo 30%',
      hito: 'ppto_aceptado',
      estado: 'pendiente',
      solicitudFacturacionId: null,
      montoFacturadoPorMoneda: null,
    },
    {
      id: newCuotaId(),
      numero: 2,
      porcentajePorMoneda: mkPorcUniform(monedasActivas, 70),
      descripcion: 'Saldo contra entrega',
      hito: 'todas_ots_cerradas',
      estado: 'pendiente',
      solicitudFacturacionId: null,
      montoFacturadoPorMoneda: null,
    },
  ];
}

/**
 * Template: 50% anticipo + 50% saldo.
 * Cuota 1: 50% at hito `ppto_aceptado`.
 * Cuota 2: 50% at hito `todas_ots_cerradas`.
 * Reemplaza al viejo 70/30 pre-embarque (UAT 2026-07-16: los anticipos que se
 * piden son 30% o 50% — el 70/30 no se usaba). El hito `pre_embarque` sigue
 * disponible para cuotas armadas a mano.
 */
export function buildTemplate50_50(
  monedasActivas: MonedaCuota[],
): PresupuestoCuotaFacturacion[] {
  return [
    {
      id: newCuotaId(),
      numero: 1,
      porcentajePorMoneda: mkPorcUniform(monedasActivas, 50),
      descripcion: 'Anticipo 50%',
      hito: 'ppto_aceptado',
      estado: 'pendiente',
      solicitudFacturacionId: null,
      montoFacturadoPorMoneda: null,
    },
    {
      id: newCuotaId(),
      numero: 2,
      porcentajePorMoneda: mkPorcUniform(monedasActivas, 50),
      descripcion: 'Saldo contra entrega',
      hito: 'todas_ots_cerradas',
      estado: 'pendiente',
      solicitudFacturacionId: null,
      montoFacturadoPorMoneda: null,
    },
  ];
}

/**
 * Template: facturación MENSUAL de contrato (circuito C).
 * `meses` cuotas (default 12), hito `manual` (siempre habilitada — la cola gatea por
 * mes), cada una con `fechaPrevista` = inicio + i meses y descripción "Cuota i/meses".
 * Los porcentajes se reparten por igual (2 decimales) y el remanente cae en la última
 * cuota para que sumen exactamente 100 (validateEsquemaSum).
 */
export function buildTemplateMensual(
  monedasActivas: MonedaCuota[],
  fechaInicioISO: string,
  meses = 12,
): PresupuestoCuotaFacturacion[] {
  const inicio = new Date(fechaInicioISO);
  const pctBase = Math.floor((100 / meses) * 100) / 100; // 2 decimales, floor
  const cuotas: PresupuestoCuotaFacturacion[] = [];
  let acumulado = 0;
  for (let i = 0; i < meses; i++) {
    const pct = i === meses - 1 ? Math.round((100 - acumulado) * 100) / 100 : pctBase;
    acumulado += pct;
    const fecha = new Date(inicio);
    fecha.setMonth(fecha.getMonth() + i);
    cuotas.push({
      id: newCuotaId(),
      numero: i + 1,
      porcentajePorMoneda: mkPorcUniform(monedasActivas, pct),
      descripcion: `Cuota ${i + 1}/${meses}`,
      hito: 'manual',
      estado: 'pendiente',
      solicitudFacturacionId: null,
      montoFacturadoPorMoneda: null,
      fechaPrevista: fecha.toISOString(),
    });
  }
  return cuotas;
}
