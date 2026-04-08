import React from 'react';
import { createPortal } from 'react-dom';
import type { TableCatalogColumn, ProtocolSelection } from '../types/tableCatalog';

// ─── Auto-cómputo de Conclusión ───────────────────────────────────────────────

/**
 * Evalúa si un valor medido cumple una especificación textual.
 * Soporta: rangos (95 – 105), NMT/NLT, >, <, >=, <=, número exacto, N/A.
 * Retorna: 'PASS' | 'FAIL' | 'NA' | '' (vacío = no se pudo determinar)
 */
function computeConclusion(resultado: string, spec: string, nominal?: string): 'PASS' | 'FAIL' | 'NA' | '' {
  const r = resultado.trim();
  if (!r) return '';

  // N/A explícito → No aplica
  if (/^(n\/a|na|no\s+aplica)$/i.test(r)) return 'NA';

  const s = spec.trim();
  if (!s) return '';

  const numR = parseFloat(r.replace(',', '.'));
  if (isNaN(numR)) {
    // Sin número → comparación textual exacta
    return r.toLowerCase() === s.toLowerCase() ? 'PASS' : 'FAIL';
  }

  const extractNum = (str: string): number => {
    const m = str.match(/([+-]?\d+[.,]\d+|[+-]?\d+)/);
    return m ? parseFloat(m[0].replace(',', '.')) : NaN;
  };

  // Rango con operadores: "≥ -1.0 ≤+5.0°C" | ">= -1.0 <= 5.0"
  // Soporta cualquier variante de ≥/>=/>  y ≤/<=/< con números positivos o negativos
  const dualMatch = s.match(/[≥>]=?\s*([+-]?\d+[.,]?\d*)\s*[≤<]=?\s*([+-]?\d+[.,]?\d*)/);
  if (dualMatch) {
    const a = parseFloat(dualMatch[1].replace(',', '.'));
    const b = parseFloat(dualMatch[2].replace(',', '.'));
    const min = Math.min(a, b);
    const max = Math.max(a, b);
    return numR >= min && numR <= max ? 'PASS' : 'FAIL';
  }

  // Rango: "95.0 – 105.0" | "95 - 105"
  const rangeMatch = s.match(/(-?\d+[.,]?\d*)\s*[–\-]\s*(-?\d+[.,]?\d*)/);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1].replace(',', '.'));
    const max = parseFloat(rangeMatch[2].replace(',', '.'));
    return numR >= min && numR <= max ? 'PASS' : 'FAIL';
  }

  // NMT (Not More Than) | ≤ | <=
  if (/NMT|≤|<=/i.test(s)) {
    const n = extractNum(s);
    return isNaN(n) ? '' : numR <= n ? 'PASS' : 'FAIL';
  }

  // NLT (Not Less Than) | ≥ | >=
  if (/NLT|≥|>=/i.test(s)) {
    const n = extractNum(s);
    return isNaN(n) ? '' : numR >= n ? 'PASS' : 'FAIL';
  }

  // Plus-minus: "±1.2" | "± 1.2" | "±1.2 psi" → |resultado - nominal| <= tolerance
  const pmMatch = s.match(/^±\s*(\d+[.,]?\d*)/);
  if (pmMatch) {
    const tolerance = parseFloat(pmMatch[1].replace(',', '.'));
    if (isNaN(tolerance)) return '';
    // If nominal value provided, compare delta from nominal; otherwise treat resultado as delta
    const numNominal = nominal ? extractNum(nominal) : NaN;
    const delta = !isNaN(numNominal) ? Math.abs(numR - numNominal) : Math.abs(numR);
    return delta <= tolerance ? 'PASS' : 'FAIL';
  }

  // Mayor estricto: "> X"
  if (/^>\s*\d/.test(s)) {
    const n = extractNum(s);
    return isNaN(n) ? '' : numR > n ? 'PASS' : 'FAIL';
  }

  // Menor estricto: "< X"
  if (/^<\s*\d/.test(s)) {
    const n = extractNum(s);
    return isNaN(n) ? '' : numR < n ? 'PASS' : 'FAIL';
  }

  // Número solo: igualdad numérica (tolerancia pequeña)
  const specNum = extractNum(s);
  if (!isNaN(specNum)) {
    return Math.abs(numR - specNum) < 0.001 ? 'PASS' : 'FAIL';
  }

  return '';
}

// ─── Multi-select cell ────────────────────────────────────────────────────────

function MultiSelectCell({ options, selected, readOnly, onToggle, getDisplay }: {
  options: { value: string; label: string }[];
  selected: string[];
  readOnly: boolean;
  onToggle: (opt: string) => void;
  getDisplay?: (v: string) => string;
}) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Posicionar el dropdown en fixed relativo al trigger
  React.useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dropW = 400;
    const dropH = Math.min(360, options.length * 32 + 40);
    const spaceBelow = window.innerHeight - rect.bottom;
    // Centrar horizontalmente respecto al trigger
    let left = rect.left + rect.width / 2 - dropW / 2;
    if (left < 8) left = 8;
    if (left + dropW > window.innerWidth - 8) left = window.innerWidth - dropW - 8;
    if (spaceBelow < dropH) {
      setPos({ top: rect.top - dropH - 4, left });
    } else {
      setPos({ top: rect.bottom + 4, left });
    }
  }, [open]);

  // Cerrar al hacer click fuera
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const dropdownEl = open ? (
    <div
      ref={dropdownRef}
      className="fixed z-50 bg-white border border-slate-200 rounded-lg shadow-xl overflow-y-auto"
      style={{ maxHeight: '360px', width: '400px', top: pos.top, left: pos.left }}
    >
      <div className="sticky top-0 bg-slate-50 border-b border-slate-200 px-3 py-1.5 flex items-center justify-between z-10">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Tests disponibles</span>
        <button onClick={() => setOpen(false)} className="text-[10px] text-teal-600 font-semibold hover:text-teal-800">Cerrar</button>
      </div>
      {options.map(opt => (
        <label key={opt.value} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-xs border-b border-slate-100 last:border-0">
          <input type="checkbox" checked={selected.includes(opt.value)} onChange={() => onToggle(opt.value)} className="w-4 h-4 accent-teal-600 shrink-0" />
          <span className="text-slate-700">
            <span className="font-semibold">{opt.value}</span>
            {opt.label && <span className="text-slate-400 ml-1.5">— {opt.label}</span>}
          </span>
        </label>
      ))}
      {options.length === 0 && <p className="px-3 py-2 text-[10px] text-slate-400 italic">Sin opciones disponibles</p>}
    </div>
  ) : null;

  return (
    <>
      <div ref={triggerRef}>
        <div
          className={`min-h-[24px] text-[10px] leading-snug ${!readOnly ? 'cursor-pointer' : ''}`}
          onClick={() => !readOnly && setOpen(!open)}
        >
          {selected.length > 0
            ? selected.map((v, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span className="text-slate-800">{getDisplay ? getDisplay(v) : v}</span>
                  {!readOnly && (
                    <button
                      onClick={e => { e.stopPropagation(); onToggle(v); }}
                      className="text-slate-300 hover:text-red-500 text-[8px] leading-none"
                    >✕</button>
                  )}
                </div>
              ))
            : <span className="text-slate-300 italic">{readOnly ? '—' : 'Seleccionar...'}</span>
          }
        </div>
      </div>
      {dropdownEl && createPortal(dropdownEl, document.body)}
    </>
  );
}

