import type { Presupuesto } from '@ags/shared';
import { TIPO_PRESUPUESTO_LABELS, ESTADO_PRESUPUESTO_LABELS } from '@ags/shared';
import { exportToExcel, fmtDateShort, type ExportColumn } from '../exportToExcel';
import { exportToPDF, type ExportPDFColumn } from '../exportToPDF';

export interface PresupuestoExportRow {
  presupuesto: Presupuesto;
  clienteNombre: string;
  responsableNombre: string;
}

export interface ExportFiltersMeta {
  /** Etiqueta resumida de filtros activos, ej. "cliente=ACME, estado=aceptado". */
  filtrosLabel?: string;
}

type Col = ExportColumn<PresupuestoExportRow>;

// 12 columnas per CONTEXT FMT-04
function buildColumns(): Col[] {
  return [
    { header: 'Numero',         width: 15, get: r => r.presupuesto.numero },
    { header: 'Cliente',        width: 28, get: r => r.clienteNombre },
    { header: 'Tipo',           width: 10, get: r => TIPO_PRESUPUESTO_LABELS[r.presupuesto.tipo] || r.presupuesto.tipo },
    { header: 'Estado',         width: 14, get: r => ESTADO_PRESUPUESTO_LABELS[r.presupuesto.estado] || r.presupuesto.estado },
    { header: 'Total',          width: 12, get: r => r.presupuesto.total ?? 0, align: 'right' },
    { header: 'Moneda',         width: 8,  get: r => r.presupuesto.moneda },
    { header: 'Responsable',    width: 20, get: r => r.responsableNombre },
    { header: 'Creado',         width: 10, get: r => fmtDateShort(r.presupuesto.createdAt) },
    { header: 'Enviado',        width: 10, get: r => fmtDateShort(r.presupuesto.fechaEnvio ?? null) },
    { header: 'Validez (dias)', width: 10, get: r => r.presupuesto.validezDias ?? '' },
    { header: 'OCs vinculadas', width: 14, get: r => (r.presupuesto.ordenesCompraIds || []).length, align: 'center' },
    { header: 'Prox. contacto', width: 12, get: r => fmtDateShort((r.presupuesto as unknown as Record<string, string | null | undefined>)['proximoContacto']) },
  ];
}

export function exportPresupuestosExcel(rows: PresupuestoExportRow[], _meta?: ExportFiltersMeta): void {
  exportToExcel({
    data: rows,
    columns: buildColumns(),
    sheetName: 'Presupuestos',
    filename: buildFilename('presupuestos'),
  });
}

export function exportPresupuestosPDF(rows: PresupuestoExportRow[], meta?: ExportFiltersMeta): Promise<void> {
  const cols = buildColumns();
  const totalW = cols.reduce((a, c) => a + (c.width ?? 12), 0);
  const pdfCols: ExportPDFColumn<PresupuestoExportRow>[] = cols.map(c => ({
    header: c.header,
    width: `${Math.round(((c.width ?? 12) / totalW) * 100)}%`,
    get: (r: PresupuestoExportRow) => String(c.get(r) ?? ''),
    align: c.align,
  }));
  return exportToPDF({
    data: rows,
    columns: pdfCols,
    title: 'Presupuestos',
    subtitle: meta?.filtrosLabel || 'Todos los presupuestos',
    filename: buildFilename('presupuestos'),
    orientation: 'landscape',
  });
}

function buildFilename(slug: string): string {
  return `${slug}_${new Date().toISOString().slice(0, 10)}`;
}
