import type { TableCatalogEntry, TableCatalogColumn, ProtocolSelection } from '../types/tableCatalog';

interface Props {
  selection: ProtocolSelection;
  readOnly?: boolean;
  isPrint?: boolean;
  onChangeData: (tableId: string, rowId: string, colKey: string, value: string) => void;
  onChangeObservaciones?: (tableId: string, value: string) => void;
  onChangeResultado?: (tableId: string, value: ProtocolSelection['resultado']) => void;
  onRemove?: (tableId: string) => void;
}

const RESULTADO_LABELS: Record<ProtocolSelection['resultado'], string> = {
  CONFORME: 'Conforme',
  NO_CONFORME: 'No conforme',
  PENDIENTE: 'Pendiente',
};

const RESULTADO_COLORS: Record<ProtocolSelection['resultado'], string> = {
  CONFORME: 'text-green-700 bg-green-50 border-green-300',
  NO_CONFORME: 'text-red-700 bg-red-50 border-red-300',
  PENDIENTE: 'text-amber-700 bg-amber-50 border-amber-300',
};

function renderCell(
  col: TableCatalogColumn,
  rowId: string,
  filledData: ProtocolSelection['filledData'],
  readOnly: boolean,
  isPrint: boolean,
  onChange: (rowId: string, colKey: string, value: string) => void
): React.ReactNode {
  const rawValue = filledData[rowId]?.[col.key] ?? '';

  if (col.type === 'fixed_text') {
    return (
      <span className="text-[10px] text-slate-600">{col.fixedValue ?? ''}</span>
    );
  }

  if (col.type === 'checkbox') {
    const checked = rawValue === 'true' || rawValue === '1';
    if (isPrint) {
      return <span className="text-[11px]">{checked ? '✓' : '☐'}</span>;
    }
    return (
      <input
        type="checkbox"
        checked={checked}
        disabled={readOnly}
        onChange={(e) => onChange(rowId, col.key, e.target.checked ? 'true' : 'false')}
        className="w-4 h-4 accent-blue-600 cursor-pointer disabled:cursor-default"
      />
    );
  }

  if (col.type === 'pass_fail') {
    const options: { value: string; label: string; printChar: string }[] = [
      { value: 'PASS', label: 'Cumple', printChar: '✓' },
      { value: 'FAIL', label: 'No cumple', printChar: '✗' },
      { value: 'NA', label: 'N/A', printChar: 'N/A' },
    ];
    if (isPrint) {
      const opt = options.find(o => o.value === rawValue);
      return <span className="text-[10px]">{opt ? opt.printChar : '—'}</span>;
    }
    return (
      <select
        value={rawValue}
        disabled={readOnly}
        onChange={(e) => onChange(rowId, col.key, e.target.value)}
        className="w-full text-[10px] border border-slate-300 rounded px-1 py-0.5 bg-white disabled:bg-slate-50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option value="">—</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }

  if (col.type === 'date_input') {
    if (isPrint) return <span className="text-[10px]">{rawValue || '—'}</span>;
    return (
      <input
        type="date"
        value={rawValue}
        disabled={readOnly}
        onChange={(e) => onChange(rowId, col.key, e.target.value)}
        className="w-full text-[10px] border border-slate-300 rounded px-1 py-0.5 bg-white disabled:bg-slate-50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    );
  }

  // text_input / number_input
  if (isPrint) return <span className="text-[10px]">{rawValue || '—'}</span>;
  return (
    <input
      type={col.type === 'number_input' ? 'number' : 'text'}
      value={rawValue}
      disabled={readOnly}
      placeholder={col.expectedValue ? `Esp: ${col.expectedValue}${col.unit ? ' ' + col.unit : ''}` : ''}
      onChange={(e) => onChange(rowId, col.key, e.target.value)}
      className="w-full text-[10px] border border-slate-300 rounded px-1 py-0.5 bg-white disabled:bg-slate-50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-300"
    />
  );
}

export const CatalogTableView: React.FC<Props> = ({
  selection,
  readOnly = false,
  isPrint = false,
  onChangeData,
  onChangeObservaciones,
  onChangeResultado,
  onRemove,
}) => {
  const table: TableCatalogEntry = selection.tableSnapshot;

  const handleCellChange = (rowId: string, colKey: string, value: string) => {
    onChangeData(selection.tableId, rowId, colKey, value);
  };

  return (
    <div className={`mb-6 ${isPrint ? '' : 'rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white'}`}>
      {/* Encabezado de tabla */}
      <div className={`flex items-center justify-between px-3 py-2 ${isPrint ? 'border-b border-slate-300' : 'bg-slate-50 border-b border-slate-200'}`}>
        <div>
          <p className={`font-semibold ${isPrint ? 'text-[10px]' : 'text-sm text-slate-900'}`}>
            {table.name}
          </p>
          {table.description && !isPrint && (
            <p className="text-xs text-slate-500 mt-0.5">{table.description}</p>
          )}
        </div>
        {!isPrint && !readOnly && onRemove && (
          <button
            onClick={() => onRemove(selection.tableId)}
            className="text-slate-400 hover:text-red-500 transition-colors p-1"
            title="Quitar tabla"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className={isPrint ? '' : 'overflow-x-auto'}>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className={isPrint ? 'border-b border-slate-300' : 'bg-slate-100 border-b border-slate-200'}>
              {table.columns.map(col => (
                <th
                  key={col.key}
                  className={`px-2 py-1.5 font-semibold text-slate-600 whitespace-nowrap ${isPrint ? 'text-[8.5px] border border-slate-300' : 'text-xs border-r border-slate-200'}`}
                >
                  {col.label}
                  {col.unit && <span className="font-normal text-slate-400 ml-1">({col.unit})</span>}
                  {col.required && !isPrint && <span className="text-red-400 ml-0.5">*</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.templateRows.map((row, idx) => {
              if (row.isTitle) {
                return (
                  <tr key={row.rowId} className={isPrint ? 'border-b border-slate-200' : 'bg-slate-50'}>
                    <td
                      colSpan={table.columns.length}
                      className={`px-2 py-1 font-semibold ${isPrint ? 'text-[9px] border border-slate-300' : 'text-xs text-slate-700 border-b border-slate-200'}`}
                    >
                      {row.titleText ?? ''}
                    </td>
                  </tr>
                );
              }
              return (
                <tr
                  key={row.rowId}
                  className={isPrint
                    ? 'border-b border-slate-200'
                    : `${idx % 2 === 0 ? '' : 'bg-slate-50/50'} hover:bg-blue-50/30 transition-colors`
                  }
                >
                  {table.columns.map(col => (
                    <td
                      key={col.key}
                      className={`px-2 py-1.5 align-middle ${isPrint ? 'text-[9px] border border-slate-300' : 'text-xs border-r border-slate-100'}`}
                    >
                      {renderCell(col, row.rowId, selection.filledData, readOnly, isPrint, handleCellChange)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer: resultado + observaciones */}
      {!isPrint && (
        <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center gap-3">
          {/* Resultado */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Resultado:</span>
            <div className="flex gap-1">
              {(['CONFORME', 'NO_CONFORME', 'PENDIENTE'] as const).map(r => (
                <button
                  key={r}
                  disabled={readOnly}
                  onClick={() => onChangeResultado?.(selection.tableId, r)}
                  className={`text-xs px-2 py-0.5 rounded border font-medium transition-colors disabled:cursor-not-allowed ${
                    selection.resultado === r
                      ? RESULTADO_COLORS[r]
                      : 'border-slate-200 text-slate-400 bg-white hover:bg-slate-50'
                  }`}
                >
                  {RESULTADO_LABELS[r]}
                </button>
              ))}
            </div>
          </div>
          {/* Observaciones */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Observaciones..."
              value={selection.observaciones ?? ''}
              disabled={readOnly}
              onChange={(e) => onChangeObservaciones?.(selection.tableId, e.target.value)}
              className="w-full text-xs border border-slate-200 rounded px-2 py-1 bg-white disabled:bg-slate-50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-300"
            />
          </div>
        </div>
      )}

      {/* Print: resultado + observaciones en versión imprimible */}
      {isPrint && (selection.resultado !== 'PENDIENTE' || selection.observaciones) && (
        <div className="px-2 py-1 border-t border-slate-200 flex gap-4">
          <span className="text-[9px] text-slate-600">
            <strong>Resultado:</strong> {RESULTADO_LABELS[selection.resultado]}
          </span>
          {selection.observaciones && (
            <span className="text-[9px] text-slate-600">
              <strong>Obs.:</strong> {selection.observaciones}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
