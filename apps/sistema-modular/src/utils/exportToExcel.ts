import * as XLSX from 'xlsx';

export interface ExportColumn<T> {
  header: string;
  width?: number;  // character width
  get: (row: T) => string | number | null;
  align?: 'left' | 'center' | 'right';
}

export interface ExportToExcelOptions<T> {
  data: T[];
  columns: ExportColumn<T>[];
  sheetName: string;
  filename: string;  // sin extension .xlsx
  freezeHeader?: boolean;  // default true
}

export function exportToExcel<T>(opts: ExportToExcelOptions<T>): void {
  const { data, columns, sheetName, filename, freezeHeader = true } = opts;

  const headers = columns.map(c => c.header);
  const aoa: (string | number | null)[][] = [headers];
  for (const row of data) {
    aoa.push(columns.map(c => c.get(row)));
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Column widths
  ws['!cols'] = columns.map(c => ({ wch: c.width ?? Math.max(12, c.header.length + 2) }));

  // Header styling — bold only (NO teal fill — Phase 10 plain strip per CONTEXT)
  for (let c = 0; c < headers.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[addr]) {
      ws[addr].s = {
        font: { bold: true },
        alignment: { horizontal: 'center', vertical: 'center' },
      };
    }
  }

  if (freezeHeader) {
    // W8 fix — xlsx free edition uses !views (frozen panes with ySplit).
    // !freeze is legacy for some older parsers; set both for max compat.
    // Verify in real Excel: open generated file + confirm first row stays pinned on scroll.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ws['!views'] = [{ state: 'frozen', ySplit: 1 } as any];
    // !freeze is a valid runtime prop but not in the xlsx type definitions (legacy compat)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ws as any)['!freeze'] = { xSplit: 0, ySplit: 1 };
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/** Formato consistente de fecha corta para exports (es-AR dd/mm/yy). */
export function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch { return '—'; }
}
