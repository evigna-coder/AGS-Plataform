import type { Remito, TipoRemito, EstadoRemito, Cliente } from '@ags/shared';
import { fmtDateShort, type ExportColumn } from '../exportToExcel';
import { filtrosAplicadosDesc } from './filtros';

/**
 * Export de Remitos (Excel + PDF vía ExportarButton).
 * Los label maps viven acá (única fuente) y RemitosList los importa para
 * los badges — antes eran consts locales de la página.
 */
export const REMITO_TIPO_LABELS: Record<TipoRemito, string> = { salida_campo: 'Salida a campo', entrega_cliente: 'Entrega a cliente', devolucion: 'Devolución', interno: 'Interno', derivacion_proveedor: 'Derivación proveedor', loaner_salida: 'Loaner salida', servicio: 'Servicio' };
export const REMITO_ESTADO_LABELS: Record<EstadoRemito, string> = { borrador: 'Borrador', confirmado: 'Confirmado', en_transito: 'En tránsito', en_proveedor: 'En proveedor externo', completado: 'Completado', completado_parcial: 'Parcial', cancelado: 'Cancelado' };

export interface RemitoExportRow {
  remito: Remito;
  /** Dueño resuelto por la página (cliente → dueño de la ficha → AGS). */
  dueno: string;
}

/** Línea "Filtros: …" del export — refleja los filtros activos de RemitosList. */
export function buildRemitosFiltrosExport(
  filters: { tab: string; estado: string; tipo: string; clienteId: string; showAll: boolean },
  clientes: Cliente[],
): string[] {
  const estadoSel = filters.estado || 'pendientes';
  return filtrosAplicadosDesc({
    'Pestaña': filters.tab === 'internos' ? 'Internos (REM)' : 'Talonario',
    Estado: estadoSel === 'pendientes'
      ? 'Pendientes'
      : estadoSel === 'todos' ? '' : (REMITO_ESTADO_LABELS[estadoSel as EstadoRemito] ?? estadoSel),
    Tipo: filters.tipo ? (REMITO_TIPO_LABELS[filters.tipo as TipoRemito] ?? filters.tipo) : '',
    Cliente: clientes.find(c => c.id === filters.clienteId)?.razonSocial,
    'Incluye cancelados': filters.showAll,
  });
}

export const REMITOS_EXPORT_COLUMNS: ExportColumn<RemitoExportRow>[] = [
  { header: 'Número',       width: 15, get: r => r.remito.numero },
  { header: 'Tipo',         width: 18, get: r => REMITO_TIPO_LABELS[r.remito.tipo] || r.remito.tipo },
  { header: 'Estado',       width: 15, get: r => REMITO_ESTADO_LABELS[r.remito.estado] || r.remito.estado },
  { header: 'Cliente',      width: 26, get: r => r.dueno + (r.remito.establecimientoNombre ? ` (${r.remito.establecimientoNombre})` : '') },
  { header: 'Ingeniero',    width: 20, get: r => r.remito.ingenieroNombre
      || (r.remito.transportistaNombre ? `${r.remito.transportistaNombre} (transp.)` : '') },
  { header: 'Items',        width: 7,  get: r => r.remito.items?.length ?? 0, align: 'center' },
  { header: 'Fecha salida', width: 11, get: r => fmtDateShort(r.remito.fechaSalida) },
];
