import type { OrdenCompra, TipoOC, EstadoOC } from '@ags/shared';
import { ESTADO_OC_LABELS } from '@ags/shared';
import { fmtDateShort, type ExportColumn } from '../exportToExcel';
import { filtrosAplicadosDesc } from './filtros';

/**
 * Export de Órdenes de Compra (Excel + PDF vía ExportarButton).
 * TIPO_OC_LABELS vivía en OCList; la página lo importa de acá.
 */
export const TIPO_OC_LABELS: Record<TipoOC, string> = { nacional: 'Nacional', importacion: 'Importacion' };

/** Línea "Filtros: …" del export — refleja los filtros activos de OCList. */
export function buildOCFiltrosExport(
  filters: { estado: string; tipo: string; showCanceladas: boolean },
): string[] {
  return filtrosAplicadosDesc({
    Estado: filters.estado === '__pendientes__'
      ? 'Pendientes'
      : filters.estado ? (ESTADO_OC_LABELS[filters.estado as EstadoOC] ?? filters.estado) : '',
    Tipo: filters.tipo ? (TIPO_OC_LABELS[filters.tipo as TipoOC] ?? filters.tipo) : '',
    'Incluye canceladas': filters.showCanceladas,
  });
}

export const OC_EXPORT_COLUMNS: ExportColumn<OrdenCompra>[] = [
  { header: 'Número',       width: 12, get: o => o.numero },
  { header: 'Tipo',         width: 12, get: o => TIPO_OC_LABELS[o.tipo] ?? o.tipo },
  { header: 'Estado',       width: 18, get: o => ESTADO_OC_LABELS[o.estado] ?? o.estado },
  { header: 'Proveedor',    width: 28, get: o => o.proveedorNombre },
  { header: 'Items',        width: 7,  align: 'right', get: o => o.items.length },
  { header: 'Total',        width: 14, align: 'right', get: o => o.total ?? null },
  { header: 'Moneda',       width: 8,  get: o => o.moneda },
  { header: 'Entrega est.', width: 11, get: o => fmtDateShort(o.fechaEntregaEstimada) },
];
