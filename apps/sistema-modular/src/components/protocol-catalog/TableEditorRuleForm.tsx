import { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { TableCatalogColumn, TableCatalogRow, TableCatalogRule } from '@ags/shared';

interface Props {
  rule: TableCatalogRule;
  columns: TableCatalogColumn[];
  rows?: TableCatalogRow[];
  onSave: (rule: TableCatalogRule) => void;
  onCancel: () => void;
}

/** Form inline para editar una regla de validación. Soporta vs_spec, compute, y operadores standard. */
export const TableEditorRuleForm = ({ rule, columns, rows = [], onSave, onCancel }: Props) => {
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

  useEffect(() => {
    if (d.operator === 'vs_spec' && (!d.sourceColumn || !d.specColumn || !d.targetColumn)) {
      setD(prev => autoFillVsSpec(prev));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOperatorChange = (op: TableCatalogRule['operator']) => {
    const next = { ...d, operator: op };
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
