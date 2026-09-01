import * as XLSX from 'xlsx';

export interface ExportColumn<T> {
  header: string;
  width?: number;  // character width
  get: (row: T) => string | number | null;
  align?: 'left' | 'center' | 'right';
}

/**
 * Agrupación de dos niveles para el "resumen catalogado" (2026-09-01):
 * categoría → subcategoría → filas, cada nivel con su total. Compartida por el
 * Excel y el PDF para que ambos salgan del mismo armado.
 */
export interface SubgrupoExport<T> {
  titulo: string;
  total: number;
  rows: T[];
}
export interface GrupoExport<T> {
  titulo: string;
  total: number;
  subgrupos: SubgrupoExport<T>[];
}

export interface ExportToExcelOptions<T> {
  data: T[];
  columns: ExportColumn<T>[];
  sheetName: string;
  filename: string;  // sin extension .xlsx
  freezeHeader?: boolean;  // default true
  /** Si viene, la hoja sale agrupada con subtítulos y totales en vez de plana. */
  grupos?: GrupoExport<T>[];
}

export function exportToExcel<T>(opts: ExportToExcelOptions<T>): void {
  const { data, columns, sheetName, filename, freezeHeader = true, grupos } = opts;

  const headers = columns.map(c => c.header);
  const aoa: (string | number | null)[][] = [headers];
  const blank = () => headers.map(() => null);
  if (grupos) {
    for (const g of grupos) {
      aoa.push(blank());
      aoa.push([`${g.titulo.toUpperCase()} — ${g.total}`, ...headers.slice(1).map(() => null)]);
      for (const sg of g.subgrupos) {
        aoa.push([`    ${sg.titulo} (${sg.total})`, ...headers.slice(1).map(() => null)]);
        for (const row of sg.rows) aoa.push(columns.map(c => c.get(row)));
      }
    }
    aoa.push(blank());
    aoa.push([`TOTAL GENERAL — ${grupos.reduce((a, g) => a + g.total, 0)}`, ...headers.slice(1).map(() => null)]);
  } else {
    for (const row of data) {
      aoa.push(columns.map(c => c.get(row)));
    }
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
