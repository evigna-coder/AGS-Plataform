import {
  CATEGORIA_INSTRUMENTO_LABELS,
  CATEGORIA_PATRON_LABELS,
  calcularEstadoCertificado,
  type EstadoCertificado,
  type InstrumentoPatron,
} from '@ags/shared';
import { formatFechaAR } from '../formatFecha';
import type { ExportColumn } from '../exportToExcel';
import { filtrosAplicadosDesc } from './filtros';

/**
 * Export de Instrumentos y Patrones (Excel + PDF vía ExportarButton).
 * El estado efectivo y sus labels viven acá; InstrumentosList los importa
 * para que la tabla y el export nunca diverjan.
 */

export type EstadoEfectivo = EstadoCertificado | 'en_calibracion';

/** Badge de estado efectivo — la página lo importa de acá (label + cls UI). */
export const INSTRUMENTO_ESTADO_BADGE: Record<EstadoEfectivo, { label: string; cls: string }> = {
  vigente: { label: 'Vigente', cls: 'bg-green-100 text-green-800' },
  por_vencer: { label: 'Por vencer', cls: 'bg-amber-100 text-amber-800' },
  vencido: { label: 'Vencido', cls: 'bg-red-100 text-red-800' },
  sin_certificado: { label: 'Sin cert.', cls: 'bg-slate-100 text-slate-500' },
  en_calibracion: { label: 'En calibración', cls: 'bg-blue-100 text-blue-800' },
};

/** Labels de categoría de instrumento + patrón combinados (el tipo admite ambas). */
export const ALL_CAT_LABELS: Record<string, string> = {
  ...CATEGORIA_INSTRUMENTO_LABELS,
  ...CATEGORIA_PATRON_LABELS,
};

/** Estado efectivo: "en calibración" pisa el estado del certificado. */
export function getEstadoEfectivo(i: InstrumentoPatron): EstadoEfectivo {
  if (i.estadoCalibracion === 'en_calibracion') return 'en_calibracion';
  return calcularEstadoCertificado(i.certificadoVencimiento);
}

/** Línea "Filtros: …" del export — refleja los filtros activos de InstrumentosList. */
export function buildInstrumentosFiltrosExport(filters: {
  tipo: string; categoria: string; estadoCert: string; showInactive: boolean;
}): string[] {
  return filtrosAplicadosDesc({
    Tipo: filters.tipo === 'instrumento' ? 'Instrumento' : filters.tipo === 'patron' ? 'Patrón' : '',
    'Categoría': ALL_CAT_LABELS[filters.categoria] ?? filters.categoria,
    Estado: filters.estadoCert
      ? (INSTRUMENTO_ESTADO_BADGE[filters.estadoCert as EstadoEfectivo]?.label ?? filters.estadoCert)
      : '',
    'Incluye inactivos': filters.showInactive,
  });
}

export const INSTRUMENTOS_EXPORT_COLUMNS: ExportColumn<InstrumentoPatron>[] = [
  { header: 'Identificación',  width: 22, get: i => i.nombre },
  { header: 'Marca / Modelo',  width: 22, get: i => [i.marca, i.modelo].filter(Boolean).join(' / ') },
  { header: 'Serie',           width: 15, get: i => i.serie || '' },
  { header: 'Categorías',      width: 24, get: i => i.categorias.map(c => ALL_CAT_LABELS[c] || c).join(', ') },
  { header: 'Vencimiento',     width: 12, get: i => i.certificadoVencimiento ? formatFechaAR(i.certificadoVencimiento) : '' },
  { header: 'Estado',          width: 15, get: i => INSTRUMENTO_ESTADO_BADGE[getEstadoEfectivo(i)].label },
];
