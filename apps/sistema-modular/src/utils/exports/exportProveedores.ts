import type { Proveedor } from '@ags/shared';
import type { ExportColumn } from '../exportToExcel';

/** Export de Proveedores (Excel + PDF vía ExportarButton). */

export const TIPO_PROVEEDOR_LABELS: Record<string, string> = {
  nacional: 'Nacional',
  internacional: 'Internacional',
};

export const PROVEEDORES_EXPORT_COLUMNS: ExportColumn<Proveedor>[] = [
  { header: 'Nombre',   width: 28, get: p => p.nombre },
  { header: 'Tipo',     width: 14, get: p => TIPO_PROVEEDOR_LABELS[p.tipo] || p.tipo },
  { header: 'Contacto', width: 22, get: p => p.contacto || '' },
  { header: 'Email',    width: 26, get: p => p.email || '' },
  { header: 'Teléfono', width: 16, get: p => p.telefono || '' },
  { header: 'País',     width: 14, get: p => p.pais || '' },
  { header: 'CUIT',     width: 14, get: p => p.cuit || '' },
  { header: 'Estado',   width: 10, get: p => p.activo ? 'Activo' : 'Inactivo' },
];
