import type { Loaner } from '@ags/shared';
import { ESTADO_LOANER_LABELS } from '@ags/shared';
import { type ExportColumn } from '../exportToExcel';

/**
 * Export de Loaners (Excel + PDF vía ExportarButton).
 * `ubicacion` se resuelve en la página (préstamo activo + sufijo de
 * establecimiento) con el mismo criterio que la columna "Ubicación actual".
 */
export interface LoanerExportRow {
  loaner: Loaner;
  /** Cliente del préstamo activo, "AGS Base" o vacío. */
  ubicacion: string;
}

export function buildLoanerExportRows(
  loaners: Loaner[],
  sufijoEstab: (clienteId?: string | null, establecimientoId?: string | null) => string,
): LoanerExportRow[] {
  return loaners.map(l => {
    const prestamo = l.prestamos.find(p => p.estado === 'activo');
    return {
      loaner: l,
      ubicacion: prestamo
        ? `${prestamo.clienteNombre}${sufijoEstab(prestamo.clienteId, prestamo.establecimientoId)}`
        : l.estado === 'en_base' ? 'AGS Base' : '',
    };
  });
}

export const LOANERS_EXPORT_COLUMNS: ExportColumn<LoanerExportRow>[] = [
  { header: 'Código',           width: 11, get: r => r.loaner.codigo },
  { header: 'Descripción',      width: 30, get: r => r.loaner.descripcion },
  { header: 'Módulo',           width: 16, get: r => r.loaner.moduloCodigo || '' },
  { header: 'Serie',            width: 14, get: r => r.loaner.serie || '' },
  { header: 'Estado',           width: 15, get: r => ESTADO_LOANER_LABELS[r.loaner.estado] || r.loaner.estado },
  { header: 'Ubicación actual', width: 26, get: r => r.ubicacion },
];
