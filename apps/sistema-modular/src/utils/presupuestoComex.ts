import type { GastoComex, PosicionComex, PresupuestoComex } from '@ags/shared';

/**
 * Motor del presupuestador de comex (2026-10-01). Reproduce la planilla con la
 * que el user estimaba importaciones (test: los dos casos de su Excel, al
 * centavo).
 *
 * Por posición:
 *   base imponible = CIF + derechos + estadística
 *   IVA            = base × (10,5 % con reducción | 21 %)
 *   IVA adicional  = base × (10 % con reducción | 20 %)
 *   Ganancias      = base × gananciasPct   (6 % habitual)
 *   IIBB           = base × iibbPct        (3,6 % habitual)
 * Total:
 *   costo financiero = costoFinancieroPct × (IVA + IVA adicional + Ganancias)
 *   costo total      = CIF + derechos + estadística + IIBB + gastos + gastos bancarios + costo financiero
 * IVA, IVA adicional y Ganancias son crédito/anticipo: se pagan en el VEP pero
 * no son costo; solo su costo financiero lo es.
 */

export const IVA_PCT = { reducido: 10.5, general: 21 } as const;
export const IVA_ADICIONAL_PCT = { reducido: 10, general: 20 } as const;

export const GASTOS_DEFAULT: Array<Omit<GastoComex, 'id'>> = [
  { concepto: 'Seguro internacional y local', monto: 0 },
  { concepto: 'Despachante', monto: 600 },
  { concepto: 'Depósito fiscal', monto: 800 },
  { concepto: 'Gastos de descarga y traslado', monto: 400 },
  { concepto: 'Agente de carga', monto: 500 },
  // Varía entre 160 y 550 según la operación: se carga a mano (2026-10-01).
  { concepto: 'Gastos bancarios', monto: 0 },
];

export function posicionVacia(): PosicionComex {
  return {
    id: crypto.randomUUID(), descripcion: '', ncm: null, cif: 0,
    derechosPct: 0, estadisticaPct: 0, ivaReducido: false, gananciasPct: 6, iibbPct: 3.6,
  };
}

export interface ResultadoPosicion {
  id: string;
  descripcion: string;
  ncm: string | null;
  cif: number;
  derechos: number;
  estadistica: number;
  baseImponible: number;
  ivaPct: number;
  iva: number;
  ivaAdicionalPct: number;
  ivaAdicional: number;
  ganancias: number;
  iibb: number;
  /** Todo lo que se paga en aduana por esta posición (VEP). */
  totalGravamenes: number;
}

export interface ResultadoComex {
  posiciones: ResultadoPosicion[];
  valorCif: number;
  derechos: number;
  estadistica: number;
  iva: number;
  ivaAdicional: number;
  ganancias: number;
  iibb: number;
  totalGravamenes: number;
  totalGastos: number;
  gastosBancarios: number;
  /** Derechos + estadística + IIBB + gastos + gastos bancarios (lo no recuperable, sin el financiero). */
  noRecuperable: number;
  costoFinanciero: number;
  costoTotal: number;
  /** Costo total ÷ valor CIF. */
  factor: number;
  /** Erogación: CIF + gravámenes + gastos + bancarios (lo que sale de caja). */
  erogacion: number;
}

const pct = (v: number | null | undefined) => (Number.isFinite(v) ? (v as number) : 0) / 100;
const num = (v: number | null | undefined) => (Number.isFinite(v) ? (v as number) : 0);

export function calcularPresupuestoComex(
  p: Pick<PresupuestoComex, 'posiciones' | 'gastos' | 'gastosBancarios' | 'costoFinancieroPct'>,
): ResultadoComex {
  const posiciones: ResultadoPosicion[] = p.posiciones.map(pos => {
    const cif = num(pos.cif);
    const derechos = cif * pct(pos.derechosPct);
    const estadistica = cif * pct(pos.estadisticaPct);
    const baseImponible = cif + derechos + estadistica;
    const ivaPct = pos.ivaReducido ? IVA_PCT.reducido : IVA_PCT.general;
    const ivaAdicionalPct = pos.ivaReducido ? IVA_ADICIONAL_PCT.reducido : IVA_ADICIONAL_PCT.general;
    const iva = baseImponible * ivaPct / 100;
    const ivaAdicional = baseImponible * ivaAdicionalPct / 100;
    const ganancias = baseImponible * pct(pos.gananciasPct);
    const iibb = baseImponible * pct(pos.iibbPct);
    return {
      id: pos.id, descripcion: pos.descripcion, ncm: pos.ncm ?? null, cif, derechos, estadistica, baseImponible,
      ivaPct, iva, ivaAdicionalPct, ivaAdicional, ganancias, iibb,
      totalGravamenes: derechos + estadistica + iva + ivaAdicional + ganancias + iibb,
    };
  });
  const sum = (sel: (r: ResultadoPosicion) => number) => posiciones.reduce((a, r) => a + sel(r), 0);
  const valorCif = sum(r => r.cif);
  const derechos = sum(r => r.derechos);
  const estadistica = sum(r => r.estadistica);
  const iva = sum(r => r.iva);
  const ivaAdicional = sum(r => r.ivaAdicional);
  const ganancias = sum(r => r.ganancias);
  const iibb = sum(r => r.iibb);
  const totalGravamenes = sum(r => r.totalGravamenes);
  const totalGastos = p.gastos.reduce((a, g) => a + num(g.monto), 0);
  const gastosBancarios = num(p.gastosBancarios);
  const noRecuperable = derechos + estadistica + iibb + totalGastos + gastosBancarios;
  const costoFinanciero = (iva + ivaAdicional + ganancias) * pct(p.costoFinancieroPct);
  const costoTotal = valorCif + noRecuperable + costoFinanciero;
  return {
    posiciones, valorCif, derechos, estadistica, iva, ivaAdicional, ganancias, iibb, totalGravamenes,
    totalGastos, gastosBancarios, noRecuperable, costoFinanciero, costoTotal,
    factor: valorCif > 0 ? costoTotal / valorCif : 0,
    erogacion: valorCif + totalGravamenes + totalGastos + gastosBancarios,
  };
}

export const usd = (n: number) => `USD ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
