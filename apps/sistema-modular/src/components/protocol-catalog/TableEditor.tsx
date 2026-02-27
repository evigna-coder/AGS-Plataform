import { useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { RowFormPanel } from './RowFormPanel';
import type { TableCatalogEntry, TableCatalogColumn, TableCatalogRow, TableCatalogRule } from '@ags/shared';

type Tab = 'columns' | 'rows' | 'rules';

// ─── Sub-componente: formulario de columna ────────────────────────────────────
interface ColFormProps {
  col: TableCatalogColumn;
  onSave: (col: TableCatalogColumn) => void;
  onCancel: () => void;
}

const ColumnForm = ({ col, onSave, onCancel }: ColFormProps) => {
  const [d, setD] = useState<TableCatalogColumn>(col);
  return (
    <div className="border border-slate-900 rounded-lg p-3 space-y-2 bg-slate-50 mt-2">
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="Clave (ej: presion)" value={d.key}
          onChange={e => setD({ ...d, key: e.target.value })} />
        <Input placeholder="Etiqueta (ej: Presión)" value={d.label}
          onChange={e => setD({ ...d, label: e.target.value })} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <select value={d.type} onChange={e => setD({ ...d, type: e.target.value as TableCatalogColumn['type'] })}
          className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          <option value="text_input">Texto libre</option>
          <option value="number_input">Número</option>
          <option value="checkbox">Checkbox</option>
          <option value="fixed_text">Texto fijo</option>
          <option value="date_input">Fecha</option>
          <option value="pass_fail">Pasa/Falla</option>
        </select>
        <Input placeholder="Unidad (ej: mL/min)" value={d.unit ?? ''}
          onChange={e => setD({ ...d, unit: e.target.value || null })} />
        {d.type === 'fixed_text' ? (
          <Input placeholder="Valor fijo (admin)" value={d.fixedValue ?? ''}
            onChange={e => setD({ ...d, fixedValue: e.target.value || null })} />
        ) : (
          <Input placeholder="Valor esperado" value={d.expectedValue ?? ''}
            onChange={e => setD({ ...d, expectedValue: e.target.value || null })} />
        )}
      </div>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase cursor-pointer">
          <input type="checkbox" checked={d.required} onChange={e => setD({ ...d, required: e.target.checked })} />
          Obligatorio
        </label>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button size="sm" onClick={() => onSave({ ...d, key: d.key || crypto.randomUUID().slice(0, 8) })}
            disabled={!d.label}>Guardar</Button>
        </div>
      </div>
    </div>
  );
};

// ─── Sub-componente: formulario de regla de validación ───────────────────────
interface RuleFormProps {
  rule: TableCatalogRule;
  columns: TableCatalogColumn[];
  onSave: (rule: TableCatalogRule) => void;
  onCancel: () => void;
}

const RuleForm = ({ rule, columns, onSave, onCancel }: RuleFormProps) => {
  const [d, setD] = useState<TableCatalogRule>(rule);
  const ops: TableCatalogRule['operator'][] = ['<=', '>=', '<', '>', '==', '!='];
  return (
    <div className="border border-slate-900 rounded-lg p-3 space-y-2 bg-slate-50 mt-2">
      <Input placeholder="Descripción de la regla" value={d.description}
        onChange={e => setD({ ...d, description: e.target.value })} />
      <div className="grid grid-cols-3 gap-2">
        <select value={d.sourceColumn} onChange={e => setD({ ...d, sourceColumn: e.target.value })}
          className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          <option value="">Columna fuente…</option>
          {columns.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <select value={d.operator} onChange={e => setD({ ...d, operator: e.target.value as TableCatalogRule['operator'] })}
          className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          {ops.map(op => <option key={op} value={op}>{op}</option>)}
        </select>
        <Input placeholder="Umbral (ej: 5.0)" value={String(d.factoryThreshold)}
          onChange={e => setD({ ...d, factoryThreshold: e.target.value })} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <select value={d.targetColumn} onChange={e => setD({ ...d, targetColumn: e.target.value })}
          className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          <option value="">Columna resultado…</option>
          {columns.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <Input placeholder="Etiqueta si pasa" value={d.valueIfPass}
          onChange={e => setD({ ...d, valueIfPass: e.target.value })} />
        <Input placeholder="Etiqueta si falla" value={d.valueIfFail}
          onChange={e => setD({ ...d, valueIfFail: e.target.value })} />
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" onClick={() => onSave(d)}>Guardar regla</Button>
      </div>
    </div>
  );
};

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
});

export const TableEditor = ({ table, onChange }: Props) => {
  const [activeTab, setActiveTab] = useState<Tab>('columns');
  const [editingColIdx, setEditingColIdx] = useState<number | null>(null);
  const [addingCol, setAddingCol] = useState(false);
  const [selectedRow, setSelectedRow] = useState<TableCatalogRow | null>(null);
  const [editingRuleIdx, setEditingRuleIdx] = useState<number | null>(null);
  const [addingRule, setAddingRule] = useState(false);

  const upd = (key: keyof TableCatalogEntry, value: any) => onChange({ ...table, [key]: value });

  const tabs: Tab[] = table.tableType === 'validation'
    ? ['columns', 'rows', 'rules']
    : ['columns', 'rows'];

  const tabLabel: Record<Tab, string> = {
    columns: `Columnas (${table.columns.length})`,
    rows: `Filas (${table.templateRows.length})`,
    rules: `Reglas (${table.validationRules.length})`,
  };

  const saveColumn = (col: TableCatalogColumn) => {
    if (editingColIdx !== null) {
      const cols = [...table.columns]; cols[editingColIdx] = col;
      upd('columns', cols); setEditingColIdx(null);
    } else {
      upd('columns', [...table.columns, col]); setAddingCol(false);
    }
  };

  const saveRow = (row: TableCatalogRow) => {
    const exists = table.templateRows.some(r => r.rowId === row.rowId);
    upd('templateRows', exists
      ? table.templateRows.map(r => r.rowId === row.rowId ? row : r)
      : [...table.templateRows, row]);
    setSelectedRow(null);
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
                <ColumnForm col={col} onSave={saveColumn} onCancel={() => setEditingColIdx(null)} />
              ) : (
                <div className="flex items-center justify-between p-2 border border-slate-200 rounded-lg">
                  <span className="text-sm">
                    <span className="font-bold text-slate-900">{col.label}</span>
                    <span className="text-slate-500 ml-2 text-xs">
                      {col.type}{col.unit ? ` (${col.unit})` : ''}{col.required ? ' *' : ''}
                      {col.type === 'fixed_text' && col.fixedValue ? ` = "${col.fixedValue}"` : ''}
                    </span>
                  </span>
                  <div className="flex gap-3">
                    <button onClick={() => { setAddingCol(false); setEditingColIdx(i); }}
                      className="text-blue-600 text-xs font-bold">Editar</button>
                    <button onClick={() => upd('columns', table.columns.filter((_, j) => j !== i))}
                      className="text-red-600 text-xs font-bold">Eliminar</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {addingCol && (
            <ColumnForm
              col={{ key: '', label: '', type: 'text_input', unit: null, required: false, expectedValue: null }}
              onSave={saveColumn} onCancel={() => setAddingCol(false)} />
          )}
        </div>
      )}

      {/* Rows */}
      {activeTab === 'rows' && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500">{table.templateRows.length} filas template</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline"
                onClick={() => setSelectedRow({ rowId: crypto.randomUUID(), cells: {}, isTitle: true, titleText: '' })}>
                + Título sección
              </Button>
              <Button size="sm"
                onClick={() => setSelectedRow({ rowId: crypto.randomUUID(), cells: {} })}>
                + Fila
              </Button>
            </div>
          </div>
          {table.templateRows.map(row => (
            <div key={row.rowId}>
              {selectedRow?.rowId === row.rowId ? (
                <RowFormPanel row={selectedRow} columns={table.columns}
                  onSave={saveRow}
                  onDelete={() => { upd('templateRows', table.templateRows.filter(r => r.rowId !== row.rowId)); setSelectedRow(null); }}
                  onCancel={() => setSelectedRow(null)} />
              ) : (
                <div onClick={() => setSelectedRow(row)}
                  className="flex items-center justify-between p-2 border border-slate-200 rounded-lg cursor-pointer hover:border-slate-400">
                  <span className="text-sm text-slate-700">
                    {row.isTitle
                      ? <span className="font-bold text-slate-500 uppercase text-xs">📌 {row.titleText || '(título vacío)'}</span>
                      : Object.values(row.cells).filter(Boolean).slice(0, 3).join(' | ') || '(fila vacía)'}
                  </span>
                  <span className="text-blue-600 text-xs font-bold">Editar</span>
                </div>
              )}
            </div>
          ))}
          {selectedRow && !table.templateRows.some(r => r.rowId === selectedRow.rowId) && (
            <RowFormPanel row={selectedRow} columns={table.columns}
              onSave={saveRow} onCancel={() => setSelectedRow(null)} />
          )}
        </div>
      )}

      {/* Rules (validation only) */}
      {activeTab === 'rules' && table.tableType === 'validation' && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500">{table.validationRules.length} reglas</span>
            {!addingRule && editingRuleIdx === null && (
              <Button size="sm" onClick={() => setAddingRule(true)}>+ Agregar regla</Button>
            )}
          </div>
          {table.validationRules.map((rule, i) => (
            <div key={rule.ruleId}>
              {editingRuleIdx === i ? (
                <RuleForm rule={rule} columns={table.columns} onSave={saveRule}
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
            <RuleForm rule={newRule()} columns={table.columns}
              onSave={saveRule} onCancel={() => setAddingRule(false)} />
          )}
        </div>
      )}
    </Card>
  );
};
