import type { Cliente, Pendiente, PendienteEstado, PendienteTipo } from '@ags/shared';
import { PENDIENTE_ESTADO_LABELS, PENDIENTE_TIPO_LABELS } from '@ags/shared';
import { fmtDateShort, type ExportColumn } from '../exportToExcel';
import { filtrosAplicadosDesc } from './filtros';

/**
 * Export de Pendientes (Excel + PDF vía ExportarButton).
 * Opera directo sobre `Pendiente` — cliente/equipo ya vienen denormalizados.
 */
export function buildPendientesFiltrosExport(
  filters: { search: string; cliente: string; tipo: string; estado: string },
  clientes: Cliente[],
): string[] {
  return filtrosAplicadosDesc({
    Estado: filters.estado ? (PENDIENTE_ESTADO_LABELS[filters.estado as PendienteEstado] ?? filters.estado) : '',
    Cliente: clientes.find(c => c.id === filters.cliente)?.razonSocial,
    Tipo: filters.tipo ? (PENDIENTE_TIPO_LABELS[filters.tipo as PendienteTipo] ?? filters.tipo) : '',
    'Búsqueda': filters.search ? `'${filters.search}'` : '',
  });
}

export const PENDIENTES_EXPORT_COLUMNS: ExportColumn<Pendiente>[] = [
  { header: 'Cliente',     width: 26, get: p => p.clienteNombre },
  { header: 'Equipo',      width: 24, get: p => p.equipoNombre ? `${p.equipoNombre}${p.equipoAgsId ? ` (${p.equipoAgsId})` : ''}` : '' },
  { header: 'Tipo',        width: 14, get: p => PENDIENTE_TIPO_LABELS[p.tipo] || p.tipo },
  { header: 'Descripción', width: 42, get: p => p.descripcion },
  { header: 'Estado',      width: 12, get: p => PENDIENTE_ESTADO_LABELS[p.estado] || p.estado },
  { header: 'Resolución',  width: 16, get: p => p.resolucionDocLabel || '' },
  { header: 'Creado',      width: 10, get: p => fmtDateShort(p.createdAt) },
  { header: 'Creado por',  width: 18, get: p => p.createdByName || '' },
];
