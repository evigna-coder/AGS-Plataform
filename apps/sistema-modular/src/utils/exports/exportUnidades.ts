import type { UnidadStock, CondicionUnidad, EstadoUnidad } from '@ags/shared';
import type { AggRow } from '../../components/stock/UnidadesAggregatedTable';
import { type ExportColumn } from '../exportToExcel';
import { filtrosAplicadosDesc } from './filtros';

/**
 * Export de Unidades de stock (Excel + PDF vía ExportarButton).
 * Dos juegos de columnas: la vista agrupada por artículo (default) y la vista
 * detalle por unidad física — el botón exporta la vista activa.
 * Los label maps viven acá y la página los importa (fuente única).
 */
export const CONDICION_UNIDAD_LABELS: Record<CondicionUnidad, string> = {
  nuevo: 'Nuevo', bien_de_uso: 'Bien de uso', reacondicionado: 'Reacondicionado', vendible: 'Vendible', scrap: 'Scrap',
};

export const ESTADO_UNIDAD_LABELS: Record<EstadoUnidad, string> = {
  disponible: 'Disponible', reservado: 'Reservado', asignado: 'Asignado', en_transito: 'En transito',
  consumido: 'Consumido', vendido: 'Vendido', entregado: 'Entregado', baja: 'Baja',
};

export const UNIDADES_AGG_EXPORT_COLUMNS: ExportColumn<AggRow>[] = [
  { header: 'Código',      width: 15, get: r => r.codigo },
  { header: 'Descripción', width: 44, get: r => r.descripcion },
  { header: 'Disponible',  width: 10, get: r => r.disponible, align: 'right' },
  { header: 'Reservado',   width: 10, get: r => r.reservado, align: 'right' },
  { header: 'Asignado',    width: 10, get: r => r.asignado, align: 'right' },
  { header: 'Total',       width: 10, get: r => r.total, align: 'right' },
];

export const UNIDADES_DETALLE_EXPORT_COLUMNS: ExportColumn<UnidadStock>[] = [
  { header: 'Código',      width: 15, get: u => u.articuloCodigo || '' },
  { header: 'Descripción', width: 40, get: u => u.articuloDescripcion || '' },
  { header: 'Cantidad',    width: 9,  get: u => u.cantidad ?? 1, align: 'right' },
  { header: 'N° serie',    width: 16, get: u => u.nroSerie || '' },
  { header: 'N° lote',     width: 14, get: u => u.nroLote || '' },
  { header: 'Condición',   width: 15, get: u => CONDICION_UNIDAD_LABELS[u.condicion] ?? u.condicion },
  { header: 'Estado',      width: 12, get: u => ESTADO_UNIDAD_LABELS[u.estado] ?? u.estado },
];

/** Línea "Filtros: …" del export — refleja los filtros activos de UnidadesList. */
export function buildUnidadesFiltrosExport(
  filters: { search: string; estado: string; condicion: string; deposito: string; showInactive: boolean },
  depositoLabel: string | undefined,
  vistaDetalle: boolean,
): string[] {
  return filtrosAplicadosDesc({
    'Búsqueda': filters.search ? `'${filters.search}'` : '',
    Estado: filters.estado ? (ESTADO_UNIDAD_LABELS[filters.estado as EstadoUnidad] ?? filters.estado) : '',
    'Condición': filters.condicion ? (CONDICION_UNIDAD_LABELS[filters.condicion as CondicionUnidad] ?? filters.condicion) : '',
    'Depósito': filters.deposito ? (depositoLabel ?? filters.deposito) : '',
    'Incluye inactivas': filters.showInactive,
    Vista: vistaDetalle ? 'Detalle por unidad' : '',
  });
}
