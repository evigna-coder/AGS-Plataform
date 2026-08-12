import type { EventoFlujo, MesFlujo } from '@ags/shared';
import { TIPO_LABEL } from '@ags/shared';
import { fmtDateShort, type ExportColumn } from '../exportToExcel';

/**
 * Export de Pagos VEP / al exterior (Excel + PDF vía ExportarButton).
 * Aplana los meses agrupados de la página en una lista de eventos futuros,
 * en el mismo orden en que se ven (meses ascendentes, eventos por fecha).
 */
export function buildPagosVEPExportRows(meses: MesFlujo[]): EventoFlujo[] {
  return meses.flatMap(m => m.eventos);
}

export const PAGOS_VEP_EXPORT_COLUMNS: ExportColumn<EventoFlujo>[] = [
  // Las fechas del flujo son 'YYYY-MM-DD': se ancla T00:00:00 local para no
  // retroceder un día al formatear en UTC-3.
  { header: 'Fecha',           width: 10, get: e => fmtDateShort(`${e.fecha}T00:00:00`) },
  { header: 'Tipo',            width: 9,  get: e => TIPO_LABEL[e.tipo] },
  { header: 'OC / Referencia', width: 18, get: e => (e.manual ? `${e.ocNumero} (manual)` : `OC ${e.ocNumero}`) },
  { header: 'Proveedor',       width: 30, get: e => e.proveedor },
  { header: 'Moneda',          width: 8,  get: e => e.moneda || '' },
  { header: 'Monto',           width: 14, get: e => e.monto ?? null, align: 'right' },
];
