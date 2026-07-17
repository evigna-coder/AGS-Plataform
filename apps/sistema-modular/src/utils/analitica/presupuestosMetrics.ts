/**
 * Analítica de presupuestos — agregación PURA (sin Firestore, sin React).
 *
 * Todas las funciones reciben datos ya cargados y un `now` explícito (testeable).
 * Regla de montos (invariante del plan): todo monto se reporta POR MONEDA
 * (`MontoPorMoneda`), nunca se suman monedas entre sí. Pptos `MIXTA` se
 * desglosan con `computeTotalsByCurrency` (utils/cuotasFacturacion, testeada).
 *
 * Tests: src/utils/analitica/__tests__/presupuestosMetrics.test.ts
 * Run:   pnpm --filter @ags/sistema-modular test:analitica
 */

import type { Presupuesto, WorkOrder, MonedaCuota } from '@ags/shared';
import { computeTotalsByCurrency } from '../cuotasFacturacion';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type MontoPorMoneda = Partial<Record<MonedaCuota, number>>;

/** Subconjunto de Presupuesto que usa la analítica (fixtures chicos en tests). */
export type PresupuestoMetricas = Pick<
  Presupuesto,
  | 'id' | 'numero' | 'estado' | 'tipo' | 'moneda' | 'total' | 'items' | 'clienteId'
  | 'responsableId' | 'responsableNombre' | 'fechaEnvio' | 'fechaAceptacion'
  | 'ordenesCompraIds' | 'otsVinculadasNumbers' | 'anuladoPorId'
  | 'validUntil' | 'validezDias'
>;

/** Subconjunto de WorkOrder que usa el join de OC adeudada. */
export type OTMetricas = Pick<
  WorkOrder,
  'otNumber' | 'budgets' | 'estadoAdmin' | 'estadoHistorial' | 'estadoAdminFecha' | 'fechaCierre' | 'cierreAdmin'
>;

/** Rango [desde, hasta] en 'YYYY-MM-DD'. Vacío/undefined = sin límite (histórico). */
export interface RangoFechas { desde?: string; hasta?: string }

export interface FiltrosAnalitica { clienteId?: string; tipo?: string; responsableId?: string }

export interface ResumenPeriodo {
  enviados: { count: number; monto: MontoPorMoneda };
  aceptados: { count: number; monto: MontoPorMoneda };
  /** aceptados-en-rango ÷ enviados-en-rango. null si no hay enviados. Puede superar 1. */
  conversion: number | null;
  /** Días envío→aceptación (solo aceptados en rango con ambas fechas, no-negativos). */
  tiempoAprobacion: { mediana: number | null; promedio: number | null; muestras: number };
  /** Higiene: pptos en pipeline activo sin fechaEnvio (fuera del conteo por período). */
  sinFechaEnvio: number;
  /** Higiene: pptos aceptados o posteriores sin fechaAceptacion (legacy pre-Phase16). */
  sinFechaAceptacion: number;
}

export interface SerieMensualPunto {
  mes: string;    // 'YYYY-MM'
  label: string;  // 'jul 26'
  enviados: number;
  aceptados: number;
}

export interface BucketAging { key: string; label: string; count: number; monto: MontoPorMoneda }

export interface AgingEnviadoRow {
  presupuesto: PresupuestoMetricas;
  dias: number;
  /** Días hasta el vencimiento de la validez (negativo = vencido). null si no computable. */
  diasHastaVencer: number | null;
  monto: MontoPorMoneda;
}

export interface OCAdeudadaRow {
  presupuesto: PresupuestoMetricas;
  otsCerradas: string[];
  fechaPrimerCierre: string | null;
  /** Días desde el primer cierre técnico. null si ninguna OT cerrada tiene fecha. */
  dias: number | null;
  monto: MontoPorMoneda;
}

