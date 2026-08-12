import type { Asignacion, ItemAsignacion, EstadoItemAsignacion } from '@ags/shared';
import { fmtDateShort, type ExportColumn } from '../exportToExcel';

/**
 * Export del Historial de Asignaciones (Excel + PDF vía ExportarButton).
 * La lista se muestra POR ITEM (quién tuvo qué cosa), no por comprobante —
 * el export refleja exactamente esas filas; estructuralmente compatible con
 * el HistRow que arma AsignacionesList.
 */
export interface AsignacionExportRow {
  asignacion: Asignacion;
  item: ItemAsignacion;
  label: string;
  detalle: string | null;
}

const ITEM_ESTADO_LABELS: Record<EstadoItemAsignacion, string> = {
  asignado: 'En poder',
  devuelto: 'Devuelto',
  consumido: 'Consumido',
};

export const ASIGNACIONES_EXPORT_COLUMNS: ExportColumn<AsignacionExportRow>[] = [
  { header: 'Ítem',              width: 20, get: r => r.label },
  { header: 'Detalle',           width: 24, get: r => r.detalle || '' },
  { header: 'Cant.',             width: 6,  get: r => r.item.cantidad > 1 ? r.item.cantidad : 1, align: 'center' },
  { header: 'Asignado',          width: 10, get: r => fmtDateShort(r.item.fechaAsignacion || r.asignacion.createdAt) },
  { header: 'Ingeniero',         width: 18, get: r => r.asignacion.ingenieroNombre },
  { header: 'Cliente / destino', width: 22, get: r => (r.item.clienteNombre || r.asignacion.clienteNombre || '')
      + (r.item.otNumber ? ` (OT ${r.item.otNumber})` : '') },
  { header: 'Retorno',           width: 10, get: r => r.item.fechaDevolucion
      ? fmtDateShort(r.item.fechaDevolucion)
      : (r.item.estado === 'asignado' ? 'En poder' : '') },
  { header: 'Estado',            width: 10, get: r => ITEM_ESTADO_LABELS[r.item.estado] || r.item.estado },
  { header: 'Comprobante',       width: 11, get: r => r.asignacion.numero },
];
