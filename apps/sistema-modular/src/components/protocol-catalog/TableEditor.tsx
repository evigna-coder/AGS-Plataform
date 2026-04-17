import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { RowFormPanel } from './RowFormPanel';
import type { TableCatalogEntry, TableCatalogColumn, TableCatalogRow, TableCatalogRule, TableHeaderField } from '@ags/shared';

type Tab = 'columns' | 'rows' | 'rules' | 'headers';

// ─── Sub-componente: formulario de columna ────────────────────────────────────
interface ColFormProps {
  col: TableCatalogColumn;
  onSave: (col: TableCatalogColumn) => void;
  onCancel: () => void;
}

const ColumnForm = ({ col, onSave, onCancel }: ColFormProps) => {
  const [d, setD] = useState<TableCatalogColumn>(col);
  const [optionsText, setOptionsText] = useState((col.options ?? []).join(', '));
  const handleSave = () => {
    const withOptions = (d.type === 'select_input' || d.type === 'multi_select')
      ? { ...d, options: optionsText.split(',').map(o => o.trim()).filter(Boolean), key: d.key || crypto.randomUUID().slice(0, 8) }
      : { ...d, key: d.key || crypto.randomUUID().slice(0, 8) };
    onSave(withOptions);
  };
  return (
    <div className="border border-slate-900 rounded-lg p-3 space-y-2 bg-slate-50 mt-2">
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="Clave (ej: presion)" value={d.key}
          onChange={e => setD({ ...d, key: e.target.value })} />
        <Input placeholder="Etiqueta (opcional — vacío oculta el encabezado)" value={d.label}
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
          <option value="select_input">Selección (una opción)</option>
          <option value="multi_select">Multi-selección (varias opciones)</option>
        </select>
        <Input placeholder="Unidad (ej: mL/min)" value={d.unit ?? ''}
          onChange={e => setD({ ...d, unit: e.target.value || null })} />
        {d.type === 'fixed_text' ? (
          <Input placeholder="Valor fijo (admin)" value={d.fixedValue ?? ''}
            onChange={e => setD({ ...d, fixedValue: e.target.value || null })} />
        ) : d.type === 'select_input' ? (
          <Input placeholder="Opciones separadas por coma (ej: Sí, No, N/A)" value={optionsText}
            onChange={e => setOptionsText(e.target.value)} />
        ) : d.type === 'multi_select' ? (
          <div className="flex gap-2 flex-1">
            <Input placeholder="Opciones fijas (coma) o vacío si usa tabla" value={optionsText}
              onChange={e => setOptionsText(e.target.value)} />
            <Input placeholder="Tabla fuente (nombre exacto)" value={d.optionsFromTable?.tableName ?? ''}
              onChange={e => setD({ ...d, optionsFromTable: e.target.value ? { tableName: e.target.value, columnKey: d.optionsFromTable?.columnKey ?? '' } : null })} />
            <Input placeholder="Columna (key)" value={d.optionsFromTable?.columnKey ?? ''}
              onChange={e => setD({ ...d, optionsFromTable: { tableName: d.optionsFromTable?.tableName ?? '', columnKey: e.target.value } })} />
          </div>
        ) : (
          <Input placeholder="Valor esperado" value={d.expectedValue ?? ''}
            onChange={e => setD({ ...d, expectedValue: e.target.value || null })} />
        )}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase cursor-pointer">
            <input type="checkbox" checked={d.required} onChange={e => setD({ ...d, required: e.target.checked })} />
            Obligatorio
          </label>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase cursor-pointer" title="Las filas sin valor de template quedan en blanco (sin input). Útil para columnas de etiqueta fija.">
            <input type="checkbox" checked={!!d.isLabelColumn} onChange={e => setD({ ...d, isLabelColumn: e.target.checked || undefined })} />
            Etiqueta fija
          </label>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase cursor-pointer" title="La columna existe y guarda datos, pero arranca oculta en reportes-ot. El ingeniero puede mostrarla por instancia.">
            <input type="checkbox" checked={!!d.hiddenByDefault} onChange={e => setD({ ...d, hiddenByDefault: e.target.checked || undefined })} />
            Oculta por defecto
          </label>
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-medium text-slate-500">Ancho (mm)</label>
            <input
              type="number"
              min={0}
              value={d.width ?? ''}
              onChange={e => setD({ ...d, width: e.target.value ? parseInt(e.target.value) || null : null })}
              placeholder="auto"
              className="w-20 border border-slate-300 rounded-lg px-2 py-1 text-xs text-center"
              title="Ancho de la columna en mm (vacío = automático)"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-medium text-slate-500">Alinear</label>
            <select
              value={d.align ?? 'center'}
              onChange={e => setD({ ...d, align: e.target.value === 'center' ? null : e.target.value as 'left' | 'right' })}
              className="border border-slate-300 rounded-lg px-1.5 py-1 text-xs"
            >
              <option value="left">Izq</option>
              <option value="center">Centro</option>
              <option value="right">Der</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button size="sm" onClick={handleSave}
            disabled={!d.key}>Guardar</Button>
        </div>
      </div>
    </div>
  );
};

