import type { MovimientoStock, TipoMovimiento } from '@ags/shared';
import { fmtDateShort, type ExportColumn } from '../exportToExcel';
import { filtrosAplicadosDesc } from './filtros';

/**
 * Export de Movimientos de Stock (Excel + PDF vía ExportarButton).
 * TIPO_MOVIMIENTO_LABELS estaba duplicado en MovimientosTable y
 * MovimientosFilters; ahora ambos lo importan de acá.
 */
export const TIPO_MOVIMIENTO_LABELS: Record<TipoMovimiento, string> = {
  ingreso: 'Ingreso', egreso: 'Egreso', transferencia: 'Transferencia',
  consumo: 'Consumo', devolucion: 'Devolucion', ajuste: 'Ajuste',
};

/** Línea "Filtros: …" del export — refleja los filtros activos de MovimientosPage. */
export function buildMovimientosFiltrosExport(
  filters: { tipo: string; cliente: string; fechaDesde: string; fechaHasta: string },
  busqueda: string,
  clientes: { value: string; label: string }[],
): string[] {
  return filtrosAplicadosDesc({
    Tipo: filters.tipo ? (TIPO_MOVIMIENTO_LABELS[filters.tipo as TipoMovimiento] ?? filters.tipo) : '',
    Cliente: clientes.find(c => c.value === filters.cliente)?.label,
    'Búsqueda': busqueda.trim() ? `'${busqueda.trim()}'` : '',
    Desde: filters.fechaDesde,
    Hasta: filters.fechaHasta,
  });
}

export const MOVIMIENTOS_EXPORT_COLUMNS: ExportColumn<MovimientoStock>[] = [
  { header: 'Fecha',       width: 10, get: m => fmtDateShort(m.createdAt) },
  { header: 'Tipo',        width: 14, get: m => TIPO_MOVIMIENTO_LABELS[m.tipo] ?? m.tipo },
  { header: 'Código',      width: 14, get: m => m.articuloCodigo },
  { header: 'Descripción', width: 32, get: m => m.articuloDescripcion },
  { header: 'Cant.',       width: 7,  align: 'right', get: m => m.cantidad },
  { header: 'Origen',      width: 18, get: m => m.origenNombre || '' },
  { header: 'Destino',     width: 18, get: m => m.destinoNombre || '' },
  { header: 'OC',          width: 11, get: m => m.ordenCompraNumero || '' },
  { header: 'Usuario',     width: 16, get: m => m.creadoPor },
];
