import type { TableCatalogEntry } from '@ags/shared';

interface Props {
  table: TableCatalogEntry;
}

export const TablePreview = ({ table }: Props) => {
  return (
    <div className="border border-slate-300 rounded-lg overflow-hidden">
      <div className="bg-slate-100 px-4 py-2 border-b border-slate-300">
        <h4 className="font-bold text-sm text-slate-900">{table.name}</h4>
        {table.description && (
          <p className="text-xs text-slate-500 mt-0.5">{table.description}</p>
        )}
        <span className="text-xs text-slate-400 uppercase font-bold">{table.tableType}</span>
      </div>

      {table.columns.length === 0 ? (
        <div className="p-6 text-center text-slate-400 text-sm">Sin columnas definidas</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50">
                {table.columns.map((col: TableCatalogEntry['columns'][number]) => (
                  <th key={col.key} className="px-3 py-2 text-left font-bold text-slate-700 border border-slate-200"
                    style={col.width ? { width: `${col.width}mm`, minWidth: `${col.width}mm` } : undefined}>
                    {col.label}
                    {col.unit ? ` (${col.unit})` : ''}
                    {col.required ? ' *' : ''}
                    {col.width ? <span className="text-slate-400 font-normal ml-1">({col.width}mm)</span> : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.templateRows.length === 0 ? (
                <tr>
                  <td colSpan={table.columns.length}
                    className="px-3 py-4 text-center text-slate-400 border border-slate-200">
                    Sin filas template
                  </td>
                </tr>
              ) : (() => {
                // Pre-compute cells covered by rowSpan
                const coveredCells = new Set<string>();
                table.templateRows.forEach((row, idx) => {
                  if (row.rowSpan && row.rowSpan > 1 && row.spanColumns?.length) {
                    for (let offset = 1; offset < row.rowSpan; offset++) {
                      row.spanColumns.forEach(colKey => coveredCells.add(`${idx + offset}:${colKey}`));
                    }
                  }
                });
                return table.templateRows.map((row: TableCatalogEntry['templateRows'][number], idx: number) => (
                  row.isTitle ? (
                    <tr key={row.rowId} className="bg-slate-200">
                      <td colSpan={table.columns.length}
                        className="px-3 py-1.5 font-bold text-xs text-slate-700 border border-slate-300 uppercase tracking-wide">
                        {row.titleText || ''}
                      </td>
                    </tr>
                  ) : row.isSelector ? (() => {
                    const splitSelector = (row.selectorColumn ?? 0) > 0;
                    const dropdownCol = row.selectorColumn ?? 0;
                    return (
                    <tr key={row.rowId} className="bg-white">
                      {table.columns.map((col: TableCatalogEntry['columns'][number], colIdx: number) => (
                        <td key={col.key} className="px-3 py-2 border border-slate-200 text-slate-700">
                          {splitSelector ? (
                            colIdx === 0 ? (
                              <span className="text-xs font-semibold text-slate-700">{row.selectorLabel}</span>
                            ) : colIdx === dropdownCol ? (
                              <select className="border border-slate-300 rounded px-2 py-0.5 text-xs bg-white" disabled>
                                <option>Seleccionar...</option>
                                {(row.selectorOptions ?? []).map(opt => (
                                  <option key={opt}>{opt}</option>
                                ))}
                              </select>
                            ) : (
                              row.cells[col.key] != null ? String(row.cells[col.key]) : '—'
                            )
                          ) : (
                            colIdx === 0 ? (
                              <div className="flex items-center gap-1">
                                <span className="text-xs font-semibold text-slate-700 shrink-0">{row.selectorLabel}:</span>
                                <select className="border border-slate-300 rounded px-1 py-0.5 text-xs bg-white" disabled>
                                  <option>Seleccionar...</option>
                                  {(row.selectorOptions ?? []).map(opt => (
                                    <option key={opt}>{opt}</option>
                                  ))}
                                </select>
                              </div>
                            ) : (
                              row.cells[col.key] != null ? String(row.cells[col.key]) : '—'
                            )
                          )}
                        </td>
                      ))}
                    </tr>);
                  })() : (
                    <tr key={row.rowId} className="bg-white">
                      {table.columns.map((col: TableCatalogEntry['columns'][number]) => {
                        if (coveredCells.has(`${idx}:${col.key}`)) return null;
                        const isSpanning = row.rowSpan && row.rowSpan > 1 && row.spanColumns?.includes(col.key);
                        return (
                          <td
                            key={col.key}
                            rowSpan={isSpanning ? row.rowSpan : undefined}
                            className={`px-3 py-2 border border-slate-200 text-slate-700 ${isSpanning ? 'align-middle font-semibold bg-slate-50' : ''}`}
                          >
                            {row.cells[col.key] != null ? String(row.cells[col.key]) : '—'}
                          </td>
                        );
                      })}
                    </tr>
                  )
                ));
              })()}
            </tbody>
          </table>
        </div>
      )}

      {table.tableType === 'validation' && table.validationRules.length > 0 && (
        <div className="px-4 py-2 border-t border-slate-200 bg-slate-50">
          <p className="text-xs font-bold text-slate-600 uppercase mb-1">
            Reglas de validación ({table.validationRules.length})
          </p>
          <ul className="text-xs text-slate-500 space-y-0.5">
            {table.validationRules.map((r: TableCatalogEntry['validationRules'][number]) => (
              <li key={r.ruleId}>
                {r.description || `${r.sourceColumn} ${r.operator} ${r.factoryThreshold}${r.unit ? ' ' + r.unit : ''} → ${r.targetColumn}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
