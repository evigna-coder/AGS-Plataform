import type { Importacion } from '@ags/shared';

export type EventoTipo = 'vep' | 'giro' | 'arribo';

export interface EventoFlujo {
  id: string;
  fecha: string;            // ISO (YYYY-MM-DD)
  tipo: EventoTipo;
  impId: string;
  impNumero: string;
  proveedor: string;
  monto: number | null;     // null para arribos
  moneda: string | null;
  pagado: boolean;          // VEP/giro ya cumplido (heurística por estado)
}

export const TIPO_LABEL: Record<EventoTipo, string> = { vep: 'VEP', giro: 'Giro', arribo: 'Arribo' };
export const TIPO_COLOR: Record<EventoTipo, string> = {
  vep: 'bg-amber-100 text-amber-700',
  giro: 'bg-teal-100 text-teal-700',
  arribo: 'bg-sky-100 text-sky-700',
};

const RECIBIDO = new Set(['recibido', 'cancelado']);

/** Aplana las importaciones en eventos de flujo de fondos (VEP, giro, arribo). */
export function buildEventos(importaciones: Importacion[]): EventoFlujo[] {
  const eventos: EventoFlujo[] = [];
  for (const imp of importaciones) {
    const base = { impId: imp.id, impNumero: imp.numero, proveedor: imp.proveedorNombre || '—' };
    const cumplido = RECIBIDO.has(imp.estado);
    if (imp.vepFechaPago) {
      eventos.push({ id: `${imp.id}-vep`, fecha: imp.vepFechaPago.slice(0, 10), tipo: 'vep', monto: imp.vepMonto ?? null, moneda: imp.vepMoneda ?? 'ARS', pagado: cumplido, ...base });
    }
    if (imp.giroFechaEstimada) {
      eventos.push({ id: `${imp.id}-giro`, fecha: imp.giroFechaEstimada.slice(0, 10), tipo: 'giro', monto: imp.giroMonto ?? null, moneda: imp.giroMoneda ?? 'USD', pagado: cumplido, ...base });
    }
    if (imp.fechaEstimadaArribo) {
      eventos.push({ id: `${imp.id}-arr`, fecha: imp.fechaEstimadaArribo.slice(0, 10), tipo: 'arribo', monto: null, moneda: null, pagado: cumplido, ...base });
    }
  }
  return eventos.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Suma de montos pendientes por moneda para un tipo, dentro de los próximos `dias`. */
export function totalPendiente(eventos: EventoFlujo[], tipo: EventoTipo, moneda: string, dias?: number): number {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const limite = dias != null ? new Date(hoy.getTime() + dias * 86400000) : null;
  return eventos
    .filter(e => e.tipo === tipo && !e.pagado && e.moneda === moneda && e.monto != null)
    .filter(e => {
      const f = new Date(e.fecha);
      if (f < hoy) return false;
      if (limite && f > limite) return false;
      return true;
    })
    .reduce((s, e) => s + (e.monto || 0), 0);
}

/** Próximo evento pendiente (VEP o giro) desde hoy. */
export function proximoPago(eventos: EventoFlujo[]): EventoFlujo | null {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  return eventos.find(e => (e.tipo === 'vep' || e.tipo === 'giro') && !e.pagado && new Date(e.fecha) >= hoy) ?? null;
}
