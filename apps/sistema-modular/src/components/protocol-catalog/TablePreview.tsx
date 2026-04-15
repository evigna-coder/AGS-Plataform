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
          <table className="w-full text-xs border-collapse" style={table.columns.some(c => c.width) ? { tableLayout: 'fixed' } : undefined}>
            <thead>
              {(() => {
                const groups = table.columnGroups ?? [];
                const hasGroups = groups.length > 0;
                const groupTitle = table.columnGroupTitle ?? null;
                const groupedCols = new Set<number>();
                groups.forEach(g => { for (let i = g.startCol; i < g.startCol + g.span; i++) groupedCols.add(i); });

                const thBase = 'px-3 py-2 font-bold text-slate-700 border border-slate-200 text-center';
                const titleRow = groupTitle ? (
                  <tr className="bg-slate-100">
                    <th colSpan={table.columns.length} className={`${thBase} text-sm`}>{groupTitle}</th>
                  </tr>
                ) : null;

                if (!hasGroups) {
                  return (
                    <>
                      {titleRow}
                      <tr className="bg-slate-50">
                        {table.columns.map((col: TableCatalogEntry['columns'][number]) => (
                          <th key={col.key} className={thBase}
                            style={col.width ? { width: `${col.width}mm`, minWidth: `${col.width}mm` } : undefined}>
                            {col.label}{col.unit ? ` (${col.unit})` : ''}{col.required ? ' *' : ''}
                            {col.width ? <span className="text-slate-400 font-normal ml-1">({col.width}mm)</span> : ''}
                          </th>
                        ))}
                      </tr>
                    </>
                  );
                }

                return (
                  <>
                    {titleRow}
                    <tr className="bg-slate-50">
                      {table.columns.map((col, colIdx) => {
                        if (groupedCols.has(colIdx)) {
                          const group = groups.find(g => g.startCol === colIdx);
                          if (!group) return null;
                          return <th key={`group-${colIdx}`} colSpan={group.span} className={thBase}>{group.label}</th>;
                        }
                        return (
                          <th key={col.key} rowSpan={2} className={thBase}
                            style={col.width ? { width: `${col.width}mm`, minWidth: `${col.width}mm` } : undefined}>
                            {col.label}{col.unit ? ` (${col.unit})` : ''}{col.required ? ' *' : ''}
                          </th>
                        );
                      })}
                    </tr>
                    <tr className="bg-slate-50">
                      {groups.flatMap(g =>
                        table.columns.slice(g.startCol, g.startCol + g.span).map(col => (
                          <th key={col.key} className={thBase}
                            style={col.width ? { width: `${col.width}mm`, minWidth: `${col.width}mm` } : undefined}>
                            {col.label}{col.unit ? ` (${col.unit})` : ''}
                          </th>
                        ))
                      )}
                    </tr>
                  </>
                );
              })()}
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
                // Pre-compute cells covered by column spans (nuevo) o rowSpan+spanColumns (legacy)
                const coveredCells = new Set<string>();
                const spanAt = (row: typeof table.templateRows[number], colKey: string): number => {
                  if (row.columnSpans?.[colKey] && row.columnSpans[colKey] > 1) return row.columnSpans[colKey];
                  if (row.rowSpan && row.rowSpan > 1 && row.spanColumns?.includes(colKey)) return row.rowSpan;
                  return 1;
                };
                table.templateRows.forEach((row, idx) => {
                  for (const col of table.columns) {
                    const span = spanAt(row, col.key);
                    if (span > 1) {
                      for (let offset = 1; offset < span; offset++) {
                        coveredCells.add(`${idx + offset}:${col.key}`);
                      }
                    }
                  }
                });
                // Solo filas con span propio > 1 reciben estilo de "celda de grupo" (gris/bold).
                const isGroupStart = (rowIdx: number): boolean => {
                  if (rowIdx === 0) return false;
                  const row = table.templateRows[rowIdx];
                  if (!row) return false;
                  return table.columns.some(col => spanAt(row, col.key) > 1);
                };
                // Borde separador: se dibuja tanto al iniciar un merge como al salir de uno
                // (fila standalone que viene después de un bloque fusionado).
                const hasMergeBoundaryAbove = (rowIdx: number): boolean => {
                  if (rowIdx === 0) return false;
                  if (isGroupStart(rowIdx)) return true;
                  const prevRow = table.templateRows[rowIdx - 1];
                  if (!prevRow) return false;
                  return table.columns.some(col =>
                    spanAt(prevRow, col.key) > 1 || coveredCells.has(`${rowIdx - 1}:${col.key}`)
                  );
                };
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
                      {table.columns.map((col: TableCatalogEntry['columns'][number], colIdx: number) => {
                        const alignClass = colIdx === 0
                          ? 'text-left'
                          : col.align === 'left' ? 'text-left' : col.align === 'right' ? 'text-right' : 'text-center';
                        return (
                        <td key={col.key} className={`px-3 py-2 border border-slate-200 text-slate-700 ${alignClass}`}>
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
                        );
                      })}
                    </tr>);
                  })() : (() => {
                    const groupStart = isGroupStart(idx);
                    const boundaryAbove = hasMergeBoundaryAbove(idx);
                    return (
                    <tr key={row.rowId}>
                      {table.columns.map((col: TableCatalogEntry['columns'][number]) => {
                        if (coveredCells.has(`${idx}:${col.key}`)) return null;
                        const colSpan = spanAt(row, col.key);
                        const isSpanning = colSpan > 1;
                        // Single-row group cell (e.g. μECD): style like spanning, but only for columns that have spans elsewhere
                        const colHasSpansElsewhere = table.templateRows.some(r => spanAt(r, col.key) > 1);
                        const isGroupCell = isSpanning || (groupStart && colHasSpansElsewhere && !coveredCells.has(`${idx}:${col.key}`));
                        return (
                          <td
                            key={col.key}
                            rowSpan={isSpanning ? colSpan : undefined}
                            className={[
                              'px-3 py-2 border border-slate-200 text-slate-700',
                              (() => {
                                const alignCls = col.align === 'left' ? 'text-left' : col.align === 'right' ? 'text-right' : 'text-center';
                                return isGroupCell
                                  ? `align-middle font-semibold border-r border-r-slate-300 ${alignCls}`
                                  : alignCls;
                              })(),
                              boundaryAbove ? 'border-t border-t-slate-300' : '',
                            ].join(' ')}
                          >
                            {row.cells[col.key] != null ? String(row.cells[col.key]) : '—'}
                          </td>
                        );
                      })}
                    </tr>);
                  })()
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
