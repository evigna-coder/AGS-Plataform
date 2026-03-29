import { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface EmbeddedColumn {
  key: string;
  label: string;
  options?: string[] | null;
  displayAs?: 'select' | 'radio' | null;
  group?: string | null;
  isRowHeader?: boolean;
}

interface Props {
  columns: EmbeddedColumn[];
  rows: Record<string, string>[];
  onChange: (columns: EmbeddedColumn[], rows: Record<string, string>[]) => void;
}

/**
 * Editor de tabla informacional embebida dentro de un ítem de checklist.
 * Soporta grupos de columnas (colspan), cabeceras de fila, y selectores por columna.
 */
export const EmbeddedTableEditor = ({ columns, rows, onChange }: Props) => {
  const [newColLabel, setNewColLabel] = useState('');
  const [editingColKey, setEditingColKey] = useState<string | null>(null);
  const [optionInput, setOptionInput] = useState('');

  const addColumn = () => {
    const label = newColLabel.trim();
    if (!label) return;
    const key = `col_${crypto.randomUUID().slice(0, 6)}`;
    onChange([...columns, { key, label }], rows.map(r => ({ ...r, [key]: '' })));
    setNewColLabel('');
  };

  const removeColumn = (key: string) => {
    onChange(
      columns.filter(c => c.key !== key),
      rows.map(r => { const { [key]: _, ...rest } = r; return rest; }),
    );
    if (editingColKey === key) setEditingColKey(null);
  };

  const updateColumn = (key: string, updates: Partial<EmbeddedColumn>) => {
    onChange(columns.map(c => c.key === key ? { ...c, ...updates } : c), rows);
  };

  const addOption = (colKey: string) => {
    const val = optionInput.trim();
    if (!val) return;
    const col = columns.find(c => c.key === colKey);
    if (!col) return;
    const current = col.options ?? [];
    if (!current.includes(val)) updateColumn(colKey, { options: [...current, val] });
    setOptionInput('');
  };

  const removeOption = (colKey: string, opt: string) => {
    const col = columns.find(c => c.key === colKey);
    if (!col) return;
    updateColumn(colKey, { options: (col.options ?? []).filter(o => o !== opt) });
  };

  const addRow = () => {
    const emptyRow: Record<string, string> = {};
    columns.forEach(c => { emptyRow[c.key] = ''; });
    onChange(columns, [...rows, emptyRow]);
  };

  const removeRow = (idx: number) => onChange(columns, rows.filter((_, i) => i !== idx));

  const updateCell = (ri: number, colKey: string, value: string) => {
    const newRows = [...rows];
    newRows[ri] = { ...newRows[ri], [colKey]: value };
    onChange(columns, newRows);
  };

  // Grupos existentes para el autocomplete
  const existingGroups = [...new Set(columns.map(c => c.group).filter(Boolean))] as string[];
  const editingCol = editingColKey ? columns.find(c => c.key === editingColKey) : null;

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Tabla informacional embebida</p>

      {/* Columnas */}
      <div className="space-y-1">
        <p className="text-[10px] font-medium text-slate-400">Columnas <span className="text-slate-300">(click para editar)</span>:</p>
        <div className="flex flex-wrap gap-1.5">
          {columns.map(col => (
            <button
              key={col.key}
              onClick={() => setEditingColKey(editingColKey === col.key ? null : col.key)}
              className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded border transition-colors ${
                editingColKey === col.key
                  ? 'border-teal-400 bg-teal-50 text-teal-800'
                  : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {col.isRowHeader && <span className="text-[9px] text-orange-500">H</span>}
              {col.group && <span className="text-[9px] text-blue-400">[{col.group}]</span>}
              {col.label}
              {col.options && col.options.length > 0 && (
                <span className="text-[9px] bg-teal-600 text-white px-1 rounded-sm">{col.options.length}</span>
              )}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <Input
            placeholder="Nueva columna..."
            value={newColLabel}
            onChange={e => setNewColLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addColumn(); } }}
            className="flex-1"
          />
          <Button size="sm" variant="outline" onClick={addColumn} disabled={!newColLabel.trim()}>+ Col</Button>
        </div>
      </div>

      {/* Panel de edición de columna */}
      {editingCol && (
        <div className="border border-teal-300 rounded-lg p-3 bg-teal-50/50 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-teal-700">Columna: {editingCol.label}</p>
            <button onClick={() => removeColumn(editingCol.key)} className="text-[10px] text-red-500 hover:text-red-700 font-medium">
              Eliminar columna
            </button>
          </div>
          <Input
            placeholder="Nombre de la columna"
            value={editingCol.label}
            onChange={e => updateColumn(editingCol.key, { label: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            {/* Grupo */}
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-slate-500">Grupo (header agrupado)</p>
              <Input
                placeholder="ej: Inlet"
                value={editingCol.group ?? ''}
                onChange={e => updateColumn(editingCol.key, { group: e.target.value || null })}
                list={`groups-${editingCol.key}`}
              />
              {existingGroups.length > 0 && (
                <datalist id={`groups-${editingCol.key}`}>
                  {existingGroups.map(g => <option key={g} value={g} />)}
                </datalist>
              )}
            </div>
            {/* Row header */}
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-[11px] font-medium text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingCol.isRowHeader ?? false}
                  onChange={e => updateColumn(editingCol.key, { isRowHeader: e.target.checked || undefined })}
                  className="accent-teal-600"
                />
                Es cabecera de fila
              </label>
            </div>
          </div>
          {/* Modo de visualización */}
          {editingCol.options && editingCol.options.length > 0 && (
            <div className="flex items-center gap-3">
              <p className="text-[10px] font-medium text-slate-500">Mostrar como:</p>
              <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 cursor-pointer">
                <input
                  type="radio"
                  name={`displayAs-${editingCol.key}`}
                  checked={!editingCol.displayAs || editingCol.displayAs === 'select'}
                  onChange={() => updateColumn(editingCol.key, { displayAs: 'select' })}
                  className="accent-teal-600"
                />
                Desplegable
              </label>
              <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 cursor-pointer">
                <input
                  type="radio"
                  name={`displayAs-${editingCol.key}`}
                  checked={editingCol.displayAs === 'radio'}
                  onChange={() => updateColumn(editingCol.key, { displayAs: 'radio' })}
                  className="accent-teal-600"
                />
                Radio buttons
              </label>
            </div>
          )}
          {/* Opciones del selector */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium text-slate-500">
              Opciones <span className="text-slate-400">(desplegable o radio para el técnico)</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(editingCol.options ?? []).map(opt => (
                <span key={opt} className="flex items-center gap-1 text-[11px] bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">
                  {opt}
                  <button onClick={() => removeOption(editingCol.key, opt)} className="text-teal-400 hover:text-teal-700 font-bold">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-1.5">
              <Input
                placeholder="Nueva opción..."
                value={optionInput}
                onChange={e => setOptionInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption(editingCol.key); } }}
                className="flex-1"
              />
              <Button size="sm" variant="outline" onClick={() => addOption(editingCol.key)} disabled={!optionInput.trim()}>+</Button>
            </div>
          </div>
        </div>
      )}

      {/* Tabla de datos */}
      {columns.length > 0 && (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-slate-100">
                {columns.map(col => (
                  <th key={col.key} className="px-2 py-1.5 text-center font-bold text-slate-600 border-b border-slate-200">
                    {col.group && <span className="text-[9px] text-blue-400 mr-1">[{col.group}]</span>}
                    {col.label}
                    {col.isRowHeader && <span className="ml-1 text-[9px] text-orange-400">H</span>}
                    {col.options && col.options.length > 0 && <span className="ml-1 text-[9px] text-teal-500">▾</span>}
                  </th>
                ))}
                <th className="w-8 border-b border-slate-200" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="border-b border-slate-100 last:border-b-0">
                  {columns.map(col => (
                    <td key={col.key} className="p-1">
                      {col.options && col.options.length > 0 ? (
                        <select
                          className="w-full text-xs bg-white border border-slate-200 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-teal-500"
                          value={row[col.key] ?? ''}
                          onChange={e => updateCell(ri, col.key, e.target.value)}
                        >
                          <option value="">—</option>
                          {col.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : (
                        <input
                          className={`w-full text-xs bg-white border border-slate-200 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-teal-500 ${col.isRowHeader ? 'font-semibold' : ''}`}
                          value={row[col.key] ?? ''}
                          onChange={e => updateCell(ri, col.key, e.target.value)}
                          placeholder="—"
                        />
                      )}
                    </td>
                  ))}
                  <td className="px-1 text-left">
                    <button onClick={() => removeRow(ri)} className="text-red-400 hover:text-red-600 text-xs">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-2 py-1.5 bg-slate-50 border-t border-slate-200">
            <button onClick={addRow} className="text-[11px] text-teal-600 hover:text-teal-700 font-medium">
              + Agregar fila
            </button>
          </div>
        </div>
      )}

      {columns.length === 0 && (
        <p className="text-[10px] text-slate-400 italic">Agregá al menos una columna para definir la tabla.</p>
      )}
    </div>
  );
};
