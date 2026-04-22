import type { VentasInsumosReportRow, VentasInsumosRangeLabel } from './ventasInsumosReport';
import { fmtDateShort } from './ventasInsumosReport';
import { exportToExcel, type ExportColumn } from './exportToExcel';

/**
 * Exporta el reporte de ventas insumos a .xlsx.
 *
 * BREAK VISUAL (Phase 10 plain strip):
 * - Los headers ya no tienen fill teal (solo bold)
 * - Las columnas manuales ya no tienen fill yellow
 * - La firma publica (rows, range) es identica — callers no cambian (W9 audit: unico caller en ReporteVentasInsumosModal.tsx)
 */
export function exportVentasInsumosExcel(
  rows: VentasInsumosReportRow[],
  range: VentasInsumosRangeLabel,
): void {
  const autoColumns: ExportColumn<VentasInsumosReportRow>[] = [
    { header: 'Ticket', width: 10, get: r => r.ticketId.slice(-6).toUpperCase() },
    { header: 'Fecha creacion', width: 13, get: r => fmtDateShort(r.fechaCreacion) },
    { header: 'Razon social', width: 30, get: r => r.razonSocial },
    { header: 'Contacto', width: 22, get: r => r.contacto },
    { header: 'Creado por', width: 20, get: r => r.creadoPor },
    { header: 'Responsable', width: 20, get: r => r.responsable },
    { header: 'Estado actual', width: 20, get: r => r.estadoActual },
    { header: 'Ultimo movimiento', width: 14, get: r => fmtDateShort(r.ultimoMovimiento) },
    { header: 'Valor estimado', width: 14, get: r => r.valorEstimado ?? '' },
    { header: 'Descripcion', width: 40, get: r => r.descripcion },
    { header: 'Resultado', width: 12, get: r => r.resultado },
  ];

  // Manual columns — quedan vacias, para completar a mano (sin fill yellow — plain consistency Phase 10)
  const manualColumns: ExportColumn<VentasInsumosReportRow>[] = [
    { header: 'N° Presupuesto', width: 15, get: () => '' },
    { header: 'Monto final', width: 14, get: () => '' },
    { header: 'N° OC', width: 14, get: () => '' },
    { header: 'Fecha entrega', width: 14, get: () => '' },
    { header: 'Observaciones', width: 40, get: () => '' },
  ];

  const filename = `ventas-insumos_${range.label.replace(/\s+/g, '-').toLowerCase()}_${fmtDateShort(new Date().toISOString()).replace(/\//g, '-')}`;

  exportToExcel({
    data: rows,
    columns: [...autoColumns, ...manualColumns],
    sheetName: 'Ventas Insumos',
    filename,
  });
}
