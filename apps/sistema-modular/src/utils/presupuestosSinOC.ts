import type { Presupuesto, WorkOrder } from '@ags/shared';
import { OC_ADEUDADA_ESTADOS, computeOCAdeudada } from './analitica/presupuestosMetrics';
import { tieneOCAdjunta } from './cuotasFacturacion';
import { diasDesde } from './formatFecha';

/**
 * Seguimiento de la OC del cliente (2026-09-18): presupuestos aprobados a los
 * que todavía les falta la orden de compra, con o sin trabajo hecho.
 *
 * "Sin OC" = aprobado (pendiente_oc / aceptado / en_ejecucion /
 * pendiente_facturacion) sin el PAPEL de la OC (adjunto del presupuesto o OC
 * formal vinculada) y sin respaldo por certificación. El número tipeado a mano
 * NO alcanza (2026-09-22, caso P1-005084-01: con el número cargado y sin
 * archivo no figuraba pendiente en ningún lado). Es la misma regla del filtro
 * `ocPendiente` de la lista, del cierre semanal y de la analítica
 * (`computeOCAdeudada`), para que card, lista, cierre y export coincidan.
 *
 * Por presupuesto se informa desde cuándo está aprobado (`fechaAceptacion`,
 * null en los aceptados antes de julio) y, si ya tiene OT cerrada, desde
 * cuándo se hizo el trabajo (primer cierre técnico).
 */
export interface SinOCInfo {
  fechaAceptacion: string | null;
  /** true = sin fecha de aprobación registrada; se toma la fecha de envío como aproximación. */
  fechaAceptacionAprox: boolean;
  /** Días desde la aprobación; null si el presupuesto no tiene fecha de aceptación. */
  diasSinOC: number | null;
  otsCerradas: string[];
  fechaPrimerCierre: string | null;
  /** Días desde el primer cierre técnico; null sin OT cerrada con fecha. */
  diasDesdeCierre: number | null;
}

export function esPresupuestoSinOC(p: Pick<Presupuesto, 'estado' | 'respaldoFacturacion' | 'ordenesCompraIds' | 'ordenCompraNumero' | 'adjuntos'>): boolean {
  if (!OC_ADEUDADA_ESTADOS.has(p.estado)) return false;
  if (p.respaldoFacturacion === 'certificacion') return false;
  return !tieneOCAdjunta(p);
}

export function computeSinOC(presupuestos: Presupuesto[], ots: WorkOrder[], now = new Date()): Map<string, SinOCInfo> {
  const conTrabajo = new Map(computeOCAdeudada(presupuestos, ots, now).rows.map(r => [r.presupuesto.id, r]));
  const out = new Map<string, SinOCInfo>();
  for (const p of presupuestos) {
    if (!esPresupuestoSinOC(p)) continue;
    // Aceptados antes de que se guardara la fecha (o por el desplegable hasta
    // 2026-09-18): la fecha de envío es la mejor aproximación disponible.
    const fechaAceptacion = p.fechaAceptacion ?? p.fechaEnvio ?? null;
    const t = conTrabajo.get(p.id);
    out.set(p.id, {
      fechaAceptacion,
      fechaAceptacionAprox: !p.fechaAceptacion && !!p.fechaEnvio,
      diasSinOC: diasDesde(fechaAceptacion),
      otsCerradas: t?.otsCerradas ?? [],
      fechaPrimerCierre: t?.fechaPrimerCierre ?? null,
      diasDesdeCierre: t?.dias ?? null,
    });
  }
  return out;
}

/** Color del contador de días: verde hasta 15, ámbar hasta 30, rojo después. */
export function colorDiasSinOC(dias: number | null): string {
  if (dias == null) return 'text-slate-400';
  if (dias > 30) return 'text-red-600';
  if (dias > 15) return 'text-amber-600';
  return 'text-slate-600';
}
