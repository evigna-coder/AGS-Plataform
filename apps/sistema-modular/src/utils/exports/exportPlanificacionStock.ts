import type { Articulo, StockAmplio } from '@ags/shared';
import { atpNetoFromStockAmplio } from '../../services/atpHelpers';
import { type ExportColumn } from '../exportToExcel';
import { filtrosAplicadosDesc } from './filtros';

/**
 * Export de Planificación de Stock (Excel + PDF vía ExportarButton).
 * Los buckets salen de `articulo.resumenStock` (mirror server-side, CF 09-02).
 * La tabla en pantalla tiene además un fallback client-side por fila
 * (useStockAmplio), así que un artículo sin mirror exporta '—' aunque en la
 * pantalla se vea el valor calculado (~).
 */
export interface PlanificacionExportRow {
  articulo: Articulo;
  marcaNombre: string;
  sa: StockAmplio | null;
  atpNeto: number | null;
}

export function buildPlanificacionExportRows(
  articulos: Articulo[],
  marcaById: Record<string, string>,
  soloComprometido: boolean,
): PlanificacionExportRow[] {
  const out: PlanificacionExportRow[] = [];
  for (const a of articulos) {
    const sa = a.resumenStock ?? null;
    // Mismo criterio que la fila: con "solo comprometido" se ocultan las que
    // tienen comprometido === 0 (las sin datos quedan, igual que en pantalla).
    if (soloComprometido && sa && sa.comprometido === 0) continue;
    out.push({
      articulo: a,
      marcaNombre: marcaById[a.marcaId] ?? '',
      sa,
      atpNeto: sa ? atpNetoFromStockAmplio(sa) : null,
    });
  }
  return out;
}

export const PLANIFICACION_EXPORT_COLUMNS: ExportColumn<PlanificacionExportRow>[] = [
  { header: 'Código',       width: 14, get: r => r.articulo.codigo },
  { header: 'Descripción',  width: 42, get: r => r.articulo.descripcion },
  { header: 'Marca',        width: 14, get: r => r.marcaNombre },
  { header: 'Disponible',   width: 10, get: r => r.sa ? r.sa.disponible : '—', align: 'right' },
  { header: 'En tránsito',  width: 10, get: r => r.sa ? r.sa.enTransito : '—', align: 'right' },
  { header: 'Reservado',    width: 10, get: r => r.sa ? r.sa.reservado : '—', align: 'right' },
  { header: 'Comprometido', width: 12, get: r => r.sa ? r.sa.comprometido : '—', align: 'right' },
  { header: 'ATP neto',     width: 10, get: r => r.atpNeto ?? '—', align: 'right' },
];

/** Línea "Filtros: …" del export — refleja los filtros activos de la página. */
export function buildPlanificacionFiltrosExport(
  filters: { texto: string; marcaId: string; proveedorId: string; soloComprometido: string },
  marcas: Array<{ id: string; nombre: string }>,
  proveedores: Array<{ id: string; nombre: string }>,
): string[] {
  return filtrosAplicadosDesc({
    'Búsqueda': filters.texto ? `'${filters.texto}'` : '',
    Marca: marcas.find(m => m.id === filters.marcaId)?.nombre,
    Proveedor: proveedores.find(p => p.id === filters.proveedorId)?.nombre,
    'Solo con comprometido > 0': filters.soloComprometido === 'true',
  });
}
