import type { MenuButtonItem } from '../ui/MenuButton';
import { exportToExcel } from '../../utils/exportToExcel';
import { exportListadoPDF } from '../../utils/exportListadoPDF';
import { todayForFilename } from '../../utils/remitoPdfActions';
import {
  LOANERS_RESUMEN_COLUMNS, buildLoanerGrupos, type LoanerExportRow,
} from '../../utils/exports/exportLoaners';

/**
 * Entradas extra del menú "Exportar" de Loaners: el resumen catalogado por
 * categoría de equipo y tipo de módulo (2026-09-01), en PDF y Excel.
 *
 * Vive acá y no en LoanersList para no seguir engordando esa página, que ya
 * está sobre el presupuesto de 250 líneas.
 */
export function buildLoanerResumenItems(opts: {
  rows: LoanerExportRow[];
  filtrosAplicados: string[];
}): MenuButtonItem[] {
  const { rows, filtrosAplicados } = opts;
  const grupos = buildLoanerGrupos(rows);
  const filename = `loaners-resumen-${todayForFilename()}`;

  return [
    {
      label: 'Resumen por categoría (PDF)',
      onClick: () => {
        void exportListadoPDF({
          titulo: 'Resumen de loaners',
          subtitulo: 'Por categoría de equipo y tipo de módulo',
          filtrosAplicados,
          columnas: LOANERS_RESUMEN_COLUMNS,
          data: rows,
          grupos,
          filename,
          orientacion: 'portrait',
        }).catch(err => {
          console.error('[loanerResumenExport] PDF:', err);
          alert('Error al generar el resumen');
        });
      },
    },
    {
      label: 'Resumen por categoría (Excel)',
      onClick: () => exportToExcel({
        data: rows,
        grupos,
        columns: LOANERS_RESUMEN_COLUMNS,
        sheetName: 'Resumen loaners',
        filename,
      }),
    },
  ];
}
