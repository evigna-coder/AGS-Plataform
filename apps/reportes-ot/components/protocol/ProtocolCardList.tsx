import React from 'react';
import type {
  ProtocolTableRow as ProtocolTableRowType,
  ProtocolTableCell as ProtocolTableCellType,
} from '../../types';

export interface ProtocolCardListProps {
  headers: string[];
  rows: ProtocolTableRowType[];
  editable?: boolean;
  getCellValue: (rowId: string, cellKey: string) => string;
  onChangeCell?: (rowId: string, cellKey: string, value: string) => void;
  caption?: string;
  sectionId?: string;
  sectionIndex?: number;
  compositeTitleRowTitle?: string;
}

function cellText(cell: ProtocolTableCellType): string {
  if (cell.type === 'text') return String(cell.value ?? '').trim();
  if (cell.type === 'checkbox') return String(cell.checkboxLabel ?? '').trim();
  return String(cell.value ?? '').trim();
}

function isHeaderTitleRow(row: ProtocolTableRowType): boolean {
  const first = row.cells?.[0];
  return first?.variant === 'header' && (first?.colSpan ?? 0) >= 4;
}

function isConclusionesSubheaderRow(row: ProtocolTableRowType): boolean {
  if (row.cells.length !== 3) return false;
  const txt = row.cells.map((c) => cellText(c).toLowerCase()).join(' ');
  return txt.includes('no cumple') && txt.includes('no aplica');
}

function isCompositeHeaderRow(row: ProtocolTableRowType): boolean {
  if (row.cells.length !== 4) return false;
  return cellText(row.cells[3]).toLowerCase().includes('conclusiones');
}

function hasConclusionesGroup(row: ProtocolTableRowType): boolean {
  return row.cells.some((c) => c.type === 'checkbox' && !!c.checkboxGroup);
}

function getRowNumber(row: ProtocolTableRowType, idx: number): number {
  return idx + 1;
}

function getRowPreview(row: ProtocolTableRowType): string {
  const first = row.cells.find((c) => c.type === 'text' && typeof c.value === 'string' && String(c.value).trim());
  const v = (first as { value?: string } | undefined)?.value;
  if (v && v.trim()) return v.trim();
  return '';
}

const CardField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1.5">
    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
      {label}
    </label>
    {children}
  </div>
);

const ConclusionesPills: React.FC<{
  row: ProtocolTableRowType;
  editable: boolean;
  getCellValue: (rowId: string, cellKey: string) => string;
  onChangeCell?: (rowId: string, cellKey: string, value: string) => void;
}> = ({ row, editable, getCellValue, onChangeCell }) => {
  const groupCells = row.cells
    .map((cell, idx) => ({ cell, idx }))
    .filter(({ cell }) => cell.type === 'checkbox' && !!cell.checkboxGroup);

  if (groupCells.length === 0) return null;

  const handleSelect = (selectedIdx: number) => {
    if (!editable || !onChangeCell) return;
    groupCells.forEach(({ idx }) => {
      onChangeCell(row.id, String(idx), idx === selectedIdx ? 'true' : 'false');
    });
  };

  return (
    <CardField label="Resultado">
      <div className="flex gap-2">
        {groupCells.map(({ cell, idx }) => {
          const raw = getCellValue(row.id, String(idx));
          const checked = raw === 'true' || raw === '1';
          const label = cell.checkboxGroup?.option ?? cellText(cell) ?? `Opción ${idx}`;
          return (
            <button
              key={idx}
              type="button"
              disabled={!editable || !onChangeCell}
              onClick={() => handleSelect(idx)}
              className={
                'flex-1 min-h-[44px] px-3 rounded-full text-[13px] font-semibold transition-colors ' +
                (checked
                  ? 'bg-teal-700 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-300 active:bg-slate-50')
              }
              aria-pressed={checked}
            >
              {checked ? '✓ ' : ''}
              {label}
            </button>
          );
        })}
      </div>
    </CardField>
  );
};

const CellInput: React.FC<{
  rowId: string;
  cellKey: string;
  cell: ProtocolTableCellType;
  value: string;
  editable: boolean;
  onChangeCell?: (rowId: string, cellKey: string, value: string) => void;
  label: string;
}> = ({ rowId, cellKey, cell, value, editable, onChangeCell, label }) => (
  <CardField label={label}>
    <input
      type="text"
      value={value}
      onChange={(e) => onChangeCell?.(rowId, cellKey, e.target.value)}
      placeholder={cell.placeholder}
      disabled={!editable || !onChangeCell}
      className="w-full min-h-[44px] text-[14px] px-3 py-2 bg-white border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-600 disabled:bg-slate-50 disabled:text-slate-500"
      aria-label={label}
    />
  </CardField>
);

