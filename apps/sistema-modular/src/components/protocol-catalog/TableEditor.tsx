import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { RowFormPanel } from './RowFormPanel';
import { TableEditorColumnForm } from './TableEditorColumnForm';
import { TableEditorRuleForm } from './TableEditorRuleForm';
import { TableEditorHeaderFieldForm } from './TableEditorHeaderFieldForm';
import type { TableCatalogEntry, TableCatalogColumn, TableCatalogRow, TableCatalogRule } from '@ags/shared';

type Tab = 'columns' | 'rows' | 'rules' | 'headers';


// ─── Componente principal ─────────────────────────────────────────────────────
interface Props {
  table: TableCatalogEntry;
  onChange: (table: TableCatalogEntry) => void;
}

const newRule = (): TableCatalogRule => ({
  ruleId: crypto.randomUUID(),
  description: '',
  sourceColumn: '',
  operator: '<=',
  factoryThreshold: '',
  unit: null,
  targetColumn: '',
  valueIfPass: 'PASA',
  valueIfFail: 'FALLA',
  operandColumn: null,
  computeOperator: '-',
});

export const TableEditor = ({ table, onChange }: Props) => {
  const [activeTab, setActiveTab] = useState<Tab>('columns');
  const [editingColIdx, setEditingColIdx] = useState<number | null>(null);
  const [addingCol, setAddingCol] = useState(false);
  const [selectedRow, setSelectedRow] = useState<TableCatalogRow | null>(null);
  const [editingRuleIdx, setEditingRuleIdx] = useState<number | null>(null);
  const [addingRule, setAddingRule] = useState(false);
  const [editingHeaderIdx, setEditingHeaderIdx] = useState<number | null>(null);
  const [addingHeader, setAddingHeader] = useState(false);
  const [unitOverrideColKey, setUnitOverrideColKey] = useState<string | null>(null);
  const [rowSelectMode, setRowSelectMode] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const rowRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const rowsContainerRef = useRef<HTMLDivElement | null>(null);

  const setRowRef = useCallback((rowId: string) => (el: HTMLDivElement | null) => {
    if (el) rowRefsMap.current.set(rowId, el);
    else rowRefsMap.current.delete(rowId);
  }, []);

  /** Scroll dentro del contenedor de filas (sin mover la página) */
  const scrollToRowInContainer = useCallback((rowId: string, position: 'start' | 'center') => {
    requestAnimationFrame(() => {
      const container = rowsContainerRef.current;
      const el = rowRefsMap.current.get(rowId);
      if (!container || !el) return;
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const offsetTop = elRect.top - containerRect.top + container.scrollTop;
      if (position === 'start') {
        container.scrollTo({ top: offsetTop - 8, behavior: 'smooth' });
      } else {
        const centered = offsetTop - container.clientHeight / 2 + elRect.height / 2;
        container.scrollTo({ top: Math.max(0, centered), behavior: 'smooth' });
      }
    });
  }, []);

  // Scroll al panel de edición cuando se abre una fila
  useEffect(() => {
    if (selectedRow) {
      scrollToRowInContainer(selectedRow.rowId, 'start');
    }
  }, [selectedRow, scrollToRowInContainer]);

  const upd = (key: keyof TableCatalogEntry, value: any) => onChange({ ...table, [key]: value });

  const headerFields = table.headerFields ?? [];

  /** Reemplaza {fieldId} por {label} y oculta @ en textos de display */
  const displaySpec = useCallback((text: string): string => {
    if (!text) return text;
    let result = text.replace(/\{@/g, '{');
    if (headerFields.length) {
      result = result.replace(/\{([^}]+)\}/g, (match, id) => {
        const field = headerFields.find(f => f.fieldId === id);
        return field ? `{${field.label}}` : match;
      });
    }
    return result;
  }, [headerFields]);

  const tabs: Tab[] = table.tableType === 'validation'
    ? ['columns', 'rows', 'rules', 'headers']
    : ['columns', 'rows', 'headers'];

  const tabLabel: Record<Tab, string> = {
    columns: `Columnas (${table.columns.length})`,
    rows: `Filas (${table.templateRows.length})`,
    rules: `Reglas (${table.validationRules.length})`,
    headers: `Encabezados (${headerFields.length})`,
  };

  const saveColumn = (col: TableCatalogColumn) => {
    if (editingColIdx !== null) {
      const cols = [...table.columns]; cols[editingColIdx] = col;
      upd('columns', cols); setEditingColIdx(null);
    } else {
      upd('columns', [...table.columns, col]); setAddingCol(false);
    }
  };

  const moveColumn = (idx: number, dir: -1 | 1) => {
    const cols = [...table.columns];
    const target = idx + dir;
    if (target < 0 || target >= cols.length) return;
    [cols[idx], cols[target]] = [cols[target], cols[idx]];
    upd('columns', cols);
  };

  const saveRow = (row: TableCatalogRow) => {
    const exists = table.templateRows.some(r => r.rowId === row.rowId);
    upd('templateRows', exists
      ? table.templateRows.map(r => r.rowId === row.rowId ? row : r)
      : [...table.templateRows, row]);
    setSelectedRow(null);
    scrollToRowInContainer(row.rowId, 'center');
  };

  const moveRow = (idx: number, dir: -1 | 1) => {
    const rows = [...table.templateRows];
    const target = idx + dir;
    if (target < 0 || target >= rows.length) return;
    [rows[idx], rows[target]] = [rows[target], rows[idx]];
    upd('templateRows', rows);
  };

  const saveRule = (rule: TableCatalogRule) => {
    if (editingRuleIdx !== null) {
      upd('validationRules', table.validationRules.map((r, i) => i === editingRuleIdx ? rule : r));
      setEditingRuleIdx(null);
    } else {
      upd('validationRules', [...table.validationRules, rule]); setAddingRule(false);
    }
  };

  return (
    <Card className="border-2 border-slate-900">
      {/* Tabs */}
      <div className="flex gap-0 mb-4 border-b border-slate-200">
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs font-black uppercase transition-all ${
              activeTab === tab
                ? 'border-b-2 border-slate-900 text-slate-900'
                : 'text-slate-400 hover:text-slate-700'
            }`}>
            {tabLabel[tab]}
          </button>
        ))}
      </div>

      {/* Columns */}
      {activeTab === 'columns' && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500">{table.columns.length} columnas definidas</span>
            {!addingCol && editingColIdx === null && (
              <Button size="sm" onClick={() => setAddingCol(true)}>+ Agregar columna</Button>
            )}
          </div>
          {table.columns.map((col, i) => (
            <div key={col.key}>
              {editingColIdx === i ? (
                <TableEditorColumnForm col={col} onSave={saveColumn} onCancel={() => setEditingColIdx(null)} />
              ) : (
                <div className="flex items-center gap-1">
                  <div className="flex flex-col shrink-0">
                    <button onClick={() => moveColumn(i, -1)} disabled={i === 0}
                      className="text-slate-400 hover:text-slate-700 disabled:opacity-20 text-xs px-1" title="Mover izquierda">◀</button>
                    <button onClick={() => moveColumn(i, 1)} disabled={i === table.columns.length - 1}
                      className="text-slate-400 hover:text-slate-700 disabled:opacity-20 text-xs px-1" title="Mover derecha">▶</button>
                  </div>
                  <div className="flex-1 flex items-center justify-between p-2 border border-slate-200 rounded-lg">
                    <span className="text-sm">
                      <span className="font-bold text-slate-900">{col.label}</span>
                      <span className="text-slate-500 ml-2 text-xs">
                        {col.type}{col.unit ? ` (${col.unit})` : ''}{col.required ? ' *' : ''}
                        {col.type === 'fixed_text' && col.fixedValue ? ` = "${col.fixedValue}"` : ''}
                        {col.type === 'select_input' && col.options?.length ? ` [${col.options.join(', ')}]` : ''}
                        {col.width ? ` · ${col.width}mm` : ''}
                        {col.align && col.align !== 'center' ? ` · ${col.align === 'left' ? '⬌ izq' : '⮞ der'}` : ''}
                      </span>
                    </span>
                    <div className="flex gap-3">
                      {(col.type === 'number_input' || col.type === 'text_input') && table.templateRows.some(r => !r.isTitle && !r.isSelector) && (
                        <button onClick={() => setUnitOverrideColKey(unitOverrideColKey === col.key ? null : col.key)}
                          className={`text-xs font-bold ${unitOverrideColKey === col.key ? 'text-orange-600' : 'text-orange-500 hover:text-orange-700'}`}
                          title="Configurar unidades distintas por fila">Unidades</button>
                      )}
                      <button onClick={() => { setAddingCol(false); setEditingColIdx(i); }}
                        className="text-blue-600 text-xs font-bold">Editar</button>
                      <button onClick={() => upd('columns', table.columns.filter((_, j) => j !== i))}
                        className="text-red-600 text-xs font-bold">Eliminar</button>
                    </div>
                  </div>
                </div>
              )}
              {/* Panel de unidades por fila para esta columna */}
              {unitOverrideColKey === col.key && (
                <div className="ml-8 border border-orange-200 rounded-lg p-3 bg-orange-50 mt-1 space-y-1.5">
                  <p className="text-[10px] text-orange-700 font-bold uppercase">
                    Unidad por fila — {col.label} {col.unit ? `(global: ${col.unit})` : '(sin unidad global)'}
                  </p>
                  <p className="text-[10px] text-orange-600 mb-2">
                    Vacío = usa la unidad global de la columna. Solo completar las filas que necesiten una unidad distinta.
                  </p>
                  {table.templateRows.filter(r => !r.isTitle && !r.isSelector).map((row, idx) => {
                    const label = String(Object.values(row.cells).find(v => v) ?? `Fila ${idx + 1}`);
                    const current = row.cellUnits?.[col.key] ?? '';
                    return (
                      <div key={row.rowId} className="flex items-center gap-2">
                        <span className="flex-1 text-xs text-slate-600 truncate" title={label}>{label}</span>
                        <input
                          type="text"
                          value={current}
                          placeholder={col.unit ?? 'ej: mAU/h'}
                          onChange={e => {
                            const val = e.target.value;
                            const updatedRows = table.templateRows.map(r => {
                              if (r.rowId !== row.rowId) return r;
                              const next = { ...(r.cellUnits ?? {}) };
                              if (val === '') { delete next[col.key]; } else { next[col.key] = val; }
                              return { ...r, cellUnits: Object.keys(next).length > 0 ? next : null };
                            });
                            upd('templateRows', updatedRows);
                          }}
                          className="w-28 border border-orange-300 rounded px-2 py-1 text-xs text-center"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
          {addingCol && (
            <TableEditorColumnForm
              col={{ key: '', label: '', type: 'text_input', unit: null, required: false, expectedValue: null }}
              onSave={saveColumn} onCancel={() => setAddingCol(false)} />
          )}

          {/* Grupos de columnas (cabeceras multi-nivel) */}
          {table.columns.length >= 2 && (
            <div className="border-t border-slate-200 pt-3 mt-3 space-y-2">
              {/* Título general (fila que abarca todas las columnas) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Título del header</label>
                <p className="text-[10px] text-slate-400 mb-1.5">Fila superior que abarca todas las columnas (ej. "Configuración de sistema"). Vacío = sin título.</p>
                <input
                  type="text"
                  value={table.columnGroupTitle ?? ''}
                  placeholder="Ej: Configuración de sistema"
                  onChange={e => upd('columnGroupTitle', e.target.value || null)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                />
              </div>

              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-slate-700 uppercase">Sub-grupos de columnas</p>
                  <p className="text-[10px] text-slate-400">Agrupá columnas bajo una cabecera común (ej. "ALS" abarcando "Modelo" y "SN").</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => {
                  const groups = [...(table.columnGroups ?? []), { label: '', startCol: 0, span: 2 }];
                  upd('columnGroups', groups);
                }}>+ Grupo</Button>
              </div>
              {(table.columnGroups ?? []).map((g, gi) => (
                <div key={gi} className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
                  <input
                    type="text"
                    value={g.label}
                    placeholder="Ej: ALS"
                    onChange={e => {
                      const groups = [...(table.columnGroups ?? [])];
                      groups[gi] = { ...groups[gi], label: e.target.value };
                      upd('columnGroups', groups);
                    }}
                    className="w-32 border border-indigo-300 rounded px-2 py-1 text-xs"
                  />
                  <div className="flex items-center gap-1">
                    <label className="text-[10px] text-slate-500">Desde col:</label>
                    <select
                      value={g.startCol}
                      onChange={e => {
                        const groups = [...(table.columnGroups ?? [])];
                        groups[gi] = { ...groups[gi], startCol: Number(e.target.value) };
                        upd('columnGroups', groups);
                      }}
                      className="border border-indigo-300 rounded px-1.5 py-1 text-xs"
                    >
                      {table.columns.map((col, ci) => (
                        <option key={ci} value={ci}>{ci}: {col.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="text-[10px] text-slate-500">Abarca:</label>
                    <input
                      type="number"
                      min={2}
                      max={table.columns.length - g.startCol}
                      value={g.span}
                      onChange={e => {
                        const groups = [...(table.columnGroups ?? [])];
                        groups[gi] = { ...groups[gi], span: Math.max(2, Number(e.target.value) || 2) };
                        upd('columnGroups', groups);
                      }}
                      className="w-14 border border-indigo-300 rounded px-2 py-1 text-xs text-center"
                    />
                    <label className="text-[10px] text-slate-500">cols</label>
                  </div>
                  <span className="text-[10px] text-indigo-500 flex-1 text-right">
                    {table.columns.slice(g.startCol, g.startCol + g.span).map(c => c.label).join(' + ')}
                  </span>
                  <button onClick={() => {
                    const groups = (table.columnGroups ?? []).filter((_, j) => j !== gi);
                    upd('columnGroups', groups.length ? groups : []);
                  }} className="text-red-500 text-xs font-bold ml-1">×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Rows */}
      {activeTab === 'rows' && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">{table.templateRows.length} filas template</span>
              {table.templateRows.length > 0 && (
                <button
                  onClick={() => { setRowSelectMode(v => !v); setSelectedRowIds(new Set()); }}
                  className={`text-xs font-bold px-2 py-0.5 rounded transition-colors ${
                    rowSelectMode
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'text-slate-500 hover:text-red-600 hover:bg-red-50'
                  }`}
                >
                  {rowSelectMode ? 'Cancelar selección' : 'Seleccionar para eliminar'}
                </button>
              )}
            </div>
            {rowSelectMode ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (selectedRowIds.size === table.templateRows.length) {
                      setSelectedRowIds(new Set());
                    } else {
                      setSelectedRowIds(new Set(table.templateRows.map(r => r.rowId)));
                    }
                  }}
                  className="text-xs text-slate-600 hover:text-slate-900 font-medium"
                >
                  {selectedRowIds.size === table.templateRows.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                </button>
                <Button size="sm" variant="outline"
                  className="!border-red-300 !text-red-700 hover:!bg-red-50"
                  disabled={selectedRowIds.size === 0}
                  onClick={() => {
                    upd('templateRows', table.templateRows.filter(r => !selectedRowIds.has(r.rowId)));
                    setSelectedRowIds(new Set());
                    setRowSelectMode(false);
                  }}
                >
                  Eliminar {selectedRowIds.size > 0 ? `(${selectedRowIds.size})` : ''}
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" variant="outline"
                  onClick={() => setSelectedRow({ rowId: crypto.randomUUID(), cells: {}, isTitle: true, titleText: '' })}>
                  + Título sección
                </Button>
                <Button size="sm" variant="outline"
                  onClick={() => setSelectedRow({ rowId: crypto.randomUUID(), cells: {}, isSelector: true, selectorLabel: '', selectorOptions: [] })}>
                  + Fila selector
                </Button>
                <Button size="sm"
                  onClick={() => setSelectedRow({ rowId: crypto.randomUUID(), cells: {} })}>
                  + Fila
                </Button>
              </div>
            )}
          </div>
          <div ref={rowsContainerRef} className="max-h-[480px] overflow-y-auto space-y-2 pr-1">
            {table.templateRows.map((row, i) => (
              <div key={row.rowId} ref={setRowRef(row.rowId)}>
                {selectedRow?.rowId === row.rowId ? (
                  <RowFormPanel row={selectedRow} columns={table.columns}
                    totalRows={table.templateRows.length} rowIndex={i}
                    headerFields={table.headerFields ?? []}
                    onSave={saveRow}
                    onDelete={() => { upd('templateRows', table.templateRows.filter(r => r.rowId !== row.rowId)); setSelectedRow(null); }}
                    onCancel={() => { setSelectedRow(null); scrollToRowInContainer(row.rowId, 'center'); }} />
                ) : (
                  <div className="flex items-center gap-1">
                    {rowSelectMode ? (
                      <input
                        type="checkbox"
                        checked={selectedRowIds.has(row.rowId)}
                        onChange={() => {
                          const next = new Set(selectedRowIds);
                          if (next.has(row.rowId)) next.delete(row.rowId);
                          else next.add(row.rowId);
                          setSelectedRowIds(next);
                        }}
                        className="w-4 h-4 accent-red-600 shrink-0 ml-1 cursor-pointer"
                      />
                    ) : (
                      <div className="flex flex-col shrink-0">
                        <button onClick={() => moveRow(i, -1)} disabled={i === 0}
                          className="text-slate-400 hover:text-slate-700 disabled:opacity-20 text-xs px-1" title="Subir">▲</button>
                        <button onClick={() => moveRow(i, 1)} disabled={i === table.templateRows.length - 1}
                          className="text-slate-400 hover:text-slate-700 disabled:opacity-20 text-xs px-1" title="Bajar">▼</button>
                      </div>
                    )}
                    <div onClick={() => { if (rowSelectMode) {
                        const next = new Set(selectedRowIds);
                        if (next.has(row.rowId)) next.delete(row.rowId);
                        else next.add(row.rowId);
                        setSelectedRowIds(next);
                      } else { setSelectedRow(row); }
                    }}
                      className={`flex-1 flex items-center justify-between p-2 border rounded-lg cursor-pointer ${
                        rowSelectMode && selectedRowIds.has(row.rowId)
                          ? 'border-red-300 bg-red-50'
                          : 'border-slate-200 hover:border-slate-400'
                      }`}>
                      <span className="text-sm text-slate-700">
                        {row.isTitle
                          ? <span className="font-bold text-slate-500 uppercase text-xs">📌 {row.titleText || '(título vacío)'}</span>
                          : row.isSelector
                          ? <span className="font-bold text-blue-600 text-xs">🔽 {row.selectorLabel || '(selector)'}: [{(row.selectorOptions ?? []).join(', ') || '...'}]</span>
                          : <>
                              {row.rowSpan && row.rowSpan > 1 && <span className="text-amber-600 text-xs font-bold mr-1">⇕{row.rowSpan}</span>}
                              {Object.values(row.cells).filter(Boolean).slice(0, 3).map(v => displaySpec(String(v))).join(' | ') || '(fila vacía)'}
                            </>}
                      </span>
                      {!rowSelectMode && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const duplicated = {
                                ...JSON.parse(JSON.stringify(row)),
                                rowId: crypto.randomUUID(),
                                rowSpan: undefined,
                                spanColumns: undefined,
                                columnSpans: undefined,
                              };
                              const next = [...table.templateRows];
                              next.splice(i + 1, 0, duplicated);
                              upd('templateRows', next);
                            }}
                            className="text-slate-500 hover:text-teal-700 text-xs font-medium"
                            title="Duplicar fila"
                          >Duplicar</button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              upd('templateRows', table.templateRows.filter(r => r.rowId !== row.rowId));
                            }}
                            className="text-red-500 hover:text-red-700 text-xs font-bold"
                            title="Eliminar fila"
                          >Eliminar</button>
                          <span className="text-blue-600 text-xs font-bold">Editar</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {selectedRow && !table.templateRows.some(r => r.rowId === selectedRow.rowId) && (
              <RowFormPanel row={selectedRow} columns={table.columns}
                totalRows={table.templateRows.length} rowIndex={table.templateRows.length}
                headerFields={table.headerFields ?? []}
                onSave={saveRow} onCancel={() => setSelectedRow(null)} />
            )}
          </div>
          {!rowSelectMode && (
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button size="sm" variant="outline"
                onClick={() => setSelectedRow({ rowId: crypto.randomUUID(), cells: {}, isTitle: true, titleText: '' })}>
                + Título sección
              </Button>
              <Button size="sm" variant="outline"
                onClick={() => setSelectedRow({ rowId: crypto.randomUUID(), cells: {}, isSelector: true, selectorLabel: '', selectorOptions: [] })}>
                + Fila selector
              </Button>
              <Button size="sm"
                onClick={() => setSelectedRow({ rowId: crypto.randomUUID(), cells: {} })}>
                + Fila
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Rules (validation only) */}
      {activeTab === 'rules' && table.tableType === 'validation' && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer">
            <input type="checkbox" checked={table.allowClientSpec ?? false}
              onChange={e => upd('allowClientSpec', e.target.checked || undefined)}
              className="w-4 h-4 accent-blue-600" />
            <div>
              <span className="text-xs font-bold text-slate-700">Permitir especificaciones del cliente</span>
              <p className="text-[10px] text-slate-500">El técnico puede activar "Especificaciones ampliadas" para sobreescribir la spec de fábrica por fila.</p>
            </div>
          </label>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500">{table.validationRules.length} reglas</span>
            {!addingRule && editingRuleIdx === null && (
              <Button size="sm" onClick={() => setAddingRule(true)}>+ Agregar regla</Button>
            )}
          </div>
          {table.validationRules.map((rule, i) => (
            <div key={rule.ruleId}>
              {editingRuleIdx === i ? (
                <TableEditorRuleForm rule={rule} columns={table.columns} rows={table.templateRows} onSave={saveRule}
                  onCancel={() => setEditingRuleIdx(null)} />
              ) : (
                <div className="flex items-center justify-between p-2 border border-slate-200 rounded-lg">
                  <span className="text-xs text-slate-700">
                    {rule.description || `${rule.sourceColumn} ${rule.operator} ${rule.factoryThreshold}`}
                  </span>
                  <div className="flex gap-3">
                    <button onClick={() => { setAddingRule(false); setEditingRuleIdx(i); }}
                      className="text-blue-600 text-xs font-bold">Editar</button>
                    <button onClick={() => upd('validationRules', table.validationRules.filter((_, j) => j !== i))}
                      className="text-red-600 text-xs font-bold">Eliminar</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {addingRule && (
            <TableEditorRuleForm rule={newRule()} columns={table.columns} rows={table.templateRows}
              onSave={saveRule} onCancel={() => setAddingRule(false)} />
          )}
        </div>
      )}

      {/* Header fields */}
      {activeTab === 'headers' && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500">
              {headerFields.length} campo(s) de encabezado
            </span>
            {!addingHeader && editingHeaderIdx === null && (
              <Button size="sm" onClick={() => setAddingHeader(true)}>+ Agregar campo</Button>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Selectores que aparecen arriba de la tabla (ej: "Inyector" con opciones ALS, SSL, PTV, COC).
          </p>
          {headerFields.map((hf, i) => (
            <div key={hf.fieldId}>
              {editingHeaderIdx === i ? (
                <TableEditorHeaderFieldForm field={hf} allFields={headerFields}
                  onSave={f => { upd('headerFields', headerFields.map((h, j) => j === i ? f : h)); setEditingHeaderIdx(null); }}
                  onCancel={() => setEditingHeaderIdx(null)} />
              ) : (
                <div className="flex items-center justify-between p-2 border border-slate-200 rounded-lg">
                  <span className="text-sm">
                    <span className="font-bold text-slate-900">{hf.label}</span>
                    <span className="text-slate-500 ml-2 text-xs">
                      {hf.options.join(' · ')}
                    </span>
                  </span>
                  <div className="flex gap-3">
                    <button onClick={() => { setAddingHeader(false); setEditingHeaderIdx(i); }}
                      className="text-blue-600 text-xs font-bold">Editar</button>
                    <button onClick={() => upd('headerFields', headerFields.filter((_, j) => j !== i))}
                      className="text-red-600 text-xs font-bold">Eliminar</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {addingHeader && (
            <TableEditorHeaderFieldForm
              field={{ fieldId: '', label: '', options: [] }}
              allFields={headerFields}
              onSave={f => { upd('headerFields', [...headerFields, { ...f, fieldId: crypto.randomUUID().slice(0, 8) }]); setAddingHeader(false); }}
              onCancel={() => setAddingHeader(false)} />
          )}
        </div>
      )}
    </Card>
  );
};
