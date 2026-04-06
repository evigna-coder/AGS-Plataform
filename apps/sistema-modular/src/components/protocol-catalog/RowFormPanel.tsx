import { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { TableCatalogColumn, TableCatalogRow, TableHeaderField } from '@ags/shared';

type RowMode = 'data' | 'title' | 'selector';

interface Props {
  row: TableCatalogRow;
  columns: TableCatalogColumn[];
  totalRows: number;
  rowIndex: number;
  /** Campos de encabezado de la tabla (para configurar visibilidad condicional) */
  headerFields?: TableHeaderField[];
  onSave: (row: TableCatalogRow) => void;
  onDelete?: () => void;
  onCancel: () => void;
}

export const RowFormPanel = ({ row, columns, totalRows, rowIndex, headerFields = [], onSave, onDelete, onCancel }: Props) => {
  const [cells, setCells] = useState<Record<string, string | number | boolean | null>>(row.cells);
  const initialMode: RowMode = row.isSelector ? 'selector' : row.isTitle ? 'title' : 'data';
  const [mode, setMode] = useState<RowMode>(initialMode);
  const [titleText, setTitleText] = useState(row.titleText ?? '');
  const [selectorLabel, setSelectorLabel] = useState(row.selectorLabel ?? '');
  const [selectorOptionsText, setSelectorOptionsText] = useState((row.selectorOptions ?? []).join(', '));
  const [selectorColumn, setSelectorColumn] = useState(row.selectorColumn ?? 0);

  // Inicializar columnSpans desde columnSpans (nuevo) o rowSpan+spanColumns (legacy)
  const initColumnSpans = (): Record<string, number> => {
    if (row.columnSpans && Object.keys(row.columnSpans).length > 0) return { ...row.columnSpans };
    if (row.rowSpan && row.rowSpan > 1 && row.spanColumns?.length) {
      const spans: Record<string, number> = {};
      row.spanColumns.forEach(key => { spans[key] = row.rowSpan!; });
      return spans;
    }
    return {};
  };
  const [columnSpans, setColumnSpans] = useState<Record<string, number>>(initColumnSpans);

  // Variable binding
  const [variable, setVariable] = useState(row.variable ?? '');

  // Unidades por columna (override de col.unit para esta fila)
  const [cellUnits, setCellUnits] = useState<Record<string, string>>(
    () => Object.fromEntries(Object.entries(row.cellUnits ?? {}).filter(([, v]) => v !== ''))
  );
  const [showCellUnits, setShowCellUnits] = useState(() => Object.keys(row.cellUnits ?? {}).length > 0);

  const unitColumns = columns.filter(c => c.type === 'number_input' || c.type === 'text_input');

  // Visibilidad condicional por header field
  const [visFieldId, setVisFieldId] = useState(row.visibleWhenSelector?.headerFieldId ?? '');
  const [visSelValues, setVisSelValues] = useState<string[]>(row.visibleWhenSelector?.values ?? []);

  const toggleVisValue = (val: string) =>
    setVisSelValues(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);

  const handleChange = (key: string, value: string | boolean | null) => {
    setCells(prev => ({ ...prev, [key]: value === '' ? null : value }));
  };

  const handleSave = () => {
    if (mode === 'title') {
      onSave({ ...row, cells: {}, isTitle: true, titleText, isSelector: false, selectorLabel: null, selectorOptions: null, rowSpan: undefined, spanColumns: undefined, columnSpans: undefined });
    } else if (mode === 'selector') {
      const options = selectorOptionsText.split(',').map(o => o.trim()).filter(Boolean);
      const effectiveSelectorCol = selectorColumn > 0 ? selectorColumn : undefined;
      onSave({ ...row, cells, isTitle: false, titleText: null, isSelector: true, selectorLabel, selectorOptions: options, selectorColumn: effectiveSelectorCol, rowSpan: undefined, spanColumns: undefined, columnSpans: undefined });
    } else {
      // Filtrar spans <= 1 y construir el objeto limpio
      const cleanSpans: Record<string, number> = {};
      for (const [key, val] of Object.entries(columnSpans)) {
        if (val > 1) cleanSpans[key] = val;
      }
      const hasSpans = Object.keys(cleanSpans).length > 0;
      // Visibilidad condicional
      const visWhen = visFieldId && visSelValues.length > 0
        ? { headerFieldId: visFieldId, values: visSelValues }
        : null;
      const cleanCellUnits = Object.fromEntries(Object.entries(cellUnits).filter(([, v]) => v !== ''));
      onSave({
        ...row, cells, isTitle: false, titleText: null, isSelector: false, selectorLabel: null, selectorOptions: null,
        rowSpan: undefined, spanColumns: undefined,
        columnSpans: hasSpans ? cleanSpans : undefined,
        visibleWhenSelector: visWhen,
        variable: variable || null,
        cellUnits: Object.keys(cleanCellUnits).length > 0 ? cleanCellUnits : null,
      });
    }
  };

  // Max rowSpan: can't exceed remaining rows below this one
  const maxRowSpan = totalRows - rowIndex;

  const setColSpan = (colKey: string, value: number) => {
    setColumnSpans(prev => {
      const next = { ...prev };
      if (value > 1) {
        next[colKey] = Math.min(value, maxRowSpan);
      } else {
        delete next[colKey];
      }
      return next;
    });
  };

  const hasAnySpan = Object.values(columnSpans).some(v => v > 1);

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
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-blue-700 uppercase">Selector</p>
              {columns.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Dropdown en:</span>
                  <select
                    value={selectorColumn}
                    onChange={e => setSelectorColumn(Number(e.target.value))}
                    className="text-xs border border-slate-300 rounded px-1.5 py-0.5 bg-white"
                  >
                    <option value={0}>{columns[0]?.label ?? 'Col 1'} (junto al label)</option>
                    {columns.slice(1).map((col, i) => (
                      <option key={col.key} value={i + 1}>{col.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
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
          {/* Variable binding */}
          <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 space-y-1.5">
            <p className="text-[10px] font-bold text-violet-700 uppercase">Variable del reporte</p>
            <p className="text-[10px] text-violet-600">Cuando se asigna una variable, la columna de valor se auto-rellena con datos del reporte (cliente, OT, ingeniero, etc.).</p>
            <select
              value={variable}
              onChange={e => setVariable(e.target.value)}
              className="w-full border border-violet-300 rounded-lg px-2 py-1.5 text-sm bg-white"
            >
              <option value="">Sin variable (valor manual)</option>
              <optgroup label="Cliente">
                <option value="cliente.razonSocial">Razón social</option>
                <option value="cliente.direccionCompleta">Dirección completa</option>
                <option value="cliente.sector">Sector / Área</option>
                <option value="cliente.contacto">Contacto</option>
              </optgroup>
              <optgroup label="Orden de Trabajo">
                <option value="ot.numero">Número de OT</option>
              </optgroup>
              <optgroup label="Ingeniero">
                <option value="ingeniero.nombre">Nombre y apellido</option>
              </optgroup>
              <optgroup label="AGS ANALITICA">
                <option value="ags.empresa">Razón social</option>
                <option value="ags.direccion">Dirección</option>
                <option value="ags.telefono">Teléfono</option>
                <option value="ags.email">Email</option>
                <option value="ags.web">Sitio web</option>
              </optgroup>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {columns.map((col, colIdx) => (
              <div key={col.key}>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  {col.label}
                  {col.required ? ' *' : ''}
                  {col.unit ? ` (${col.unit})` : ''}
                  {colIdx === 0 && columns.length >= 2 && (
                    <span className="ml-1 text-[9px] font-normal text-slate-400 normal-case">(vacío = sin etiqueta)</span>
                  )}
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
                    type={col.type === 'date_input' ? 'date' : 'text'}
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

          {/* Visibilidad condicional por header field */}
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 space-y-2">
            <p className="text-[10px] font-bold text-teal-700 uppercase">Visible solo si...</p>
            {headerFields.length === 0 ? (
              <p className="text-[10px] text-teal-600 italic">Primero agregá un <strong>campo de encabezado</strong> a la tabla (pestaña "Encabezado") para habilitar visibilidad condicional.</p>
            ) : (
              <>
                <p className="text-[10px] text-teal-600">Esta fila solo se muestra cuando el campo de encabezado elegido tiene alguno de los valores indicados.</p>
                <div className="space-y-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Campo de encabezado</label>
                    <select
                      value={visFieldId}
                      onChange={e => { setVisFieldId(e.target.value); setVisSelValues([]); }}
                      className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                    >
                      <option value="">Sin condición (siempre visible)</option>
                      {headerFields.map(hf => (
                        <option key={hf.fieldId} value={hf.fieldId}>{hf.label}</option>
                      ))}
                    </select>
                  </div>
                  {visFieldId && (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Visible cuando el valor es...</label>
                      <div className="flex flex-wrap gap-2">
                        {(headerFields.find(h => h.fieldId === visFieldId)?.options ?? []).map(opt => (
                          <label key={opt} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium cursor-pointer transition-colors ${visSelValues.includes(opt) ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-slate-300 text-slate-600 hover:border-teal-400'}`}>
                            <input type="checkbox" checked={visSelValues.includes(opt)} onChange={() => toggleVisValue(opt)} className="sr-only" />
                            {opt}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Unidades por columna (override de col.unit para esta fila) */}
          {unitColumns.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setShowCellUnits(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 text-[10px] font-bold text-slate-600 uppercase hover:bg-slate-100"
              >
                <span>Unidades por columna (opcional)</span>
                <span className="text-slate-400">{showCellUnits ? '▲' : '▼'}</span>
              </button>
              {showCellUnits && (
                <div className="p-3 space-y-1.5">
                  <p className="text-[10px] text-slate-400 mb-2">
                    Vacío = usa la unidad global de la columna. Solo completar las columnas que necesitan una unidad distinta en esta fila.
                  </p>
                  {unitColumns.map(col => (
                    <div key={col.key} className="flex items-center gap-2">
                      <span className="flex-1 text-xs text-slate-600 truncate">
                        {col.label}{col.unit ? <span className="text-slate-400 ml-1">({col.unit})</span> : ''}
                      </span>
                      <input
                        type="text"
                        value={cellUnits[col.key] ?? ''}
                        placeholder={col.unit ?? 'ej: mAU/h'}
                        onChange={e => {
                          const val = e.target.value;
                          setCellUnits(prev => {
                            const next = { ...prev };
                            if (val === '') { delete next[col.key]; } else { next[col.key] = val; }
                            return next;
                          });
                        }}
                        className="w-28 border border-slate-300 rounded px-2 py-1 text-xs text-center"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Column-level span config */}
          {maxRowSpan > 1 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
              <p className="text-[10px] font-bold text-amber-700 uppercase">Fusión de filas por columna</p>
              <p className="text-[10px] text-amber-600">Cada columna puede abarcar un número distinto de filas hacia abajo. Dejá en 1 las que no se fusionan.</p>
              <div className="grid grid-cols-2 gap-2">
                {columns.map(col => (
                  <div key={col.key} className="flex items-center gap-2">
                    <span className="text-xs text-slate-700 truncate flex-1">{col.label}</span>
                    <input
                      type="number"
                      min={1}
                      max={maxRowSpan}
                      value={columnSpans[col.key] ?? 1}
                      onChange={e => setColSpan(col.key, Math.max(1, Math.min(maxRowSpan, Number(e.target.value) || 1)))}
                      className={`w-14 border rounded-lg px-2 py-1 text-xs text-center ${(columnSpans[col.key] ?? 1) > 1 ? 'border-amber-400 bg-amber-100 font-bold' : 'border-slate-300'}`}
                    />
                  </div>
                ))}
              </div>
              {hasAnySpan && (
                <p className="text-[10px] text-amber-600 mt-1">
                  Las columnas con valor {'>'} 1 mostrarán una celda fusionada. Las filas cubiertas no renderizan esas celdas.
                </p>
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
