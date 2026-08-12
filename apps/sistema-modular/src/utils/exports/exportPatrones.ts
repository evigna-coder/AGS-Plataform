import type { Patron, PatronLoteBajaEntry } from '@ags/shared';
import { CATEGORIA_PATRON_LABELS, MOTIVO_BAJA_LOTE_LABELS, type CategoriaPatron } from '@ags/shared';
import { formatFechaAR } from '../formatFecha';
import type { ExportColumn } from '../exportToExcel';
import { filtrosAplicadosDesc } from './filtros';

/**
 * Export de Patrones (Excel + PDF vía ExportarButton). Dos sets de columnas —
 * uno por pestaña: lotes activos (una fila por patrón) e historial de bajas
 * (una fila por lote dado de baja).
 */

/** Badge de estado global del patrón — la página lo importa de acá (label + cls UI). */
export const PATRON_ESTADO_BADGE: Record<string, { label: string; cls: string }> = {
  vigente: { label: 'Vigente', cls: 'bg-green-100 text-green-800' },
  por_vencer: { label: 'Por vencer', cls: 'bg-amber-100 text-amber-800' },
  vencido: { label: 'Vencido', cls: 'bg-red-100 text-red-800' },
  sin_cert: { label: 'Sin cert.', cls: 'bg-slate-100 text-slate-500' },
};

export interface PatronExportRow {
  patron: Patron;
  /** Label legible del estado global (lote más crítico). */
  estadoLabel: string;
  /** Vencimiento más próximo entre lotes (YYYY-MM-DD) o null. */
  vencimiento: string | null;
  /** Suma de cantidades de lotes; null si ningún lote tiene cantidad numérica. */
  cantidad: number | null;
}

export const PATRONES_EXPORT_COLUMNS: ExportColumn<PatronExportRow>[] = [
  { header: 'Código artículo', width: 15, get: r => r.patron.codigoArticulo || '' },
  { header: 'Descripción',     width: 34, get: r => r.patron.descripcion || '' },
  { header: 'Marca',           width: 14, get: r => r.patron.marca || '' },
  { header: 'Categorías',      width: 22, get: r => r.patron.categorias.map(c => CATEGORIA_PATRON_LABELS[c as CategoriaPatron] || c).join(', ') },
  { header: 'Lotes',           width: 7,  get: r => r.patron.lotes.length, align: 'right' },
  { header: 'Estado',          width: 12, get: r => r.patron.lotes.length ? r.estadoLabel : 'Sin lotes' },
  { header: 'Vencimiento',     width: 12, get: r => r.vencimiento ? formatFechaAR(r.vencimiento) : '' },
  { header: 'Cantidad',        width: 10, get: r => r.cantidad, align: 'right' },
];

/** Fila del historial de bajas: un lote dado de baja + su patrón. */
export interface PatronBajaExportRow {
  patron: Patron;
  entry: PatronLoteBajaEntry;
}

/** Aplana lotesBaja de todos los patrones, más recientes primero (mismo orden que la tabla). */
export function buildPatronesBajasExportRows(patrones: Patron[]): PatronBajaExportRow[] {
  const all: PatronBajaExportRow[] = [];
  for (const patron of patrones) {
    for (const entry of patron.lotesBaja ?? []) all.push({ patron, entry });
  }
  all.sort((a, b) => b.entry.fechaBaja.localeCompare(a.entry.fechaBaja));
  return all;
}

export const PATRONES_BAJAS_EXPORT_COLUMNS: ExportColumn<PatronBajaExportRow>[] = [
  { header: 'Código artículo', width: 15, get: r => r.patron.codigoArticulo || '' },
  { header: 'Descripción',     width: 30, get: r => r.patron.descripcion || '' },
  { header: 'Lote',            width: 14, get: r => r.entry.lote.lote || '' },
  { header: 'Motivo',          width: 13, get: r => MOTIVO_BAJA_LOTE_LABELS[r.entry.motivo] ?? r.entry.motivo },
  { header: 'Vencimiento',     width: 12, get: r => r.entry.lote.fechaVencimiento ? formatFechaAR(r.entry.lote.fechaVencimiento) : '' },
  { header: 'Fecha baja',      width: 12, get: r => formatFechaAR(r.entry.fechaBaja) },
  { header: 'Por',             width: 18, get: r => r.entry.bajaPorNombre || '' },
  { header: 'Cantidad',        width: 10, get: r => typeof r.entry.lote.cantidad === 'number' ? r.entry.lote.cantidad : null, align: 'right' },
];

/** Línea "Filtros: …" del export — refleja los filtros activos de PatronesList. */
export function buildPatronesFiltrosExport(filters: {
  vista: string; categoria: string; showInactive: boolean; bloqueados: boolean;
}): string[] {
  return filtrosAplicadosDesc({
    Vista: filters.vista === 'bajas' ? 'Historial de bajas' : '',
    'Categoría': CATEGORIA_PATRON_LABELS[filters.categoria as CategoriaPatron] ?? filters.categoria,
    'Incluye inactivos': filters.showInactive,
    'Solo bloqueados': filters.bloqueados,
  });
}
