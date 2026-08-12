import type { Lead, TicketArea, TicketPrioridad, UsuarioAGS } from '@ags/shared';
import {
  getSimplifiedEstadoLabel,
  MOTIVO_LLAMADO_LABELS,
  TICKET_AREA_LABELS,
  TICKET_PRIORIDAD_LABELS,
} from '@ags/shared';
import { fmtDateShort, type ExportColumn } from '../exportToExcel';
import { filtrosAplicadosDesc } from './filtros';

/**
 * Export de Tickets (módulo interno "leads") — Excel + PDF vía ExportarButton.
 * Las filas se arman desde `leadsSorted` (mismo array y orden que la tabla).
 */
export interface TicketExportRow {
  lead: Lead;
  /** razonSocial + sufijo de establecimiento, igual que la columna Cliente. */
  clienteDisplay: string;
  asignadoNombre: string;
}

export function buildTicketsExportRows(
  leads: Lead[],
  usuarios: UsuarioAGS[],
  sufijo: (lead: Lead) => string,
): TicketExportRow[] {
  const userById = new Map(usuarios.map(u => [u.id, u.displayName]));
  return leads.map(l => ({
    lead: l,
    clienteDisplay: `${l.razonSocial}${sufijo(l)}`,
    asignadoNombre: (l.asignadoA && userById.get(l.asignadoA)) || '',
  }));
}

const ESTADO_SIMPLE_LABELS: Record<string, string> = {
  nuevo: 'Nuevo',
  en_proceso: 'En proceso',
  finalizado: 'Finalizado',
};

/** Línea "Filtros: …" del export — refleja los filtros activos de LeadsList. */
export function buildTicketsFiltrosExport(
  filters: {
    search: string; estadoFilter: string; motivo: string; area: string;
    responsable: string; prioridad: string; fechaDesde: string; fechaHasta: string;
    soloMios: boolean; misCreados: boolean; misDerivados: boolean;
    mostrarFinalizados: boolean; vista: string;
  },
  usuarios: UsuarioAGS[],
): string[] {
  return filtrosAplicadosDesc({
    Vista: filters.vista === 'sistema' ? 'Sistema' : '',
    Estado: ESTADO_SIMPLE_LABELS[filters.estadoFilter] ?? filters.estadoFilter,
    Motivo: filters.motivo ? (MOTIVO_LLAMADO_LABELS as Record<string, string>)[filters.motivo] ?? filters.motivo : '',
    'Área': filters.area ? (TICKET_AREA_LABELS as Record<string, string>)[filters.area] ?? filters.area : '',
    Prioridad: filters.prioridad ? (TICKET_PRIORIDAD_LABELS as Record<string, string>)[filters.prioridad] ?? filters.prioridad : '',
    Responsable: usuarios.find(u => u.id === filters.responsable)?.displayName,
    'Solo míos': filters.soloMios,
    'Mis creados': filters.misCreados,
    'Mis derivados': filters.misDerivados,
    'Incluye finalizados': filters.mostrarFinalizados,
    Desde: filters.fechaDesde,
    Hasta: filters.fechaHasta,
    'Búsqueda': filters.search ? `'${filters.search}'` : '',
  });
}

export const TICKETS_EXPORT_COLUMNS: ExportColumn<TicketExportRow>[] = [
  { header: 'Número',    width: 12, get: r => r.lead.numero || '' },
  { header: 'Cliente',   width: 28, get: r => r.clienteDisplay },
  { header: 'Contacto',  width: 20, get: r => r.lead.contacto || '' },
  { header: 'Motivo',    width: 16, get: r => MOTIVO_LLAMADO_LABELS[r.lead.motivoLlamado] || r.lead.motivoLlamado },
  { header: 'Prioridad', width: 10, get: r => r.lead.prioridad ? TICKET_PRIORIDAD_LABELS[r.lead.prioridad as TicketPrioridad] : '' },
  { header: 'Estado',    width: 12, get: r => getSimplifiedEstadoLabel(r.lead.estado) },
  { header: 'Área',      width: 16, get: r => r.lead.areaActual ? TICKET_AREA_LABELS[r.lead.areaActual as TicketArea] : '' },
  { header: 'Asignado',  width: 18, get: r => r.asignadoNombre },
  { header: 'Fecha',     width: 10, get: r => fmtDateShort(r.lead.updatedAt || r.lead.createdAt) },
];
