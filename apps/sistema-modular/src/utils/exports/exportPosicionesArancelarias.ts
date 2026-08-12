import type { PosicionArancelaria } from '@ags/shared';
import { type ExportColumn } from '../exportToExcel';
import { filtrosAplicadosDesc } from './filtros';

/** Display igual a la tabla: valor con símbolo %, vacío si no está cargado. */
const pct = (v: number | null | undefined): string => (v != null ? `${v}%` : '');

/** Export de Posiciones Arancelarias (Excel + PDF vía ExportarButton). */
export const POSICIONES_ARANCELARIAS_EXPORT_COLUMNS: ExportColumn<PosicionArancelaria>[] = [
  { header: 'Código',      width: 17, get: p => p.codigo },
  { header: 'Descripción', width: 38, get: p => p.descripcion },
  { header: 'DI %',        width: 8,  get: p => pct(p.tratamiento?.derechoImportacion), align: 'right' },
  { header: 'Est. %',      width: 8,  get: p => pct(p.tratamiento?.estadistica), align: 'right' },
  { header: 'IVA %',       width: 8,  get: p => pct(p.tratamiento?.iva), align: 'right' },
  { header: 'IVA Ad. %',   width: 9,  get: p => pct(p.tratamiento?.ivaAdicional), align: 'right' },
  { header: 'Gan. %',      width: 8,  get: p => pct(p.tratamiento?.ganancias), align: 'right' },
  { header: 'IIBB %',      width: 8,  get: p => pct(p.tratamiento?.ingresosBrutos), align: 'right' },
  { header: 'Estado',      width: 10, get: p => (p.activo ? 'Activa' : 'Inactiva') },
];

/** Línea "Filtros: …" del export — refleja los filtros activos de la página. */
export function buildPosicionesFiltrosExport(q: string, showInactive: boolean): string[] {
  return filtrosAplicadosDesc({
    'Búsqueda': q ? `'${q}'` : '',
    'Incluye inactivas': showInactive,
  });
}