export interface AgingResult<Row> {
  rows: Row[];
  buckets: BucketAging[];
  totalCount: number;
  totalMonto: MontoPorMoneda;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const DIA_MS = 86_400_000;
const MONEDAS: MonedaCuota[] = ['USD', 'ARS', 'EUR'];
const SIMBOLO: Record<MonedaCuota, string> = { USD: 'U$S', ARS: '$', EUR: '€' };

/** Estados con "pipeline activo" — deberían tener fechaEnvio cargada. */
const PIPELINE_ACTIVO = new Set(['enviado', 'aceptado', 'en_ejecucion', 'pendiente_facturacion']);

/** Decisión Esteban 2026-07-17 (#3): OC adeudada incluye en_ejecucion y pendiente_facturacion. */
export const OC_ADEUDADA_ESTADOS = new Set(['aceptado', 'en_ejecucion', 'pendiente_facturacion']);

/** OT con servicio realizado: cierre técnico o posterior. */
const OT_CERRADA = new Set(['CIERRE_TECNICO', 'CIERRE_ADMINISTRATIVO', 'FINALIZADO']);

export const AGING_BUCKETS = [
  { key: '0-7', label: '0–7d', min: 0, max: 7 },
  { key: '8-15', label: '8–15d', min: 8, max: 15 },
  { key: '16-30', label: '16–30d', min: 16, max: 30 },
  { key: '31-60', label: '31–60d', min: 31, max: 60 },
  { key: '+60', label: '+60d', min: 61, max: Infinity },
] as const;

// ── Helpers de monto ──────────────────────────────────────────────────────────

/** Monto de un ppto desglosado por moneda. MIXTA se abre por items; el resto aporta `total`. */
export function montoPresupuesto(p: Pick<PresupuestoMetricas, 'items' | 'moneda' | 'total'>): MontoPorMoneda {
  if (p.moneda === 'MIXTA') return computeTotalsByCurrency(p.items, p.moneda);
  return { [p.moneda as MonedaCuota]: p.total || 0 };
}

/** Acumula `add` sobre `acc` (muta y devuelve acc). */
export function acumularMonto(acc: MontoPorMoneda, add: MontoPorMoneda): MontoPorMoneda {
  for (const m of MONEDAS) {
    const v = add[m];
    if (v) acc[m] = (acc[m] ?? 0) + v;
  }
  return acc;
}

/** 'U$S 1.200 · $ 500.000'. '—' si todo cero. */
export function formatMonto(monto: MontoPorMoneda): string {
  const parts = MONEDAS
    .filter(m => (monto[m] ?? 0) > 0)
    .map(m => `${SIMBOLO[m]} ${(monto[m] as number).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`);
  return parts.length > 0 ? parts.join(' · ') : '—';
}

// ── Helpers de fecha ──────────────────────────────────────────────────────────

/** Compara por día calendario ('YYYY-MM-DD'); acepta ISO completo o date-only. */
export function enRango(fechaIso: string | null | undefined, rango: RangoFechas): boolean {
  if (!fechaIso) return false;
  const d = fechaIso.slice(0, 10);
  if (rango.desde && d < rango.desde) return false;
  if (rango.hasta && d > rango.hasta) return false;
  return true;
}

function diasDesde(fechaIso: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(fechaIso).getTime()) / DIA_MS);
}

