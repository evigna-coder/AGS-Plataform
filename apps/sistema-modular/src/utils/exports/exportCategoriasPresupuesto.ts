import type { CategoriaPresupuesto } from '@ags/shared';
import { type ExportColumn } from '../exportToExcel';

/**
 * Export de Categorías de Presupuesto (Excel + PDF vía ExportarButton).
 * Los impuestos se muestran como en la tabla: "N%" o "No aplica".
 */
export const CATEGORIAS_PRESUPUESTO_EXPORT_COLUMNS: ExportColumn<CategoriaPresupuesto>[] = [
  { header: 'Nombre',      width: 26, get: c => c.nombre },
  { header: 'Descripción', width: 34, get: c => c.descripcion || '' },
  { header: 'IVA',         width: 16, get: c => c.incluyeIva
      ? `${c.porcentajeIva}%${c.ivaReduccion && c.porcentajeIvaReduccion ? ` (Red: ${c.porcentajeIvaReduccion}%)` : ''}`
      : 'No aplica' },
  { header: 'Ganancias',   width: 10, get: c => (c.incluyeGanancias ? `${c.porcentajeGanancias}%` : 'No aplica'), align: 'right' },
  { header: 'IIBB',        width: 10, get: c => (c.incluyeIIBB ? `${c.porcentajeIIBB}%` : 'No aplica'), align: 'right' },
  { header: 'Estado',      width: 10, get: c => (c.activo ? 'Activa' : 'Inactiva') },
];
