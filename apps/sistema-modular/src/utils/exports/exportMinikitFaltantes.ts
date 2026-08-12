import { type ExportColumn } from '../exportToExcel';
import { filtrosAplicadosDesc } from './filtros';

/**
 * Export de Faltantes de Minikits (Excel + PDF vía ExportarButton).
 * Fila estructural: la página pasa su `FaltanteRow` (minikit × artículo debajo
 * del mínimo) ya filtrada y ordenada.
 */
export interface MinikitFaltanteExportRow {
  minikitCodigo: string;
  minikitNombre: string;
  asignadoNombre: string;
  articuloCodigo: string;
  articuloDescripcion: string;
  sector: string;
  cantidadMinima: number;
  actual: number;
  deficit: number;
}

export const MINIKIT_FALTANTES_EXPORT_COLUMNS: ExportColumn<MinikitFaltanteExportRow>[] = [
  { header: 'Minikit',     width: 12, get: r => r.minikitCodigo },
  { header: 'Nombre',      width: 24, get: r => r.minikitNombre },
  { header: 'Asignado',    width: 20, get: r => r.asignadoNombre },
  { header: 'Artículo',    width: 15, get: r => r.articuloCodigo },
  { header: 'Descripción', width: 36, get: r => r.articuloDescripcion },
  { header: 'Sector',      width: 14, get: r => r.sector },
  { header: 'Mínimo',      width: 8,  get: r => r.cantidadMinima, align: 'right' },
  { header: 'Actual',      width: 8,  get: r => r.actual, align: 'right' },
  { header: 'Falta',       width: 8,  get: r => r.deficit, align: 'right' },
];

/** Línea "Filtros: …" del export — refleja los filtros activos de la página. */
export function buildMinikitFaltantesFiltrosExport(
  filters: { minikitId: string; asignado: string; articulo: string },
  minikits: Array<{ id: string; codigo: string; nombre: string }>,
): string[] {
  const mk = minikits.find(m => m.id === filters.minikitId);
  return filtrosAplicadosDesc({
    Minikit: mk ? `${mk.codigo} — ${mk.nombre}` : '',
    'Asignado a': filters.asignado,
    'Artículo': filters.articulo,
  });
}
