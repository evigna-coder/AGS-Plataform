import type { TipoServicio } from '@ags/shared';
import { type ExportColumn } from '../exportToExcel';

/** Export de Tipos de Servicio (Excel + PDF vía ExportarButton). */
export const TIPOS_SERVICIO_EXPORT_COLUMNS: ExportColumn<TipoServicio>[] = [
  { header: 'Nombre',            width: 40, get: t => t.nombre },
  { header: 'Recurrencia anual', width: 16, get: t => (t.generaRecurrenciaAnual ? 'Sí' : '') },
  { header: 'Estado',            width: 12, get: t => (t.activo ? 'Activo' : 'Inactivo') },
];
