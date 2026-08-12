import type { RequerimientoCompra, EstadoRequerimiento, OrigenRequerimiento, UrgenciaRequerimiento } from '@ags/shared';
import { ESTADO_REQUERIMIENTO_LABELS, ORIGEN_REQUERIMIENTO_LABELS } from '@ags/shared';
import { fmtDateShort, type ExportColumn } from '../exportToExcel';
import { filtrosAplicadosDesc } from './filtros';

/**
 * Export de Requerimientos de Compra (pestaña "Requerimientos"; la pestaña
 * "Partes de presupuestos" tiene otro shape y no exporta desde acá).
 * URGENCIA_LABELS vivía en RequerimientoRow; ahora se define acá y la fila lo
 * re-exporta para no romper a sus consumidores.
 */
export const URGENCIA_LABELS: Record<UrgenciaRequerimiento, string> = {
  baja: 'Baja', media: 'Media', alta: 'Alta', critica: 'Crítica',
};

export interface RequerimientoExportRow {
  r: RequerimientoCompra;
  /** Cliente del presupuesto origen, resuelto por la página (clienteDeReq). */
  cliente: string;
}

export function buildRequerimientosExportRows(
  reqs: RequerimientoCompra[],
  clienteDe: (r: RequerimientoCompra) => string,
): RequerimientoExportRow[] {
  return reqs.map(r => ({ r, cliente: clienteDe(r) }));
}

/** Línea "Filtros: …" del export — refleja los filtros activos de RequerimientosList. */
export function buildRequerimientosFiltrosExport(
  filters: { estado: string; origen: string; urgencia: string; condicional: string },
  busqueda: string,
): string[] {
  return filtrosAplicadosDesc({
    'Búsqueda': busqueda.trim() ? `'${busqueda.trim()}'` : '',
    Estado: filters.estado === 'abiertos'
      ? 'Abiertos'
      : filters.estado === 'todos'
        ? ''
        : (ESTADO_REQUERIMIENTO_LABELS[filters.estado as EstadoRequerimiento] ?? filters.estado),
    Origen: filters.origen ? (ORIGEN_REQUERIMIENTO_LABELS[filters.origen as OrigenRequerimiento] ?? filters.origen) : '',
    Urgencia: filters.urgencia ? (URGENCIA_LABELS[filters.urgencia as UrgenciaRequerimiento] ?? filters.urgencia) : '',
    'Solo condicionales': filters.condicional === 'true',
    'Solo firmes': filters.condicional === 'false',
  });
}

export const REQUERIMIENTOS_EXPORT_COLUMNS: ExportColumn<RequerimientoExportRow>[] = [
  { header: 'Número',             width: 11, get: x => x.r.numero },
  { header: 'Artículo',           width: 16, get: x => x.r.articuloCodigo || '' },
  { header: 'Descripción',        width: 32, get: x => x.r.articuloDescripcion },
  { header: 'Cantidad',           width: 10, align: 'right', get: x => `${x.r.cantidad} ${x.r.unidadMedida ?? ''}`.trim() },
  // Mismo criterio que la celda "Origen" de la tabla: badge + cliente del presupuesto debajo.
  { header: 'Origen',             width: 22, get: x => {
      const o = ORIGEN_REQUERIMIENTO_LABELS[x.r.origen] ?? x.r.origen;
      return x.cliente ? `${o} — ${x.cliente}` : o;
    } },
  { header: 'Estado',             width: 14, get: x => ESTADO_REQUERIMIENTO_LABELS[x.r.estado] ?? x.r.estado },
  { header: 'Urgencia',           width: 10, get: x => x.r.urgencia ? (URGENCIA_LABELS[x.r.urgencia] ?? x.r.urgencia) : '' },
  { header: 'Proveedor sugerido', width: 22, get: x => x.r.proveedorSugeridoNombre || '' },
  { header: 'Fecha',              width: 10, get: x => fmtDateShort(x.r.fechaSolicitud) },
];
