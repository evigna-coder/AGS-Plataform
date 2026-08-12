import type { Marca } from '@ags/shared';
import { type ExportColumn } from '../exportToExcel';
import { filtrosAplicadosDesc } from './filtros';

/** Export de Marcas (Excel + PDF vía ExportarButton). */
export const MARCAS_EXPORT_COLUMNS: ExportColumn<Marca>[] = [
  { header: 'Nombre', width: 36, get: m => m.nombre },
  { header: 'Estado', width: 12, get: m => (m.activo ? 'Activa' : 'Inactiva') },
];

export function buildMarcasFiltrosExport(showInactive: boolean): string[] {
  return filtrosAplicadosDesc({ 'Incluye inactivas': showInactive });
}
