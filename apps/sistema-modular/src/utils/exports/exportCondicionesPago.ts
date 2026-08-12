import type { CondicionPago } from '@ags/shared';
import { type ExportColumn } from '../exportToExcel';

/** Texto del plazo — mismo criterio que la tabla ("Contado" / "N días"). */
export function condicionPagoPlazoTexto(dias: number): string {
  if (dias === 0) return 'Contado';
  if (dias === 1) return '1 día';
  return `${dias} días`;
}

/** Export de Condiciones de Pago (Excel + PDF vía ExportarButton). */
export const CONDICIONES_PAGO_EXPORT_COLUMNS: ExportColumn<CondicionPago>[] = [
  { header: 'Nombre',      width: 36, get: c => c.nombre },
  { header: 'Plazo',       width: 12, get: c => condicionPagoPlazoTexto(c.dias) },
  { header: 'Descripción', width: 40, get: c => c.descripcion || '' },
  { header: 'Estado',      width: 10, get: c => (c.activo ? 'Activa' : 'Inactiva') },
];
