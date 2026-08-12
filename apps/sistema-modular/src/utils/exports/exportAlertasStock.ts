import { type ExportColumn } from '../exportToExcel';

/**
 * Export de Alertas de Stock (Excel + PDF vía ExportarButton).
 * Fila estructural: la página pasa su `ArticuloConStock` (Articulo + agregados
 * stockActual / enOC / deficit calculados en pantalla).
 */
export interface AlertaStockExportRow {
  codigo: string;
  descripcion: string;
  categoriaEquipo: string;
  stockActual: number;
  enOC: number;
  stockMinimo: number;
  deficit: number;
}

export const ALERTAS_STOCK_EXPORT_COLUMNS: ExportColumn<AlertaStockExportRow>[] = [
  { header: 'Código',       width: 14, get: r => r.codigo },
  { header: 'Descripción',  width: 42, get: r => r.descripcion },
  { header: 'Categoría',    width: 16, get: r => r.categoriaEquipo },
  { header: 'Stock actual', width: 12, get: r => r.stockActual, align: 'right' },
  { header: 'En OC',        width: 10, get: r => r.enOC, align: 'right' },
  { header: 'Mínimo',       width: 10, get: r => r.stockMinimo, align: 'right' },
  { header: 'Déficit',      width: 10, get: r => r.deficit, align: 'right' },
];
