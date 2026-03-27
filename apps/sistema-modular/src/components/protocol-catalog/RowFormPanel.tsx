import { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { TableCatalogColumn, TableCatalogRow } from '@ags/shared';

type RowMode = 'data' | 'title' | 'selector';

interface Props {
  row: TableCatalogRow;
  columns: TableCatalogColumn[];
  totalRows: number;
  rowIndex: number;
  onSave: (row: TableCatalogRow) => void;
  onDelete?: () => void;
  onCancel: () => void;
}

export const RowFormPanel = ({ row, columns, totalRows, rowIndex, onSave, onDelete, onCancel }: Props) => {
  const [cells, setCells] = useState<Record<string, string | number | boolean | null>>(row.cells);
  const initialMode: RowMode = row.isSelector ? 'selector' : row.isTitle ? 'title' : 'data';
  const [mode, setMode] = useState<RowMode>(initialMode);
  const [titleText, setTitleText] = useState(row.titleText ?? '');
  const [selectorLabel, setSelectorLabel] = useState(row.selectorLabel ?? '');
  const [selectorOptionsText, setSelectorOptionsText] = useState((row.selectorOptions ?? []).join(', '));
  const [rowSpan, setRowSpan] = useState(row.rowSpan ?? 1);
  const [spanColumns, setSpanColumns] = useState<string[]>(row.spanColumns ?? []);

  const handleChange = (key: string, value: string | boolean | null) => {
    setCells(prev => ({ ...prev, [key]: value === '' ? null : value }));
  };

  const handleSave = () => {
    if (mode === 'title') {
      onSave({ ...row, cells: {}, isTitle: true, titleText, isSelector: false, selectorLabel: null, selectorOptions: null, rowSpan: undefined, spanColumns: undefined });
    } else if (mode === 'selector') {
      const options = selectorOptionsText.split(',').map(o => o.trim()).filter(Boolean);
      onSave({ ...row, cells, isTitle: false, titleText: null, isSelector: true, selectorLabel, selectorOptions: options, rowSpan: undefined, spanColumns: undefined });
    } else {
      const effectiveSpan = rowSpan > 1 ? rowSpan : undefined;
      const effectiveSpanCols = effectiveSpan && spanColumns.length > 0 ? spanColumns : undefined;
      onSave({ ...row, cells, isTitle: false, titleText: null, isSelector: false, selectorLabel: null, selectorOptions: null, rowSpan: effectiveSpan, spanColumns: effectiveSpanCols });
    }
  };

  // Max rowSpan: can't exceed remaining rows below this one
  const maxRowSpan = totalRows - rowIndex;

  const toggleSpanColumn = (colKey: string) => {
    setSpanColumns(prev =>
      prev.includes(colKey) ? prev.filter(k => k !== colKey) : [...prev, colKey]
    );
  };

  // En modo selector, la primera columna se reemplaza por el dropdown; el resto son editables
  const restColumns = mode === 'selector' && columns.length > 1 ? columns.slice(1) : [];

  const modeLabel: Record<RowMode, string> = { data: 'Editar fila', title: 'Título de sección', selector: 'Fila selector' };

  return (
    <div className="border border-slate-900 rounded-lg p-4 bg-slate-50 space-y-3">
      <div className="flex justify-between items-center gap-2">
        <h4 className="text-xs font-black text-slate-900 uppercase">
          {modeLabel[mode]}
        </h4>
        <div className="flex gap-3">
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase cursor-pointer">
            <input type="radio" name="rowMode" checked={mode === 'data'} onChange={() => setMode('data')} />
            Datos
          </label>
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase cursor-pointer">
            <input type="radio" name="rowMode" checked={mode === 'title'} onChange={() => setMode('title')} />
            Título
          </label>
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase cursor-pointer">
            <input type="radio" name="rowMode" checked={mode === 'selector'} onChange={() => setMode('selector')} />
            Selector
          </label>
        </div>
      </div>

      {mode === 'title' ? (
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Texto del título</label>
          <Input
            value={titleText}
            onChange={e => setTitleText(e.target.value)}
            placeholder="Ej: Sección 1 — Preparación del sistema"
          />
        </div>
      ) : mode === 'selector' ? (
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
            <p className="text-[10px] font-bold text-blue-700 uppercase">Columna 1 → Selector</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Etiqueta</label>
                <Input
                  value={selectorLabel}
                  onChange={e => setSelectorLabel(e.target.value)}
                  placeholder="Ej: Inyector Automático"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Opciones (coma)</label>
                <Input
                  value={selectorOptionsText}
                  onChange={e => setSelectorOptionsText(e.target.value)}
                  placeholder="Ej: ALS, Manual"
                />
              </div>
            </div>
          </div>
          {restColumns.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Columnas restantes (valores por defecto)</p>
              <div className="grid grid-cols-2 gap-3">
                {restColumns.map(col => (
                  <div key={col.key}>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                      {col.label}{col.unit ? ` (${col.unit})` : ''}
                    </label>
                    <Input
                      value={String(cells[col.key] ?? '')}
                      onChange={e => handleChange(col.key, e.target.value)}
                      placeholder={col.expectedValue ?? ''}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : columns.length === 0 ? (
        <p className="text-xs text-slate-500 py-2">
          Primero definí las columnas en la pestaña "Columnas".
        </p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {columns.map(col => (
              <div key={col.key}>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  {col.label}
                  {col.required ? ' *' : ''}
                  {col.unit ? ` (${col.unit})` : ''}
                </label>
                {col.type === 'pass_fail' ? (
                  <select
                    value={String(cells[col.key] ?? '')}
                    onChange={e => handleChange(col.key, e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">—</option>
                    <option value="PASA">PASA</option>
                    <option value="FALLA">FALLA</option>
                    <option value="N/A">N/A</option>
                  </select>
                ) : col.type === 'select_input' && col.options?.length ? (
                  <select
                    value={String(cells[col.key] ?? '')}
                    onChange={e => handleChange(col.key, e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">—</option>
                    {col.options.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : col.type === 'checkbox' ? (
                  <div className="flex items-center h-9">
                    <input
                      type="checkbox"
                      checked={Boolean(cells[col.key])}
                      onChange={e => handleChange(col.key, e.target.checked)}
                      className="w-4 h-4 accent-slate-900"
                    />
                  </div>
                ) : (
                  <Input
                    type={col.type === 'number_input' ? 'number' : col.type === 'date_input' ? 'date' : 'text'}
                    value={String(cells[col.key] ?? '')}
                    onChange={e => handleChange(col.key, e.target.value)}
                    placeholder={
                      col.type === 'fixed_text'
                        ? col.fixedValue ?? '(valor fijo)'
                        : (col.expectedValue ?? '')
                    }
                  />
                )}
              </div>
            ))}
          </div>

          {/* Row spanning config */}
          {maxRowSpan > 1 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
              <p className="text-[10px] font-bold text-amber-700 uppercase">Fusión de filas (Row Span)</p>
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-slate-600 uppercase shrink-0">Abarcar filas</label>
                <input
                  type="number"
                  min={1}
                  max={maxRowSpan}
                  value={rowSpan}
                  onChange={e => setRowSpan(Math.max(1, Math.min(maxRowSpan, Number(e.target.value) || 1)))}
                  className="w-16 border border-slate-300 rounded-lg px-2 py-1 text-sm text-center"
                />
                <span className="text-[10px] text-slate-500">
                  (máx. {maxRowSpan} — filas restantes debajo)
                </span>
              </div>
              {rowSpan > 1 && (
                <div>
                  <p className="text-[10px] font-bold text-slate-600 uppercase mb-1.5">Columnas que se fusionan verticalmente</p>
                  <div className="flex flex-wrap gap-2">
                    {columns.map(col => (
                      <label key={col.key} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={spanColumns.includes(col.key)}
                          onChange={() => toggleSpanColumn(col.key)}
                          className="w-3.5 h-3.5 accent-amber-600"
                        />
                        <span className="text-xs text-slate-700">{col.label}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-[10px] text-amber-600 mt-1.5">
                    Las columnas seleccionadas mostrarán una sola celda que abarca {rowSpan} filas. Las demás columnas tendrán celdas independientes por cada sub-fila.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between pt-2 border-t border-slate-200">
        {onDelete ? (
          <Button size="sm" variant="danger" onClick={onDelete}>Eliminar fila</Button>
        ) : (
          <div />
        )}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button size="sm" onClick={handleSave}>Guardar</Button>
        </div>
      </div>
    </div>
  );
};
