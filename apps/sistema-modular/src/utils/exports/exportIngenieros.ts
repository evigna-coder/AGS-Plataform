import type { AreaIngeniero, Ingeniero } from '@ags/shared';
import type { ExportColumn } from '../exportToExcel';

/**
 * Export de Ingenieros (Excel + PDF vía ExportarButton).
 * AREA_INGENIERO_LABELS vive acá; IngenierosPage lo importa para que la
 * lista y el export usen los mismos labels.
 */

export const AREA_INGENIERO_LABELS: Record<AreaIngeniero, string> = {
  campo: 'Campo',
  taller: 'Taller',
  electronica: 'Electrónica',
  mecanica: 'Mecánica',
  ventas: 'Ventas',
  admin: 'Administración',
};

export const INGENIEROS_EXPORT_COLUMNS: ExportColumn<Ingeniero>[] = [
  { header: 'Nombre',           width: 26, get: i => i.nombre },
  { header: 'Área',             width: 15, get: i => i.area ? (AREA_INGENIERO_LABELS[i.area] || i.area) : '' },
  { header: 'Email',            width: 28, get: i => i.email || '' },
  { header: 'Teléfono',         width: 16, get: i => i.telefono || '' },
  { header: 'Cuenta vinculada', width: 16, get: i => i.usuarioId ? 'Sí' : 'No' },
  { header: 'Estado',           width: 10, get: i => i.activo ? 'Activo' : 'Inactivo' },
];
