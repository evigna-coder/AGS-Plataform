import type { EstadoImportacion } from '@ags/shared';
import { ESTADO_IMPORTACION_LABELS } from '@ags/shared';
import { SEMAFORO_LABELS, type EntregaRow, type Semaforo } from '../entregasResolver';
import { fmtDateShort, type ExportColumn } from '../exportToExcel';
import { filtrosAplicadosDesc } from './filtros';

/**
 * Export de Entregas (Excel + PDF vía ExportarButton).
 * Se exportan las filas PLANAS (`sorted`) que alimentan el agrupado por OC,
 * en el mismo orden de sort de la tabla — un item por fila, sin filas-grupo.
 */
export function buildEntregasFiltrosExport(
  filters: { clienteId: string; semaforo: string; estadoImp: string; search: string },
  clienteNombre: string | undefined,
): string[] {
  return filtrosAplicadosDesc({
    Cliente: clienteNombre,
    'Semáforo': filters.semaforo === '__pendientes__'
      ? 'Pendientes'
      : filters.semaforo ? (SEMAFORO_LABELS[filters.semaforo as Semaforo] ?? filters.semaforo) : '',
    'Estado IMP': filters.estadoImp
      ? (ESTADO_IMPORTACION_LABELS[filters.estadoImp as EstadoImportacion] ?? filters.estadoImp)
      : '',
    'Búsqueda': filters.search ? `'${filters.search}'` : '',
  });
}

export const ENTREGAS_EXPORT_COLUMNS: ExportColumn<EntregaRow>[] = [
  { header: 'Disponibilidad', width: 15, get: r => r.disponibilidadCalculada?.label ?? '' },
  { header: 'Cliente',     width: 26, get: r => r.clienteNombre },
  { header: 'Código',      width: 16, get: r => r.codigoProducto || '' },
  { header: 'Item',        width: 34, get: r => r.descripcion },
  { header: 'Cant.',       width: 7,  get: r => r.cantidad, align: 'right' },
  { header: 'Presupuesto', width: 15, get: r => r.presupuestoNumero },
  { header: 'OC',          width: 12, get: r => r.ocNumero || '' },
  { header: 'Importación', width: 13, get: r => r.importacionNumero || '' },
  { header: 'ETA',         width: 10, get: r => fmtDateShort(r.etaFecha) },
  { header: 'Semáforo',    width: 11, get: r => SEMAFORO_LABELS[r.semaforo] || r.semaforo },
  { header: 'Días',        width: 7,  get: r => r.diasRestantes, align: 'right' },
];
