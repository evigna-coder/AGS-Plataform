import type { Presupuesto, SolicitudFacturacion, WorkOrder } from '@ags/shared';
import { otsDelPresupuesto } from '../otsDelPresupuesto';
import { montoPresupuesto } from './presupuestosMetrics';

export type MontoPorMonedaRec = Record<string, number>;

const ACEPTADO_FAM = new Set(['pendiente_oc', 'aceptado', 'en_ejecucion', 'pendiente_facturacion']);
const OT_CERRADA = new Set(['CIERRE_TECNICO', 'CIERRE_ADMINISTRATIVO', 'FINALIZADO']);

export interface ACertificar {
  /** Presupuestos con trabajo hecho esperando el papel del cliente. */
  presupuestos: Presupuesto[];
  ids: Set<string>;
  /** Cuántas OTs cerradas están retenidas por certificación. */
  otsRetenidas: number;
  /** Plata trabada esperando certificación, por moneda. */
  monto: MontoPorMonedaRec;
}

type OTMin = Pick<WorkOrder, 'otNumber' | 'budgets' | 'estadoAdmin' | 'retenidaFacturacion' | 'requisitoFacturacionPendiente' | 'certificacionId'>;

/**
 * "A certificar" (2026-09-08): presupuestos aceptados con al menos una OT
 * cerrada y RETENIDA por certificación. Es trabajo hecho que todavía no es
 * crédito: el cliente puede objetarlo. Por eso va en su propia card y no
 * mezclado con lo facturado.
 *
 * Monto: el del presupuesto, PROPORCIONAL a las OTs retenidas sobre el total
 * de OTs del presupuesto (un presupuesto por 5 visitas con 2 esperando papel
 * aporta 2/5). Con una sola OT, el total. Nunca se suman monedas entre sí.
 */
export function computeACertificar(presupuestos: Presupuesto[], ots: OTMin[]): ACertificar {
  const porNumero = new Map(ots.map(o => [o.otNumber, o]));
  const out: Presupuesto[] = [];
  const monto: MontoPorMonedaRec = {};
  let otsRetenidas = 0;
  for (const p of presupuestos) {
    if (!ACEPTADO_FAM.has(p.estado)) continue;
    const numeros = [...otsDelPresupuesto(p, ots as WorkOrder[])];
    if (numeros.length === 0) continue;
    const retenidas = numeros.filter(n => {
      const ot = porNumero.get(n);
      return !!ot && OT_CERRADA.has(ot.estadoAdmin ?? '') && !!ot.retenidaFacturacion
        && ot.requisitoFacturacionPendiente === 'certificacion';
    });
    if (retenidas.length === 0) continue;
    out.push(p);
    otsRetenidas += retenidas.length;
    const factor = retenidas.length / numeros.length;
    for (const [m, v] of Object.entries(montoPresupuesto(p))) {
      if (!v) continue;
      monto[m] = (monto[m] ?? 0) + v * factor;
    }
  }
  return { presupuestos: out, ids: new Set(out.map(p => p.id)), otsRetenidas, monto };
}

/**
 * "Certificadas sin aviso" (2026-09-08): el papel del cliente YA llegó (la OT
 * quedó liberada con `certificacionId`) pero todavía nadie pasó el aviso a
 * facturación. Entre "A certificar" y "A facturar" quedaba un hueco: esa
 * plata no aparecía en ninguna card.
 *
 * Una OT se considera avisada si alguna solicitud no anulada del presupuesto
 * la nombra en `otNumbers`, o si el presupuesto tiene una solicitud sin
 * detalle de OTs (aviso total).
 */
export function computeCertificadasSinAviso(
  presupuestos: Presupuesto[],
  ots: OTMin[],
  solicitudes: Pick<SolicitudFacturacion, 'presupuestoId' | 'estado' | 'otNumbers'>[],
): ACertificar {
  const porNumero = new Map(ots.map(o => [o.otNumber, o]));
  const avisadasPorPpto = new Map<string, Set<string> | 'todas'>();
  for (const sol of solicitudes) {
    if (sol.estado === 'anulada') continue;
    const prev = avisadasPorPpto.get(sol.presupuestoId);
    if (prev === 'todas') continue;
    if (!sol.otNumbers?.length) { avisadasPorPpto.set(sol.presupuestoId, 'todas'); continue; }
    const set = prev ?? new Set<string>();
    sol.otNumbers.forEach(n => set.add(n));
    avisadasPorPpto.set(sol.presupuestoId, set);
  }
  const out: Presupuesto[] = [];
  const monto: MontoPorMonedaRec = {};
  let otsRetenidas = 0;
  for (const p of presupuestos) {
    if (!ACEPTADO_FAM.has(p.estado)) continue;
    const numeros = [...otsDelPresupuesto(p, ots as WorkOrder[])];
    if (numeros.length === 0) continue;
    const avisadas = avisadasPorPpto.get(p.id);
    if (avisadas === 'todas') continue;
    const sinAviso = numeros.filter(n => {
      const ot = porNumero.get(n);
      return !!ot && OT_CERRADA.has(ot.estadoAdmin ?? '') && !!ot.certificacionId
        && !ot.retenidaFacturacion && !(avisadas?.has(n));
    });
    if (sinAviso.length === 0) continue;
    out.push(p);
    otsRetenidas += sinAviso.length;
    const factor = sinAviso.length / numeros.length;
    for (const [m, v] of Object.entries(montoPresupuesto(p))) {
      if (!v) continue;
      monto[m] = (monto[m] ?? 0) + v * factor;
    }
  }
  return { presupuestos: out, ids: new Set(out.map(p => p.id)), otsRetenidas, monto };
}

/**
 * "Por cobrar" (2026-09-08): todo lo que se hizo y todavía no entró, por
 * moneda — a certificar + certificado sin aviso + a facturar (avisos sin
 * factura) + facturado sin cobrar. Es el número que se lee de un vistazo.
 */
export function computePorCobrar(
  aCertificar: MontoPorMonedaRec,
  solicitudesPendientes: Pick<SolicitudFacturacion, 'moneda' | 'montoTotal'>[],
  facturadasSinCobrar: Pick<SolicitudFacturacion, 'moneda' | 'montoTotal'>[],
  certificadasSinAviso: MontoPorMonedaRec = {},
): MontoPorMonedaRec {
  const out: MontoPorMonedaRec = { ...aCertificar };
  for (const [m, v] of Object.entries(certificadasSinAviso)) out[m] = (out[m] ?? 0) + v;
  for (const s of [...solicitudesPendientes, ...facturadasSinCobrar]) {
    const m = s.moneda || 'USD';
    out[m] = (out[m] ?? 0) + (s.montoTotal || 0);
  }
  return out;
}
