import type { Articulo, Marca, CategoriaEquipoStock, TipoArticulo } from '@ags/shared';
import { type ExportColumn } from '../exportToExcel';
import { filtrosAplicadosDesc } from './filtros';

/**
 * Export de Artículos (Excel + PDF vía ExportarButton).
 * Los label maps vivían en ArticulosListFilters; ahora la página los importa
 * de acá para que export y filtros muestren exactamente los mismos textos.
 */
export const CATEGORIA_ARTICULO_LABELS: Record<CategoriaEquipoStock, string> = {
  HPLC: 'HPLC', GC: 'GC', MSD: 'MSD', UV: 'UV', OSMOMETRO: 'Osmometro',
  HEADSPACE: 'Headspace', DENSIMETRO: 'Densimetro', GENERAL: 'General',
};
export const TIPO_ARTICULO_LABELS: Record<TipoArticulo, string> = {
  repuesto: 'Repuesto', consumible: 'Consumible', equipo: 'Equipo', columna: 'Columna',
  accesorio: 'Accesorio', muestra: 'Muestra', otro: 'Otro',
};

export interface ArticuloExportRow {
  articulo: Articulo;
  /** Nombre de marca resuelto (mismo criterio que getMarcaNombre de la lista). */
  marcaNombre: string;
}

export function buildArticulosExportRows(articulos: Articulo[], marcas: Marca[]): ArticuloExportRow[] {
  const nombrePorId = new Map(marcas.map(m => [m.id, m.nombre]));
  return articulos.map(a => ({
    articulo: a,
    marcaNombre: a.marcaId
      ? (nombrePorId.get(a.marcaId) ?? '-')
      : ((a as Articulo & { marca?: string }).marca || '-'),
  }));
}

/** Línea "Filtros: …" del export — refleja los filtros activos de ArticulosList. */
export function buildArticulosFiltrosExport(
  filters: { search: string; categoriaEquipo: string; marcaId: string; tipo: string; deposito: string; showInactive: boolean },
  marcas: Marca[],
  depositos: { value: string; label: string }[],
): string[] {
  return filtrosAplicadosDesc({
    'Búsqueda': filters.search ? `'${filters.search}'` : '',
    'Categoría': filters.categoriaEquipo
      ? (CATEGORIA_ARTICULO_LABELS[filters.categoriaEquipo as CategoriaEquipoStock] ?? filters.categoriaEquipo) : '',
    Marca: marcas.find(m => m.id === filters.marcaId)?.nombre,
    Tipo: filters.tipo ? (TIPO_ARTICULO_LABELS[filters.tipo as TipoArticulo] ?? filters.tipo) : '',
    'Depósito': depositos.find(d => d.value === filters.deposito)?.label,
    'Incluye inactivos': filters.showInactive,
  });
}

export const ARTICULOS_EXPORT_COLUMNS: ExportColumn<ArticuloExportRow>[] = [
  { header: 'Código',      width: 16, get: r => r.articulo.codigo },
  { header: 'Descripción', width: 40, get: r => r.articulo.descripcion },
  { header: 'Marca',       width: 16, get: r => r.marcaNombre },
  { header: 'Categoría',   width: 12, get: r => CATEGORIA_ARTICULO_LABELS[r.articulo.categoriaEquipo] ?? r.articulo.categoriaEquipo },
  { header: 'Tipo',        width: 12, get: r => TIPO_ARTICULO_LABELS[r.articulo.tipo] ?? r.articulo.tipo },
  { header: 'Stock mín.',  width: 10, align: 'right', get: r => r.articulo.stockMinimo ?? 0 },
  // Con moneda en la celda: mezclar ARS y USD en una columna numérica pelada sería engañoso.
  { header: 'Precio ref.', width: 14, align: 'right', get: r => r.articulo.precioReferencia != null
      ? `${r.articulo.monedaPrecio ?? 'USD'} ${r.articulo.precioReferencia.toLocaleString('es-AR')}` : '' },
];
