import type { CategoriaEquipo, Establecimiento, ModuloSistema, Sistema } from '@ags/shared';
import { type ExportColumn } from '../exportToExcel';
import { filtrosAplicadosDesc } from './filtros';

/**
 * Export de Equipos / Sistemas (Excel + PDF vía ExportarButton).
 * Cliente/establecimiento/categoría se resuelven con los mismos maps que usa
 * la tabla (cliente vía establecimiento → clienteCuit, fallback clienteId).
 */
export interface EquipoExportRow {
  sistema: Sistema;
  clienteNombre: string;
  establecimientoNombre: string;
  categoriaNombre: string;
}

export function buildEquiposExportRows(
  sistemas: Sistema[],
  estMap: Record<string, Establecimiento>,
  clienteMap: Record<string, string>,
  catMap: Record<string, string>,
): EquipoExportRow[] {
  return sistemas.map(s => {
    const est = estMap[s.establecimientoId || ''];
    return {
      sistema: s,
      clienteNombre: clienteMap[est?.clienteCuit ?? s.clienteId ?? ''] || '',
      establecimientoNombre: est?.nombre || '',
      categoriaNombre: catMap[s.categoriaId] || '',
    };
  });
}

/** Línea "Filtros: …" del export — refleja los filtros activos de EquiposList. */
export function buildEquiposFiltrosExport(
  filters: { search: string; estadoTab: string; categoriaFilter: string },
  categorias: CategoriaEquipo[],
): string[] {
  return filtrosAplicadosDesc({
    Estado: filters.estadoTab === 'activos' ? 'Activos'
      : filters.estadoTab === 'inactivos' ? 'Inactivos' : '',
    'Categoría': categorias.find(c => c.id === filters.categoriaFilter)?.nombre,
    'Búsqueda': filters.search ? `'${filters.search}'` : '',
  });
}

/** Fila de la vista por módulos (2026-10-01). */
export interface ModuloExportRow {
  m: ModuloSistema;
  s: Sistema;
  cliente: string;
  est: string;
  categoria: string;
}

export const MODULOS_EXPORT_COLUMNS: ExportColumn<ModuloExportRow>[] = [
  { header: 'Módulo',          width: 14, get: r => r.m.nombre || '' },
  { header: 'Descripción',     width: 30, get: r => r.m.descripcion || '' },
  { header: 'N° serie',        width: 16, get: r => r.m.serie || '' },
  { header: 'Marca',           width: 12, get: r => r.m.marca || '' },
  { header: 'Firmware',        width: 12, get: r => r.m.firmware || '' },
  { header: 'Sistema',         width: 22, get: r => r.s.nombre || '' },
  { header: 'ID equipo',       width: 14, get: r => r.s.codigoInternoCliente || r.s.agsVisibleId || '' },
  { header: 'Categoría',       width: 16, get: r => r.categoria },
  { header: 'Cliente',         width: 28, get: r => r.cliente },
  { header: 'Establecimiento', width: 22, get: r => r.est },
];

export const EQUIPOS_EXPORT_COLUMNS: ExportColumn<EquipoExportRow>[] = [
  { header: 'Cliente',         width: 28, get: r => r.clienteNombre },
  { header: 'Nombre',          width: 26, get: r => r.sistema.nombre },
  { header: 'Establecimiento', width: 22, get: r => r.establecimientoNombre },
  { header: 'Categoría',       width: 16, get: r => r.categoriaNombre },
  { header: 'Sector',          width: 16, get: r => r.sistema.sector || '' },
  { header: 'Código',          width: 14, get: r => r.sistema.codigoInternoCliente || '' },
  { header: 'Software',        width: 16, get: r => r.sistema.software || '' },
  { header: 'Estado',          width: 12, get: r => `${r.sistema.activo ? 'Activo' : 'Inactivo'}${r.sistema.enContrato ? ' · Contrato' : ''}` },
];
