import type { SolicitudFacturacion, Cliente } from '@ags/shared';
import { SOLICITUD_FACTURACION_ESTADO_LABELS } from '@ags/shared';
import { fmtDateShort, type ExportColumn } from '../exportToExcel';
import { filtrosAplicadosDesc } from './filtros';

/**
 * Export de Solicitudes de Facturación (Excel + PDF vía ExportarButton).
 * Las filas son las `SolicitudFacturacion` YA filtradas de FacturacionList.
 */

// 10 columnas per CONTEXT FMT-06 — mismas que el export previo a la unificación.
export const SOLICITUDES_FACTURACION_EXPORT_COLUMNS: ExportColumn<SolicitudFacturacion>[] = [
  { header: 'Numero OT',          width: 12, get: s => (s.otNumbers || [])[0] || '—' },
  { header: 'Ppto',               width: 14, get: s => s.presupuestoNumero },
  { header: 'Cliente',            width: 26, get: s => s.clienteNombre },
  { header: 'Total',              width: 12, get: s => s.montoTotal, align: 'right' },
  { header: 'Moneda',             width: 8,  get: s => s.moneda },
  { header: 'Fecha cierre admin', width: 16, get: s => fmtDateShort(s.createdAt) },
  { header: 'Estado',             width: 12, get: s => SOLICITUD_FACTURACION_ESTADO_LABELS[s.estado] || s.estado },
  { header: 'Facturada por',      width: 18, get: s => s.facturadoPorNombre || '—' },
  { header: 'Fecha facturacion',  width: 16, get: s => fmtDateShort(s.fechaFactura ?? null) },
  { header: 'Nota',               width: 30, get: s => s.observaciones || '' },
];

/** Línea "Filtros: …" del export — refleja los filtros activos de FacturacionList. */
export function buildSolicitudesFiltrosExport(
  f: { search: string; cliente: string; estado: string; fechaDesde: string; fechaHasta: string },
  clientes: Cliente[],
): string[] {
  return filtrosAplicadosDesc({
    Cliente: clientes.find(c => c.id === f.cliente)?.razonSocial,
    Estado: f.estado
      ? (SOLICITUD_FACTURACION_ESTADO_LABELS[f.estado as keyof typeof SOLICITUD_FACTURACION_ESTADO_LABELS] ?? f.estado)
      : '',
    Desde: f.fechaDesde,
    Hasta: f.fechaHasta,
    'Búsqueda': f.search ? `'${f.search}'` : '',
  });
}
