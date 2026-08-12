import type { WorkOrder } from '@ags/shared';
import { REQUISITO_FACTURACION_LABELS } from '@ags/shared';
import type { ExportColumn } from '../exportToExcel';

/**
 * Export de Pendientes de Documentación (Excel + PDF vía ExportarButton).
 * La página agrupa por cliente; el export aplana los grupos a una fila por OT
 * retenida, en el mismo orden en pantalla (clientes A→Z).
 */
export const PENDIENTES_DOCUMENTACION_EXPORT_COLUMNS: ExportColumn<WorkOrder>[] = [
  { header: 'OT',                       width: 12, get: ot => ot.otNumber },
  { header: 'Cliente',                  width: 28, get: ot => ot.razonSocial || 'Sin cliente' },
  { header: 'Sistema',                  width: 22, get: ot => ot.sistema || '' },
  { header: 'Tipo servicio',            width: 18, get: ot => ot.tipoServicio || '' },
  { header: 'Documentación requerida',  width: 22, get: ot => REQUISITO_FACTURACION_LABELS[ot.requisitoFacturacionPendiente || 'remito_firmado'] },
];