// ─── Sub-componente: formulario de regla de validación ───────────────────────
interface RuleFormProps {
  rule: TableCatalogRule;
  columns: TableCatalogColumn[];
  rows?: TableCatalogRow[];
  onSave: (rule: TableCatalogRule) => void;
  onCancel: () => void;
}

const RuleForm = ({ rule, columns, rows = [], onSave, onCancel }: RuleFormProps) => {
  /** Auto-detecta columnas para vs_spec basándose en labels */
  const autoFillVsSpec = (r: TableCatalogRule): TableCatalogRule => {
    if (r.operator !== 'vs_spec') return r;
    const next = { ...r };
    const find = (patterns: RegExp[]) => columns.find(c => patterns.some(p => p.test(c.label)))?.key ?? '';
    if (!next.sourceColumn) next.sourceColumn = find([/resultado/i, /valor\s+medido/i, /medido/i, /ΔP/i, /delta/i]);
    if (!next.specColumn) {
      const specKey = find([/especificaci[oó]n/i, /spec/i]);
      next.specColumn = specKey || null;
      if (specKey) next.factoryThreshold = specKey;
    }
    if (!next.targetColumn) next.targetColumn = find([/conclusi[oó]n/i, /cumple/i, /pass.*fail/i]);
    if (!next.referenceColumn) next.referenceColumn = find([/valor\s+nominal/i, /nominal/i, /referencia/i, /set\s*point/i]) || null;
    if (!next.description && next.sourceColumn && next.targetColumn) {
      const srcLabel = columns.find(c => c.key === next.sourceColumn)?.label ?? '';
      const tgtLabel = columns.find(c => c.key === next.targetColumn)?.label ?? '';
      next.description = `Auto: compara ${srcLabel} vs Especificación del template → ${tgtLabel}`;
    }
    return next;
  };

  const [d, setD] = useState<TableCatalogRule>(() => autoFillVsSpec(rule));
  const [showRowOverrides, setShowRowOverrides] = useState(
    () => Object.keys(rule.rowThresholds ?? {}).length > 0
  );
  const allOps: TableCatalogRule['operator'][] = ['<=', '>=', '<', '>', '==', '!=', 'vs_spec', 'compute'];
  const opLabels: Record<string, string> = {
    '<=': '≤', '>=': '≥', '<': '<', '>': '>', '==': '==', '!=': '!=',
    vs_spec: 'vs Especificación', compute: 'Cálculo entre columnas',
  };
  const isCompute = d.operator === 'compute';
  const isVsSpec = d.operator === 'vs_spec';
  const computeOps: NonNullable<TableCatalogRule['computeOperator']>[] = ['+', '-', '*', '/', 'abs_diff'];

  // Auto-detectar columnas al abrir si están vacías
  useEffect(() => {
    if (d.operator === 'vs_spec' && (!d.sourceColumn || !d.specColumn || !d.targetColumn)) {
      setD(prev => autoFillVsSpec(prev));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOperatorChange = (op: TableCatalogRule['operator']) => {
    const next = { ...d, operator: op };
    // Inicializar computeOperator al cambiar a compute para evitar que quede null
    if (op === 'compute' && !next.computeOperator) next.computeOperator = '-';
    setD(autoFillVsSpec(next));
  };

  const handleSave = () => {
    if (isVsSpec && (!d.sourceColumn || !d.specColumn || !d.targetColumn)) return;
    if (isCompute && (!d.sourceColumn || !d.targetColumn)) return;
    if (isCompute && !d.operandColumn && (d.factoryThreshold == null || d.factoryThreshold === '')) return;
    onSave(d);
  };

  return (
    <div className="border border-slate-900 rounded-lg p-3 space-y-2 bg-slate-50 mt-2">
      <Input placeholder="Descripción de la regla" value={d.description}
        onChange={e => setD({ ...d, description: e.target.value })} />
      <div className="grid grid-cols-3 gap-2">
        <select value={d.operator} onChange={e => handleOperatorChange(e.target.value as TableCatalogRule['operator'])}
          className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm font-medium">
          {allOps.map(op => <option key={op} value={op}>{opLabels[op]}</option>)}
        </select>
      </div>

      {isCompute ? (
        /* ── Compute: operación aritmética entre 2 columnas → escribe resultado en otra ── */
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-2">
          <p className="text-[10px] text-purple-700 font-bold uppercase">Cálculo automático entre columnas</p>
          <p className="text-[10px] text-purple-600">El técnico no edita la columna resultado — se calcula solo.</p>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Columna A</label>
              <select value={d.sourceColumn} onChange={e => setD({ ...d, sourceColumn: e.target.value })}
                className={`w-full border rounded-lg px-2 py-1.5 text-sm ${!d.sourceColumn ? 'border-red-300 bg-red-50' : 'border-slate-300'}`}>
                <option value="">Seleccionar…</option>
                {columns.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Operación</label>
              <select value={d.computeOperator ?? '-'} onChange={e => setD({ ...d, computeOperator: e.target.value as TableCatalogRule['computeOperator'] })}
                className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-center font-bold">
                {computeOps.map(op => <option key={op} value={op}>{op === '+' ? '+ (suma)' : op === '-' ? '− (resta)' : op === '*' ? '× (multiplica)' : op === '/' ? '÷ (divide)' : '|A−B| (desvío absoluto)'}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Operando B</label>
              <div className="flex gap-1.5 mb-1">
                <button type="button" onClick={() => setD({ ...d, operandColumn: '', factoryThreshold: '' })}
                  className={`text-[10px] px-2 py-0.5 rounded ${!d.operandColumn && d.operandColumn !== undefined ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  Constante
                </button>
                <button type="button" onClick={() => setD({ ...d, operandColumn: columns[0]?.key ?? '', factoryThreshold: '' })}
                  className={`text-[10px] px-2 py-0.5 rounded ${d.operandColumn ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  Columna
                </button>
              </div>
              {d.operandColumn ? (
                <select value={d.operandColumn} onChange={e => setD({ ...d, operandColumn: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
                  {columns.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              ) : (
                <Input placeholder="ej: 40" value={String(d.factoryThreshold ?? '')}
                  onChange={e => setD({ ...d, factoryThreshold: e.target.value, operandColumn: null })} />
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Columna donde se escribe el resultado</label>
              <select value={d.targetColumn} onChange={e => setD({ ...d, targetColumn: e.target.value })}
                className={`w-full border rounded-lg px-2 py-1.5 text-sm ${!d.targetColumn ? 'border-red-300 bg-red-50' : 'border-slate-300'}`}>
                <option value="">Seleccionar…</option>
                {columns.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Unidad (opcional)</label>
              <Input placeholder="ej: psi, mL/min" value={d.unit ?? ''}
                onChange={e => setD({ ...d, unit: e.target.value || null })} />
            </div>
          </div>
          {d.sourceColumn && (d.operandColumn || d.factoryThreshold) && d.targetColumn && (
            <p className="text-[10px] text-purple-600 bg-purple-100 rounded px-2 py-1">
              {columns.find(c => c.key === d.targetColumn)?.label} = {d.computeOperator === 'abs_diff' ? '|' : ''}
              {columns.find(c => c.key === d.sourceColumn)?.label} {d.computeOperator === 'abs_diff' ? '−' : d.computeOperator ?? '−'} {d.operandColumn ? columns.find(c => c.key === d.operandColumn)?.label : d.factoryThreshold}
              {d.computeOperator === 'abs_diff' ? '|' : ''}
            </p>
          )}
          {/* Override de constante B por fila (solo cuando operando es constante) */}
          {!d.operandColumn && rows.filter(r => !r.isTitle && !r.isSelector).length > 0 && (
            <div className="border border-purple-200 rounded-lg overflow-hidden mt-1">
              <button
                type="button"
                onClick={() => setShowRowOverrides(v => !v)}
                className="w-full flex items-center justify-between px-3 py-1.5 bg-purple-50 text-[10px] font-bold text-purple-700 uppercase hover:bg-purple-100"
              >
                <span>Constante por fila (opcional)</span>
                <span className="text-purple-400">{showRowOverrides ? '▲' : '▼'}</span>
              </button>
              {showRowOverrides && (
                <div className="p-3 space-y-1.5">
                  <p className="text-[10px] text-slate-400 mb-2">
                    Vacío = usa la constante global. Solo completar las filas que necesitan un valor distinto.
                  </p>
                  {rows.filter(r => !r.isTitle && !r.isSelector).map((row, idx) => {
                    const label = String(Object.values(row.cells).find(v => v) ?? `Fila ${idx + 1}`);
                    const current = d.rowThresholds?.[row.rowId] ?? '';
                    return (
                      <div key={row.rowId} className="flex items-center gap-2">
                        <span className="flex-1 text-xs text-slate-600 truncate" title={label}>{label}</span>
                        <input
                          type="number"
                          step="any"
                          value={current === '' ? '' : String(current)}
                          placeholder={String(d.factoryThreshold || '—')}
                          onChange={e => {
                            const val = e.target.value;
                            const next = { ...(d.rowThresholds ?? {}) };
                            if (val === '') { delete next[row.rowId]; }
                            else { next[row.rowId] = val; }
                            setD({ ...d, rowThresholds: Object.keys(next).length ? next : null });
                          }}
                          className="w-24 border border-purple-200 rounded px-2 py-1 text-xs text-center"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      ) : isVsSpec ? (
        /* ── vs_spec: compara valor medido contra especificación por fila → escribe PASA/FALLA ── */
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-blue-700 font-bold uppercase">Comparar valor vs especificación</p>
              <p className="text-[10px] text-blue-600">Lee la spec de cada fila y evalúa si el resultado cumple. Soporta: rangos, ±, NMT/NLT, {'>'}{'<'}.</p>
            </div>
            {(!d.sourceColumn || !d.specColumn || !d.targetColumn) && (
              <button onClick={() => setD(autoFillVsSpec({ ...d, sourceColumn: '', specColumn: null, targetColumn: '' }))}
                className="text-[10px] text-blue-600 font-bold hover:underline shrink-0 ml-2">
                Auto-detectar
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Valor medido</label>
              <select value={d.sourceColumn} onChange={e => setD({ ...d, sourceColumn: e.target.value })}
                className={`w-full border rounded-lg px-2 py-1.5 text-sm ${!d.sourceColumn ? 'border-red-300 bg-red-50' : 'border-slate-300'}`}>
                <option value="">Seleccionar…</option>
                {columns.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Especificación</label>
              <select value={d.specColumn ?? ''} onChange={e => setD({ ...d, specColumn: e.target.value || null, factoryThreshold: e.target.value })}
                className={`w-full border rounded-lg px-2 py-1.5 text-sm ${!d.specColumn ? 'border-red-300 bg-red-50' : 'border-slate-300'}`}>
                <option value="">Seleccionar…</option>
                {columns.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Donde escribir resultado</label>
              <select value={d.targetColumn} onChange={e => setD({ ...d, targetColumn: e.target.value })}
                className={`w-full border rounded-lg px-2 py-1.5 text-sm ${!d.targetColumn ? 'border-red-300 bg-red-50' : 'border-slate-300'}`}>
                <option value="">Seleccionar…</option>
                {columns.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Valor nominal / referencia (solo para specs ±)</label>
            <p className="text-[9px] text-slate-400 mb-1">Si la spec es "±1.2", se evalúa |medido - nominal| {'<='} 1.2. Si no hay nominal, se asume que el valor medido ya es un delta.</p>
            <select value={d.referenceColumn ?? ''} onChange={e => setD({ ...d, referenceColumn: e.target.value || null })}
              className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
              <option value="">(ninguna — el valor medido ya es la diferencia)</option>
              {columns.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          {(!d.sourceColumn || !d.specColumn || !d.targetColumn) && (
            <p className="text-[9px] text-slate-400">
              Columnas: {columns.map(c => `"${c.label}" (${c.key})`).join(' | ')}
            </p>
          )}
        </div>
      ) : (
        /* ── Standard: compara una columna contra un umbral fijo ── */
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
          <p className="text-[10px] text-amber-700 font-bold uppercase">Comparación contra umbral fijo</p>
          <p className="text-[10px] text-amber-600">Se compara el valor de una columna contra un número fijo (igual para todas las filas).</p>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Columna a evaluar</label>
              <select value={d.sourceColumn} onChange={e => setD({ ...d, sourceColumn: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
                <option value="">Seleccionar…</option>
                {columns.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Operador</label>
              <span className="block text-center text-sm font-bold text-slate-600 py-1.5">{opLabels[d.operator]}</span>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Umbral global</label>
              <Input placeholder="ej: 5.0" value={String(d.factoryThreshold)}
                onChange={e => setD({ ...d, factoryThreshold: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Columna resultado</label>
              <select value={d.targetColumn} onChange={e => setD({ ...d, targetColumn: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
                <option value="">Seleccionar…</option>
                {columns.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Texto si cumple</label>
              <Input placeholder="ej: PASA" value={d.valueIfPass}
                onChange={e => setD({ ...d, valueIfPass: e.target.value })} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Texto si no cumple</label>
              <Input placeholder="ej: FALLA" value={d.valueIfFail}
                onChange={e => setD({ ...d, valueIfFail: e.target.value })} />
            </div>
          </div>
        </div>
      )}

      {/* ── Overrides por fila (disponible para todos los operadores con umbral numérico) ── */}
      {!isVsSpec && rows.filter(r => !r.isTitle && !r.isSelector).length > 0 && (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setShowRowOverrides(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 text-[10px] font-bold text-slate-600 uppercase hover:bg-slate-100"
          >
            <span>Umbrales por fila (opcional)</span>
            <span className="text-slate-400">{showRowOverrides ? '▲' : '▼'}</span>
          </button>
          {showRowOverrides && (
            <div className="p-3 space-y-1.5">
              <p className="text-[10px] text-slate-400 mb-2">
                Vacío = usa el umbral global. Solo completar las filas que necesitan un valor distinto.
              </p>
              {rows.filter(r => !r.isTitle && !r.isSelector).map((row, idx) => {
                const label = String(Object.values(row.cells).find(v => v) ?? `Fila ${idx + 1}`);
                const current = d.rowThresholds?.[row.rowId] ?? '';
                return (
                  <div key={row.rowId} className="flex items-center gap-2">
                    <span className="flex-1 text-xs text-slate-600 truncate" title={label}>{label}</span>
                    <input
                      type="number"
                      step="any"
                      value={current === '' ? '' : String(current)}
                      placeholder={String(d.factoryThreshold || '—')}
                      onChange={e => {
                        const val = e.target.value;
                        const next = { ...(d.rowThresholds ?? {}) };
                        if (val === '') { delete next[row.rowId]; }
                        else { next[row.rowId] = val; }
                        setD({ ...d, rowThresholds: Object.keys(next).length ? next : null });
                      }}
                      className="w-24 border border-slate-300 rounded px-2 py-1 text-xs text-center"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Selector de filas donde aplica la regla ── */}
      {rows.filter(r => !r.isTitle && !r.isSelector).length > 1 && (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => {
              if (d.applicableRowIds?.length) {
                setD({ ...d, applicableRowIds: null });
              } else {
                setD({ ...d, applicableRowIds: rows.filter(r => !r.isTitle && !r.isSelector).map(r => r.rowId) });
              }
            }}
            className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 text-[10px] font-bold text-slate-600 uppercase hover:bg-slate-100"
          >
            <span>
              Aplica a: {d.applicableRowIds?.length
                ? `${d.applicableRowIds.length} de ${rows.filter(r => !r.isTitle && !r.isSelector).length} filas`
                : 'todas las filas'}
            </span>
            <span className="text-slate-400">{d.applicableRowIds?.length ? '✎' : '▼'}</span>
          </button>
          {d.applicableRowIds && (
            <div className="p-3 space-y-1">
              <p className="text-[10px] text-slate-400 mb-2">
                Destildar las filas donde esta regla NO debe aplicarse.
              </p>
              {rows.filter(r => !r.isTitle && !r.isSelector).map((row, idx) => {
                const label = String(Object.values(row.cells).find(v => v) ?? `Fila ${idx + 1}`);
                const checked = d.applicableRowIds!.includes(row.rowId);
                return (
                  <label key={row.rowId} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        const next = checked
                          ? d.applicableRowIds!.filter(id => id !== row.rowId)
                          : [...d.applicableRowIds!, row.rowId];
                        setD({ ...d, applicableRowIds: next.length === rows.filter(r => !r.isTitle && !r.isSelector).length ? null : next.length > 0 ? next : null });
                      }}
                      className="w-3.5 h-3.5 accent-slate-700"
                    />
                    <span className="text-xs text-slate-600">{label}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Advertencia si faltan columnas */}
      {isVsSpec && (!d.sourceColumn || !d.specColumn || !d.targetColumn) && (
        <p className="text-[10px] text-red-500 font-bold">Seleccioná las 3 columnas para guardar la regla.</p>
      )}
      {isCompute && (!d.sourceColumn || !d.operandColumn || !d.targetColumn) && (
        <p className="text-[10px] text-red-500 font-bold">Seleccioná todas las columnas para guardar la regla.</p>
      )}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" onClick={handleSave}>Guardar regla</Button>
      </div>
    </div>
  );
};

// ─── Sub-componente: formulario de campo de encabezado ────────────────────────
interface HeaderFieldFormProps {
  field: TableHeaderField;
  allFields: TableHeaderField[];
  onSave: (field: TableHeaderField) => void;
  onCancel: () => void;
}

const HeaderFieldForm = ({ field, allFields, onSave, onCancel }: HeaderFieldFormProps) => {
  const [label, setLabel] = useState(field.label);
  const [optionsText, setOptionsText] = useState(field.options.join(', '));
  const [inputType, setInputType] = useState<'select' | 'number'>(field.inputType ?? 'select');
  const [unit, setUnit] = useState(field.unit ?? '');
  const [placeholder, setPlaceholder] = useState(field.placeholder ?? '');
  const [multiSelect, setMultiSelect] = useState<boolean>(!!field.multiSelect);
  const [visTriggerField, setVisTriggerField] = useState<string>(field.visibleWhenSelector?.headerFieldId ?? '');
  const [visValues, setVisValues] = useState<string[]>(field.visibleWhenSelector?.values ?? []);

  // Sólo se puede disparar desde otros campos tipo 'select' (dropdowns con options)
  const triggerCandidates = allFields.filter(f =>
    f.fieldId !== field.fieldId &&
    (f.inputType ?? 'select') === 'select' &&
    f.options.length > 0,
  );
  const triggerField = triggerCandidates.find(f => f.fieldId === visTriggerField) ?? null;

  const handleSave = () => {
    if (!label) return;
    const visibility = visTriggerField && visValues.length > 0
      ? { headerFieldId: visTriggerField, values: visValues }
      : null;
    if (inputType === 'select') {
      const options = optionsText.split(',').map(o => o.trim()).filter(Boolean);
      if (options.length < 2) return;
      onSave({ ...field, label, options, inputType: 'select', unit: null, placeholder: null, multiSelect, visibleWhenSelector: visibility });
    } else {
      onSave({
        ...field,
        label,
        options: [],
        inputType: 'number',
        unit: unit.trim() || null,
        placeholder: placeholder.trim() || null,
        multiSelect: false,
        visibleWhenSelector: visibility,
      });
    }
  };

  const disabled = !label || (inputType === 'select' &&
    optionsText.split(',').map(o => o.trim()).filter(Boolean).length < 2);

  return (
    <div className="border border-slate-900 rounded-lg p-3 space-y-2 bg-slate-50 mt-2">
      <div className="flex gap-2">
        <Input placeholder="Etiqueta (ej: Inyector, Ruido)" value={label}
          onChange={e => setLabel(e.target.value)} />
        <select value={inputType} onChange={e => setInputType(e.target.value as 'select' | 'number')}
          className="border border-slate-300 rounded-lg px-2 text-xs bg-white">
          <option value="select">Dropdown</option>
          <option value="number">Numérico</option>
        </select>
      </div>
      {inputType === 'select' ? (
        <div className="space-y-2">
          <Input placeholder="Opciones separadas por coma (ej: ALS, SSL, PTV, COC)" value={optionsText}
            onChange={e => setOptionsText(e.target.value)} />
          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
            <input type="checkbox" checked={multiSelect} onChange={e => setMultiSelect(e.target.checked)} />
            Selección múltiple (el ingeniero puede elegir varias opciones; las filas se agrupan por valor)
          </label>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input placeholder="Unidad (ej: mAU, %)" value={unit}
            onChange={e => setUnit(e.target.value)} />
          <Input placeholder="Placeholder (ej: 0.5)" value={placeholder}
            onChange={e => setPlaceholder(e.target.value)} />
        </div>
      )}
      {/* Visibilidad condicional */}
      {triggerCandidates.length > 0 && (
        <div className="border-t border-slate-200 pt-2 space-y-1.5">
          <label className="text-[10px] font-bold uppercase text-slate-500">Visibilidad condicional (opcional)</label>
          <div className="flex gap-2">
            <select
              value={visTriggerField}
              onChange={e => { setVisTriggerField(e.target.value); setVisValues([]); }}
              className="border border-slate-300 rounded-lg px-2 py-1 text-xs bg-white flex-1"
            >
              <option value="">Siempre visible</option>
              {triggerCandidates.map(f => (
                <option key={f.fieldId} value={f.fieldId}>Mostrar cuando {f.label} =</option>
              ))}
            </select>
          </div>
          {triggerField && (
            <div className="flex flex-wrap gap-1.5">
              {triggerField.options.map(opt => {
                const checked = visValues.includes(opt);
                return (
                  <label key={opt} className={`text-[10px] px-2 py-0.5 rounded-full border cursor-pointer ${
                    checked ? 'bg-teal-600 text-white border-teal-600' : 'bg-white border-slate-300 text-slate-600'
                  }`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setVisValues(checked ? visValues.filter(v => v !== opt) : [...visValues, opt])}
                      className="hidden"
                    />
                    {opt}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-400">
          {inputType === 'select'
            ? 'Mínimo 2 opciones'
            : `Uso en specs: referenciar como {${field.fieldId || 'fieldId'}} (ej. "≥ 1600*{${field.fieldId || 'ruido'}}")`}
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={disabled}>Guardar</Button>
        </div>
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
                <ColumnForm col={col} onSave={saveColumn} onCancel={() => setEditingColIdx(null)} />
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
            <ColumnForm
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
                <RuleForm rule={rule} columns={table.columns} rows={table.templateRows} onSave={saveRule}
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
            <RuleForm rule={newRule()} columns={table.columns} rows={table.templateRows}
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
                <HeaderFieldForm field={hf} allFields={headerFields}
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
            <HeaderFieldForm
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
