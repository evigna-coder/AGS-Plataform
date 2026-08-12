import {
  CATEGORIA_PATRON_LABELS,
  calcularEstadoCertificado,
  type CategoriaPatron,
  type Columna,
  type ColumnaSerie,
  type EstadoCertificado,
} from '@ags/shared';
import type { ExportColumn } from '../exportToExcel';

/**
 * Export de Columnas cromatográficas (Excel + PDF vía ExportarButton).
 * Una fila por código de artículo — las series se resumen (conteo + números
 * + estado de certificado más crítico), igual que la fila colapsada de la tabla.
 */

const ESTADO_CERT_LABELS: Record<EstadoCertificado, string> = {
  vigente: 'Vigente',
  por_vencer: 'Por vencer',
  vencido: 'Vencido',
  sin_certificado: 'Sin cert.',
};

/** Estado global: el certificado más crítico entre las series (como en ColumnaRow). */
function estadoGlobalSeries(series: ColumnaSerie[]): EstadoCertificado | null {
  const conCert = series.filter(s => !!s.fechaVencimiento);
  if (conCert.length === 0) return null;
  const estados = conCert.map(s => calcularEstadoCertificado(s.fechaVencimiento));
  if (estados.includes('vencido')) return 'vencido';
  if (estados.includes('por_vencer')) return 'por_vencer';
  return 'vigente';
}

export const COLUMNAS_EXPORT_COLUMNS: ExportColumn<Columna>[] = [
  { header: 'Código artículo', width: 16, get: c => c.codigoArticulo || '' },
  { header: 'Descripción',     width: 36, get: c => c.descripcion || '' },
  { header: 'Marca',           width: 14, get: c => c.marca || '' },
  { header: 'Categorías',      width: 22, get: c => c.categorias.map(cat => CATEGORIA_PATRON_LABELS[cat as CategoriaPatron] || cat).join(', ') },
  { header: 'Series',          width: 7,  get: c => c.series.length, align: 'right' },
  { header: 'N° de serie',     width: 28, get: c => c.series.map(s => s.serie || '(vacío)').join(', ') },
  { header: 'Estado cert.',    width: 12, get: c => {
      if (c.series.length === 0) return 'Sin series';
      const e = estadoGlobalSeries(c.series);
      return e ? ESTADO_CERT_LABELS[e] : 'Sin cert.';
    } },
];
