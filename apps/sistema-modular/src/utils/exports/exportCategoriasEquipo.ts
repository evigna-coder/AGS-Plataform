import type { CategoriaEquipo, CategoriaModulo } from '@ags/shared';
import { type ExportColumn } from '../exportToExcel';

/**
 * Export de Categorías de Equipo (Excel + PDF vía ExportarButton).
 * La página tiene dos pestañas (sistemas / módulos) — cada una exporta su
 * propio listado con su juego de columnas.
 */
export const CATEGORIAS_SISTEMAS_EXPORT_COLUMNS: ExportColumn<CategoriaEquipo>[] = [
  { header: 'Nombre',        width: 28, get: c => c.nombre },
  { header: 'Cant. modelos', width: 13, get: c => (c.modelos || []).length, align: 'right' },
  { header: 'Modelos',       width: 60, get: c => (c.modelos || []).join(', ') },
];

export const CATEGORIAS_MODULOS_EXPORT_COLUMNS: ExportColumn<CategoriaModulo>[] = [
  { header: 'Nombre',        width: 28, get: c => c.nombre },
  { header: 'Cant. modelos', width: 13, get: c => c.modelos.length, align: 'right' },
  { header: 'Modelos',       width: 60, get: c => c.modelos.map(m => m.codigo).join(', ') },
];
