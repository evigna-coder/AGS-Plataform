import type { ConsumiblesPorModulo } from '@ags/shared';
import { type ExportColumn } from '../exportToExcel';

/**
 * Export de Consumibles por Módulo (Excel + PDF vía ExportarButton).
 * La columna "Consumibles" lista código × cantidad de cada consumible declarado,
 * para que el Excel sirva como catálogo imprimible completo.
 */
export const CONSUMIBLES_POR_MODULO_EXPORT_COLUMNS: ExportColumn<ConsumiblesPorModulo>[] = [
  { header: 'Código módulo',  width: 16, get: m => m.codigoModulo },
  { header: 'Descripción',    width: 30, get: m => m.descripcion || '' },
  { header: 'N° consumibles', width: 14, get: m => m.consumibles.length, align: 'right' },
  { header: 'Consumibles',    width: 50, get: m => m.consumibles.map(c => `${c.codigo} ×${c.cantidad}`).join(', ') },
  { header: 'Estado',         width: 10, get: m => m.activo ? 'Activo' : 'Inactivo' },
];