// ─── Componente ───────────────────────────────────────────────────────────────

interface Props {
  selection: ProtocolSelection;
  readOnly?: boolean;
  isPrint?: boolean;
  onChangeData: (tableId: string, rowId: string, colKey: string, value: string) => void;
  onChangeObservaciones?: (tableId: string, value: string) => void;
  onChangeResultado?: (tableId: string, value: ProtocolSelection['resultado']) => void;
  onToggleClientSpec?: (tableId: string, enabled: boolean) => void;
  onRemove?: (tableId: string) => void;
  onDuplicate?: (tableId: string) => void;
  onAddRow?: (tableId: string) => void;
  onRemoveRow?: (tableId: string, rowId: string) => void;
  onChangeHeaderData?: (tableId: string, fieldId: string, value: string) => void;
  /** Variables del reporte para auto-rellenar filas con variable binding */
  variables?: Record<string, string>;
  /** Filas del catálogo vivo — usadas como fallback si el snapshot no tiene 'variable' actualizado */
  liveTemplateRows?: import('@ags/shared').TableCatalogRow[];
  /** Tablas hermanas del protocolo — para resolver opciones de multi_select con optionsFromTable */
  siblingSelections?: ProtocolSelection[];
}

const PASS_LABELS: Record<string, string> = {
  PASS: 'Cumple',
  FAIL: 'No cumple',
  NA: 'N/A',
};

const PASS_PRINT_CHARS: Record<string, string> = {
  PASS: 'Cumple',
  FAIL: 'No cumple',
  NA: 'N/A',
};

const PASS_COLORS: Record<string, string> = {
  PASS: 'text-green-700 font-semibold',
  FAIL: 'text-red-700 font-semibold',
  NA: 'text-slate-500',
};

