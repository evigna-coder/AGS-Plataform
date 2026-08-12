import type { QFDocumento, QFEstado } from '@ags/shared';
import { fmtDateShort, type ExportColumn } from '../exportToExcel';
import { filtrosAplicadosDesc } from './filtros';

/** Export de Documentos QF (Excel + PDF vía ExportarButton). */

export const QF_ESTADO_LABELS: Record<QFEstado, string> = {
  vigente: 'Vigente',
  obsoleto: 'Obsoleto',
};

/** Cambios de la última revisión del historial ('' si no hay historial). */
function ultimaRevision(d: QFDocumento): string {
  const h = d.historial;
  return (h && h.length > 0 ? h[h.length - 1].cambios : '') ?? '';
}

export const QF_DOCUMENTOS_EXPORT_COLUMNS: ExportColumn<QFDocumento>[] = [
  { header: 'Número',          width: 15, get: d => `${d.numeroCompleto}.${d.versionActual}` },
  { header: 'Nombre',          width: 30, get: d => d.nombre },
  { header: 'Descripción',     width: 30, get: d => d.descripcion || '' },
  { header: 'Estado',          width: 10, get: d => QF_ESTADO_LABELS[d.estado] || d.estado },
  { header: 'Última revisión', width: 32, get: d => ultimaRevision(d) },
  { header: 'Actualizado',     width: 11, get: d => fmtDateShort(d.fechaUltimaActualizacion) },
  { header: 'Usuario',         width: 22, get: d => d.ultimoUsuarioNombre || d.ultimoUsuarioEmail },
];

/** Línea "Filtros: …" del export — refleja los filtros activos de QFDocumentosList. */
export function buildQFFiltrosExport(filters: {
  search: string; tipo: string; familia: string; mostrarObsoletos: boolean;
}): string[] {
  return filtrosAplicadosDesc({
    'Búsqueda': filters.search.trim() ? `'${filters.search.trim()}'` : '',
    Tipo: filters.tipo,
    Familia: filters.familia,
    'Incluye obsoletos': filters.mostrarObsoletos,
  });
}
