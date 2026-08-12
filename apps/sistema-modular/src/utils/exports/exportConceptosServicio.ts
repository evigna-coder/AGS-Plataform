import type { CategoriaPresupuesto, ConceptoServicio } from '@ags/shared';
import { type ExportColumn } from '../exportToExcel';

/**
 * Export de Conceptos de Servicio (Excel + PDF vía ExportarButton).
 * `categoriaNombre` se resuelve al armar las filas (mismo criterio que la tabla).
 */
export interface ConceptoServicioExportRow {
  concepto: ConceptoServicio;
  categoriaNombre: string;
}

export function buildConceptosServicioExportRows(
  conceptos: ConceptoServicio[],
  categorias: CategoriaPresupuesto[],
): ConceptoServicioExportRow[] {
  const catById = new Map(categorias.map(c => [c.id, c.nombre]));
  return conceptos.map(concepto => ({
    concepto,
    categoriaNombre: (concepto.categoriaPresupuestoId && catById.get(concepto.categoriaPresupuestoId)) || '',
  }));
}

export const CONCEPTOS_SERVICIO_EXPORT_COLUMNS: ExportColumn<ConceptoServicioExportRow>[] = [
  { header: 'Código',          width: 15, get: r => r.concepto.codigo || '' },
  { header: 'Descripción',     width: 44, get: r => r.concepto.descripcion },
  { header: 'Valor base',      width: 12, get: r => r.concepto.valorBase, align: 'right' },
  { header: 'Moneda',          width: 8,  get: r => r.concepto.moneda },
  { header: 'Factor',          width: 8,  get: r => r.concepto.factorActualizacion, align: 'right' },
  { header: 'Precio efectivo', width: 14, get: r => r.concepto.valorBase * r.concepto.factorActualizacion, align: 'right' },
  { header: 'Categoría',       width: 20, get: r => r.categoriaNombre },
  { header: 'Estado',          width: 10, get: r => (r.concepto.activo ? 'Activo' : 'Inactivo') },
];