function renderDefaultCell(
  col: TableCatalogColumn,
  rowId: string,
  filledData: ProtocolSelection['filledData'],
  readOnly: boolean,
  isPrint: boolean,
  onChange: (rowId: string, colKey: string, value: string) => void,
  compact = false,
): React.ReactNode {
  const rawValue = filledData[rowId]?.[col.key] ?? '';

  if (col.type === 'fixed_text') {
    return <span className="text-[10px] text-slate-600">{col.fixedValue ?? ''}</span>;
  }

  if (col.type === 'checkbox') {
    const checked = rawValue === 'true' || rawValue === '1';
    if (isPrint) return <span className="text-[11px]">{checked ? '☑' : '☐'}</span>;
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

  if (col.type === 'select_input') {
    if (isPrint) return <span className="text-[10px]">{rawValue || '—'}</span>;
    return (
      <select
        value={rawValue}
        disabled={readOnly}
        onChange={(e) => onChange(rowId, col.key, e.target.value)}
        className="w-full text-[10px] border border-slate-300 rounded px-1 py-0.5 bg-white disabled:bg-slate-50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option value="">Seleccionar...</option>
        {(col.options ?? []).map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }

  // text_input / number_input
  //
  // "effectiveUnit": unidad real del campo.
  // col.unit puede ser null en tablas importadas; en ese caso intentamos extraerla del label.
  const effectiveUnit = col.unit
    ?? col.label?.match(/\(\s*([^)]{1,15})\s*\)\s*$/)?.[1]?.trim()
    ?? null;

  // isPureSymbol: true si el valor almacenado es SOLO símbolo/unidad sin contenido numérico ni
  // alfabético (ej. "%", "mL/min" solos). Indica un placeholder pre-impreso del Word que debe
  // mostrarse como vacío en el input de edición.
  const isPureSymbol = (v: string) =>
    v.trim().length > 0 && !/[0-9A-Za-zÀ-ÖØ-öø-ÿ\-+]/.test(v.trim());

  const escUnit = effectiveUnit
    ? effectiveUnit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    : '';

  // Strip la unidad del valor almacenado para el display.
  // También trata valores puro-símbolo (como "%") como vacíos.
  const displayValue = (() => {
    if (!rawValue) return rawValue;
    if (isPureSymbol(rawValue)) return '';          // "%" → ""
    if (!effectiveUnit) return rawValue;
    return rawValue
      .replace(new RegExp(`^\\s*${escUnit}\\s*$`), '')  // solo la unidad → vacío
      .replace(new RegExp(`\\s*${escUnit}\\s*$`), '')   // "98%" → "98"
      .trim();
  })();

  if (isPrint) {
    return (
      <span className="text-[10px]" style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
        {displayValue ? `${displayValue}${effectiveUnit ? '\u00A0' + effectiveUnit : ''}` : '—'}
      </span>
    );
  }

  const placeholder = col.expectedValue ? `Esp: ${col.expectedValue}` : '';

  // Al guardar, el valor se almacena siempre SIN la unidad
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = effectiveUnit
      ? e.target.value.replace(new RegExp(`\\s*${escUnit}\\s*$`), '').trim()
      : e.target.value;
    onChange(rowId, col.key, val);
  };

  const selectAll = (e: React.FocusEvent<HTMLInputElement>) => e.target.select();

  if (!effectiveUnit) {
    const alignClass = col.align === 'left' ? 'text-left' : col.align === 'right' ? 'text-right' : 'text-center';
    // Textarea auto-expandible para columnas alineadas a izquierda (texto extenso)
    if (col.align === 'left' && !compact) {
      const handleTextarea = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = effectiveUnit
          ? e.target.value.replace(new RegExp(`\\s*${escUnit}\\s*$`), '').trim()
          : e.target.value;
        onChange(rowId, col.key, val);
        // Auto-resize
        e.target.style.height = 'auto';
        e.target.style.height = e.target.scrollHeight + 'px';
      };
      return (
        <textarea
          value={displayValue}
          disabled={readOnly}
          placeholder={placeholder}
          onChange={handleTextarea}
          onFocus={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
          rows={1}
          className={`w-full text-[10px] ${alignClass} border border-slate-300 rounded bg-white disabled:bg-slate-50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-300 px-1 py-0.5 resize-none overflow-hidden`}
          style={{ minHeight: '26px' }}
        />
      );
    }
    return (
      <input
        type="text"
        value={displayValue}
        disabled={readOnly}
        placeholder={placeholder}
        onChange={handleChange}
        onFocus={selectAll}
        className={compact
          ? `w-full text-[10px] ${alignClass} bg-transparent border-none outline-none focus:outline-none disabled:cursor-not-allowed placeholder:text-slate-300 px-0 py-0`
          : `w-full text-[10px] ${alignClass} border border-slate-300 rounded bg-white disabled:bg-slate-50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-300 px-1 py-0.5`}
      />
    );
  }

  // Input con unidad fija integrada: parece un solo campo, la unidad no es editable
  return (
    <div className={compact
      ? `flex items-center gap-0.5 ${readOnly ? '' : ''}`
      : `flex items-center border border-slate-300 rounded bg-white px-1 py-0.5 gap-0.5 focus-within:ring-1 focus-within:ring-blue-500 ${readOnly ? 'bg-slate-50' : ''}`}>
      <input
        type="text"
        value={displayValue}
        disabled={readOnly}
        placeholder={placeholder}
        onChange={handleChange}
        onFocus={selectAll}
        className="flex-1 min-w-0 text-[10px] text-center bg-transparent border-none outline-none focus:outline-none disabled:cursor-not-allowed placeholder:text-slate-300"
      />
      <span className="text-[10px] text-slate-400 select-none shrink-0 pointer-events-none">
        {effectiveUnit}
      </span>
    </div>
  );
}

export const CatalogTableView: React.FC<Props> = ({
  selection,
  readOnly = false,
  isPrint = false,
  onChangeData,
  onChangeObservaciones,
  onToggleClientSpec,
  onRemove,
  onDuplicate,
  onAddRow,
  onRemoveRow,
  onChangeHeaderData,
  variables,
  liveTemplateRows,
  siblingSelections,
}) => {
  const table = selection.tableSnapshot;
  const compact = table.compactDisplay ?? false;
  const clientSpecEnabled = selection.clientSpecEnabled ?? false;

  /** Resuelve opciones para una columna multi_select desde una tabla hermana del protocolo.
   *  Retorna { value: string (se guarda), label: string (se muestra) }[] */
  const resolveMultiSelectOptions = (col: TableCatalogColumn): { value: string; label: string }[] => {
    // 1. Opciones desde tabla hermana
    if (col.optionsFromTable && siblingSelections) {
      const { tableName, columnKey } = col.optionsFromTable;
      const needle = tableName.toLowerCase().trim();
      const sibling = needle
        ? siblingSelections.find(s =>
            s.tableName?.toLowerCase().trim() === needle ||
            s.tableSnapshot.name?.toLowerCase().trim() === needle
          )
        : undefined;
      if (sibling) {
        const rows = sibling.tableSnapshot.templateRows.filter(r => !r.isTitle && !r.isSelector);
        const effectiveKey = columnKey || sibling.tableSnapshot.columns[0]?.key || '';
        // Segunda columna para label (si existe)
        const cols = sibling.tableSnapshot.columns;
        const keyIdx = cols.findIndex(c => c.key === effectiveKey);
        const labelCol = keyIdx >= 0 && cols.length > keyIdx + 1 ? cols[keyIdx + 1] : null;
        return rows
          .map(r => {
            const value = String(r.cells?.[effectiveKey] ?? '').trim();
            const label = labelCol ? String(r.cells?.[labelCol.key] ?? '').trim() : '';
            return { value, label };
          })
          .filter(o => o.value);
      }
    }
    // 2. Fallback: opciones estáticas de la columna
    return (col.options ?? []).map(o => ({ value: o, label: '' }));
  };

  // Extraer TODAS las reglas vs_spec (soporta múltiples, ej. FRONT y BACK con conclusiones separadas)
  const vsSpecRules = (table.validationRules ?? []).filter(r =>
    r.operator === 'vs_spec' && r.sourceColumn && r.targetColumn && (r.specColumn || r.factoryThreshold)
  );
  const vsSpecRule = vsSpecRules[0] ?? null;
  const specColKey = vsSpecRule
    ? (vsSpecRule.specColumn || String(vsSpecRule.factoryThreshold) || null)
    : null;
  const resultadoColKey = vsSpecRule?.sourceColumn || null;
  const conclusionColKey = vsSpecRule?.targetColumn || null;
  const referenceColKey = vsSpecRule?.referenceColumn || null;
  // Sets for multi-rule column identification
  const allResultadoColKeys = new Set(vsSpecRules.map(r => r.sourceColumn));
  const allConclusionColKeys = new Set(vsSpecRules.map(r => r.targetColumn));
  const allSpecColKeys = new Set(vsSpecRules.map(r => r.specColumn || String(r.factoryThreshold)).filter(Boolean));

  // Extraer reglas compute (operaciones aritméticas entre columnas)
  // Nota: computeOperator puede ser null en reglas legacy — se trata como resta por defecto
  const computeRules = (table.validationRules ?? []).filter(r => r.operator === 'compute' && (r.operandColumn || r.factoryThreshold != null));

  /** Valor de fábrica para cualquier columna y fila (del template) */
  const getFactoryValue = (rowId: string, colKey: string): string => {
    const row = table.templateRows.find(r => r.rowId === rowId);
    return row ? String(row.cells?.[colKey] ?? '') : '';
  };

  /** Valor de fábrica del campo especificación para una fila (del template) */
  const getFactorySpec = (rowId: string): string => getFactoryValue(rowId, specColKey ?? '');

  /** Extrae la unidad de un string de especificación (ej. "≤ 0.500 %" → "%", "5.000 mV/h" → "mV/h", "0.50ºC" → "ºC") */
  const extractUnitFromSpec = (specVal: string): string | null => {
    const s = specVal.trim();
    if (!s) return null;
    // Unidad separada por espacio ("2.000 mV") O pegada al número ("0.50ºC")
    const m = s.match(/[\d\s]([A-Za-z%°ºª][A-Za-z0-9.%°ºª/]{0,10})\s*$/);
    return m ? m[1].trim() : null;
  };

  /** Unidad de la columna Resultado para una fila específica, extraída de su especificación */
  const getRowResultUnit = (rowId: string): string | null => {
    if (!specColKey || !resultadoColKey) return null;
    const specVal = getFactorySpec(rowId);
    return extractUnitFromSpec(specVal);
  };

  /** Especificación activa: del cliente si está habilitada, de fábrica si no */
  const getActiveSpec = (rowId: string): string => {
    if (clientSpecEnabled && specColKey) {
      const clientVal = selection.filledData[rowId]?.[specColKey];
      if (clientVal) return clientVal;
    }
    return getFactorySpec(rowId);
  };

  /** Verifica si una regla aplica a un rowId dado (por applicableRowIds) */
  const ruleAppliesToRow = (rule: { applicableRowIds?: string[] | null }, rowId: string): boolean =>
    !rule.applicableRowIds?.length || rule.applicableRowIds.includes(rowId);

  /** Ejecuta reglas compute afectadas por un cambio, retorna el valor computado si la columna target es relevante */
  const runComputeRules = (rowId: string, changedColKey: string, changedValue: string): Map<string, string> => {
    const computed = new Map<string, string>();
    for (const rule of computeRules) {
      if (!ruleAppliesToRow(rule, rowId)) continue;
      const isSourceChange = changedColKey === rule.sourceColumn;
      const isOperandChange = rule.operandColumn ? changedColKey === rule.operandColumn : false;
      if (!isSourceChange && !isOperandChange) continue;

      const rawA = isSourceChange ? changedValue : (selection.filledData[rowId]?.[rule.sourceColumn] ?? '');
      // Operando B: otra columna o constante (rowThresholds[rowId] ?? factoryThreshold)
      const effectiveConstant = rule.rowThresholds?.[rowId] ?? rule.factoryThreshold;
      const rawB = rule.operandColumn
        ? (isOperandChange ? changedValue : (selection.filledData[rowId]?.[rule.operandColumn] ?? ''))
        : String(effectiveConstant ?? '');
      const a = parseFloat(rawA.replace(',', '.'));
      const b = parseFloat(rawB.replace(',', '.'));

      if (isNaN(a) || isNaN(b)) {
        onChangeData(selection.tableId, rowId, rule.targetColumn, '');
        computed.set(rule.targetColumn, '');
        continue;
      }

      let result: number;
      switch (rule.computeOperator ?? '-') {
        case '+': result = a + b; break;
        case '-': result = a - b; break;
        case '*': result = a * b; break;
        case '/': result = b !== 0 ? a / b : NaN; break;
        case 'abs_diff': result = Math.abs(a - b); break;
        default: result = a - b; break;
      }
      if (isNaN(result)) continue;

      const rounded = Math.round(result * 1e6) / 1e6;
      const strResult = String(rounded);
      onChangeData(selection.tableId, rowId, rule.targetColumn, strResult);
      computed.set(rule.targetColumn, strResult);
    }
    return computed;
  };

  const handleCellChange = (rowId: string, colKey: string, value: string) => {
    onChangeData(selection.tableId, rowId, colKey, value);

    // Run compute rules (e.g. ΔP = Valor Final - Valor Inicial)
    const computedValues = runComputeRules(rowId, colKey, value);

    // Auto-computar conclusiones para las reglas vs_spec que apliquen a esta fila
    for (const rule of vsSpecRules) {
      if (!ruleAppliesToRow(rule, rowId)) continue;
      const rSrcCol = rule.sourceColumn;
      const rTgtCol = rule.targetColumn;
      const rSpecCol = rule.specColumn || String(rule.factoryThreshold) || '';
      const rRefCol = rule.referenceColumn || null;

      const computedResultado = computedValues.get(rSrcCol);
      const isResultadoChange = colKey === rSrcCol || computedResultado !== undefined;
      const isSpecChange = colKey === rSpecCol && clientSpecEnabled;
      const isReferenceChange = colKey === rRefCol;

      if (isResultadoChange || isSpecChange || isReferenceChange) {
        const currentResultado = computedResultado
          ?? (colKey === rSrcCol ? value : (selection.filledData[rowId]?.[rSrcCol] ?? ''));
        const currentSpec = isSpecChange
          ? value
          : (clientSpecEnabled && rSpecCol
            ? (selection.filledData[rowId]?.[rSpecCol] || getFactoryValue(rowId, rSpecCol))
            : getFactoryValue(rowId, rSpecCol));
        const currentNominal = rRefCol
          ? (colKey === rRefCol ? value : (selection.filledData[rowId]?.[rRefCol] ?? getFactoryValue(rowId, rRefCol)))
          : undefined;
        const conclusion = computeConclusion(currentResultado, currentSpec, currentNominal);
        if (conclusion !== '') {
          onChangeData(selection.tableId, rowId, rTgtCol, conclusion);
        } else if (!currentResultado.trim()) {
          onChangeData(selection.tableId, rowId, rTgtCol, '');
        }
      }
    }
  };

  /** Renderiza una celda con lógica especial para columnas spec y conclusion */
  const renderTableCell = (col: TableCatalogColumn, rowId: string): React.ReactNode => {
    const rawValue = selection.filledData[rowId]?.[col.key] ?? '';

    // ── Columna de etiqueta fija: solo lectura para filas con valor, en blanco si vacío ──
    // Solo cuando el admin marcó isLabelColumn=true en esta columna, y no es fila extra
    const isExtraRow = rowId.startsWith('extra_');
    if (!isExtraRow && col.isLabelColumn) {
      const labelVal = String(table.templateRows.find(r => r.rowId === rowId)?.cells[col.key] ?? '').trim();
      if (!labelVal) return <span />;
      if (isPrint) return <span className="text-[10px]">{labelVal}</span>;
      return <span className="text-[10px] text-slate-700 cursor-default">{labelVal}</span>;
    }

    // ── Multi-select (dropdown con checkboxes, valores apilados) ─────────────
    if (col.type === 'multi_select') {
      const options = resolveMultiSelectOptions(col);
      let selected: string[] = [];
      if (rawValue) {
        try { selected = JSON.parse(rawValue); } catch { selected = []; }
      }
      const getDisplay = (v: string) => {
        const opt = options.find(o => o.value === v);
        return opt?.label ? `${v} - ${opt.label}` : v;
      };

      if (isPrint) {
        return selected.length > 0
          ? <div className="text-[10px] leading-snug">{selected.map((v, i) => <div key={i}>{getDisplay(v)}</div>)}</div>
          : <span className="text-[10px] text-slate-400">—</span>;
      }

      const toggle = (opt: string) => {
        const next = selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt];
        handleCellChange(rowId, col.key, next.length > 0 ? JSON.stringify(next) : '');
      };

      return (
        <MultiSelectCell
          options={options}
          selected={selected}
          readOnly={readOnly}
          onToggle={toggle}
          getDisplay={getDisplay}
        />
      );
    }

    // ── Variable binding: auto-rellenar desde contexto del reporte ──────────
    const templateRow = table.templateRows.find(r => r.rowId === rowId);
    // Fallback: si el snapshot es obsoleto, usar la fila del catálogo vivo
    const liveRow = liveTemplateRows?.find(r => r.rowId === rowId);
    const rowVariable = templateRow?.variable || liveRow?.variable;
    if (rowVariable && variables) {
      const resolved = variables[rowVariable];
      if (resolved !== undefined) {
        const isLabelCol = table.columns[0]?.key === col.key;
        if (!isLabelCol) {
          // Todas las columnas excepto la primera (label) → mostrar valor resuelto
          if (isPrint) return <span className="text-[10px] whitespace-pre-wrap">{resolved || '—'}</span>;
          return <span className="text-[10px] text-slate-700 whitespace-pre-wrap">{resolved || '—'}</span>;
        }
        // Primera columna (label) → renderizar normalmente desde template
      }
    }

    // ── Auto-fill por label (solo tabla informacional de 1 fila: cabecera equipo) ─
    const dataRows = table.templateRows.filter(r => !r.isTitle && !r.isSelector);
    if (variables && !rawValue && table.tableType === 'informational' && dataRows.length === 1) {
      const colLabel = (col.label || col.key).toLowerCase().replace(/[:.]/g, '').trim();
      let resolved: string | null = null;
      if (colLabel === 'marca') resolved = variables['equipo.marca'] || null;
      else if (colLabel === 'modelo') resolved = variables['equipo.modelo'] || null;
      else if (/^(número de serie|nro?\s+de serie|n[°º]\s*de serie|serie|s\/n)$/.test(colLabel)) resolved = variables['equipo.serie'] || null;
      else if (colLabel === 'id') resolved = variables['equipo.id'] || null;
      if (resolved) {
        if (isPrint) return <span className="text-[10px]">{resolved}</span>;
        return <span className="text-[10px] text-slate-700">{resolved}</span>;
      }
    }

    // ── Columna Especificación ──────────────────────────────────────────────
    if (allSpecColKeys.has(col.key)) {
      const factoryVal = getFactorySpec(rowId);

      if (!clientSpecEnabled) {
        // Solo lectura: muestra valor de fábrica
        if (isPrint) return <span className="text-[10px]">{factoryVal || '—'}</span>;
        return (
          <span className="text-[10px] text-slate-600 select-none" title="Especificación de fábrica (no editable)">
            {factoryVal || '—'}
          </span>
        );
      }

      // Cliente: editable + referencia de fábrica
      if (isPrint) {
        const printVal = rawValue || factoryVal || '—';
        return (
          <span className="text-[10px]">
            {printVal !== '—' && col.unit ? `${printVal}\u00A0${col.unit}` : printVal}
          </span>
        );
      }
      return (
        <div className="space-y-0.5">
          <div className={`flex items-center border border-blue-300 rounded bg-blue-50/60 px-1 py-0.5 gap-0.5 focus-within:ring-1 focus-within:ring-blue-500 ${readOnly ? 'bg-slate-50' : ''}`}>
            <input
              type="text"
              value={rawValue}
              disabled={readOnly}
              placeholder="Especificación del cliente..."
              onChange={(e) => handleCellChange(rowId, col.key, e.target.value)}
              onFocus={e => e.target.select()}
              className="flex-1 min-w-0 text-[10px] text-center bg-transparent border-none outline-none focus:outline-none disabled:cursor-not-allowed placeholder:text-blue-300"
            />
            {col.unit && (
              <span className="text-[10px] text-blue-400 select-none shrink-0 pointer-events-none">
                {col.unit}
              </span>
            )}
          </div>
          {factoryVal && (
            <div className="text-[9px] font-semibold text-blue-600 bg-blue-50 rounded px-1 py-0.5 mt-0.5 truncate" title={`Especificación de fábrica: ${factoryVal}`}>
              Ref. fábrica: {factoryVal}
            </div>
          )}
        </div>
      );
    }

    // ── Columna Conclusión (pass_fail calculado) — soporta múltiples reglas ─
    // Solo renderizar como conclusión si al menos una regla vs_spec aplica a esta fila
    const conclusionRuleApplies = vsSpecRules.some(r => r.targetColumn === col.key && ruleAppliesToRow(r, rowId));
    if (allConclusionColKeys.has(col.key) && conclusionRuleApplies) {
      if (isPrint) {
        return (
          <span className={`text-[10px] font-semibold ${rawValue === 'PASS' ? 'text-emerald-700' : rawValue === 'FAIL' ? 'text-red-700' : 'text-slate-500'}`}>
            {(PASS_PRINT_CHARS[rawValue] ?? rawValue) || '—'}
          </span>
        );
      }
      if (!rawValue) {
        return <span className="text-[10px] text-slate-300 italic">Auto</span>;
      }
      return (
        <span className={`text-[10px] ${PASS_COLORS[rawValue] ?? 'text-slate-600'}`}>
          {PASS_LABELS[rawValue] ?? rawValue}
        </span>
      );
    }

    // ── Columna computada (ej. ΔP = Valor Final - Valor Inicial) ───────────
    const computeRule = computeRules.find(r => r.targetColumn === col.key && ruleAppliesToRow(r, rowId));
    if (computeRule) {
      const unit = computeRule.unit ?? col.unit ?? null;
      if (isPrint) {
        return (
          <span className="text-[10px]">
            {rawValue ? `${rawValue}${unit ? '\u00A0' + unit : ''}` : '—'}
          </span>
        );
      }
      return (
        <span className="text-[10px] text-purple-700 font-medium" title="Valor calculado automáticamente">
          {rawValue ? `${rawValue}${unit ? ' ' + unit : ''}` : <span className="text-slate-300 italic font-normal">Auto</span>}
        </span>
      );
    }

    // ── Columnas con valor de fábrica fijo (ej. Parámetro) ─────────────────
    // Si la columna tiene valor en templateRows y NO es una columna especial
    // (resultado/spec/conclusión), se muestra como texto de solo lectura.
    const isSpecialCol =
      allSpecColKeys.has(col.key) ||
      allResultadoColKeys.has(col.key) ||
      allConclusionColKeys.has(col.key);

    if (!isSpecialCol) {
      const factoryVal = getFactoryValue(rowId, col.key);
      const trimmed = factoryVal.trim();
      const effUnit = (col.unit ?? col.label?.match(/\(\s*([^)]{1,15})\s*\)\s*$/)?.[1])?.trim();
      const isJustUnit = effUnit && trimmed === effUnit;
      const hasContent = trimmed.length > 0 &&
        /[0-9A-Za-zÀ-ÖØ-öø-ÿ]/.test(trimmed) && !isJustUnit;
      if (hasContent) {
        // Para columnas text_input/number_input, verificar si el valor de fábrica
        // varía entre filas. Si cada fila tiene un valor distinto, es un label (read-only).
        // Si todas las filas tienen el mismo valor, es un placeholder/unidad (editable).
        if (col.type === 'text_input' || col.type === 'number_input') {
          const dataRows = table.templateRows.filter(r => !r.isTitle && !r.isSelector);
          const allSame = dataRows.length > 0 && dataRows.every(r =>
            (r.cells?.[col.key] ?? '').toString().trim() === trimmed
          );
          if (allSame) {
            // Mismo valor en todas las filas → placeholder/unidad → editable
            // (cae al renderDefaultCell más abajo)
          } else {
            // Valores distintos por fila → label descriptivo → read-only
            if (isPrint) return <span className="text-[10px]">{factoryVal}</span>;
            return <span className="text-[10px] text-slate-700 cursor-default">{factoryVal}</span>;
          }
        } else {
          if (isPrint) return <span className="text-[10px]">{factoryVal}</span>;
          return <span className="text-[10px] text-slate-700 cursor-default">{factoryVal}</span>;
        }
      }
    }

    // ── Resto de columnas (Resultado y otras editables) ─────────────────────
    // Para la columna Resultado, inyectar la unidad detectada de la especificación de esta fila.
    // cellUnits de la fila sobreescribe tanto col.unit como el rowUnit auto-detectado.
    const rowUnit = allResultadoColKeys.has(col.key) && !col.unit ? getRowResultUnit(rowId) : null;
    const templateRowForUnit = table.templateRows.find(r => r.rowId === rowId);
    const cellUnitOverride = templateRowForUnit?.cellUnits?.[col.key] ?? null;
    const effectiveColUnit = cellUnitOverride ?? (rowUnit ?? col.unit ?? null);
    const colForRender = effectiveColUnit !== col.unit ? { ...col, unit: effectiveColUnit } : col;
    return renderDefaultCell(colForRender, rowId, selection.filledData, readOnly, isPrint, handleCellChange, compact);
  };

  return (
    <div className={`mb-6 ${isPrint ? 'rounded-xl border border-slate-200 overflow-hidden' : 'rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white'}`}>

      {/* Encabezado de tabla (ocultar si showTitle === false) */}
      {table.showTitle !== false ? (
      <div className={`flex items-center justify-between px-3 gap-3 ${compact ? 'py-1.5' : 'py-2'} bg-slate-50 border-b border-slate-200`}>
        <div className="min-w-0">
          <p className={`font-semibold truncate ${compact ? 'text-xs text-slate-900' : 'text-sm text-slate-900'}`}>
            {table.name}
          </p>
          {table.description && !isPrint && (
            <p className="text-xs text-slate-500 mt-0.5 truncate">{table.description}</p>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Toggle "Ver especificación del cliente" */}
          {table.allowClientSpec && !isPrint && (
            <label className="flex items-center gap-1.5 cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={clientSpecEnabled}
                disabled={readOnly}
                onChange={(e) => onToggleClientSpec?.(selection.tableId, e.target.checked)}
                className="w-3.5 h-3.5 accent-blue-600 cursor-pointer disabled:cursor-default"
              />
              <span className="text-[10px] font-medium text-slate-600 group-hover:text-slate-900 transition-colors">
                Especificaciones ampliadas por el cliente
              </span>
            </label>
          )}

          {/* Botón duplicar tabla */}
          {!isPrint && !readOnly && onDuplicate && (
            <button
              onClick={() => onDuplicate(selection.tableId)}
              className="text-slate-400 hover:text-teal-600 transition-colors p-1"
              title="Duplicar tabla"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}

          {/* Botón quitar */}
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
      </div>
      ) : !isPrint && !readOnly && onRemove ? (
        /* Título oculto: solo mostrar botón quitar en modo edición */
        <div className="flex justify-end px-2 py-1 bg-slate-50 border-b border-slate-100">
          {onDuplicate && (
            <button onClick={() => onDuplicate(selection.tableId)}
              className="text-slate-400 hover:text-teal-600 transition-colors p-1" title="Duplicar tabla">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
          <button onClick={() => onRemove(selection.tableId)}
            className="text-slate-400 hover:text-red-500 transition-colors p-1" title="Quitar tabla">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : null}

      {/* Campos de encabezado (selectores pre-tabla) */}
      {(table.headerFields ?? []).length > 0 && (
        <div className="flex flex-wrap gap-4 px-3 py-2 border-b border-slate-200 bg-white">
          {(table.headerFields ?? []).map(hf => {
            const value = selection.headerData?.[hf.fieldId] ?? '';
            // En print/PDF: texto entre paréntesis se oculta (ej. "DAD (1260)" → "DAD")
            const printValue = value.replace(/\s*\([^)]*\)\s*$/, '').trim();
            return (
              <div key={hf.fieldId} className="flex items-center gap-2">
                {hf.label?.trim() && (
                  <span className={`font-semibold ${isPrint ? 'text-[9px]' : 'text-xs text-slate-700'}`}>
                    {hf.label}:
                  </span>
                )}
                {isPrint ? (
                  <span className="text-[9px]">{printValue || '—'}</span>
                ) : readOnly ? (
                  <span className="text-xs text-slate-600">{value || '—'}</span>
                ) : (
                  <select
                    value={value}
                    onChange={e => onChangeHeaderData?.(selection.tableId, hf.fieldId, e.target.value)}
                    className="border border-slate-300 rounded px-2 py-1 text-xs bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Seleccionar...</option>
                    {hf.options.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tabla */}
      <div className={isPrint || readOnly ? '' : 'overflow-x-auto'}>
        <table className="w-full text-left border-collapse" style={table.columns.some(c => c.width) ? { tableLayout: 'fixed' } : undefined}>
          <thead>
            {(() => {
              const groups = table.columnGroups ?? [];
              const hasGroups = groups.length > 0;
              const groupTitle = table.columnGroupTitle ?? null;
              // Set de índices de columna cubiertos por un grupo
              const groupedCols = new Set<number>();
              groups.forEach(g => { for (let i = g.startCol; i < g.startCol + g.span; i++) groupedCols.add(i); });

              const thClass = (colIdx: number) =>
                `px-2 font-semibold ${compact ? 'py-1 text-[10px]' : 'py-1.5 text-xs'} text-center ${
                  `text-slate-600${colIdx < table.columns.length - 1 ? ' border-r border-slate-200' : ''}`
                }`;

              const titleRow = groupTitle ? (
                <tr className="bg-slate-100">
                  <th colSpan={table.columns.length}
                    className={`px-2 font-bold text-center ${compact ? 'py-1 text-[10px]' : 'py-1.5 text-xs'} text-slate-700 border-b border-slate-200`}>
                    {groupTitle}
                  </th>
                </tr>
              ) : null;

              if (!hasGroups) {
                // Sin grupos: título (opcional) + una fila de headers
                return (
                  <>
                    {titleRow}
                    <tr className="bg-slate-100 border-b border-slate-200">
                      {table.columns.map((col, colIdx) => (
                        <th key={col.key} className={`${thClass(colIdx)} ${col.align === 'right' ? '!text-right' : ''}`}
                          style={col.width ? { width: `${col.width}mm` } : undefined}>
                          {col.label || null}
                          {col.label && col.unit && <span className={`font-normal ml-1 ${isPrint ? 'text-slate-300' : 'text-slate-400'}`}>({col.unit})</span>}
                          {col.label && col.required && !isPrint && <span className="text-red-400 ml-0.5">*</span>}
                          {allConclusionColKeys.has(col.key) && !isPrint && !readOnly && <span className="ml-1 text-blue-400 font-normal text-[9px]">auto</span>}
                          {computeRules.some(r => r.targetColumn === col.key) && !isPrint && !readOnly && <span className="ml-1 text-purple-400 font-normal text-[9px]">calc</span>}
                          {allSpecColKeys.has(col.key) && !isPrint && !readOnly && <span className="ml-1 text-slate-400 font-normal text-[9px]">{clientSpecEnabled ? '✎' : '🔒'}</span>}
                        </th>
                    ))}
                  </tr>
                  </>
                );
              }

              // Con grupos: título (opcional) + dos filas de headers
              // Fila 1: grupos (colspan) + columnas no agrupadas (rowSpan=2)
              // Fila 2: sub-columnas de cada grupo
              const trClass = 'bg-slate-100';
              return (
                <>
                  {titleRow}
                  <tr className={trClass}>
                    {table.columns.map((col, colIdx) => {
                      // Si esta columna es parte de un grupo pero NO es la primera del grupo, skip
                      if (groupedCols.has(colIdx)) {
                        const group = groups.find(g => g.startCol === colIdx);
                        if (!group) return null; // columna interior del grupo, skip
                        // Primera columna del grupo: render el grupo con colspan
                        const lastGroupColIdx = group.startCol + group.span - 1;
                        return (
                          <th key={`group-${colIdx}`} colSpan={group.span}
                            className={`${thClass(lastGroupColIdx)} ${isPrint ? '' : 'border-b border-slate-200'}`}>
                            {group.label}
                          </th>
                        );
                      }
                      // Columna no agrupada: rowSpan=2
                      return (
                        <th key={col.key} rowSpan={2}
                          className={`${thClass(colIdx)} ${col.align === 'right' ? '!text-right' : ''} ${isPrint ? '' : 'border-b border-slate-200'}`}
                          style={col.width ? { width: `${col.width}mm` } : undefined}>
                          {col.label || null}
                          {col.label && col.unit && <span className={`font-normal ml-1 ${isPrint ? 'text-slate-300' : 'text-slate-400'}`}>({col.unit})</span>}
                          {col.label && col.required && !isPrint && <span className="text-red-400 ml-0.5">*</span>}
                          {allConclusionColKeys.has(col.key) && !isPrint && !readOnly && <span className="ml-1 text-blue-400 font-normal text-[9px]">auto</span>}
                          {computeRules.some(r => r.targetColumn === col.key) && !isPrint && !readOnly && <span className="ml-1 text-purple-400 font-normal text-[9px]">calc</span>}
                          {allSpecColKeys.has(col.key) && !isPrint && !readOnly && <span className="ml-1 text-slate-400 font-normal text-[9px]">{clientSpecEnabled ? '✎' : '🔒'}</span>}
                        </th>
                      );
                    })}
                  </tr>
                  <tr className={`${trClass} ${isPrint ? '' : 'border-b border-slate-200'}`}>
                    {groups.flatMap(g =>
                      table.columns.slice(g.startCol, g.startCol + g.span).map((col, i) => {
                        const colIdx = g.startCol + i;
                        const isLastInGroup = i === g.span - 1;
                        const isLastCol = colIdx === table.columns.length - 1;
                        return (
                          <th key={col.key}
                            className={`${thClass(colIdx)} ${col.align === 'right' ? '!text-right' : ''} ${!isPrint && isLastInGroup && !isLastCol ? 'border-r border-slate-200' : ''}`}
                            style={col.width ? { width: `${col.width}mm` } : undefined}>
                            {col.label || null}
                            {col.label && col.unit && <span className={`font-normal ml-1 ${isPrint ? 'text-slate-300' : 'text-slate-400'}`}>({col.unit})</span>}
                          </th>
                        );
                      })
                    )}
                  </tr>
                </>
              );
            })()}
          </thead>
          <tbody>
            {(() => {
              // Pre-compute which cells are covered by a previous row's span
              // Soporta columnSpans (nuevo, por columna) y rowSpan+spanColumns (legacy, uniforme)
              const coveredCells = new Set<string>(); // "rowIdx:colKey"
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
              // Detect rows that START a new group: either has a span > 1,
              // or is NOT covered by a previous row's span in the first spannable column
              // (handles single-row groups like μECD)
              const isGroupStart = (rowIdx: number): boolean => {
                if (rowIdx === 0) return false;
                const r = table.templateRows[rowIdx];
                if (!r) return false;
                // Has an explicit span → definitely a group start
                if (table.columns.some(col => spanAt(r, col.key) > 1)) return true;
                // Check if previous row had a span that covered this row — if not, it's a new group
                const prevRow = table.templateRows[rowIdx - 1];
                if (!prevRow) return false;
                return table.columns.some(col => {
                  const prevSpan = spanAt(prevRow, col.key);
                  return prevSpan > 1 || coveredCells.has(`${rowIdx - 1}:${col.key}`);
                }) && !table.columns.some(col => coveredCells.has(`${rowIdx}:${col.key}`));
              };
              return table.templateRows.map((row, idx) => {
              // Visibilidad condicional por header field
              if (row.visibleWhenSelector) {
                const selVal = selection.headerData?.[row.visibleWhenSelector.headerFieldId] ?? '';
                if (!selVal || !row.visibleWhenSelector.values.includes(selVal)) return null;
              }
              if (row.isTitle) {
                return (
                  <tr key={row.rowId} className="bg-slate-50">
                    <td
                      colSpan={table.columns.length}
                      className="px-2 py-1 font-semibold text-xs text-slate-700 border-b border-slate-200"
                    >
                      {row.titleText ?? ''}
                    </td>
                  </tr>
                );
              }
              if (row.isSelector) {
                const selectorValue = selection.filledData[row.rowId]?.['__selector__'] ?? '';
                return (
                  <tr
                    key={row.rowId}
                    className={isPrint
                      ? 'border-b border-slate-200'
                      : `${idx % 2 === 0 ? '' : 'bg-slate-50/50'} hover:bg-blue-50/30 transition-colors`
                    }
                  >
                    {(() => {
                      // Si selectorColumn está definido y > 0: label en col 0, dropdown en selectorColumn
                      // Si no: label + dropdown juntos en col 0, resto editables
                      const splitSelector = (row.selectorColumn ?? 0) > 0;
                      const dropdownCol = row.selectorColumn ?? 0;
                      return table.columns.map((col, colIdx) => (
                        <td
                          key={col.key}
                          className={`px-2 py-1.5 align-middle ${isPrint ? 'text-[10px]' : 'text-xs'}${colIdx < table.columns.length - 1 ? ' border-r border-slate-100' : ''}`}
                        >
                          {splitSelector ? (
                            // ── Selector separado: label en col 0, dropdown en dropdownCol ──
                            colIdx === 0 ? (
                              <span className={`text-[10px] font-semibold ${isPrint ? '' : 'text-slate-700'}`}>
                                {row.selectorLabel}{(isPrint || readOnly) && selectorValue ? ` (${selectorValue})` : ''}
                              </span>
                            ) : colIdx === dropdownCol ? (
                              (isPrint || readOnly) ? (
                                <span className="text-[10px]">{selectorValue || '—'}</span>
                              ) : (
                                <select
                                  value={selectorValue}
                                  onChange={(e) => onChangeData(selection.tableId, row.rowId, '__selector__', e.target.value)}
                                  className="w-full text-[10px] border border-slate-300 rounded px-1 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                  <option value="">Seleccionar...</option>
                                  {(row.selectorOptions ?? []).map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              )
                            ) : (
                              renderTableCell(col, row.rowId)
                            )
                          ) : (
                            // ── Default: label+dropdown en col 0, resto editables ──
                            colIdx === 0 ? (
                              (isPrint || readOnly) ? (
                                <span className="text-[10px]">
                                  <span className="font-semibold">{row.selectorLabel}</span>
                                  {selectorValue ? ` (${selectorValue})` : ''}
                                </span>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] font-semibold text-slate-700 shrink-0">{row.selectorLabel}:</span>
                                  <select
                                    value={selectorValue}
                                    onChange={(e) => onChangeData(selection.tableId, row.rowId, '__selector__', e.target.value)}
                                    className="text-[10px] border border-slate-300 rounded px-1 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  >
                                    <option value="">Seleccionar...</option>
                                    {(row.selectorOptions ?? []).map(opt => (
                                      <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                  </select>
                                </div>
                              )
                            ) : (
                              renderTableCell(col, row.rowId)
                            )
                          )}
                        </td>
                      ));
                    })()}
                  </tr>
                );
              }
              const isExtra = row.rowId.startsWith('extra_');
              const groupStart = isGroupStart(idx);
              return (
                <tr
                  key={row.rowId}
                  className={isPrint
                    ? 'border-b border-slate-200'
                    : `${idx % 2 === 0 ? '' : 'bg-slate-50/50'} hover:bg-blue-50/30 transition-colors`
                  }
                >
                  {table.columns.map((col, colIdx) => {
                    // Skip cells covered by a previous row's span
                    if (coveredCells.has(`${idx}:${col.key}`)) return null;
                    const colSpan = spanAt(row, col.key);
                    const isSpanning = colSpan > 1;
                    // A cell is "group-like" if it spans OR if it's a single-row group
                    // in a column that HAS spans elsewhere (e.g. μECD in the "detector" column)
                    const colHasSpansElsewhere = table.templateRows.some(r => spanAt(r, col.key) > 1);
                    const isGroupCell = isSpanning || (groupStart && colHasSpansElsewhere && !coveredCells.has(`${idx}:${col.key}`));
                    // Label columns (first col or align:left) should NOT get centered/bold group styling
                    const isLabelCol = colIdx === 0 || col.align === 'left';
                    const groupStyle = isGroupCell && !isLabelCol ? ' font-semibold text-center bg-slate-50' : isGroupCell ? ' bg-slate-50' : '';
                    return (
                      <td
                        key={col.key}
                        rowSpan={isSpanning ? colSpan : undefined}
                        className={[
                          `px-2 ${compact ? 'py-1' : 'py-1.5'} align-middle`,
                          `${isPrint ? 'text-[10px]' : 'text-xs'}${colIdx < table.columns.length - 1 ? ' border-r border-slate-100' : ''} border-b border-b-slate-100${groupStyle}`,
                          !isGroupCell ? (col.align === 'left' ? 'text-left' : col.align === 'right' ? 'text-right' : 'text-center') : isLabelCol ? 'text-left' : '',
                        ].join(' ')}
                      >
                        {renderTableCell(col, row.rowId)}
                      </td>
                    );
                  })}
                  {/* Botón eliminar fila extra */}
                  {isExtra && !readOnly && !isPrint && onRemoveRow && (
                    <td className="px-1 py-1 align-middle w-6">
                      <button
                        onClick={() => onRemoveRow(selection.tableId, row.rowId)}
                        className="text-slate-300 hover:text-red-500 transition-colors"
                        title="Quitar fila"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </td>
                  )}
                </tr>
              );
            });
            })()}
          </tbody>
        </table>
      </div>

      {/* Botón agregar fila (solo si la tabla lo permite) */}
      {!readOnly && !isPrint && onAddRow && table.allowExtraRows && (
        <div className="px-3 py-1.5 border-t border-slate-100">
          <button
            onClick={() => onAddRow(selection.tableId)}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            + Agregar fila
          </button>
        </div>
      )}

      {/* Footer edit: observaciones (oculto en readOnly si no hay contenido) */}
      {!isPrint && (!readOnly || selection.observaciones) && (
        <div className="px-3 py-2 bg-slate-50 border-t border-slate-200">
          <input
            type="text"
            placeholder="Observaciones..."
            value={selection.observaciones ?? ''}
            disabled={readOnly}
            onChange={(e) => onChangeObservaciones?.(selection.tableId, e.target.value)}
            className="w-full text-xs border border-slate-200 rounded px-2 py-1 bg-white disabled:bg-slate-50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-300"
          />
        </div>
      )}

      {/* Footer print: observaciones */}
      {isPrint && selection.observaciones && (
        <div className="px-2 py-1 border-t border-slate-200">
          <span className="text-[9px] text-slate-600">
            <strong>Obs.:</strong> {selection.observaciones}
          </span>
        </div>
      )}
    </div>
  );
};
