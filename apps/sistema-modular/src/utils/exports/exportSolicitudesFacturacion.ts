import type { SolicitudFacturacion } from '@ags/shared';
import { SOLICITUD_FACTURACION_ESTADO_LABELS } from '@ags/shared';
import { exportToExcel, fmtDateShort, type ExportColumn } from '../exportToExcel';
import { exportToPDF, type ExportPDFColumn } from '../exportToPDF';

export interface ExportFiltersMeta {
  filtrosLabel?: string;
}

type Col = ExportColumn<SolicitudFacturacion>;

// 10 columnas per CONTEXT FMT-06
function buildColumns(): Col[] {
  return [
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
}

export function exportSolicitudesExcel(rows: SolicitudFacturacion[], _meta?: ExportFiltersMeta): void {
  exportToExcel({
    data: rows,
    columns: buildColumns(),
    sheetName: 'Solicitudes Facturacion',
    filename: buildFilename('solicitudes-facturacion'),
  });
}

export function exportSolicitudesPDF(rows: SolicitudFacturacion[], meta?: ExportFiltersMeta): Promise<void> {
  const cols = buildColumns();
  const totalW = cols.reduce((a, c) => a + (c.width ?? 12), 0);
  const pdfCols: ExportPDFColumn<SolicitudFacturacion>[] = cols.map(c => ({
    header: c.header,
    width: `${Math.round(((c.width ?? 12) / totalW) * 100)}%`,
    get: (r: SolicitudFacturacion) => String(c.get(r) ?? ''),
    align: c.align,
  }));
  return exportToPDF({
    data: rows,
    columns: pdfCols,
    title: 'Solicitudes de Facturacion',
    subtitle: meta?.filtrosLabel || 'Todas las solicitudes',
    filename: buildFilename('solicitudes-facturacion'),
    orientation: 'landscape',
  });
}

function buildFilename(slug: string): string {
  return `${slug}_${new Date().toISOString().slice(0, 10)}`;
}
