import type { Presupuesto, PresupuestoCuotaFacturacion, MonedaCuota, MonedaPresupuesto } from '@ags/shared';
import { computeTotalsByCurrency } from '../cuotasFacturacion';
import { fmtDateShort, type ExportColumn } from '../exportToExcel';

/**
 * Export de Cuotas por Facturar (Excel + PDF vía ExportarButton).
 * Las filas se arman desde las mismas `filas` (ppto + cuota) que renderizan
 * las cards; el monto estimado replica el cálculo %cuota × total por moneda.
 */
export interface CuotaPorFacturarExportRow {
  clienteNombre: string;
  pptoNumero: string;
  cuotaDescripcion: string;
  fechaPrevista: string | null;
  /** Ej. "USD 1.200 + ARS 500.000" — mismo formato que la card. */
  montoEstimado: string;
}

function montoEstimado(cuota: PresupuestoCuotaFacturacion, ppto: Presupuesto): string {
  const totals = computeTotalsByCurrency(ppto.items ?? [], ppto.moneda as MonedaPresupuesto);
  const parts = Object.entries(cuota.porcentajePorMoneda ?? {})
    .filter(([, p]) => (p ?? 0) > 0)
    .map(([m, p]) => {
      const monto = Math.round(((p as number) / 100) * (totals[m as MonedaCuota] ?? 0));
      return `${m} ${monto.toLocaleString('es-AR')}`;
    });
  return parts.join(' + ') || '—';
}

export function buildCuotasPorFacturarRows(
  filas: { ppto: Presupuesto; cuota: PresupuestoCuotaFacturacion }[],
  nombreById: Map<string, string>,
): CuotaPorFacturarExportRow[] {
  return filas.map(({ ppto, cuota }) => ({
    clienteNombre: nombreById.get(ppto.clienteId) || ppto.clienteId,
    pptoNumero: ppto.numero,
    cuotaDescripcion: cuota.descripcion,
    fechaPrevista: cuota.fechaPrevista ?? null,
    montoEstimado: montoEstimado(cuota, ppto),
  }));
}

export const CUOTAS_POR_FACTURAR_EXPORT_COLUMNS: ExportColumn<CuotaPorFacturarExportRow>[] = [
  { header: 'Cliente',         width: 28, get: r => r.clienteNombre },
  { header: 'Presupuesto',     width: 14, get: r => r.pptoNumero },
  { header: 'Cuota',           width: 30, get: r => r.cuotaDescripcion },
  { header: 'Vence',           width: 10, get: r => fmtDateShort(r.fechaPrevista) },
  { header: 'Monto estimado',  width: 24, get: r => r.montoEstimado, align: 'right' },
];
