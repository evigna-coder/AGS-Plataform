import React, { useMemo, useEffect } from 'react';
import type {
  ProtocolTableRow as ProtocolTableRowType,
  ProtocolTableCell as ProtocolTableCellType,
} from '../../types';

const GREY_ROW_ID = 'row_0_grey_sec19_sec18';

function makeGreyTitleRow(title: string): ProtocolTableRowType {
  return {
    id: GREY_ROW_ID,
    cells: [
      { type: 'text', value: title, colSpan: 4, variant: 'header' },
      { type: 'checkbox', value: false, checkboxLabel: 'Ver especificación\ndel cliente', variant: 'header', colSpan: 2 },
    ],
  };
}

export interface ProtocolTableProps {
  headers: string[];
  rows: ProtocolTableRowType[];
  editable?: boolean;
  getCellValue: (rowId: string, cellKey: string) => string;
  onChangeCell?: (rowId: string, cellKey: string, value: string) => void;
  /** V2: layout de tabla (default 'fixed') */
  layout?: 'fixed' | 'auto';
  /** V2: anchos de columna (ej. ["35%","20%","25%","20%"]) */
  columnWidths?: string[];
  /** V2: caption opcional */
  caption?: string;
  /** Para sec_18/sec_19: si se pasa y la primera fila no es la gris, se antepone fila gris con este título. */
  sectionId?: string;
  /** Índice de sección (1-based) para forzar formato compuesto cuando === 19. */
  sectionIndex?: number;
  /** Título para la fila gris cuando sectionId es sec_18 o sec_19 o sectionIndex es 19. */
  compositeTitleRowTitle?: string;
}

type GridCell = ProtocolTableCellType & { rowIndex: number; cellIndex: number; logicalCol: number } | 'covered';

/**
 * Layout engine: respeta rowSpan/colSpan. Por cada fila mantenemos rowspanLeft[col] =
 * cuántas filas (incl. la actual) sigue ocupada esa columna por un rowSpan anterior.
 * Solo colocamos celdas en columnas libres (rowspanLeft[col] === 0).
 * Así filas con menos celdas (por rowSpan arriba) no "corren" a la izquierda.
 */
function buildBodyGrid(
  rows: ProtocolTableRowType[],
  totalCols: number
): GridCell[][] {
  const grid: GridCell[][] = rows.map(() => Array(totalCols).fill(null) as GridCell[]);
  let rowspanLeft: number[] = Array(totalCols).fill(0);

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    let cellIdx = 0;
    for (let col = 0; col < totalCols && cellIdx < row.cells.length; col++) {
      if (rowspanLeft[col] > 0) continue;
      const cell = row.cells[cellIdx];
      const cs = cell.colSpan ?? 1;
      const rs = cell.rowSpan ?? 1;
      const logicalCol = col;
      grid[r][col] = { ...cell, rowIndex: r, cellIndex: cellIdx, logicalCol };
      for (let cc = col; cc < col + cs && cc < totalCols; cc++) {
        rowspanLeft[cc] = rs;
      }
      for (let rr = r + 1; rr < r + rs && rr < rows.length; rr++) {
        for (let cc = col; cc < col + cs && cc < totalCols; cc++) {
          if (grid[rr][cc] === null) (grid[rr] as unknown[])[cc] = 'covered';
        }
      }
      cellIdx++;
      col += cs - 1;
    }
    rowspanLeft = rowspanLeft.map((left) => Math.max(0, left - 1));
  }
  return grid;
}

function getTotalCols(
  headers: string[],
  rows: ProtocolTableRowType[],
  columnWidths?: string[]
): number {
  if (columnWidths?.length) return columnWidths.length;
  const firstRowSum =
    rows.length > 0
      ? rows[0].cells.reduce((s, c) => s + (c.colSpan ?? 1), 0)
      : 0;
  const fromRows = Math.max(
    firstRowSum,
    ...rows.map((r) => r.cells.reduce((s, c) => s + (c.colSpan ?? 1), 0))
  );
  return Math.max(headers.length, fromRows, 1);
}

function cellVariantClass(variant?: string): string {
  switch (variant) {
    case 'header':
      return 'protocol-cell-header bg-slate-200 font-bold uppercase text-[10px] text-slate-700';
    case 'subheader':
      return 'protocol-cell-subheader bg-slate-100 font-semibold text-slate-600';
    case 'note':
      return 'protocol-cell-note italic text-slate-500';
    default:
      return '';
  }
}

function cellAlignClass(align?: string): string {
  switch (align) {
    case 'center':
      return 'text-center';
    case 'right':
      return 'text-right';
    default:
      return 'text-left';
  }
}

/**
 * Detecta si el título de columna corresponde a una columna booleana (checkbox).
 * Si no es booleana → renderizar como input de texto.
 */
function isBooleanColumn(title?: string): boolean {
  if (!title || typeof title !== 'string') return false;
  const t = title.trim();
  return /cumple|no cumple|no aplica|adjunto|sí\b|si\b|no\b|n\/a|na\b/i.test(t);
}

/** Título indica "Nueva especificación" → siempre input de texto. */
function isNuevaEspecificacionColumn(title?: string): boolean {
  if (!title || typeof title !== 'string') return false;
  return /nueva especificación/i.test(title.trim());
}

const HEADER_WORDS = [
  'parámetro',
  'resultado',
  'especificación',
  'conclusiones',
  'cumple',
  'no cumple',
  'no aplica',
];

function includesAny(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w));
}

/** Extrae texto de una celda de forma robusta para detectar subheader de conclusiones (Cumple | No cumple | No aplica). */
function looseText(cell: unknown): string {
  if (!cell || typeof cell !== 'object') return '';
  const c = cell as { type?: string; value?: unknown; checkboxLabel?: string };
  if (c.type === 'text') return String(c.value ?? '').trim().toLowerCase();
  if (c.type === 'checkbox') return String(c.checkboxLabel ?? '').trim().toLowerCase();
  if (c.type === 'input') return String(c.value ?? '').trim().toLowerCase();
  return String(c.value ?? '').trim().toLowerCase();
}

