import type { WorkOrder, Sistema, OTEstadoAdmin, Cliente, UsuarioAGS } from '@ags/shared';
import { OT_ESTADO_LABELS } from '@ags/shared';
import { resolveEstadoOT } from '../../components/ordenes-trabajo/OTStatusBadge';
import { fmtDateShort, type ExportColumn } from '../exportToExcel';
import { filtrosAplicadosDesc } from './filtros';

/**
 * Export de Órdenes de Trabajo (Excel + PDF vía ExportarButton).
 * Las filas se arman desde el array `grouped` YA filtrado de OTList — padres e
 * items en el mismo orden en que se ven en la tabla.
 */
export interface OTExportRow {
  ot: WorkOrder;
  sistemaNombre: string;
  /** Nombre del establecimiento (solo clientes multi-planta, igual que en la lista). */
  establecimiento: string;
}

export function buildOTExportRows(
  grouped: { ot: WorkOrder }[],
  sistemas: Sistema[],
  sufijoEstab: (clienteId?: string | null, establecimientoId?: string | null) => string,
): OTExportRow[] {
  const sistById = new Map(sistemas.map(s => [s.id, s.nombre]));
  return grouped.map(({ ot }) => ({
    ot,
    sistemaNombre: (ot.sistemaId && sistById.get(ot.sistemaId)) || ot.sistema || '',
    // sufijoEstab devuelve " (Nombre)" — para la columna va el nombre pelado.
    establecimiento: sufijoEstab(ot.clienteId, ot.establecimientoId).replace(/^\s*\(/, '').replace(/\)$/, ''),
  }));
}

/** Línea "Filtros: …" del export — refleja los filtros activos de OTList. */
export function buildOTFiltrosExport(
  filters: {
    clienteId: string; sistemaId: string; estadoAdmin: string; tipoServicio: string;
    ingenieroId: string; fechaDesde: string; fechaHasta: string;
    busqueda: string; busquedaDescripcion: string;
    soloFacturable: boolean; soloContrato: boolean; soloGarantia: boolean;
  },
  clientes: Cliente[], sistemas: Sistema[], ingenieros: UsuarioAGS[],
): string[] {
  return filtrosAplicadosDesc({
    Cliente: clientes.find(c => c.id === filters.clienteId)?.razonSocial,
    Sistema: sistemas.find(s => s.id === filters.sistemaId)?.nombre,
    Estado: filters.estadoAdmin === '__pendientes__'
      ? 'Pendientes'
      : (OT_ESTADO_LABELS[filters.estadoAdmin as OTEstadoAdmin] ?? filters.estadoAdmin),
    'Tipo servicio': filters.tipoServicio,
    Ingeniero: ingenieros.find(i => i.id === filters.ingenieroId)?.displayName,
    Desde: filters.fechaDesde,
    Hasta: filters.fechaHasta,
    'Búsqueda': filters.busqueda ? `'${filters.busqueda}'` : '',
    'Búsqueda en descripción': filters.busquedaDescripcion ? `'${filters.busquedaDescripcion}'` : '',
    'Solo facturables': filters.soloFacturable,
    'Solo contrato': filters.soloContrato,
    'Solo garantía': filters.soloGarantia,
  });
}

export const OT_EXPORT_COLUMNS: ExportColumn<OTExportRow>[] = [
  { header: 'OT',             width: 11, get: r => r.ot.otNumber },
  { header: 'Cliente',        width: 28, get: r => r.ot.razonSocial },
  { header: 'Establecimiento', width: 20, get: r => r.establecimiento },
  { header: 'Tipo servicio',  width: 18, get: r => r.ot.tipoServicio || '' },
  { header: 'Ingeniero',      width: 20, get: r => r.ot.ingenieroAsignadoNombre || '' },
  { header: 'Estado',         width: 16, get: r => {
      const e = resolveEstadoOT(r.ot);
      return OT_ESTADO_LABELS[e as OTEstadoAdmin] ?? e;
    } },
  { header: 'Fecha servicio', width: 11, get: r => fmtDateShort(r.ot.fechaInicio || r.ot.fechaServicioAprox) },
];
