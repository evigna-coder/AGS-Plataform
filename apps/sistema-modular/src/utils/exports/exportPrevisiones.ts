import type { AgendaPrevision, EstadoPrevision, Ingeniero } from '@ags/shared';
import { ESTADO_PREVISION_LABELS } from '@ags/shared';
import { fmtDateShort, type ExportColumn } from '../exportToExcel';
import { filtrosAplicadosDesc } from './filtros';

/**
 * Export de Previsiones — OTs sin abrir (Excel + PDF vía ExportarButton).
 * Mismas columnas que PrevisionesTable.
 */

// Las fechas son 'YYYY-MM-DD': se ancla T00:00:00 local para no retroceder un
// día al formatear en UTC-3.
const fmtDia = (d: string) => (d ? fmtDateShort(`${d}T00:00:00`) : '—');

/** Rango legible: un solo día → una fecha; multi-día → "dd/mm/aa — dd/mm/aa". */
const rango = (p: AgendaPrevision) =>
  p.fechaInicio === p.fechaFin ? fmtDia(p.fechaInicio) : `${fmtDia(p.fechaInicio)} — ${fmtDia(p.fechaFin)}`;

export const PREVISIONES_EXPORT_COLUMNS: ExportColumn<AgendaPrevision>[] = [
  { header: 'Fecha',            width: 20, get: p => rango(p) },
  { header: 'Cliente',          width: 26, get: p => p.clienteNombre || '' },
  { header: 'Establecimiento',  width: 20, get: p => p.establecimientoNombre || '' },
  { header: 'Tipo de servicio', width: 22, get: p => p.tipoServicio || '' },
  { header: 'Equipo / Sistema', width: 22, get: p => p.sistemaNombre || p.equipoModelo || '' },
  { header: 'Ingeniero',        width: 18, get: p => p.ingenieroNombre || '' },
  { header: 'Estado',           width: 16, get: p => ESTADO_PREVISION_LABELS[p.estado] ?? p.estado },
  { header: 'OT origen',        width: 11, get: p => p.origenOtNumber || '' },
  { header: 'Contrato',         width: 9,  get: p => (p.tieneContrato ? 'Sí' : 'No') },
];

/** Línea "Filtros: …" del export — refleja los filtros activos de la pestaña. */
export function buildPrevisionesFiltrosExport(
  filters: { anio: string; ingenieroId: string; estado: string; busqueda: string },
  ingenieros: Ingeniero[],
): string[] {
  return filtrosAplicadosDesc({
    'Año': filters.anio,
    Ingeniero: ingenieros.find(i => i.id === filters.ingenieroId)?.nombre,
    Estado: filters.estado ? (ESTADO_PREVISION_LABELS[filters.estado as EstadoPrevision] ?? filters.estado) : '',
    'Búsqueda': filters.busqueda ? `'${filters.busqueda}'` : '',
  });
}
