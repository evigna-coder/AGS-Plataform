import type { IngresoEmpresa } from '@ags/shared';
import { DOCUMENTACION_INGRESO_KEYS, DOCUMENTO_INGRESO_LABELS, TIPO_INGRESO_LABELS } from '@ags/shared';
import type { ExportColumn } from '../exportToExcel';

/**
 * Export de Ingreso a Empresas (Excel + PDF vía ExportarButton).
 * La tabla tiene una columna por documento (12); el export los resume en una
 * sola columna con los requeridos y su modalidad — legible en Excel/PDF.
 */

/** "ART: Requerido; SVO: Con Contrato; …" — solo los documentos requeridos. */
function documentacionResumen(item: IngresoEmpresa): string {
  return DOCUMENTACION_INGRESO_KEYS
    .filter(({ key }) => item.documentacion[key] !== 'no_requerido')
    .map(({ key, label }) => `${label}: ${DOCUMENTO_INGRESO_LABELS[item.documentacion[key]]}`)
    .join('; ');
}

export const INGRESO_EMPRESAS_EXPORT_COLUMNS: ExportColumn<IngresoEmpresa>[] = [
  { header: 'Cliente',         width: 28, get: i => i.clienteNombre },
  { header: 'Tipo',            width: 17, get: i => TIPO_INGRESO_LABELS[i.tipo] || i.tipo },
  { header: 'Inducción',       width: 10, get: i => i.induccion.requerida ? 'Sí' : 'No' },
  { header: 'Contacto',        width: 24, get: i => i.contacto || '' },
  { header: 'Docs requeridos', width: 9,  get: i => DOCUMENTACION_INGRESO_KEYS.filter(({ key }) => i.documentacion[key] !== 'no_requerido').length, align: 'right' },
  { header: 'Documentación',   width: 60, get: i => documentacionResumen(i) },
];
