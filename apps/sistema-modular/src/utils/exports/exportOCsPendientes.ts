import type { Presupuesto } from '@ags/shared';
import { ESTADO_PRESUPUESTO_LABELS } from '@ags/shared';
import { exportToExcel, fmtDateShort, type ExportColumn } from '../exportToExcel';
import { exportToPDF, type ExportPDFColumn } from '../exportToPDF';

export interface OCPendienteExportRow {
  presupuesto: Presupuesto;
  clienteNombre: string;
  /** Primer OC del array (o 'N/A' si no hay cargada pero el filter la marco como pendiente). */
  ocNumero: string;
  /** ISO del primer OC recibido (o null si no hay). */
  ocFecha: string | null;
  /** Count de adjuntos (OC PDF + otros). */
  adjuntosCount: number;
  /** Dias desde createdAt del primer OC (o desde estado='aceptado' si no hay OC aun). */
  diasDesdeCarga: number;
  coordinadorNombre: string;
}

export interface ExportFiltersMeta {
  filtrosLabel?: string;
}

type Col = ExportColumn<OCPendienteExportRow>;

// 8 columnas per CONTEXT FMT-05
function buildColumns(): Col[] {
  return [
    { header: 'Numero OC',           width: 14, get: r => r.ocNumero },
    { header: 'Cliente',             width: 28, get: r => r.clienteNombre },
    { header: 'Presupuesto(s)',      width: 16, get: r => r.presupuesto.numero },
    { header: 'Fecha OC',           width: 10, get: r => fmtDateShort(r.ocFecha) },
    { header: 'Estado ppto',        width: 14, get: r => ESTADO_PRESUPUESTO_LABELS[r.presupuesto.estado] || r.presupuesto.estado },
    { header: 'Adjuntos',           width: 8,  get: r => r.adjuntosCount, align: 'center' },
    { header: 'Dias desde carga',   width: 14, get: r => r.diasDesdeCarga, align: 'right' },
    { header: 'Coordinador asignado', width: 20, get: r => r.coordinadorNombre },
  ];
}

export function exportOCsPendientesExcel(rows: OCPendienteExportRow[], _meta?: ExportFiltersMeta): void {
  exportToExcel({
    data: rows,
    columns: buildColumns(),
    sheetName: 'OCs Pendientes',
    filename: buildFilename('ocs-pendientes'),
  });
}

export function exportOCsPendientesPDF(rows: OCPendienteExportRow[], meta?: ExportFiltersMeta): Promise<void> {
  const cols = buildColumns();
  const totalW = cols.reduce((a, c) => a + (c.width ?? 12), 0);
  const pdfCols: ExportPDFColumn<OCPendienteExportRow>[] = cols.map(c => ({
    header: c.header,
    width: `${Math.round(((c.width ?? 12) / totalW) * 100)}%`,
    get: (r: OCPendienteExportRow) => String(c.get(r) ?? ''),
    align: c.align,
  }));
  return exportToPDF({
    data: rows,
    columns: pdfCols,
    title: 'OCs Pendientes',
    subtitle: meta?.filtrosLabel || 'OCs cargadas sin recibir / aceptados sin OC',
    filename: buildFilename('ocs-pendientes'),
    orientation: 'landscape',
  });
}

function buildFilename(slug: string): string {
  return `${slug}_${new Date().toISOString().slice(0, 10)}`;
}
