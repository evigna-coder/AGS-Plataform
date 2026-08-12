import type { Importacion } from '@ags/shared';
import { ESTADO_IMPORTACION_LABELS } from '@ags/shared';
import { fmtDateShort, type ExportColumn } from '../exportToExcel';

/**
 * Export de Importaciones (Excel + PDF vía ExportarButton).
 * Moneda/monto = giro al exterior (pago al proveedor), que es el monto que la
 * operación maneja a nivel embarque; las importaciones sin giro cargado quedan vacías.
 */
export const IMPORTACIONES_EXPORT_COLUMNS: ExportColumn<Importacion>[] = [
  { header: 'Número',      width: 11, get: i => i.numero },
  { header: 'OC',          width: 12, get: i => i.ordenCompraNumero },
  { header: 'Proveedor',   width: 26, get: i => i.proveedorNombre },
  { header: 'Estado',      width: 13, get: i => ESTADO_IMPORTACION_LABELS[i.estado] || i.estado },
  { header: 'Embarque',    width: 10, get: i => fmtDateShort(i.fechaEmbarque) },
  { header: 'Arribo est.', width: 10, get: i => fmtDateShort(i.fechaEstimadaArribo) },
  { header: 'Arribo real', width: 10, get: i => fmtDateShort(i.fechaArriboReal) },
  { header: 'Moneda',      width: 8,  get: i => i.giroMoneda || '', align: 'center' },
  { header: 'Monto giro',  width: 12, get: i => i.giroMonto ?? '', align: 'right' },
];