/** Decodifica entidades HTML en texto (ej. &gt; → >) para fidelidad Word. */
function decodeHtmlEntities(s: string): string {
  if (typeof s !== 'string' || !s.length) return s;
  const div = document.createElement('div');
  div.innerHTML = s;
  return div.textContent ?? div.innerText ?? s;
}

/**
 * Sanitiza texto: elimina caracteres de línea (box drawing / combining underline) y espacios raros heredados de Word.
 */
function sanitizeText(s: string): string {
  if (typeof s !== 'string') return '';
  let t = s
    .replace(/\u00A0/g, ' ')
    .replace(/\u0332/g, '')
    .replace(/[\u2500-\u257F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return t;
}

/**
 * Tabla densa tipo informe: borde fino, cabecera gris claro, celdas compactas.
 * V2: colSpan/rowSpan, columnWidths, variant (header/subheader/note), checkboxGroup (radio por grupo).
 */
export const ProtocolTable: React.FC<ProtocolTableProps> = ({
  headers,
  rows,
  editable = false,
  getCellValue,
  onChangeCell,
  layout = 'fixed',
  columnWidths,
  caption,
  sectionId,
  sectionIndex,
  compositeTitleRowTitle,
}) => {
  const isCompositeSection = sectionId === 'sec_19' || sectionId === 'sec_18' || sectionIndex === 19;
  const effectiveRows = useMemo(() => {
    if (isCompositeSection && compositeTitleRowTitle && rows.length > 0) {
      const first = rows[0].cells?.[0] as { variant?: string; colSpan?: number } | undefined;
      const hasGrey = first?.variant === 'header' && (first?.colSpan ?? 0) >= 4;
      if (!hasGrey) return [makeGreyTitleRow(compositeTitleRowTitle), ...rows];
    }
    return rows;
  }, [isCompositeSection, compositeTitleRowTitle, rows]);

  const totalCols = useMemo(
    () => getTotalCols(headers, effectiveRows, columnWidths),
    [headers.length, effectiveRows, columnWidths]
  );
  const bodyGrid = useMemo(() => buildBodyGrid(effectiveRows, totalCols), [effectiveRows, totalCols]);

  if (import.meta.env.DEV && (sectionId === 'sec_19' || sectionId === 'sec_20' || sectionId === 'sec_21')) {
    console.log('TABLE RENDER', sectionId, {
      headersLen: headers?.length ?? 0,
      rowsLen: rows?.length ?? 0,
      totalCols,
      isCompositeSection,
    });
  }

  /** Si la primera fila del body es fila gris (título + checkbox), no mostrar thead de 2 niveles aunque vengan 6 headers. */
  const firstRowIsGreyTitle =
    effectiveRows.length > 0 &&
    (effectiveRows[0].cells?.[0] as { variant?: string } | undefined)?.variant === 'header' &&
    ((effectiveRows[0].cells?.[0] as { colSpan?: number } | undefined)?.colSpan ?? 0) >= 4;
  const showTwoRowThead =
    headers.length === 6 &&
    headers[3] === 'Cumple' &&
    headers[4] === 'No cumple' &&
    headers[5] === 'No aplica' &&
    !firstRowIsGreyTitle;

  const handleCheckboxChange = (
    rowId: string,
    cellKey: string,
    cell: ProtocolTableCellType,
    checked: boolean
  ) => {
    if (!onChangeCell) return;
    if (cell.checkboxGroup) {
      const row = effectiveRows.find((r) => r.id === rowId);
      if (row) {
        const groupId = cell.checkboxGroup.groupId;
        row.cells.forEach((c, j) => {
          if (c.checkboxGroup?.groupId === groupId && String(j) !== cellKey)
            onChangeCell(rowId, String(j), 'false');
        });
      }
    }
    onChangeCell(rowId, cellKey, checked ? 'true' : 'false');
  };

  /** Clase reutilizable: tamaño vía CSS --protocol-checkbox-size (16px), ver constants/protocol.ts */
  const checkboxClass =
    'protocol-checkbox shrink-0 accent-slate-700 cursor-pointer';

  const baseTdClass =
    'px-2 py-1 align-middle !border-b !border-slate-200 !border-r !border-slate-300 last:border-r-0';

  const COMPOSITE_TITLE_CLASS = 'bg-slate-300 font-semibold text-slate-800 text-[11px]';
  const COMPOSITE_HEADER_CLASS =
    'bg-slate-200 font-semibold text-slate-700 text-[10px] text-center !py-1 !pt-1 !pb-1 leading-tight whitespace-nowrap';
  const COMPOSITE_SUBHEADER_CLASS = 'bg-slate-100 font-semibold text-slate-600 text-[10px] text-center';

  useEffect(() => {
    if (import.meta.env.DEV && sectionId === 'sec_19') {
      queueMicrotask(() => {
        const rows = Array.from(
          document.querySelectorAll('tr[data-sectionid="sec_19"][data-rowid*="_grey"]')
        ).slice(0, 6);
        console.log('[SEC19 GREY DOM COUNT]', rows.length);
        rows.forEach((tr) =>
          console.log('[SEC19 GREY OUTERHTML]', tr.getAttribute('data-rowid'), tr.outerHTML)
        );
      });
    }
  }, [sectionId]);

  return (
    <div className="protocol-table-wrapper overflow-x-auto border border-slate-300 rounded-sm">
      {caption && (
        <div className="text-[10px] font-semibold text-slate-600 px-2 py-1 border-b border-slate-200 bg-slate-50">
          {caption}
        </div>
      )}
      <table
        className="w-full border-collapse text-[11px] protocol-table-no-break"
        style={{
          pageBreakInside: 'avoid',
          tableLayout: layout === 'fixed' ? 'fixed' : 'auto',
        }}
      >
        {columnWidths && columnWidths.length > 0 && (
          <colgroup>
            {columnWidths.slice(0, totalCols).map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
        )}
        <thead>
          {import.meta.env.DEV && (sectionId === 'sec_19' || sectionId === 'sec_21') && (
            (() => {
              console.log('THEAD DEBUG', sectionId, {
                headers,
                headersLen: headers?.length ?? 0,
              });
              return null;
            })()
          )}
          {headers.length === 0 || firstRowIsGreyTitle ? (
            <tr aria-hidden className="h-0 min-h-0 p-0 m-0 border-0 overflow-hidden">
              <th colSpan={totalCols} className="p-0 m-0 border-0 h-0 min-h-0 w-0 min-w-0 overflow-hidden invisible" style={{ lineHeight: 0, fontSize: 0 }} />
            </tr>
          ) : showTwoRowThead ? (
            <>
              <tr className="bg-slate-100 protocol-tr-no-break">
                <th className="text-left px-2 py-1.5 font-semibold uppercase tracking-wide text-[10px] text-slate-600 border-b border-slate-300 border-r border-slate-300 whitespace-normal leading-snug">
                  {headers[0]}
                </th>
                <th className="text-left px-2 py-1.5 font-semibold uppercase tracking-wide text-[10px] text-slate-600 border-b border-slate-300 border-r border-slate-300 whitespace-normal leading-snug">
                  {headers[1]}
                </th>
                <th className="text-left px-2 py-1.5 font-semibold uppercase tracking-wide text-[10px] text-slate-600 border-b border-slate-300 border-r border-slate-300 whitespace-normal leading-snug">
                  {headers[2]}
                </th>
                <th colSpan={3} className="text-left px-2 py-1.5 font-semibold uppercase tracking-wide text-[10px] text-slate-600 border-b border-slate-300 last:border-r-0 whitespace-normal leading-snug">
                  Conclusiones
                </th>
              </tr>
              <tr className="bg-slate-100 protocol-tr-no-break">
                <th className="text-left px-2 py-1 font-semibold text-[10px] text-slate-600 border-b border-slate-300 border-r border-slate-300 whitespace-normal" />
                <th className="text-left px-2 py-1 font-semibold text-[10px] text-slate-600 border-b border-slate-300 border-r border-slate-300 whitespace-normal" />
                <th className="text-left px-2 py-1 font-semibold text-[10px] text-slate-600 border-b border-slate-300 border-r border-slate-300 whitespace-normal" />
                <th className="text-left px-2 py-1 font-semibold text-[10px] text-slate-600 border-b border-slate-300 border-r border-slate-300 whitespace-normal">
                  {headers[3]}
                </th>
                <th className="text-left px-2 py-1 font-semibold text-[10px] text-slate-600 border-b border-slate-300 border-r border-slate-300 whitespace-normal">
                  {headers[4]}
                </th>
                <th className="text-left px-2 py-1 font-semibold text-[10px] text-slate-600 border-b border-slate-300 last:border-r-0 whitespace-normal">
                  {headers[5]}
                </th>
              </tr>
            </>
          ) : (
          <tr className="bg-slate-100 protocol-tr-no-break">
            {headers.length === 1 ? (
              <th
                colSpan={totalCols}
                className="text-left px-2 py-1.5 font-semibold uppercase tracking-wide text-[10px] text-slate-600 border-b border-slate-300 last:border-r-0 whitespace-normal leading-snug bg-slate-200"
              >
                {headers[0]}
              </th>
            ) : headers.length === 2 &&
            /ver especificación del cliente/i.test(String(headers[1] ?? '')) ? (
              <>
                <th
                  colSpan={Math.max(1, totalCols - 2)}
                  className="text-left px-2 py-1.5 font-semibold uppercase tracking-wide text-[10px] text-slate-600 border-b border-slate-300 border-r border-slate-300 whitespace-normal leading-snug"
                >
                  {headers[0]}
                </th>
                <th
                  colSpan={2}
                  className="protocol-th-ver-especificacion text-right px-2 py-1.5 font-semibold text-[10px] text-slate-600 border-b border-slate-300 last:border-r-0"
                >
                  <span className="inline-block text-[10px] leading-tight">
                    Ver especificación del cliente
                  </span>
                </th>
              </>
            ) : (
              headers.map((h, i) => {
                const thClassName = 'text-left px-2 py-1.5 font-semibold uppercase tracking-wide text-[10px] text-slate-600 border-b border-slate-300 border-r border-slate-300 last:border-r-0 whitespace-normal leading-snug';
                if (import.meta.env.DEV && (sectionId === 'sec_19' || sectionId === 'sec_21') && i === 0) {
                  console.log('TH CLASS', sectionId, thClassName);
                }
                return (
                  <th key={i} className={thClassName}>
                    {h}
                  </th>
                );
              })
            )}
          </tr>
          )}
        </thead>
        <tbody className="bg-white">
          {bodyGrid.map((rowCells, r) => {
            const hasRenderableCell = rowCells.some((c) => c && c !== 'covered');
            if (!hasRenderableCell) return null;
            if (sectionId === 'sec_19') {
              const row = effectiveRows[r];
              if (row) {
                console.log('ROW DEBUG SEC_19', {
                  rowId: row.id,
                  cells: row.cells.map((c) => ({
                    type: c.type,
                    colSpan: c.colSpan,
                    value: (c as { value?: unknown }).value,
                    checkboxLabel: (c as { checkboxLabel?: string }).checkboxLabel,
                  })),
                });
                const txt = row.cells
                  .map((c) =>
                    c.type === 'text'
                      ? String((c as { value?: unknown }).value ?? '')
                      : String((c as { checkboxLabel?: string }).checkboxLabel ?? '')
                  )
                  .join(' ')
                  .toLowerCase();
                if (
                  txt.includes('holmio') ||
                  txt.includes('canal b') ||
                  txt.includes('temperatura') ||
                  txt.includes('longitud')
                ) {
                  console.log('MID TITLE ROW', {
                    rowId: row.id,
                    cells: row.cells.map((c) => ({
                      type: c.type,
                      colSpan: (c as { colSpan?: number }).colSpan,
                      value: (c as { value?: unknown }).value,
                      checkboxLabel: (c as { checkboxLabel?: string }).checkboxLabel,
                      variant: (c as { variant?: string }).variant,
                      renderAs: (c as { renderAs?: string }).renderAs,
                    })),
                  });
                }
              }
            }
            const row = effectiveRows[r];
            const headersLen = headers?.length ?? 0;
            const rowText = (row?.cells ?? [])
              .map((c) =>
                c.type === 'text'
                  ? String((c as { value?: unknown }).value ?? '')
                  : String((c as { checkboxLabel?: string }).checkboxLabel ?? '')
              )
              .join(' ')
              .replace(/\s+/g, ' ')
              .trim()
              .toLowerCase();
            const looksLikeTitleRow =
              (row?.cells?.length ?? 0) >= 1 &&
              (row?.cells?.[0] as { variant?: string })?.variant === 'header' &&
              ((row?.cells?.[0] as { colSpan?: number })?.colSpan ?? 1) >= 4;
            const looksLikeHeaderRow =
              (row?.cells?.length ?? 0) === 4 &&
              rowText.includes('conclusiones');
            const looksLikeSubheaderRow =
              (row?.cells?.length ?? 0) === 3 &&
              rowText.includes('no cumple') &&
              rowText.includes('no aplica');
            const hasClientSpecCheckbox =
              (row?.cells ?? []).some((c) =>
                c.type === 'checkbox' &&
                String((c as { checkboxLabel?: string }).checkboxLabel ?? '')
                  .toLowerCase()
                  .includes('ver especificación')
              );
            if (
              (sectionId === 'sec_19' || sectionId === 'sec_21') &&
              row &&
              (looksLikeTitleRow || looksLikeHeaderRow || looksLikeSubheaderRow || hasClientSpecCheckbox)
            ) {
              console.log('ROW KIND (ROW LEVEL)', sectionId, row.id, {
                totalCols,
                headersLen,
                looksLikeTitleRow,
                looksLikeHeaderRow,
                looksLikeSubheaderRow,
                hasClientSpecCheckbox,
                rowCellsLen: row.cells.length,
              }, row.cells.map((c) => ({
                t: c.type,
                cs: (c as { colSpan?: number }).colSpan,
                v: (c as { variant?: string }).variant,
                txt: (c as { value?: unknown }).value,
                lbl: (c as { checkboxLabel?: string }).checkboxLabel,
              })));
            }
            if (import.meta.env.DEV && sectionId === 'sec_19' && row) {
              const isCompositeLikeRow = (isCompositeSection || headers.length === 0) && totalCols === 6;
              const isHeaderTitleRowR =
                isCompositeLikeRow &&
                row.cells.length >= 1 &&
                (row.cells[0] as { variant?: string })?.variant === 'header' &&
                ((row.cells[0] as { colSpan?: number })?.colSpan ?? 1) >= 4;
              const isCompositeHeaderRowR =
                isCompositeLikeRow &&
                row.cells.length === 4 &&
                looseText(row.cells[3]).includes('conclusiones');
              const isConclusionesSubheaderRowR =
                isCompositeLikeRow &&
                row.cells.length === 3 &&
                row.cells.some((c) => looseText(c).includes('no cumple')) &&
                row.cells.some((c) => looseText(c).includes('no aplica'));
              const rowTextDisplay = row.cells
                .map((c) =>
                  c.type === 'text'
                    ? String((c as { value?: unknown }).value ?? '')
                    : String((c as { checkboxLabel?: string }).checkboxLabel ?? '')
                )
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim();
              const lower = rowTextDisplay.toLowerCase();
              const maybe =
                isHeaderTitleRowR ||
                isCompositeHeaderRowR ||
                isConclusionesSubheaderRowR ||
                lower.includes('parámetro') ||
                lower.includes('cumple') ||
                lower.includes('conclusiones');
              if (maybe) {
                console.log('SEC19 ROW CLASSIFY', row.id, {
                  isHeaderTitleRow: isHeaderTitleRowR,
                  isCompositeHeaderRow: isCompositeHeaderRowR,
                  isConclusionesSubheaderRow: isConclusionesSubheaderRowR,
                  rowCellsLen: row.cells.length,
                  cells: row.cells.map((c) => ({
                    t: c.type,
                    cs: (c as { colSpan?: number }).colSpan,
                    v: (c as { variant?: string }).variant,
                    txt: (c as { value?: unknown }).value,
                    lbl: (c as { checkboxLabel?: string }).checkboxLabel,
                  })),
                }, rowTextDisplay);
              }
            }
            return (
            <tr
              key={effectiveRows[r]?.id ?? r}
              data-sectionid={sectionId}
              data-rowid={effectiveRows[r]?.id ?? ''}
              className="protocol-tr-no-break border-b border-slate-200 last:border-b-0 hover:bg-slate-50/50"
              style={{ pageBreakInside: 'avoid' }}
            >
              {rowCells.map((cellOrCovered, c) => {
                if (!cellOrCovered || cellOrCovered === 'covered') return null;
                const cell = cellOrCovered as GridCell & ProtocolTableCellType;
                const { rowIndex, cellIndex, logicalCol } = cell as GridCell & { rowIndex: number; cellIndex: number; logicalCol: number };
                const isTopLeft = logicalCol === c;
                if (!isTopLeft) return null;
                const row = effectiveRows[rowIndex];
                if (import.meta.env.DEV && (sectionId === 'sec_19' || sectionId === 'sec_21') && rowIndex === 0 && cellIndex === 0) {
                  console.log('TBODY FIRST ROW', sectionId, {
                    rowId: row.id,
                    cellsLen: row.cells.length,
                    cells: row.cells.map((c) => ({
                      t: c.type,
                      cs: (c as { colSpan?: number }).colSpan,
                      v: (c as { variant?: string }).variant,
                      txt: (c as { value?: unknown }).value,
                      lbl: (c as { checkboxLabel?: string }).checkboxLabel,
                    })),
                  });
                }
                const cellKey = String(cellIndex);
                const displayValue = getCellValue(row.id, cellKey);
                const variantClass = cellVariantClass(cell.variant);
                const alignClass = cellAlignClass(cell.align);
                const columnTitle = headers[logicalCol] ?? '';
                const isCompositeLike = (isCompositeSection || headers.length === 0) && totalCols === 6;
                const isHeaderTitleRow =
                  isCompositeLike &&
                  row.cells.length >= 1 &&
                  row.cells[0]?.variant === 'header' &&
                  (row.cells[0]?.colSpan ?? 1) >= 4;
                const hasClientSpecCheckbox =
                  isHeaderTitleRow &&
                  row.cells.some((c) =>
                    c.type === 'checkbox' &&
                    String(c.checkboxLabel ?? '').toLowerCase().includes('ver especificación')
                  );
                const rowText = row.cells.map((c) => looseText(c)).join(' ').trim();
                const hasControl = row.cells.some(
                  (c) =>
                    c.type === 'checkbox' ||
                    c.type === 'input' ||
                    (c as { renderAs?: string }).renderAs === 'input'
                );
                const isBlockTitleLikeRow =
                  isCompositeLike &&
                  !!rowText &&
                  rowText.includes('test') &&
                  !includesAny(rowText, HEADER_WORDS) &&
                  !hasControl &&
                  !isHeaderTitleRow;
                const dominantStartCol = (() => {
                  const cells = row.cells ?? [];
                  let col = 0;
                  let maxSpan = 0;
                  let start = 0;
                  cells.forEach((cel) => {
                    const span = (cel as { colSpan?: number }).colSpan ?? 1;
                    if (span >= maxSpan) {
                      maxSpan = span;
                      start = col;
                    }
                    col += span;
                  });
                  return start;
                })();
                const isCompositeHeaderRow =
                  isCompositeLike &&
                  row.cells.length === 4 &&
                  looseText(row.cells[3]).includes('conclusiones');
                const baseCellClass = `${variantClass} ${alignClass}`;
                const isCompositeLikeTable = (isCompositeSection || (headers?.length ?? 0) === 0) && totalCols === 6;
                const conclusionDividerClass = isCompositeLikeTable && c === 3 ? 'protocol-conclusion-divider' : '';
                const debugOutline =
                  sectionId === 'sec_19' && isHeaderTitleRow && cell.type === 'checkbox'
                    ? { outline: '3px solid red', outlineOffset: '-3px' as const }
                    : undefined;
                const isConclusionesSubheaderRow =
                  isCompositeLike &&
                  row.cells.length === 3 &&
                  row.cells.some((c) => looseText(c).includes('no cumple')) &&
                  row.cells.some((c) => looseText(c).includes('no aplica'));
                const conclusionesSubheaderLabels = ['Cumple', 'No cumple', 'No aplica'];

                const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                  onChangeCell?.(row.id, cellKey, e.target.value);
                };

                const isHeaderTitleCell =
                  cell.type === 'text' &&
                  cell.variant === 'header' &&
                  (cell.colSpan ?? 0) >= 4;

                // Fila título de bloque: render por logicalCol (text en 0, checkbox en 4), no por cellIndex.
                if (isHeaderTitleRow) {
                  if (cell.type === 'text' && logicalCol === 0) {
                    const title = String((cell as { value?: string }).value ?? '').trim();
                    const tdClass = `${baseTdClass} ${conclusionDividerClass} ${COMPOSITE_TITLE_CLASS}`;
                    if (import.meta.env.DEV && sectionId === 'sec_19') {
                      console.log('SEC19 TITLE ROWS RAW', row.id, (row.cells ?? []).map((cel, idx) => {
                        const lcol = (row.cells ?? []).slice(0, idx).reduce((s, x) => s + (x.colSpan ?? 1), 0);
                        return { logicalCol: lcol, type: cel.type, colSpan: (cel as { colSpan?: number }).colSpan, variant: (cel as { variant?: string }).variant };
                      }));
                    }
                    return (
                      <td
                        key={`${r}-${c}`}
                        data-tdrowid={row.id}
                        data-tdcellindex={cellIndex}
                        data-tdlogicalcol={logicalCol}
                        colSpan={cell.colSpan ?? 1}
                        rowSpan={cell.rowSpan ?? 1}
                        className={tdClass}
                        style={debugOutline}
                      >
                        <span className="whitespace-pre-line break-words">{title || 'Test'}</span>
                      </td>
                    );
                  }
                  if (cell.type === 'checkbox' && logicalCol >= 4) {
                    if (import.meta.env.DEV && sectionId === 'sec_19') {
                      console.log('SEC19 TITLE CHECKBOX', row.id, logicalCol);
                    }
                    const checked =
                      getCellValue(row.id, '1') === 'true' ||
                      getCellValue(row.id, '1') === '1' ||
                      getCellValue(row.id, '1') === 'yes' ||
                      (getCellValue(row.id, '1') === '' && (cell as { value?: boolean }).value === true);
                    const label = String((cell as { checkboxLabel?: string }).checkboxLabel ?? 'Ver especificación del cliente')
                      .replace(/\s+/g, ' ')
                      .trim();
                    return (
                      <td
                        key={`${r}-${c}`}
                        data-tdrowid={row.id}
                        data-tdcellindex={cellIndex}
                        data-tdlogicalcol={logicalCol}
                        colSpan={cell.colSpan ?? 1}
                        rowSpan={cell.rowSpan ?? 1}
                        className={`${baseTdClass} ${conclusionDividerClass} ${COMPOSITE_TITLE_CLASS} text-right`}
                        style={debugOutline}
                      >
                        <div className="flex justify-end items-center gap-2">
                          <label className="inline-flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!checked}
                              onChange={(e) =>
                                editable &&
                                onChangeCell &&
                                handleCheckboxChange(row.id, '1', cell, e.target.checked)
                              }
                              disabled={!editable || !onChangeCell}
                              className={checkboxClass}
                              aria-label={label}
                            />
                            <span className="text-[10px] text-slate-700 whitespace-normal">
                              {label}
                            </span>
                          </label>
                        </div>
                      </td>
                    );
                  }
                  return null;
                }

                // Títulos de bloque por contenido (Canal B, Temperatura, Holmio, etc.): celda dominante por logicalCol, resto vacías.
                if (isBlockTitleLikeRow) {
                  if (logicalCol !== dominantStartCol) {
                    return (
                      <td
                        key={`${r}-${c}`}
                        data-tdrowid={row.id}
                        data-tdcellindex={cellIndex}
                        data-tdlogicalcol={logicalCol}
                        colSpan={cell.colSpan ?? 1}
                        rowSpan={cell.rowSpan ?? 1}
                        className={`${baseTdClass} ${conclusionDividerClass} bg-slate-300`}
                        style={debugOutline}
                      />
                    );
                  }
                  const specKey = 'client_spec';
                  const rawSpecVal = getCellValue(row.id, specKey);
                  const specChecked =
                    rawSpecVal === 'true' || rawSpecVal === '1' || rawSpecVal === 'yes';
                  const titleShown = sanitizeText(decodeHtmlEntities(rowText));
                  return (
                    <td
                      key={`${r}-${c}`}
                      data-tdrowid={row.id}
                      data-tdcellindex={cellIndex}
                      data-tdlogicalcol={logicalCol}
                      colSpan={cell.colSpan ?? 1}
                      rowSpan={cell.rowSpan ?? 1}
                      className={`${baseTdClass} ${conclusionDividerClass} ${COMPOSITE_TITLE_CLASS}`}
                      style={debugOutline}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <span className="flex-1 text-center whitespace-pre-line break-words">
                          {titleShown || 'Test'}
                        </span>
                        <label className="inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0">
                          <input
                            type="checkbox"
                            checked={!!specChecked}
                            onChange={(e) =>
                              editable &&
                              onChangeCell &&
                              onChangeCell(row.id, specKey, e.target.checked ? 'true' : 'false')
                            }
                            disabled={!editable || !onChangeCell}
                            className={checkboxClass}
                            aria-label="Ver especificación del cliente"
                          />
                          <span className="text-[10px] text-slate-700">Ver especificación del cliente</span>
                        </label>
                      </div>
                    </td>
                  );
                }

                if (cell.inline && cell.inline.length > 0) {
                  return (
                    <td
                      key={`${r}-${c}`}
                      data-tdrowid={row.id}
                      data-tdcellindex={cellIndex}
                      data-tdlogicalcol={logicalCol}
                      colSpan={cell.colSpan ?? 1}
                      rowSpan={cell.rowSpan ?? 1}
                      className={`${baseTdClass} ${conclusionDividerClass} ${baseCellClass}`}
                      style={debugOutline}
                    >
                      <div className="flex items-center gap-3 flex-nowrap">
                        {cell.inline.map((item, idx) => {
                          if (item.kind === 'text') {
                            return (
                              <span key={idx} className="text-[10px] text-slate-700">
                                {item.text}
                              </span>
                            );
                          }
                          const subKey = `${cellKey}__${item.option}`;
                          const checked =
                            getCellValue(row.id, subKey) === 'true' ||
                            getCellValue(row.id, subKey) === '1';
                          const label = item.label ?? item.option.toUpperCase();
                          return (
                            <label
                              key={idx}
                              className="inline-flex items-center gap-1 text-[10px] cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                className={checkboxClass}
                                checked={!!checked}
                                onChange={(e) =>
                                  onChangeCell?.(
                                    row.id,
                                    subKey,
                                    e.target.checked ? 'true' : 'false'
                                  )
                                }
                                disabled={!editable || !onChangeCell}
                                aria-label={label}
                              />
                              <span>{label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </td>
                  );
                }

                if (cell.inlineCheckboxes && cell.inlineCheckboxes.length > 0) {
                  return (
                    <td
                      key={`${r}-${c}`}
                      data-tdrowid={row.id}
                      data-tdcellindex={cellIndex}
                      data-tdlogicalcol={logicalCol}
                      colSpan={cell.colSpan ?? 1}
                      rowSpan={cell.rowSpan ?? 1}
                      className={`${baseTdClass} ${conclusionDividerClass} ${baseCellClass}`}
                      style={debugOutline}
                    >
                      <div className="inline-detectors flex flex-wrap items-center gap-3">
                        {cell.inlineCheckboxPrefix && (
                          <span className="text-[10px] font-semibold text-slate-700">
                            {cell.inlineCheckboxPrefix}
                          </span>
                        )}
                        {cell.inlineCheckboxes.map((opt) => {
                          const subKey = `${cellKey}__${opt.key}`;
                          const checked =
                            getCellValue(row.id, subKey) === 'true' ||
                            getCellValue(row.id, subKey) === '1';
                          return (
                            <label
                              key={opt.key}
                              className="inline-flex items-center gap-1 text-[10px] cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                className={checkboxClass}
                                checked={!!checked}
                                onChange={(e) =>
                                  onChangeCell?.(
                                    row.id,
                                    subKey,
                                    e.target.checked ? 'true' : 'false'
                                  )
                                }
                                disabled={!editable || !onChangeCell}
                                aria-label={opt.label}
                              />
                              <span className="text-[10px]">{opt.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </td>
                  );
                }

                // Override: tabla compuesta 6 cols, fila subheader conclusiones (3 celdas en logicalCol 3,4,5).
                if (isConclusionesSubheaderRow && logicalCol >= 3 && logicalCol <= 5) {
                  const tdClass = `${baseTdClass} ${conclusionDividerClass} ${COMPOSITE_SUBHEADER_CLASS}`;
                  if ((sectionId === 'sec_19' || sectionId === 'sec_21') && logicalCol === 3) {
                    console.log('TD CLASS', sectionId, row.id, {
                      isHeaderTitleRow,
                      isCompositeHeaderRow,
                      isConclusionesSubheaderRow,
                      tdClass,
                    });
                  }
                  if (import.meta.env.DEV && sectionId === 'sec_19' && logicalCol === 3 && (isHeaderTitleRow || isCompositeHeaderRow || isConclusionesSubheaderRow)) {
                    console.log('SEC19 TDCLASS', row.id, { isHeaderTitleRow, isCompositeHeaderRow, isConclusionesSubheaderRow, colSpan: (cell as { colSpan?: number }).colSpan, tdClass });
                  }
                  return (
                    <td
                      key={`${r}-${c}`}
                      data-tdrowid={row.id}
                      data-tdcellindex={cellIndex}
                      data-tdlogicalcol={logicalCol}
                      colSpan={cell.colSpan ?? 1}
                      rowSpan={cell.rowSpan ?? 1}
                      className={tdClass}
                      style={debugOutline}
                    >
                      {conclusionesSubheaderLabels[logicalCol - 3]}
                    </td>
                  );
                }

                const isConclusionesColComposite =
                  isCompositeLike && logicalCol >= 3;
                const isSubheaderCumpleCell =
                  isCompositeSection &&
                  totalCols === 6 &&
                  row.cells.length === 3 &&
                  logicalCol === 3 &&
                  cell.type === 'checkbox' &&
                  !cell.checkboxGroup &&
                  !cell.checkboxLabel;
                if (isSubheaderCumpleCell || (isConclusionesColComposite && logicalCol === 3 && cell.type === 'checkbox' && !cell.checkboxGroup && !cell.checkboxLabel)) {
                  return (
                    <td
                      key={`${r}-${c}`}
                      data-tdrowid={row.id}
                      data-tdcellindex={cellIndex}
                      data-tdlogicalcol={logicalCol}
                      colSpan={cell.colSpan ?? 1}
                      rowSpan={cell.rowSpan ?? 1}
                      className={`${baseTdClass} ${conclusionDividerClass} ${COMPOSITE_SUBHEADER_CLASS}`}
                      style={debugOutline}
                    >
                      Cumple
                    </td>
                  );
                }

                // Fuente única de verdad: columna "NUEVA ESPECIFICACIÓN" → siempre input de texto (todas las filas, ignorar cell.type).
                if (isNuevaEspecificacionColumn(columnTitle)) {
                  return (
                    <td
                      key={`${r}-${c}`}
                      data-tdrowid={row.id}
                      data-tdcellindex={cellIndex}
                      data-tdlogicalcol={logicalCol}
                      colSpan={cell.colSpan ?? 1}
                      rowSpan={cell.rowSpan ?? 1}
                      className={`${baseTdClass} ${conclusionDividerClass} ${baseCellClass}`}
                      style={debugOutline}
                    >
                      <input
                        type="text"
                        value={displayValue}
                        onChange={(e) => onChangeCell?.(row.id, cellKey, e.target.value)}
                        placeholder={cell.placeholder}
                        disabled={!editable || !onChangeCell}
                        className="w-full min-w-0 text-[11px] px-1.5 py-0.5 border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        style={{ fontSize: '11px' }}
                        aria-label={columnTitle || `Fila ${row.id}, celda ${cellIndex + 1}`}
                      />
                    </td>
                  );
                }

                const renderCheckboxAsInput =
                  cell.type === 'checkbox' &&
                  !cell.checkboxGroup &&
                  !cell.checkboxLabel &&
                  !isBooleanColumn(columnTitle) &&
                  !isConclusionesColComposite &&
                  !isSubheaderCumpleCell;

                if (
                  cell.renderAs === 'input' ||
                  cell.type === 'input' ||
                  renderCheckboxAsInput
                ) {
                  return (
                    <td
                      key={`${r}-${c}`}
                      data-tdrowid={row.id}
                      data-tdcellindex={cellIndex}
                      data-tdlogicalcol={logicalCol}
                      colSpan={cell.colSpan ?? 1}
                      rowSpan={cell.rowSpan ?? 1}
                      className={`${baseTdClass} ${conclusionDividerClass} ${baseCellClass}`}
                      style={debugOutline}
                    >
                      <input
                        type="text"
                        value={displayValue}
                        onChange={(e) => onChangeCell?.(row.id, cellKey, e.target.value)}
                        placeholder={cell.placeholder}
                        disabled={!editable || !onChangeCell}
                        className="w-full min-w-0 text-[11px] px-1.5 py-0.5 border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        style={{ fontSize: '11px' }}
                        aria-label={columnTitle || `Fila ${row.id}, celda ${cellIndex + 1}`}
                      />
                    </td>
                  );
                }

                // Columnas Conclusiones (Cumple/No cumple/No aplica): siempre checkbox cuando tienen checkboxGroup; el normalizador entrega 3 columnas, no inventar inputs.
                if (cell.type === 'checkbox') {
                  const rawVal = getCellValue(row.id, cellKey);
                  const checked =
                    rawVal === 'true' ||
                    rawVal === '1' ||
                    rawVal === 'yes' ||
                    (rawVal === '' && cell.value === true);
                  const isConclusiones = !!cell.checkboxGroup;
                  const isHeaderWithLabel =
                    cell.variant === 'header' && cell.checkboxLabel;
                  return (
                    <td
                      key={`${r}-${c}`}
                      data-tdrowid={row.id}
                      data-tdcellindex={cellIndex}
                      data-tdlogicalcol={logicalCol}
                      colSpan={cell.colSpan ?? 1}
                      rowSpan={cell.rowSpan ?? 1}
                      className={`${baseTdClass} ${conclusionDividerClass} ${isHeaderWithLabel ? 'text-right protocol-header-checkbox-cell pl-2 w-[32mm] min-w-[32mm] whitespace-normal' : ''} ${baseCellClass}${isConclusiones ? ' protocol-cell-conclusiones protocol-checkbox-cell' : ''}`}
                      style={
                        isConclusiones && !cell.colSpan
                          ? { minWidth: '32px', width: '32px', ...debugOutline }
                          : !cell.colSpan && !cell.rowSpan
                            ? { width: '36px', minWidth: '36px', ...debugOutline }
                            : debugOutline
                      }
                    >
                      {isHeaderWithLabel ? (
                        <label className="inline-flex items-start justify-end gap-1 w-full cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!checked}
                            onChange={(e) =>
                              editable &&
                              onChangeCell &&
                              handleCheckboxChange(
                                row.id,
                                cellKey,
                                cell,
                                e.target.checked
                              )
                            }
                            disabled={!editable || !onChangeCell}
                            className={`${checkboxClass} mt-0.5`}
                            aria-label={cell.checkboxLabel}
                          />
                          <span className="text-[9px] leading-tight whitespace-normal break-words text-slate-600 text-right">
                            {cell.checkboxLabel}
                          </span>
                        </label>
                      ) : editable && onChangeCell ? (
                        <span className="protocol-checkbox-wrapper">
                          <input
                            type="checkbox"
                            checked={!!checked}
                            onChange={(e) =>
                              handleCheckboxChange(
                                row.id,
                                cellKey,
                                cell,
                                e.target.checked
                              )
                            }
                            className={checkboxClass}
                            aria-label={
                            cell.checkboxGroup
                              ? `Grupo ${cell.checkboxGroup.groupId}: ${cell.checkboxGroup.option}`
                              : `Fila ${row.id}, celda ${cellIndex + 1}`
                          }
                        />
                        </span>
                      ) : (
                        <span
                          className="inline-block w-5 h-5 text-center text-slate-500 text-[11px] leading-5"
                          aria-hidden
                        >
                          {checked ? '✓' : '□'}
                        </span>
                      )}
                    </td>
                  );
                }

                const isReadOnly = cell.readOnly === true;
                const isEditableCell =
                  cell.editable === true && !isReadOnly && editable && onChangeCell;
                if (isEditableCell) {
                  return (
                    <td
                      key={`${r}-${c}`}
                      data-tdrowid={row.id}
                      data-tdcellindex={cellIndex}
                      data-tdlogicalcol={logicalCol}
                      colSpan={cell.colSpan ?? 1}
                      rowSpan={cell.rowSpan ?? 1}
                      className={`${baseTdClass} ${conclusionDividerClass} ${baseCellClass}`}
                      style={debugOutline}
                    >
                      <input
                        type="text"
                        value={displayValue}
                        onChange={handleChange}
                        placeholder={cell.placeholder}
                        className="w-full min-w-0 text-[11px] px-1.5 py-0.5 border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        style={{ fontSize: '11px' }}
                        aria-label={`Fila ${row.id}, celda ${cellIndex + 1}`}
                      />
                    </td>
                  );
                }

                const shown = sanitizeText(
                  decodeHtmlEntities(displayValue || cell.placeholder || '')
                );
                const isHeaderMerge =
                  cell.variant === 'header' && (cell.colSpan ?? 0) >= 4;
                const subheaderCenter =
                  cell.variant === 'subheader' ? ' text-center align-middle' : '';
                const tdClass = `${baseTdClass} ${conclusionDividerClass} ${isCompositeHeaderRow ? COMPOSITE_HEADER_CLASS : `text-slate-700 ${variantClass} ${alignClass}${isHeaderTitleCell ? ' protocol-cell-header-title pr-3 overflow-hidden break-words whitespace-pre-line' : ''}${isHeaderMerge ? ' protocol-header-merge' : ''}${subheaderCenter}`}`;
                if (
                  (sectionId === 'sec_19' || sectionId === 'sec_21') &&
                  (isHeaderTitleRow || isCompositeHeaderRow || isConclusionesSubheaderRow) &&
                  cellIndex === 0
                ) {
                  console.log('TD CLASS', sectionId, row.id, {
                    isHeaderTitleRow,
                    isCompositeHeaderRow,
                    isConclusionesSubheaderRow,
                    tdClass,
                  });
                }
                if (import.meta.env.DEV && sectionId === 'sec_19' && cellIndex === 0 && (isHeaderTitleRow || isCompositeHeaderRow || isConclusionesSubheaderRow)) {
                  console.log('SEC19 TDCLASS', row.id, { isHeaderTitleRow, isCompositeHeaderRow, isConclusionesSubheaderRow, colSpan: (cell as { colSpan?: number }).colSpan, tdClass });
                }
                return (
                  <td
                    key={`${r}-${c}`}
                    data-tdrowid={row.id}
                    data-tdcellindex={cellIndex}
                    data-tdlogicalcol={logicalCol}
                    colSpan={cell.colSpan ?? 1}
                    rowSpan={cell.rowSpan ?? 1}
                    className={tdClass}
                    style={debugOutline}
                  >
                    {shown}
                  </td>
                );
              })}
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
