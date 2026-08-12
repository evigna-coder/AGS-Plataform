import type { Cliente, Establecimiento } from '@ags/shared';
import { type ExportColumn } from '../exportToExcel';
import { filtrosAplicadosDesc } from './filtros';

/**
 * Export de Establecimientos (Excel + PDF vía ExportarButton).
 * `clienteNombre` se resuelve en la página con el mismo `clienteMap` (indexado
 * por id, cuit y cuit-solo-dígitos) que usa la columna "Cliente" de la tabla.
 */
export interface EstablecimientoExportRow {
  est: Establecimiento;
  clienteNombre: string;
}

export function buildEstablecimientosExportRows(
  establecimientos: Establecimiento[],
  clienteMap: Record<string, string>,
): EstablecimientoExportRow[] {
  return establecimientos.map(e => ({
    est: e,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    clienteNombre: clienteMap[e.clienteCuit || (e as any).clienteId] || '',
  }));
}

/** Línea "Filtros: …" del export — refleja los filtros activos de EstablecimientosList. */
export function buildEstablecimientosFiltrosExport(
  filters: { search: string; cliente: string },
  clientes: Cliente[],
): string[] {
  return filtrosAplicadosDesc({
    Cliente: clientes.find(c => c.id === filters.cliente)?.razonSocial,
    'Búsqueda': filters.search ? `'${filters.search}'` : '',
  });
}

export const ESTABLECIMIENTOS_EXPORT_COLUMNS: ExportColumn<EstablecimientoExportRow>[] = [
  { header: 'Cliente',   width: 30, get: r => r.clienteNombre },
  { header: 'Nombre',    width: 26, get: r => r.est.nombre },
  { header: 'Dirección', width: 30, get: r => r.est.direccion || '' },
  { header: 'Localidad', width: 18, get: r => r.est.localidad || '' },
  { header: 'Provincia', width: 16, get: r => r.est.provincia || '' },
  { header: 'Estado',    width: 10, get: r => r.est.activo ? 'Activo' : 'Inactivo' },
];
