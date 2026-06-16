import type { Importacion } from '../types';

/**
 * Flujo de fondos de comercio exterior (VEP, giro al exterior, arribo).
 * Lógica pura compartida entre `sistema-modular` (carga + consulta) y
 * `portal-ingeniero` (consulta mobile, perfil tesorería).
 */

export type EventoTipo = 'vep' | 'giro' | 'arribo';

export interface EventoFlujo {
  id: string;
  fecha: string;            // ISO (YYYY-MM-DD)
  tipo: EventoTipo;
  impId: string;
  ocNumero: string;         // identificador visible = número de OC (no el IMP interno)
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
    const base = { impId: imp.id, ocNumero: imp.ordenCompraNumero || imp.numero, proveedor: imp.proveedorNombre || '—' };
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

// --- Agrupación mes a mes (vista de flujo de fondos del director) ---

export interface SubtotalMoneda {
  tipo: EventoTipo;
  moneda: string;
  monto: number;
}

export interface MesFlujo {
  mes: string;                  // 'YYYY-MM'
  label: string;               // 'junio 2026'
  eventos: EventoFlujo[];
  subtotales: SubtotalMoneda[]; // pendientes por tipo+moneda dentro del mes (sin arribos)
}

const MES_NOMBRES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** 'YYYY-MM' → 'junio 2026'. */
export function mesLabel(mes: string): string {
  const [y, m] = mes.split('-').map(Number);
  const nombre = MES_NOMBRES[(m || 1) - 1] ?? mes;
  return `${nombre} ${y}`;
}

/**
 * Agrupa los eventos por mes calendario (YYYY-MM), ordenado ascendente.
 * Cada mes incluye sus eventos y los subtotales pendientes por tipo+moneda
 * (VEP/giro; los arribos no tienen monto).
 */
export function groupByMes(eventos: EventoFlujo[]): MesFlujo[] {
  const map = new Map<string, EventoFlujo[]>();
  for (const e of eventos) {
    const mes = e.fecha.slice(0, 7);
    const arr = map.get(mes);
    if (arr) arr.push(e); else map.set(mes, [e]);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([mes, evs]) => {
      const subMap = new Map<string, SubtotalMoneda>();
      for (const e of evs) {
        if (e.monto == null || !e.moneda || e.pagado) continue;
        const key = `${e.tipo}-${e.moneda}`;
        const cur = subMap.get(key) ?? { tipo: e.tipo, moneda: e.moneda, monto: 0 };
        cur.monto += e.monto;
        subMap.set(key, cur);
      }
      const subtotales = [...subMap.values()].sort((a, b) =>
        a.tipo === b.tipo ? a.moneda.localeCompare(b.moneda) : a.tipo.localeCompare(b.tipo));
      return { mes, label: mesLabel(mes), eventos: evs, subtotales };
    });
}
