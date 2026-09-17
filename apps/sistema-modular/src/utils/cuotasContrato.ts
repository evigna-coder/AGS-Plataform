import type { Presupuesto, PresupuestoCuota, SolicitudFacturacion } from '@ags/shared';
import { presupuestoEstaAceptado } from '@ags/shared';

/**
 * Cuotas mensuales de CONTRATO (2026-09-16, caso TEVA P5-005179-01).
 *
 * Los presupuestos de contrato no usan el esquema porcentual (`esquemaFacturacion`):
 * llevan `cuotas[]` (número, moneda, monto) y `contratoFechaInicio`. Ese modelo no
 * tiene estado ni fecha por cuota, así que acá se DERIVAN:
 *  - la fecha: cuota N se factura el mes N-1 después del inicio del contrato
 *    (el aviso sale el primer día hábil de ese mes);
 *  - el estado: por las solicitudes de facturación que llevan `cuotaNumero` +
 *    `cuotaMoneda`. Sin solicitud viva → por facturar (o futura).
 * En un contrato mixto cada moneda es una cuota aparte: un aviso por moneda.
 * Una cuota facturada por fuera del sistema es una solicitud `facturada` con
 * `facturadaExterna` (ver facturacionService.registrarFacturadaExterna).
 */

export type EstadoCuotaContrato = 'futura' | 'por_facturar' | 'solicitada' | 'facturada' | 'cobrada';

export interface CuotaContratoRow {
  ppto: Presupuesto;
  cuota: PresupuestoCuota;
  /** Primer día del mes en que corresponde facturarla (YYYY-MM-01). */
  fecha: string;
  estado: EstadoCuotaContrato;
  solicitud: SolicitudFacturacion | null;
}

/** Mes de la cuota N: inicio del contrato + (N-1) meses, al día 1. */
export function fechaCuotaContrato(fechaInicio: string, numero: number): string {
  const [y, m] = fechaInicio.slice(0, 10).split('-').map(Number);
  const total = (m - 1) + (Math.max(1, numero) - 1);
  const yy = y + Math.floor(total / 12);
  const mm = (total % 12) + 1;
  return `${yy}-${String(mm).padStart(2, '0')}-01`;
}

/** Último día del mes de una fecha YYYY-MM(-DD), en ISO corto. */
export function finDeMes(ym: string): string {
  const [y, m] = ym.slice(0, 7).split('-').map(Number);
  const d = new Date(y, m, 0);
  return `${y}-${String(m).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Solicitud viva (no anulada) de una cuota, si la hay. */
export function solicitudDeCuota(
  solicitudes: SolicitudFacturacion[],
  numero: number,
  moneda: string,
): SolicitudFacturacion | null {
  return solicitudes.find(s => s.cuotaNumero === numero && s.cuotaMoneda === moneda && s.estado !== 'anulada') ?? null;
}

export function estadoCuotaContrato(
  fecha: string,
  solicitud: SolicitudFacturacion | null,
  hasta: string,
): EstadoCuotaContrato {
  if (solicitud) {
    if (solicitud.estado === 'cobrada') return 'cobrada';
    if (solicitud.estado === 'facturada') return 'facturada';
    return 'solicitada';
  }
  return fecha <= hasta ? 'por_facturar' : 'futura';
}

/** ¿Es un contrato en vigencia con cuotas armadas? */
export function esContratoConCuotas(p: Presupuesto): boolean {
  return p.tipo === 'contrato' && !!p.contratoFechaInicio && (p.cuotas?.length ?? 0) > 0 && presupuestoEstaAceptado(p.estado);
}

/** Todas las cuotas de un contrato con fecha y estado derivados, ordenadas por fecha, número y moneda. */
export function cuotasDeContrato(
  ppto: Presupuesto,
  solicitudes: SolicitudFacturacion[],
  hasta: string,
): CuotaContratoRow[] {
  if (!esContratoConCuotas(ppto)) return [];
  const rows = (ppto.cuotas ?? []).map(cuota => {
    const fecha = fechaCuotaContrato(ppto.contratoFechaInicio as string, cuota.numero);
    const solicitud = solicitudDeCuota(solicitudes, cuota.numero, cuota.moneda);
    return { ppto, cuota, fecha, estado: estadoCuotaContrato(fecha, solicitud, hasta), solicitud };
  });
  rows.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.cuota.numero - b.cuota.numero || a.cuota.moneda.localeCompare(b.cuota.moneda));
  return rows;
}

/** Cuotas de contrato que corresponde facturar hasta `hasta` y aún no tienen aviso. */
export function cuotasContratoPorFacturar(
  pptos: Presupuesto[],
  solicitudesPorPpto: Map<string, SolicitudFacturacion[]>,
  hasta: string,
): CuotaContratoRow[] {
  const out: CuotaContratoRow[] = [];
  for (const p of pptos) {
    for (const r of cuotasDeContrato(p, solicitudesPorPpto.get(p.id) ?? [], hasta)) {
      if (r.estado === 'por_facturar') out.push(r);
    }
  }
  out.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.ppto.numero.localeCompare(b.ppto.numero) || a.cuota.numero - b.cuota.numero);
  return out;
}

/** Primer día hábil del mes (lunes a viernes, sin feriados), YYYY-MM-DD. */
export function primerDiaHabil(anio: number, mes: number, feriados: Set<string>): string {
  for (let dia = 1; dia <= 31; dia++) {
    const d = new Date(anio, mes - 1, dia);
    if (d.getMonth() !== mes - 1) break;
    const iso = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    const dow = d.getDay();
    if (dow === 0 || dow === 6 || feriados.has(iso)) continue;
    return iso;
  }
  return `${anio}-${String(mes).padStart(2, '0')}-01`;
}

/** ¿Hoy es el primer día hábil del mes o uno posterior? */
export function esDesdePrimerDiaHabil(hoy: string, feriados: Set<string>): boolean {
  const [y, m] = hoy.slice(0, 10).split('-').map(Number);
  return hoy.slice(0, 10) >= primerDiaHabil(y, m, feriados);
}

/** Fecha local de hoy en YYYY-MM-DD (sin el corrimiento UTC de toISOString). */
export function hoyLocalISO(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