export function mediana(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// ── Filtros cliente/tipo/responsable ─────────────────────────────────────────

export function aplicarFiltros<P extends PresupuestoMetricas>(pptos: P[], f: FiltrosAnalitica): P[] {
  return pptos.filter(p =>
    (!f.clienteId || p.clienteId === f.clienteId) &&
    (!f.tipo || (p.tipo || 'servicio') === f.tipo) &&
    (!f.responsableId || p.responsableId === f.responsableId),
  );
}

// ── 1.1 + 1.2: Enviados / aprobados del período ──────────────────────────────

export function computePeriodo(pptos: PresupuestoMetricas[], rango: RangoFechas): ResumenPeriodo {
  const enviados = { count: 0, monto: {} as MontoPorMoneda };
  const aceptados = { count: 0, monto: {} as MontoPorMoneda };
  const tiempos: number[] = [];
  let sinFechaEnvio = 0;
  let sinFechaAceptacion = 0;

  for (const p of pptos) {
    // Enviados: por fechaEnvio en rango, sin importar estado actual (anulados incluidos:
    // fueron actividad comercial real en ese período).
    if (enRango(p.fechaEnvio, rango)) {
      enviados.count++;
      acumularMonto(enviados.monto, montoPresupuesto(p));
    } else if (!p.fechaEnvio && PIPELINE_ACTIVO.has(p.estado)) {
      sinFechaEnvio++;
    }

    // Aprobados: por fechaAceptacion en rango, sin importar estado actual (puede estar
    // ya en en_ejecucion / pendiente_facturacion / finalizado). NUNCA updatedAt.
    if (p.estado !== 'anulado' || p.fechaAceptacion) {
      if (enRango(p.fechaAceptacion, rango)) {
        aceptados.count++;
        acumularMonto(aceptados.monto, montoPresupuesto(p));
        if (p.fechaEnvio) {
          const dias = Math.round(
            (new Date(p.fechaAceptacion as string).getTime() - new Date(p.fechaEnvio).getTime()) / DIA_MS,
          );
          if (dias >= 0) tiempos.push(dias); // negativos = datos sucios, descartar
        }
      } else if (!p.fechaAceptacion && p.estado !== 'enviado' && p.estado !== 'borrador' && p.estado !== 'anulado') {
        sinFechaAceptacion++;
      }
    }
  }

  const promedio = tiempos.length > 0
    ? Math.round((tiempos.reduce((a, b) => a + b, 0) / tiempos.length) * 10) / 10
    : null;

  return {
    enviados,
    aceptados,
    conversion: enviados.count > 0 ? aceptados.count / enviados.count : null,
    tiempoAprobacion: { mediana: mediana(tiempos), promedio, muestras: tiempos.length },
    sinFechaEnvio,
    sinFechaAceptacion,
  };
}

// ── Gráfico: serie mensual enviados vs aceptados ─────────────────────────────

export function computeSerieMensual(pptos: PresupuestoMetricas[], rango: RangoFechas): SerieMensualPunto[] {
  const env = new Map<string, number>();
  const ace = new Map<string, number>();
  for (const p of pptos) {
    if (enRango(p.fechaEnvio, rango)) {
      const m = (p.fechaEnvio as string).slice(0, 7);
      env.set(m, (env.get(m) ?? 0) + 1);
    }
    if (enRango(p.fechaAceptacion, rango)) {
      const m = (p.fechaAceptacion as string).slice(0, 7);
      ace.set(m, (ace.get(m) ?? 0) + 1);
    }
  }

  const keys = [...new Set([...env.keys(), ...ace.keys()])].sort();
  if (keys.length === 0) return [];
  // Eje continuo: del primer al último mes con datos, acotado por el rango si está seteado.
  const first = rango.desde ? rango.desde.slice(0, 7) : keys[0];
  const last = rango.hasta ? rango.hasta.slice(0, 7) : keys[keys.length - 1];

  const out: SerieMensualPunto[] = [];
  let [y, m] = first.split('-').map(Number);
  const [ly, lm] = last.split('-').map(Number);
  while (y < ly || (y === ly && m <= lm)) {
    const mes = `${y}-${String(m).padStart(2, '0')}`;
    out.push({
      mes,
      label: new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
      enviados: env.get(mes) ?? 0,
      aceptados: ace.get(mes) ?? 0,
    });
    m++;
    if (m > 12) { m = 1; y++; }
    if (out.length >= 120) break; // guard: eje de más de 10 años no tiene sentido visual
  }
  return out;
}

// ── Buckets compartidos (1.3 y 1.4) ──────────────────────────────────────────

function buildBuckets(rows: Array<{ dias: number | null; monto: MontoPorMoneda }>): BucketAging[] {
  return AGING_BUCKETS.map(b => {
    const enBucket = rows.filter(r => {
      if (r.dias === null) return false;
      const d = Math.max(0, r.dias);
      return d >= b.min && d <= b.max;
    });
    const monto: MontoPorMoneda = {};
    enBucket.forEach(r => acumularMonto(monto, r.monto));
    return { key: b.key, label: b.label, count: enBucket.length, monto };
  });
}

// ── 1.3 Aging de enviados abiertos (snapshot, ignora el rango) ───────────────

export function computeAgingEnviados(pptos: PresupuestoMetricas[], now: Date): AgingResult<AgingEnviadoRow> {
  const rows: AgingEnviadoRow[] = pptos
    .filter(p => p.estado === 'enviado' && !!p.fechaEnvio)
    .map(p => {
      let diasHastaVencer: number | null = null;
      const target = p.validUntil
        ? new Date(p.validUntil + (p.validUntil.includes('T') ? '' : 'T23:59:59'))
        : (p.fechaEnvio && p.validezDias
          ? new Date(new Date(p.fechaEnvio).getTime() + p.validezDias * DIA_MS)
          : null);
      if (target) diasHastaVencer = Math.ceil((target.getTime() - now.getTime()) / DIA_MS);
      return {
        presupuesto: p,
        dias: diasDesde(p.fechaEnvio as string, now),
        diasHastaVencer,
        monto: montoPresupuesto(p),
      };
    })
    .sort((a, b) => b.dias - a.dias);

  const totalMonto: MontoPorMoneda = {};
  rows.forEach(r => acumularMonto(totalMonto, r.monto));
  return { rows, buckets: buildBuckets(rows), totalCount: rows.length, totalMonto };
}

// ── 1.4 OC adeudada con servicio realizado (snapshot, ignora el rango) ───────

/** Fecha de cierre de una OT: primer CIERRE_TECNICO del historial → fallbacks. */
export function getFechaCierreOT(ot: OTMetricas): string | null {
  const hist = ot.estadoHistorial?.find(h => h.estado === 'CIERRE_TECNICO')?.fecha;
  return hist ?? ot.cierreAdmin?.fechaCierreAdmin ?? ot.estadoAdminFecha ?? ot.fechaCierre ?? null;
}

export function computeOCAdeudada(
  pptos: PresupuestoMetricas[],
  ots: OTMetricas[],
  now: Date,
): AgingResult<OCAdeudadaRow> {
  const rows: OCAdeudadaRow[] = [];

  for (const p of pptos) {
    // Candidatos: sin OC del cliente, estado aceptado o posterior, no anulados.
    // (anulado por revisión ⇒ estado 'anulado' ⇒ queda afuera por el mismo check).
    if (!OC_ADEUDADA_ESTADOS.has(p.estado)) continue;
    if ((p.ordenesCompraIds || []).length > 0) continue;

    // Servicio realizado: OT cerrada con budgets conteniendo el número del ppto,
    // o rescate por otsVinculadasNumbers (budgets mal cargado en la OT).
    const vinculadas = new Set(p.otsVinculadasNumbers ?? []);
    const cerradas = ots.filter(ot =>
      !!ot.estadoAdmin && OT_CERRADA.has(ot.estadoAdmin) &&
      ((ot.budgets ?? []).includes(p.numero) || vinculadas.has(ot.otNumber)),
    );
    if (cerradas.length === 0) continue;

    // Días de deuda: desde la fecha de cierre técnico MÁS ANTIGUA (desde ese día
    // AGS ya trabajó y el cliente todavía no mandó la OC).
    const fechas = cerradas.map(getFechaCierreOT).filter((f): f is string => !!f).sort();
    const fechaPrimerCierre = fechas[0] ?? null;
    rows.push({
      presupuesto: p,
      otsCerradas: cerradas.map(o => o.otNumber).sort(),
      fechaPrimerCierre,
      dias: fechaPrimerCierre ? diasDesde(fechaPrimerCierre, now) : null,
      monto: montoPresupuesto(p),
    });
  }

  rows.sort((a, b) => (b.dias ?? -1) - (a.dias ?? -1));
  const totalMonto: MontoPorMoneda = {};
  rows.forEach(r => acumularMonto(totalMonto, r.monto));
  return { rows, buckets: buildBuckets(rows), totalCount: rows.length, totalMonto };
}