const CellReadonly: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <CardField label={label}>
    <div className="min-h-[44px] flex items-center text-[14px] text-slate-700 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
      {value || '—'}
    </div>
  </CardField>
);

const CellCheckbox: React.FC<{
  rowId: string;
  cellKey: string;
  cell: ProtocolTableCellType;
  value: string;
  editable: boolean;
  onChangeCell?: (rowId: string, cellKey: string, value: string) => void;
  label: string;
}> = ({ rowId, cellKey, cell, value, editable, onChangeCell, label }) => {
  const checked = value === 'true' || value === '1' || (value === '' && cell.value === true);
  return (
    <CardField label={label}>
      <label className="inline-flex items-center gap-3 min-h-[44px] cursor-pointer">
        <input
          type="checkbox"
          checked={!!checked}
          onChange={(e) => onChangeCell?.(rowId, cellKey, e.target.checked ? 'true' : 'false')}
          disabled={!editable || !onChangeCell}
          className="w-5 h-5 accent-teal-700 cursor-pointer"
        />
        <span className="text-[13px] text-slate-700">
          {cell.checkboxLabel || 'Marcar'}
        </span>
      </label>
    </CardField>
  );
};

const DataRowCard: React.FC<{
  row: ProtocolTableRowType;
  idx: number;
  headers: string[];
  editable: boolean;
  getCellValue: (rowId: string, cellKey: string) => string;
  onChangeCell?: (rowId: string, cellKey: string, value: string) => void;
}> = ({ row, idx, headers, editable, getCellValue, onChangeCell }) => {
  const preview = getRowPreview(row);
  const rowNum = getRowNumber(row, idx);
  const hasGroup = hasConclusionesGroup(row);

  return (
    <div className="protocol-card rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-teal-50 text-teal-700 text-[11px] font-bold">
          {rowNum}
        </span>
        {preview && (
          <span className="text-[13px] font-semibold text-slate-800 truncate">{preview}</span>
        )}
      </div>

      {row.cells.map((cell, cellIndex) => {
        if (cell.hidden) return null;
        if (cell.type === 'checkbox' && cell.checkboxGroup) return null;
        const cellKey = String(cellIndex);
        const columnTitle = headers[cellIndex] ?? `Campo ${cellIndex + 1}`;
        const value = getCellValue(row.id, cellKey);

        if (cell.renderAs === 'input' || cell.type === 'input') {
          return (
            <CellInput
              key={cellIndex}
              rowId={row.id}
              cellKey={cellKey}
              cell={cell}
              value={value}
              editable={editable}
              onChangeCell={onChangeCell}
              label={columnTitle}
            />
          );
        }

        if (cell.type === 'text') {
          if (cell.editable) {
            return (
              <CellInput
                key={cellIndex}
                rowId={row.id}
                cellKey={cellKey}
                cell={cell}
                value={value || String(cell.value ?? '')}
                editable={editable}
                onChangeCell={onChangeCell}
                label={columnTitle}
              />
            );
          }
          return <CellReadonly key={cellIndex} label={columnTitle} value={value || String(cell.value ?? '')} />;
        }

        if (cell.type === 'checkbox') {
          return (
            <CellCheckbox
              key={cellIndex}
              rowId={row.id}
              cellKey={cellKey}
              cell={cell}
              value={value}
              editable={editable}
              onChangeCell={onChangeCell}
              label={columnTitle}
            />
          );
        }

        return null;
      })}

      {hasGroup && (
        <ConclusionesPills
          row={row}
          editable={editable}
          getCellValue={getCellValue}
          onChangeCell={onChangeCell}
        />
      )}
    </div>
  );
};

const BlockTitle: React.FC<{ title: string }> = ({ title }) => (
  <div className="pt-2 pb-1">
    <h4 className="text-[12px] font-bold uppercase tracking-wider text-teal-800">{title}</h4>
  </div>
);

export const ProtocolCardList: React.FC<ProtocolCardListProps> = ({
  headers,
  rows,
  editable = false,
  getCellValue,
  onChangeCell,
  caption,
}) => {
  let dataRowCount = 0;

  return (
    <div className="protocol-card-list space-y-3">
      {caption && (
        <div className="text-[11px] font-semibold text-slate-600">{caption}</div>
      )}
      {rows.map((row, idx) => {
        if (isConclusionesSubheaderRow(row) || isCompositeHeaderRow(row)) {
          return null;
        }
        if (isHeaderTitleRow(row)) {
          const title = cellText(row.cells[0]) || 'Sección';
          return <BlockTitle key={row.id ?? idx} title={title} />;
        }
        const thisIdx = dataRowCount++;
        return (
          <DataRowCard
            key={row.id ?? idx}
            row={row}
            idx={thisIdx}
            headers={headers}
            editable={editable}
            getCellValue={getCellValue}
            onChangeCell={onChangeCell}
          />
        );
      })}
    </div>
  );
};
