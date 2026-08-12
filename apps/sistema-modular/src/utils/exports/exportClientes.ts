import type { Cliente } from '@ags/shared';
import { type ExportColumn } from '../exportToExcel';
import { filtrosAplicadosDesc } from './filtros';

/**
 * Export de Clientes (Excel + PDF vía ExportarButton).
 * `establecimientos` se resuelve en la página con el mismo record que alimenta
 * la columna "Establec." (conteo por cliente).
 */
export interface ClienteExportRow {
  cliente: Cliente;
  establecimientos: number;
}

export function buildClientesExportRows(
  clientes: Cliente[],
  establecimientosByCliente: Record<string, number>,
): ClienteExportRow[] {
  return clientes.map(c => ({
    cliente: c,
    establecimientos: establecimientosByCliente[c.id] ?? 0,
  }));
}

/** Línea "Filtros: …" del export — refleja los filtros activos de ClientesList. */
export function buildClientesFiltrosExport(
  filters: { search: string; estadoTab: string },
): string[] {
  return filtrosAplicadosDesc({
    Estado: filters.estadoTab === 'activos' ? 'Activos'
      : filters.estadoTab === 'inactivos' ? 'Inactivos' : '',
    'Búsqueda': filters.search ? `'${filters.search}'` : '',
  });
}

export const CLIENTES_EXPORT_COLUMNS: ExportColumn<ClienteExportRow>[] = [
  { header: 'Razón Social',     width: 32, get: r => r.cliente.razonSocial },
  { header: 'CUIT',             width: 15, get: r => r.cliente.cuit || '' },
  { header: 'Rubro',            width: 20, get: r => r.cliente.rubro || '' },
  { header: 'Establecimientos', width: 16, get: r => r.establecimientos, align: 'right' },
  { header: 'Estado',           width: 10, get: r => r.cliente.activo !== false ? 'Activo' : 'Inactivo' },
];
