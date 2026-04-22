import React from 'react';
import { createPortal } from 'react-dom';
import type { TableCatalogColumn, ProtocolSelection } from '../types/tableCatalog';
import { useAccordionCard } from '../hooks/useAccordionCard';
import { useIsCompact } from '../hooks/useIsMobile';
import { AccordionHeaderChrome, AccordionConfirmButton } from './protocol/AccordionChrome';

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

/**
 * Resuelve variables y expresiones aritméticas simples en una especificación.
 * - Substituye `{fieldId}` con valores de headerData
 * - Evalúa multiplicaciones simples `a*b` o `a×b` (ej. "1600*0.5" → "800")
 * - Se respetan operadores de comparación (≥, ≤, >, <, ±, NMT, NLT, rangos)
 *
 * Ejemplos:
 *   "≥ 1600*{ruido}" + {ruido: "0.5"}  →  "≥ 800"
 *   "≤ {ruido}*6.0"  + {ruido: "0.5"}  →  "≤ 3"
 *   "95 – 105"                          →  "95 – 105" (sin cambios)
 *
 * Si una variable no tiene valor o no se puede resolver, devuelve null (spec incompleta).
 */
/**
 * Tokens soportados:
 *   {fieldId} o {Label}        → headerData (match por fieldId, o label normalizado)
 *   {@rowId} o {@RowLabel}     → filledData[rowId][currentColKey] (valor de otra fila, misma columna)
 * Aritmética:
 *   multiplicación (a*b, a×b), suma (a+b), resta (a-b). Se evalúan en orden: *, +, -.
 */
function resolveSpecExpression(
  spec: string,
  headerData?: Record<string, string>,
  headerFields?: { fieldId: string; label: string }[],
  ctx?: {
    filledData?: Record<string, Record<string, string>>;
    templateRows?: { rowId: string; cells: Record<string, string | number | boolean | null> }[];
    currentColKey?: string;
    labelColKey?: string;
  },
): string | null {
  if (!spec) return spec;
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s()=:]+/g, '');

  const resolveHeaderToken = (token: string): string | undefined => {
    if (!headerData) return undefined;
    if (headerData[token] !== undefined) return headerData[token];
    const ntoken = norm(token);
    for (const k of Object.keys(headerData)) {
      if (norm(k) === ntoken) return headerData[k];
    }
    if (headerFields) {
      const field = headerFields.find(f => norm(f.label) === ntoken);
      if (field && headerData[field.fieldId] !== undefined) return headerData[field.fieldId];
    }
    return undefined;
  };

  const resolveCellToken = (token: string): string | undefined => {
    if (!ctx?.filledData || !ctx?.currentColKey) return undefined;
    const ntoken = norm(token);
    // 1. Match por rowId exacto
    if (ctx.filledData[token]?.[ctx.currentColKey] !== undefined) {
      return ctx.filledData[token][ctx.currentColKey];
    }
    // 2. Match por rowId normalizado
    for (const rowId of Object.keys(ctx.filledData)) {
      if (norm(rowId) === ntoken) return ctx.filledData[rowId][ctx.currentColKey];
    }
    // 3. Match por label de cualquier columna del template row (primera coincidencia)
    if (ctx.templateRows) {
      const row = ctx.templateRows.find(r => {
        for (const val of Object.values(r.cells ?? {})) {
          if (val != null && norm(String(val)) === ntoken) return true;
        }
        return false;
      });
      if (row) return ctx.filledData[row.rowId]?.[ctx.currentColKey];
    }
    return undefined;
  };

  // 1. Substituir tokens
  let resolved = spec;
  const varMatches = Array.from(spec.matchAll(/\{(@?[^}]+)\}/g));
  for (const m of varMatches) {
    const raw = m[1];
    const isCellRef = raw.startsWith('@');
    const key = isCellRef ? raw.slice(1) : raw;
    const val = (isCellRef ? resolveCellToken(key) : resolveHeaderToken(key))?.trim();
    if (!val) return null;
    resolved = resolved.replaceAll(m[0], val);
  }
  // 2. Aritmética: multiplicación → suma → resta (iterativo)
  const evalOp = (re: RegExp, op: (a: number, b: number) => number) => {
    let safety = 20;
    while (re.test(resolved) && safety-- > 0) {
      resolved = resolved.replace(re, (_, a: string, b: string) => {
        const na = parseFloat(a.replace(',', '.'));
        const nb = parseFloat(b.replace(',', '.'));
        if (isNaN(na) || isNaN(nb)) return _;
        const r = op(na, nb);
        return String(Math.round(r * 1e6) / 1e6);
      });
    }
  };
  evalOp(/(\d+(?:[.,]\d+)?)\s*[*×x]\s*(\d+(?:[.,]\d+)?)/, (a, b) => a * b);
  // Suma y resta: solo cuando NO hay un operador de comparación inmediatamente antes (para no consumir "≥ 5")
  evalOp(/(\d+(?:[.,]\d+)?)\s*\+\s*(\d+(?:[.,]\d+)?)/, (a, b) => a + b);
  // Resta: evita consumir "≥ -5" o "±-5"; solo consume "a-b" con a numérico
  evalOp(/(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)/, (a, b) => a - b);
  return resolved;
}

// ─── Dropdown multi-select para header field (portal) ────────────────────────
function MultiSelectHeaderDropdown({
  label, options, selected, onToggle,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const [pos, setPos] = React.useState<
    { top?: number; bottom?: number; left: number; width: number; maxHeight: number } | null
  >(null);

  React.useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const vh = window.innerHeight;
    const gap = 4;
    const spaceBelow = vh - r.bottom - gap - 8;
    const spaceAbove = r.top - gap - 8;
    // Abrir hacia abajo si hay >= 200px de espacio O más espacio que arriba
    const openDown = spaceBelow >= 200 || spaceBelow >= spaceAbove;
    const width = Math.max(r.width, 220);
    if (openDown) {
      setPos({ top: r.bottom + gap, left: r.left, width, maxHeight: Math.max(150, spaceBelow) });
    } else {
      setPos({ bottom: vh - r.top + gap, left: r.left, width, maxHeight: Math.max(150, spaceAbove) });
    }
  }, [open]);

  const display = selected.join(', ');
  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen(!open)}
        className="border border-slate-300 rounded px-2 py-1 text-xs bg-white hover:border-teal-400 min-w-[160px] text-left truncate"
        title={display || label}
      >
        {display || 'Seleccionar...'}
      </button>
      {open && pos && createPortal(
        <>
          <div className="fixed inset-0 z-[1000]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[1001] bg-white border border-slate-200 rounded-lg shadow-xl py-1 overflow-y-auto"
            style={{
              top: pos.top,
              bottom: pos.bottom,
              left: pos.left,
              width: pos.width,
              maxHeight: pos.maxHeight,
            }}
          >
            {options.map(opt => {
              const checked = selected.includes(opt);
              return (
                <label key={opt} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(opt)}
                    className="accent-teal-600"
                  />
                  <span className="text-slate-700 flex-1 truncate">{opt}</span>
                </label>
              );
            })}
          </div>
        </>,
        document.body,
      )}
    </>
  );
}

// ─── Menú mostrar/ocultar columnas (portal) ───────────────────────────────────
// Se renderiza en document.body para escapar cualquier `overflow: hidden` de padres.
function ColumnVisibilityMenu({
  open, setOpen, columns, isColumnVisible, onToggle,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  columns: TableCatalogColumn[];
  isColumnVisible: (col: TableCatalogColumn) => boolean;
  onToggle: (colKey: string, visible: boolean) => void;
}) {
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const [pos, setPos] = React.useState<
    { top?: number; bottom?: number; left: number; maxHeight: number } | null
  >(null);

  React.useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const vh = window.innerHeight;
    const gap = 4;
    const menuWidth = 240;
    const left = Math.max(8, r.right - menuWidth);
    const spaceBelow = vh - r.bottom - gap - 8;
    const spaceAbove = r.top - gap - 8;
    const openDown = spaceBelow >= 200 || spaceBelow >= spaceAbove;
    if (openDown) {
      setPos({ top: r.bottom + gap, left, maxHeight: Math.max(150, spaceBelow) });
    } else {
      setPos({ bottom: vh - r.top + gap, left, maxHeight: Math.max(150, spaceAbove) });
    }
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen(!open)}
        className="text-slate-400 hover:text-teal-600 transition-colors p-1"
        title="Mostrar/ocultar columnas"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      </button>
      {open && pos && createPortal(
        <>
          <div className="fixed inset-0 z-[1000]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[1001] bg-white border border-slate-200 rounded-lg shadow-xl py-1 w-[240px] overflow-y-auto"
            style={{ top: pos.top, bottom: pos.bottom, left: pos.left, maxHeight: pos.maxHeight }}
          >
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide font-bold text-slate-500 border-b border-slate-100 sticky top-0 bg-white">
              Columnas
            </div>
            {columns.map(col => {
              const visible = isColumnVisible(col);
              return (
                <label key={col.key} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={visible}
                    onChange={e => onToggle(col.key, e.target.checked)}
                    className="accent-teal-600"
                  />
                  <span className="text-slate-700 flex-1 truncate">{col.label || col.key}</span>
                  {col.hiddenByDefault && <span className="text-[9px] text-slate-400">oculta def.</span>}
                </label>
              );
            })}
          </div>
        </>,
        document.body,
      )}
    </>
  );
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
  onToggleClientSpec?: (tableId: string, enabled: boolean, instanceValue?: string) => void;
  onRemove?: (tableId: string) => void;
  onDuplicate?: (tableId: string) => void;
  onAddRow?: (tableId: string) => void;
  onRemoveRow?: (tableId: string, rowId: string) => void;
  onDuplicateRow?: (tableId: string, originalRowId: string) => void;
  onChangeHeaderData?: (tableId: string, fieldId: string, value: string, instanceValue?: string) => void;
  /** Toggle de visibilidad de columna en la instancia (sobrescribe hiddenByDefault del template) */
  onChangeColumnVisibility?: (tableId: string, colKey: string, visible: boolean) => void;
  /** Cambio del input editable en el encabezado de una columna (feature headerEditable) */
  onChangeColumnHeader?: (tableId: string, colKey: string, value: string) => void;
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
      ? `relative ${readOnly ? '' : ''}`
      : `relative border border-slate-300 rounded bg-white px-1 py-0.5 focus-within:ring-1 focus-within:ring-blue-500 ${readOnly ? 'bg-slate-50' : ''}`}>
      <input
        type="text"
        value={displayValue}
        disabled={readOnly}
        placeholder={placeholder}
        onChange={handleChange}
        onFocus={selectAll}
        className="w-full text-[10px] text-center bg-transparent border-none outline-none focus:outline-none disabled:cursor-not-allowed placeholder:text-slate-300"
      />
      <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 select-none pointer-events-none">
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
  onDuplicateRow,
  onChangeHeaderData,
  onChangeColumnVisibility,
  onChangeColumnHeader,
  variables,
  liveTemplateRows,
  siblingSelections,
}) => {
  const table = selection.tableSnapshot;
  // Inyectar CSS de fontSize en <head> en vez de inline dentro de la tabla,
  // para evitar que html2canvas vea el <style> en el árbol capturado y falle en renderBackgroundImage.
  React.useEffect(() => {
    if (!table.fontSize) return;
    const styleEl = document.createElement('style');
    styleEl.setAttribute('data-ags-table-font', selection.tableId);
    styleEl.textContent = `
      table[data-catalog-table-id="${selection.tableId}"] tbody td,
      table[data-catalog-table-id="${selection.tableId}"] tbody td * { font-size: ${table.fontSize}px !important; line-height: 1.35 !important; }
    `;
    document.head.appendChild(styleEl);
    return () => { styleEl.remove(); };
  }, [table.fontSize, selection.tableId]);
  const compact = table.compactDisplay ?? false;
  const clientSpecEnabled = selection.clientSpecEnabled ?? false;

  // ── Accordion (mobile/tablet only) ──────────────────────────────────────────
  const isCompact = useIsCompact();
  const { expanded, toggle, completed, markCompleted } = useAccordionCard(selection.tableId);
  const accordionActive = isCompact && !isPrint && !readOnly;
  const showBody = !accordionActive || expanded;
  const isCompletedStyle = accordionActive && completed;

  // ── Visibilidad por columna (default = !hiddenByDefault, overrideable por instancia) ──
  const isColumnVisible = (col: TableCatalogColumn): boolean =>
    selection.columnVisibility?.[col.key] ?? !col.hiddenByDefault;
  const visibleColumns = table.columns.filter(isColumnVisible);
  // Recalcular columnGroups para reflejar solo columnas visibles (span y startCol ajustados)
  const visibleGroups: Array<{ startCol: number; span: number; label: string }> = [];
  for (const g of (table.columnGroups ?? [])) {
    const groupCols = table.columns.slice(g.startCol, g.startCol + g.span);
    const visibleInGroup = groupCols.filter(isColumnVisible);
    if (visibleInGroup.length === 0) continue;
    const firstVisibleIdx = visibleColumns.indexOf(visibleInGroup[0]);
    visibleGroups.push({ startCol: firstVisibleIdx, span: visibleInGroup.length, label: g.label });
  }
  const [showColMenu, setShowColMenu] = React.useState(false);
  const hasHiddenCapableCols = table.columns.some(c => c.hiddenByDefault) ||
    Object.keys(selection.columnVisibility ?? {}).length > 0;

  // ── Multi-select de header fields ───────────────────────────────────────
  /** Devuelve los valores seleccionados de un header field como array (maneja multi y single). */
  const getSelectedHeaderValues = (fieldId: string): string[] => {
    const raw = selection.headerData?.[fieldId] ?? '';
    if (!raw) return [];
    if (raw.startsWith('[')) {
      try { return JSON.parse(raw); } catch { return []; }
    }
    return [raw];
  };
  /** Toggle de un valor en un header multi-select. */
  const toggleHeaderValue = (fieldId: string, value: string) => {
    const current = getSelectedHeaderValues(fieldId);
    const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
    onChangeHeaderData?.(selection.tableId, fieldId, next.length > 0 ? JSON.stringify(next) : '');
  };
  /** Verifica si un header field es visible dado su visibleWhenSelector (soporta multi-select trigger). */
  const isHeaderFieldVisible = (hf: import('@ags/shared').TableHeaderField): boolean => {
    if (isPrint && hf.hideInPrint) return false;
    if (!hf.visibleWhenSelector) return true;
    const triggerValues = getSelectedHeaderValues(hf.visibleWhenSelector.headerFieldId);
    return triggerValues.some(v => hf.visibleWhenSelector!.values.includes(v));
  };
  /** Verifica si un visibleWhenSelector de fila se cumple con los headers seleccionados. */
  const doesRowSelectorMatch = (sel: { headerFieldId: string; values: string[] }): boolean => {
    const triggerValues = getSelectedHeaderValues(sel.headerFieldId);
    return triggerValues.some(v => sel.values.includes(v));
  };
  /**
   * Resuelve la visibilidad de una fila considerando visibleWhenSelector + defaultVisible.
   * Semántica: defaultVisible sólo aplica cuando el header selector está vacío.
   * Si el técnico selecciona un valor, gana el match exacto; los "default" no forzados.
   */
  const shouldShowRow = (row: { visibleWhenSelector?: { headerFieldId: string; values: string[] } | null; defaultVisible?: boolean }): boolean => {
    if (!row.visibleWhenSelector) return true;
    const selected = getSelectedHeaderValues(row.visibleWhenSelector.headerFieldId);
    if (selected.length === 0) return !!row.defaultVisible;
    return doesRowSelectorMatch(row.visibleWhenSelector);
  };
  /** Header field que actúa como trigger primario de agrupación (primer multi-select con ≥2 valores). */
  const groupingField = (table.headerFields ?? []).find(hf =>
    hf.multiSelect && !hf.suppressGrouping && getSelectedHeaderValues(hf.fieldId).length >= 2
  ) ?? null;
  const groupingSelectedValues = groupingField ? getSelectedHeaderValues(groupingField.fieldId) : [];

  // ── Helpers para datos por instancia (sub-tablas) ──
  /** Lee headerData por instancia, con fallback al global. */
  const getInstanceHeaderValue = (instanceValue: string, fieldId: string): string =>
    selection.instanceHeaderData?.[instanceValue]?.[fieldId]
    ?? selection.headerData?.[fieldId]
    ?? '';
  /** Lee clientSpec por instancia, con fallback al global. */
  const getInstanceClientSpec = (instanceValue: string): boolean =>
    selection.instanceClientSpec?.[instanceValue]
    ?? selection.clientSpecEnabled
    ?? false;
  /** Determina a qué instancia pertenece una fila (por visibleWhenSelector del groupingField). */
  const getRowInstanceValue = (rowId: string): string | undefined => {
    if (!groupingField) return undefined;
    const row = table.templateRows.find(r => r.rowId === rowId);
    if (!row?.visibleWhenSelector) return undefined;
    if (row.visibleWhenSelector.headerFieldId !== groupingField.fieldId) return undefined;
    // Devuelve el primer valor del grouping que matchee
    return groupingSelectedValues.find(v => row.visibleWhenSelector!.values.includes(v));
  };
  /** Headers internos (excluye el groupingField) para una instancia dada. */
  const getInstanceHeaderFields = (instanceValue: string) =>
    (table.headerFields ?? []).filter(hf => {
      if (!groupingField) return false;
      if (hf.fieldId === groupingField.fieldId) return false;
      if (!hf.visibleWhenSelector) return true;
      // Solo mostrar si el visibleWhenSelector incluye esta instancia
      if (hf.visibleWhenSelector.headerFieldId === groupingField.fieldId) {
        return hf.visibleWhenSelector.values.includes(instanceValue);
      }
      return true;
    });

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
    // Determinar clientSpec efectivo (por instancia si aplica)
    const rowInstance = getRowInstanceValue(rowId);
    const effectiveCellClientSpec = rowInstance ? getInstanceClientSpec(rowInstance) : clientSpecEnabled;

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
      const isSpecChange = colKey === rSpecCol && effectiveCellClientSpec;
      const isReferenceChange = colKey === rRefCol;

      if (isResultadoChange || isSpecChange || isReferenceChange) {
        const currentResultado = computedResultado
          ?? (colKey === rSrcCol ? value : (selection.filledData[rowId]?.[rSrcCol] ?? ''));
        const currentSpec = isSpecChange
          ? value
          : (effectiveCellClientSpec && rSpecCol
            ? (selection.filledData[rowId]?.[rSpecCol] || getFactoryValue(rowId, rSpecCol))
            : getFactoryValue(rowId, rSpecCol));
        const currentNominal = rRefCol
          ? (colKey === rRefCol ? value : (selection.filledData[rowId]?.[rRefCol] ?? getFactoryValue(rowId, rRefCol)))
          : undefined;
        // Para resolver {@rowRef}, usamos filledData con el valor actual ya reflejado (aún no commiteado)
        const effectiveFilledData = {
          ...selection.filledData,
          [rowId]: { ...(selection.filledData[rowId] ?? {}), [colKey]: value },
        };
        const resolvedSpec = resolveSpecExpression(currentSpec, selection.headerData, table.headerFields, {
          filledData: effectiveFilledData,
          templateRows: table.templateRows,
          currentColKey: rSrcCol,
        }) ?? '';
        const conclusion = computeConclusion(currentResultado, resolvedSpec, currentNominal);
        if (conclusion !== '') {
          onChangeData(selection.tableId, rowId, rTgtCol, conclusion);
        } else if (!currentResultado.trim()) {
          onChangeData(selection.tableId, rowId, rTgtCol, '');
        }
      }

      // Recalcular OTRAS filas cuya spec referencia esta celda vía {@rowRef}
      // Solo si la celda cambiada es una columna fuente de alguna regla (Front/Back típicamente)
      if (rSrcCol === colKey) {
        for (const otherRow of table.templateRows) {
          if (otherRow.rowId === rowId || otherRow.isTitle || otherRow.isSelector) continue;
          if (!ruleAppliesToRow(rule, otherRow.rowId)) continue;
          const otherInstance = getRowInstanceValue(otherRow.rowId);
          const otherClientSpec = otherInstance ? getInstanceClientSpec(otherInstance) : clientSpecEnabled;
          const otherSpec = (otherClientSpec && selection.filledData[otherRow.rowId]?.[rSpecCol])
            || getFactoryValue(otherRow.rowId, rSpecCol);
          if (!/\{@/.test(otherSpec)) continue; // solo filas con referencia a celda
          const otherResultado = selection.filledData[otherRow.rowId]?.[rSrcCol] ?? '';
          if (!otherResultado.trim()) continue;
          const otherNominal = rRefCol
            ? (selection.filledData[otherRow.rowId]?.[rRefCol] ?? getFactoryValue(otherRow.rowId, rRefCol))
            : undefined;
          const effectiveFilledData = {
            ...selection.filledData,
            [rowId]: { ...(selection.filledData[rowId] ?? {}), [colKey]: value },
          };
          const otherResolved = resolveSpecExpression(otherSpec, selection.headerData, table.headerFields, {
            filledData: effectiveFilledData,
            templateRows: table.templateRows,
            currentColKey: rSrcCol,
          }) ?? '';
          const otherConclusion = computeConclusion(otherResultado, otherResolved, otherNominal);
          const currentOtherConclusion = selection.filledData[otherRow.rowId]?.[rTgtCol] ?? '';
          if (otherConclusion !== currentOtherConclusion) {
            onChangeData(selection.tableId, otherRow.rowId, rTgtCol, otherConclusion);
          }
        }
      }
    }
  };

  // ── Recomputar conclusiones cuando cambian variables del encabezado ──
  // Si el spec usa {fieldId} y el ingeniero cambia ese valor, las conclusiones de las filas
  // afectadas tienen que recalcular. Se ejecuta cuando headerData cambia.
  const headerDataKey = JSON.stringify(selection.headerData ?? {}) + JSON.stringify(selection.instanceClientSpec ?? {}) + JSON.stringify(selection.instanceHeaderData ?? {});
  React.useEffect(() => {
    if (!specColKey || vsSpecRules.length === 0) return;
    for (const rule of vsSpecRules) {
      const rSrcCol = rule.sourceColumn;
      const rTgtCol = rule.targetColumn;
      const rSpecCol = rule.specColumn || String(rule.factoryThreshold) || '';
      if (!rSrcCol || !rTgtCol || !rSpecCol) continue;
      for (const row of table.templateRows) {
        if (row.isTitle || row.isSelector) continue;
        if (!ruleAppliesToRow(rule, row.rowId)) continue;
        const rowInst = getRowInstanceValue(row.rowId);
        const rowClientSpec = rowInst ? getInstanceClientSpec(rowInst) : clientSpecEnabled;
        const specRaw = (rowClientSpec && selection.filledData[row.rowId]?.[rSpecCol])
          || getFactoryValue(row.rowId, rSpecCol);
        if (!/\{[^}]+\}/.test(specRaw)) continue; // sin variables: no aplica
        const resultado = selection.filledData[row.rowId]?.[rSrcCol] ?? '';
        if (!resultado.trim()) continue;
        const nominal = rule.referenceColumn
          ? (selection.filledData[row.rowId]?.[rule.referenceColumn] ?? getFactoryValue(row.rowId, rule.referenceColumn))
          : undefined;
        const resolvedSpec = resolveSpecExpression(specRaw, selection.headerData, table.headerFields, {
          filledData: selection.filledData,
          templateRows: table.templateRows,
          currentColKey: rSrcCol,
        }) ?? '';
        const newConclusion = computeConclusion(resultado, resolvedSpec, nominal);
        const currentConclusion = selection.filledData[row.rowId]?.[rTgtCol] ?? '';
        if (newConclusion !== currentConclusion) {
          onChangeData(selection.tableId, row.rowId, rTgtCol, newConclusion);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerDataKey]);

  /** Renderiza una celda con lógica especial para columnas spec y conclusion */
  const renderTableCell = (col: TableCatalogColumn, rowId: string, instanceValue?: string): React.ReactNode => {
    const rawValue = selection.filledData[rowId]?.[col.key] ?? '';
    // Client spec efectivo: por instancia si aplica, sino global
    const effectiveClientSpec = instanceValue ? getInstanceClientSpec(instanceValue) : clientSpecEnabled;

    // ── Columna de etiqueta fija: solo lectura para filas con valor, en blanco si vacío ──
    // Solo cuando el admin marcó isLabelColumn=true en esta columna, y no es fila extra.
    // Excluir columnas de spec y conclusión — necesitan su propio procesamiento.
    const isExtraRow = rowId.startsWith('extra_');
    if (!isExtraRow && col.isLabelColumn && !allSpecColKeys.has(col.key) && !allConclusionColKeys.has(col.key)) {
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
        const isLabelCol = visibleColumns[0]?.key === col.key;
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
    if (variables && (!rawValue || rawValue === 'N/A') && table.tableType === 'informational' && dataRows.length === 1) {
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
      const hasSpecVars = /\{@?[^}]+\}/.test(factoryVal);
      // Para display, resolvemos usando la columna fuente de la primera regla aplicable
      const displayColKey = vsSpecRules.find(r => ruleAppliesToRow(r, rowId))?.sourceColumn ?? '';
      const resolvedSpec = hasSpecVars ? resolveSpecExpression(factoryVal, selection.headerData, table.headerFields, {
        filledData: selection.filledData,
        templateRows: table.templateRows,
        currentColKey: displayColKey,
      }) : null;

      // Para display: ocultar el @ de referencias a celdas ({@Señal (OFF)} → {Señal (OFF)})
      const displayFactoryVal = factoryVal.replace(/\{@/g, '{');

      if (!effectiveClientSpec) {
        // Solo lectura: muestra valor de fábrica (con resolución si tiene variables)
        if (isPrint) {
          return <span className="text-[10px]">{resolvedSpec || displayFactoryVal || '—'}</span>;
        }
        if (hasSpecVars) {
          return (
            <div className="flex flex-col items-center leading-tight">
              <span className="text-[10px] text-slate-600 select-none" title="Fórmula (template)">
                {displayFactoryVal}
              </span>
              <span className={`text-[9px] font-semibold ${resolvedSpec ? 'text-teal-600' : 'text-amber-500'}`}
                title={resolvedSpec ? 'Valor resuelto con variables del encabezado' : 'Cargar variable para resolver'}>
                {resolvedSpec ? `= ${resolvedSpec}` : '(cargar variable)'}
              </span>
            </div>
          );
        }
        return (
          <span className="text-[10px] text-slate-600 select-none" title="Especificación de fábrica (no editable)">
            {factoryVal || '—'}
          </span>
        );
      }

      // Cliente: editable — solo el número, operador y unidad fijos
      // Parsear spec en: prefijo (operador), número(s), sufijo (unidad)
      const parseSpec = (val: string) => {
        if (!val) return { prefix: '', number: '', suffix: '' };
        // Match: operador + número(s) con rangos + unidad
        // Ej: "≤ 25 pA" → prefix="≤ ", number="25", suffix=" pA"
        // Ej: "± 4.0 °C" → prefix="± ", number="4.0", suffix=" °C"
        // Ej: "95 – 105" → prefix="", number="95 – 105", suffix=""
        // Ej: "≥1600*{ruido}" → devolver todo como number (tiene variable)
        if (/\{/.test(val)) return { prefix: '', number: val, suffix: '' };
        const m = val.match(/^([^\d+-]*?)\s*([+-]?\d[\d.,\s–\-]*\d|\d+(?:[.,]\d+)?)\s*(.*)$/);
        if (!m) return { prefix: '', number: val, suffix: '' };
        return { prefix: m[1].trim(), number: m[2].trim(), suffix: m[3].trim() };
      };

      if (isPrint) {
        const printVal = rawValue || factoryVal || '—';
        return (
          <span className="text-[10px]">
            {printVal !== '—' && col.unit ? `${printVal}\u00A0${col.unit}` : printVal}
          </span>
        );
      }

      const parsed = parseSpec(rawValue);
      const hasStructure = parsed.prefix || parsed.suffix;

      return (
        <div className="space-y-0.5">
          <div className={`flex items-center border border-blue-300 rounded bg-blue-50/60 px-1 py-0.5 focus-within:ring-1 focus-within:ring-blue-500 ${readOnly ? 'bg-slate-50' : ''}`}>
            {hasStructure ? (
              <>
                {parsed.prefix && (
                  <span className="text-[10px] text-blue-500 select-none shrink-0 font-medium">{parsed.prefix}</span>
                )}
                <input
                  type="text"
                  value={parsed.number}
                  disabled={readOnly}
                  placeholder="—"
                  onChange={(e) => {
                    const newVal = [parsed.prefix, e.target.value, parsed.suffix].filter(Boolean).join(' ');
                    handleCellChange(rowId, col.key, newVal);
                  }}
                  onFocus={e => e.target.select()}
                  className="min-w-0 text-[10px] text-center bg-transparent border-none outline-none focus:outline-none disabled:cursor-not-allowed placeholder:text-blue-300"
                  style={{ width: `${Math.max(parsed.number.length + 1, 3)}ch` }}
                />
                {parsed.suffix && (
                  <span className="text-[10px] text-blue-400 select-none shrink-0">{parsed.suffix}</span>
                )}
              </>
            ) : (
              <input
                type="text"
                value={rawValue}
                disabled={readOnly}
                placeholder="Especificación del cliente..."
                onChange={(e) => handleCellChange(rowId, col.key, e.target.value)}
                onFocus={e => e.target.select()}
                className="flex-1 min-w-0 text-[10px] text-center bg-transparent border-none outline-none focus:outline-none disabled:cursor-not-allowed placeholder:text-blue-300"
              />
            )}
          </div>
          {factoryVal && (
            <div className="text-[9px] font-semibold text-blue-600 bg-blue-50 rounded px-1 py-0.5 mt-0.5 truncate" title={`Especificación de fábrica: ${displayFactoryVal}`}>
              Ref. fábrica: {displayFactoryVal}
            </div>
          )}
        </div>
      );
    }

    // ── Conclusión manual (marcada en la biblioteca) ────────────────────────
    // Fila con manualConclusion=true + columna pass_fail: el ingeniero elige
    // Cumple/No cumple/N/A visualmente. Tiene prioridad sobre cualquier vs_spec.
    if (col.type === 'pass_fail' && templateRow?.manualConclusion === true) {
      if (isPrint) {
        return (
          <span className={`text-[10px] font-semibold ${rawValue === 'PASS' ? 'text-emerald-700' : rawValue === 'FAIL' ? 'text-red-700' : 'text-slate-500'}`}>
            {(PASS_PRINT_CHARS[rawValue] ?? rawValue) || '—'}
          </span>
        );
      }
      return (
        <select
          value={rawValue}
          disabled={readOnly}
          onChange={(e) => handleCellChange(rowId, col.key, e.target.value)}
          className={`w-full text-[10px] border border-slate-300 rounded px-1 py-0.5 bg-white disabled:bg-slate-50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-blue-500 ${PASS_COLORS[rawValue] ?? 'text-slate-600'}`}
        >
          <option value="">—</option>
          <option value="PASS">Cumple</option>
          <option value="FAIL">No cumple</option>
          <option value="NA">N/A</option>
        </select>
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
      // "N/A" se trata como placeholder, no como label read-only — para que el técnico
      // pueda completar el valor aunque el template marque N/A en una fila y vacío en otras.
      const isNA = /^n\/?a$/i.test(trimmed);
      const hasContent = trimmed.length > 0 &&
        /[0-9A-Za-zÀ-ÖØ-öø-ÿ]/.test(trimmed) && !isJustUnit && !isNA;
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
    <div className={`catalog-table-rowsafe mb-6 ${isPrint ? 'rounded-xl border border-slate-200' : `rounded-xl border shadow-sm overflow-hidden bg-white ${isCompletedStyle ? 'border-emerald-300' : 'border-slate-200'}`}`}>

      {/* Encabezado de tabla (ocultar si showTitle === false) */}
      {table.showTitle !== false ? (
      <div className={`flex items-center justify-between px-3 gap-3 ${compact ? 'py-1.5' : 'py-2'} ${isCompletedStyle ? 'bg-emerald-50 border-b border-emerald-200' : 'bg-slate-50 border-b border-slate-200'}`}>
        <AccordionHeaderChrome isCompact={accordionActive} expanded={expanded} onToggle={toggle} completed={completed}>
          <p className={`font-semibold truncate ${compact ? 'text-xs text-slate-900' : 'text-sm text-slate-900'}`}>
            {table.name}
          </p>
          {table.description && !isPrint && (
            <p className="text-xs text-slate-500 mt-0.5 truncate">{table.description}</p>
          )}
        </AccordionHeaderChrome>

        <div className="flex items-center gap-3 shrink-0">
          {/* Toggle "Ver especificación del cliente" — en mobile accordion va al body, en desktop queda en el header */}
          {table.allowClientSpec && !isPrint && !groupingField && !accordionActive && (
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

          {/* Menú mostrar/ocultar columnas (solo si hay columnas ocultables) */}
          {!isPrint && !readOnly && hasHiddenCapableCols && onChangeColumnVisibility && (
            <ColumnVisibilityMenu
              open={showColMenu}
              setOpen={setShowColMenu}
              columns={table.columns}
              isColumnVisible={isColumnVisible}
              onToggle={(key, vis) => onChangeColumnVisibility(selection.tableId, key, vis)}
            />
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
      ) : accordionActive ? (
        /* Mobile accordion: forzar título aunque showTitle === false (necesario para el header clickeable) */
        <div className={`flex items-center justify-between px-3 gap-3 py-2 ${isCompletedStyle ? 'bg-emerald-50 border-b border-emerald-200' : 'bg-slate-50 border-b border-slate-200'}`}>
          <AccordionHeaderChrome isCompact={accordionActive} expanded={expanded} onToggle={toggle} completed={completed}>
            <p className="font-semibold truncate text-sm text-slate-900">{table.name}</p>
          </AccordionHeaderChrome>
          <div className="flex items-center gap-2 shrink-0">
            {onDuplicate && (
              <button onClick={() => onDuplicate(selection.tableId)}
                className="text-slate-400 hover:text-teal-600 transition-colors p-1" title="Duplicar tabla">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            )}
            {onRemove && (
              <button onClick={() => onRemove(selection.tableId)}
                className="text-slate-400 hover:text-red-500 transition-colors p-1" title="Quitar tabla">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      ) : !isPrint && !readOnly && onRemove ? (
        /* Desktop con título oculto: solo botones */
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

      <div hidden={!showBody}>

      {/* Toggle "Ver especificación del cliente" — solo visible en mobile accordion (en desktop va arriba) */}
      {table.allowClientSpec && !isPrint && !groupingField && accordionActive && (
        <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/60">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={clientSpecEnabled}
              disabled={readOnly}
              onChange={(e) => onToggleClientSpec?.(selection.tableId, e.target.checked)}
              className="w-4 h-4 accent-blue-600 cursor-pointer"
            />
            <span className="text-xs font-medium text-slate-700">
              Especificaciones ampliadas por el cliente
            </span>
          </label>
        </div>
      )}

      {/* Campos de encabezado (selectores pre-tabla) */}
      {/* Cuando hay groupingField, solo mostrar el groupingField aquí; los demás van por instancia */}
      {(table.headerFields ?? []).filter(hf => isHeaderFieldVisible(hf) && (!groupingField || hf.fieldId === groupingField.fieldId)).length > 0 && (
        <div className="flex flex-wrap gap-4 px-3 py-2 border-b border-slate-200 bg-white">
          {(table.headerFields ?? []).filter(hf => isHeaderFieldVisible(hf) && (!groupingField || hf.fieldId === groupingField.fieldId)).map(hf => {
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
                {(() => {
                  const selectedVals = getSelectedHeaderValues(hf.fieldId);
                  const isMulti = hf.multiSelect && (hf.inputType ?? 'select') === 'select';
                  const displayMulti = isMulti ? selectedVals.join(', ') : '';
                  if (isPrint) {
                    return (
                      <span className="text-[9px]">
                        {(isMulti
                          ? (displayMulti || '—')
                          : (hf.inputType === 'number' ? value : printValue) || '—')}
                        {hf.inputType === 'number' && value && hf.unit ? ` ${hf.unit}` : ''}
                      </span>
                    );
                  }
                  if (readOnly) {
                    return (
                      <span className="text-xs text-slate-600">
                        {(isMulti ? displayMulti : value) || '—'}
                        {hf.inputType === 'number' && value && hf.unit ? ` ${hf.unit}` : ''}
                      </span>
                    );
                  }
                  if (isMulti) {
                    return (
                      <MultiSelectHeaderDropdown
                        label={hf.label}
                        options={hf.options}
                        selected={selectedVals}
                        onToggle={(opt) => toggleHeaderValue(hf.fieldId, opt)}
                      />
                    );
                  }
                  return null;
                })()}
                {!isPrint && !readOnly && !hf.multiSelect && hf.inputType === 'number' ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="any"
                      value={value}
                      placeholder={hf.placeholder ?? ''}
                      onChange={e => onChangeHeaderData?.(selection.tableId, hf.fieldId, e.target.value)}
                      className="border border-slate-300 rounded px-2 py-1 text-xs bg-white focus:ring-1 focus:ring-blue-500 outline-none w-24"
                    />
                    {hf.unit && <span className="text-[10px] text-slate-500">{hf.unit}</span>}
                  </div>
                ) : (!isPrint && !readOnly && !hf.multiSelect && (hf.inputType ?? 'select') === 'select') ? (
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
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {/* Tabla */}
      <div className={isPrint ? '' : readOnly ? '' : 'overflow-x-auto'}>
        {(() => {
          // Usar table-layout: fixed para tablas de validación con 5+ columnas (print y edición)
          // Las tablas informacionales (2-3 cols) funcionan mejor con auto
          const useFixedLayout = table.tableType === 'validation' && visibleColumns.length >= 5;
          const hasExplicitWidths = !useFixedLayout && visibleColumns.some(c => c.width);
          const tableLayout = useFixedLayout || hasExplicitWidths ? 'fixed' as const : undefined;
          return (
        <table className="w-full text-left border-collapse" data-catalog-table-id={selection.tableId} style={{ tableLayout }}>
          {(() => {
            if (useFixedLayout) {
              // Validación con muchas columnas: distribuir proporcionalmente
              const weights = visibleColumns.map(c => {
                if (c.width) return c.width;
                const label = (c.label ?? '') + (c.unit ? ` (${c.unit})` : '');
                return Math.max(label.length * 1.5, 8);
              });
              const total = weights.reduce((a, b) => a + b, 0);
              return (
                <colgroup>
                  {visibleColumns.map((col, i) => (
                    <col key={col.key} style={{ width: `${(weights[i] / total * 100).toFixed(1)}%` }} />
                  ))}
                </colgroup>
              );
            }
            return (
              <colgroup>
                {visibleColumns.map(col => (
                  <col key={col.key} style={col.width ? { width: `${col.width}mm` } : undefined} />
                ))}
              </colgroup>
            );
          })()}
          <thead>
            {(() => {
              const groups = visibleGroups;
              const hasGroups = groups.length > 0;
              const groupTitle = table.columnGroupTitle ?? null;
              // Set de índices de columna cubiertos por un grupo
              const groupedCols = new Set<number>();
              groups.forEach(g => { for (let i = g.startCol; i < g.startCol + g.span; i++) groupedCols.add(i); });

              const thClass = (colIdx: number) =>
                `px-1 font-semibold align-middle ${isPrint ? 'py-2 text-[8px] leading-tight' : compact ? 'py-1 text-[8px] leading-tight' : useFixedLayout ? 'py-1 text-[10px] leading-tight' : 'py-1.5 text-xs'} text-center ${
                  `text-slate-600${colIdx < visibleColumns.length - 1 ? ' border-r border-slate-200' : ''}`
                }`;
              const thStyle: React.CSSProperties = isPrint || useFixedLayout ? { overflowWrap: 'anywhere', wordBreak: 'break-word' } : {};

              const titleRow = groupTitle ? (
                <tr className="bg-slate-100">
                  <th colSpan={visibleColumns.length}
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
                      {visibleColumns.map((col, colIdx) => (
                        <th key={col.key} className={`${thClass(colIdx)} ${col.align === 'right' ? '!text-right' : ''}`}
                          style={{ ...thStyle, ...(col.width ? { width: `${col.width}mm` } : {}) }}>
                          {col.label || null}
                          {col.label && col.unit && <span className={`font-normal ml-1 ${isPrint ? 'text-slate-300' : 'text-slate-400'}`}>({col.unit})</span>}
                          {col.headerEditable && (() => {
                            const _hv = selection.columnHeaderData?.[col.key] ?? '';
                            const _pc = isPrint ? 'text-slate-500' : 'text-slate-400';
                            return (
                              <span className="inline-block whitespace-nowrap ml-1 font-normal align-baseline">
                                <span className={_pc}>(</span>
                                {isPrint || readOnly ? (
                                  <span>{_hv}</span>
                                ) : (
                                  <input
                                    type="text"
                                    maxLength={15}
                                    value={_hv}
                                    onChange={(e) => onChangeColumnHeader?.(selection.tableId, col.key, e.target.value.slice(0, 15))}
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-block border-b border-slate-400 bg-transparent text-xs font-normal focus:outline-none focus:border-blue-500 m-0 min-w-0"
                                    style={{ width: `${Math.max(_hv.length, 1)}ch`, padding: 0, minWidth: '1ch' }}
                                  />
                                )}
                                <span className={_pc}>)</span>
                              </span>
                            );
                          })()}
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
                    {visibleColumns.map((col, colIdx) => {
                      // Si esta columna es parte de un grupo pero NO es la primera del grupo, skip
                      if (groupedCols.has(colIdx)) {
                        const group = groups.find(g => g.startCol === colIdx);
                        if (!group) return null; // columna interior del grupo, skip
                        // Primera columna del grupo: render el grupo con colspan
                        const lastGroupColIdx = group.startCol + group.span - 1;
                        return (
                          <th key={`group-${colIdx}`} colSpan={group.span}
                            className={`${thClass(lastGroupColIdx)} ${isPrint ? '' : 'border-b border-slate-200'}`}
                            style={thStyle}>
                            {group.label}
                          </th>
                        );
                      }
                      // Columna no agrupada: rowSpan=2
                      return (
                        <th key={col.key} rowSpan={2}
                          className={`${thClass(colIdx)} ${col.align === 'right' ? '!text-right' : ''} ${isPrint ? '' : 'border-b border-slate-200'}`}
                          style={{ ...thStyle, ...(col.width ? { width: `${col.width}mm` } : {}) }}>
                          {col.label || null}
                          {col.label && col.unit && <span className={`font-normal ml-1 ${isPrint ? 'text-slate-300' : 'text-slate-400'}`}>({col.unit})</span>}
                          {col.headerEditable && (() => {
                            const _hv = selection.columnHeaderData?.[col.key] ?? '';
                            const _pc = isPrint ? 'text-slate-500' : 'text-slate-400';
                            return (
                              <span className="inline-block whitespace-nowrap ml-1 font-normal align-baseline">
                                <span className={_pc}>(</span>
                                {isPrint || readOnly ? (
                                  <span>{_hv}</span>
                                ) : (
                                  <input
                                    type="text"
                                    maxLength={15}
                                    value={_hv}
                                    onChange={(e) => onChangeColumnHeader?.(selection.tableId, col.key, e.target.value.slice(0, 15))}
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-block border-b border-slate-400 bg-transparent text-xs font-normal focus:outline-none focus:border-blue-500 m-0 min-w-0"
                                    style={{ width: `${Math.max(_hv.length, 1)}ch`, padding: 0, minWidth: '1ch' }}
                                  />
                                )}
                                <span className={_pc}>)</span>
                              </span>
                            );
                          })()}
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
                      visibleColumns.slice(g.startCol, g.startCol + g.span).map((col, i) => {
                        const colIdx = g.startCol + i;
                        const isLastInGroup = i === g.span - 1;
                        const isLastCol = colIdx === visibleColumns.length - 1;
                        return (
                          <th key={col.key}
                            className={`${thClass(colIdx)} ${col.align === 'right' ? '!text-right' : ''} ${!isPrint && isLastInGroup && !isLastCol ? 'border-r border-slate-200' : ''}`}
                            style={{ ...thStyle, ...(col.width ? { width: `${col.width}mm` } : {}) }}>
                            {col.label || null}
                            {col.label && col.unit && <span className={`font-normal ml-1 ${isPrint ? 'text-slate-300' : 'text-slate-400'}`}>({col.unit})</span>}
                            {col.headerEditable && (() => {
                              const _hv = selection.columnHeaderData?.[col.key] ?? '';
                              const _pc = isPrint ? 'text-slate-500' : 'text-slate-400';
                              return (
                                <span className="inline-block whitespace-nowrap ml-1 font-normal align-baseline">
                                  <span className={_pc}>(</span>
                                  {isPrint || readOnly ? (
                                    <span>{_hv}</span>
                                  ) : (
                                    <input
                                      type="text"
                                      maxLength={15}
                                      value={_hv}
                                      onChange={(e) => onChangeColumnHeader?.(selection.tableId, col.key, e.target.value.slice(0, 15))}
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-block border-b border-slate-400 bg-transparent text-xs font-normal focus:outline-none focus:border-blue-500 m-0 min-w-0"
                                      style={{ width: `${Math.max(_hv.length, 1)}ch`, padding: 0, minWidth: '1ch' }}
                                    />
                                  )}
                                  <span className={_pc}>)</span>
                                </span>
                              );
                            })()}
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
                for (const col of visibleColumns) {
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
                const r = table.templateRows[rowIdx];
                if (!r) return false;
                return visibleColumns.some(col => spanAt(r, col.key) > 1);
              };
              // Borde separador: se dibuja tanto al iniciar un merge como al salir de uno
              // (fila standalone que viene después de un bloque fusionado).
              const hasMergeBoundaryAbove = (rowIdx: number): boolean => {
                if (rowIdx === 0) return false;
                if (isGroupStart(rowIdx)) return true;
                const prevRow = table.templateRows[rowIdx - 1];
                if (!prevRow) return false;
                return visibleColumns.some(col =>
                  spanAt(prevRow, col.key) > 1 || coveredCells.has(`${rowIdx - 1}:${col.key}`)
                );
              };
              // Construir lista de filas con dividers por grupo (multi-select header)
              type RowItem = { kind: 'row'; row: typeof table.templateRows[number]; origIdx: number; instanceValue?: string }
                           | { kind: 'divider'; value: string; id: string };
              const items: RowItem[] = [];
              const rowMatchesGroup = (row: typeof table.templateRows[number], groupVal: string): boolean => {
                if (!row.visibleWhenSelector) return false;
                if (groupingField && row.visibleWhenSelector.headerFieldId === groupingField.fieldId) {
                  return row.visibleWhenSelector.values.includes(groupVal);
                }
                return false;
              };
              if (groupingField && groupingSelectedValues.length >= 2) {
                // Primero, filas sin visibleWhenSelector o que NO usan el grouping field
                table.templateRows.forEach((row, origIdx) => {
                  if (row.visibleWhenSelector && row.visibleWhenSelector.headerFieldId === groupingField.fieldId) return;
                  if (!shouldShowRow(row)) return;
                  items.push({ kind: 'row', row, origIdx });
                });
                // Luego, un grupo por cada valor seleccionado. Cada fila se asigna a UN solo grupo
                // (el primero que matchee), para evitar duplicación de rowId.
                const placed = new Set<string>();
                for (const groupVal of groupingSelectedValues) {
                  const groupRows = table.templateRows
                    .map((row, origIdx) => ({ row, origIdx }))
                    .filter(({ row }) => rowMatchesGroup(row, groupVal) && !placed.has(row.rowId));
                  if (groupRows.length === 0) continue;
                  items.push({ kind: 'divider', value: groupVal, id: `div-${groupingField.fieldId}-${groupVal}` });
                  for (const { row, origIdx } of groupRows) {
                    items.push({ kind: 'row', row, origIdx, instanceValue: groupVal });
                    placed.add(row.rowId);
                  }
                }
              } else {
                table.templateRows.forEach((row, origIdx) => {
                  if (!shouldShowRow(row)) return;
                  items.push({ kind: 'row', row, origIdx });
                });
              }
              return items.map((item) => {
              if (item.kind === 'divider') {
                const instVal = item.value;
                const instHeaders = getInstanceHeaderFields(instVal);
                const instClientSpec = getInstanceClientSpec(instVal);
                return (
                  <React.Fragment key={item.id}>
                    <tr className="bg-teal-50 border-y border-teal-200">
                      <td colSpan={visibleColumns.length} className="px-3 py-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-bold text-teal-800 uppercase tracking-wide">
                            {instVal}
                          </span>
                          {/* Toggle specs por instancia */}
                          {table.allowClientSpec && !isPrint && !readOnly && (
                            <label className="flex items-center gap-1.5 cursor-pointer select-none shrink-0">
                              <input
                                type="checkbox"
                                checked={instClientSpec}
                                onChange={(e) => onToggleClientSpec?.(selection.tableId, e.target.checked, instVal)}
                                className="w-3 h-3 accent-blue-600 cursor-pointer"
                              />
                              <span className="text-[9px] font-medium text-slate-500">
                                Especificaciones ampliadas por el cliente
                              </span>
                            </label>
                          )}
                        </div>
                        {/* Headers internos de esta instancia */}
                        {instHeaders.length > 0 && (
                          <div className="flex flex-wrap gap-3 mt-1.5">
                            {instHeaders.map(hf => {
                              const hfValue = getInstanceHeaderValue(instVal, hf.fieldId);
                              return (
                                <div key={hf.fieldId} className="flex items-center gap-1.5">
                                  {hf.label?.trim() && (
                                    <span className={`font-semibold ${isPrint ? 'text-[9px]' : 'text-[10px] text-slate-600'}`}>
                                      {hf.label}:
                                    </span>
                                  )}
                                  {isPrint || readOnly ? (
                                    <span className="text-[10px] text-slate-600">{hfValue || '—'}</span>
                                  ) : (hf.inputType ?? 'select') === 'select' ? (
                                    <select
                                      value={hfValue}
                                      onChange={(e) => onChangeHeaderData?.(selection.tableId, hf.fieldId, e.target.value, instVal)}
                                      className="text-[10px] border border-slate-300 rounded px-1.5 py-0.5 bg-white"
                                    >
                                      <option value="">Seleccionar...</option>
                                      {hf.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                  ) : (
                                    <input
                                      type="number"
                                      value={hfValue}
                                      onChange={(e) => onChangeHeaderData?.(selection.tableId, hf.fieldId, e.target.value, instVal)}
                                      placeholder={hf.placeholder ?? ''}
                                      className="w-20 text-[10px] border border-slate-300 rounded px-1.5 py-0.5 bg-white text-center"
                                    />
                                  )}
                                  {hf.inputType === 'number' && hf.unit && (
                                    <span className="text-[10px] text-slate-400">{hf.unit}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    </tr>
                  </React.Fragment>
                );
              }
              const row = item.row;
              const idx = item.origIdx;
              if (row.isTitle) {
                return (
                  <tr key={row.rowId} className="bg-slate-50">
                    <td
                      colSpan={visibleColumns.length}
                      className="px-2 py-1 font-semibold text-xs text-slate-700 border-b border-slate-200"
                    >
                      {row.titleText ?? ''}
                    </td>
                  </tr>
                );
              }
              if (row.isSelector) {
                const selectorValue = selection.filledData[row.rowId]?.['_selector_'] ?? '';
                const isDup = row.rowId.startsWith('dup_');
                const canDuplicate = !!row.duplicableEnProtocolo && !!onDuplicateRow && !readOnly && !isPrint;
                const canRemove = isDup && !!onRemoveRow && !readOnly && !isPrint;
                return (
                  <tr
                    key={row.rowId}
                    className={isPrint
                      ? `border-b border-slate-200${idx % 2 === 0 ? '' : ' bg-slate-50'}`
                      : `${idx % 2 === 0 ? '' : 'bg-slate-50/50'} hover:bg-blue-50/30 transition-colors`
                    }
                  >
                    {(() => {
                      // Si selectorColumn está definido y > 0: label en col 0, dropdown en selectorColumn
                      // Si no: label + dropdown juntos en col 0, resto editables
                      const splitSelector = (row.selectorColumn ?? 0) > 0;
                      const dropdownCol = row.selectorColumn ?? 0;
                      return visibleColumns.map((col, colIdx) => {
                        // La columna del label (col 0) siempre va a la izquierda.
                        // Las demás respetan col.align configurado en el catálogo (default: center).
                        const alignClass = colIdx === 0
                          ? 'text-left'
                          : col.align === 'left' ? 'text-left' : col.align === 'right' ? 'text-right' : 'text-center';
                        const isLastCol = colIdx === visibleColumns.length - 1;
                        const showActionsHere = isLastCol && (canDuplicate || canRemove);
                        return (
                        <td
                          key={col.key}
                          data-col-label={col.label || ''}
                          className={`px-2 py-1.5 align-middle ${alignClass} ${isPrint ? 'text-[10px]' : 'text-xs'}${colIdx < visibleColumns.length - 1 ? ' border-r border-slate-100' : ''}${showActionsHere ? ' relative pr-4' : ''}`}
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
                                  onChange={(e) => onChangeData(selection.tableId, row.rowId, '_selector_', e.target.value)}
                                  className="w-full text-[10px] border border-slate-300 rounded px-1 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                  <option value="">Seleccionar...</option>
                                  {(row.selectorOptions ?? []).map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              )
                            ) : (
                              renderTableCell(col, row.rowId, item.kind === 'row' ? item.instanceValue : undefined)
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
                                    onChange={(e) => onChangeData(selection.tableId, row.rowId, '_selector_', e.target.value)}
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
                              renderTableCell(col, row.rowId, item.kind === 'row' ? item.instanceValue : undefined)
                            )
                          )}
                          {showActionsHere && (
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-0.5 whitespace-nowrap">
                              {canDuplicate && (
                                <button
                                  onClick={() => onDuplicateRow!(selection.tableId, row.rowId)}
                                  className="text-teal-500 hover:text-teal-700 transition-colors"
                                  title="Duplicar fila"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                </button>
                              )}
                              {canRemove && (
                                <button
                                  onClick={() => onRemoveRow!(selection.tableId, row.rowId)}
                                  className="text-slate-300 hover:text-red-500 transition-colors"
                                  title="Quitar fila duplicada"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        );
                      });
                    })()}
                  </tr>
                );
              }
              const isExtra = row.rowId.startsWith('extra_');
              const isDup = row.rowId.startsWith('dup_');
              const canDuplicate = !!row.duplicableEnProtocolo && !!onDuplicateRow && !readOnly && !isPrint;
              const canRemoveDup = isDup && !!onRemoveRow && !readOnly && !isPrint;
              const groupStart = isGroupStart(idx);
              const boundaryAbove = hasMergeBoundaryAbove(idx);
              return (
                <tr
                  key={row.rowId}
                  className={isPrint
                    ? `border-b border-slate-200${idx % 2 === 0 ? '' : ' bg-slate-50'}`
                    : `${idx % 2 === 0 ? '' : 'bg-slate-50/50'} hover:bg-blue-50/30 transition-colors`
                  }
                >
                  {(() => {
                    const hasActions = canDuplicate || canRemoveDup || (isExtra && !readOnly && !isPrint && !!onRemoveRow);
                    // Última celda renderizada (última columna no cubierta por un span).
                    let lastRenderedIdx = -1;
                    for (let i = visibleColumns.length - 1; i >= 0; i--) {
                      if (!coveredCells.has(`${idx}:${visibleColumns[i].key}`)) { lastRenderedIdx = i; break; }
                    }
                    return visibleColumns.map((col, colIdx) => {
                      if (coveredCells.has(`${idx}:${col.key}`)) return null;
                      const colSpan = spanAt(row, col.key);
                      const isSpanning = colSpan > 1;
                      const colHasSpansElsewhere = table.templateRows.some(r => spanAt(r, col.key) > 1);
                      const isGroupCell = isSpanning || (groupStart && colHasSpansElsewhere && !coveredCells.has(`${idx}:${col.key}`));
                      const isLabelCol = colIdx === 0 || col.align === 'left';
                      const alignCls = col.align === 'left' ? 'text-left' : col.align === 'right' ? 'text-right' : 'text-center';
                      const groupStyle = isGroupCell && !isLabelCol ? ` font-semibold` : '';
                      const showActionsHere = hasActions && colIdx === lastRenderedIdx;
                      return (
                        <td
                          key={col.key}
                          data-col-label={col.label || ''}
                          rowSpan={isSpanning ? colSpan : undefined}
                          className={[
                            `px-2 ${compact ? 'py-1' : 'py-1.5'} align-middle`,
                            `${isPrint ? 'text-[10px]' : 'text-xs'}${colIdx < visibleColumns.length - 1 ? ' border-r border-slate-100' : ''}${isPrint ? '' : ' border-b border-b-slate-100'}${groupStyle}`,
                            alignCls,
                            !isPrint && boundaryAbove ? 'border-t border-t-slate-300' : '',
                            showActionsHere ? 'relative pr-4' : '',
                          ].join(' ')}
                        >
                          {renderTableCell(col, row.rowId, item.kind === 'row' ? item.instanceValue : undefined)}
                          {showActionsHere && (
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-0.5 whitespace-nowrap">
                              {canDuplicate && (
                                <button
                                  onClick={() => onDuplicateRow!(selection.tableId, row.rowId)}
                                  className="text-teal-500 hover:text-teal-700 transition-colors"
                                  title="Duplicar fila"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                </button>
                              )}
                              {(canRemoveDup || (isExtra && !readOnly && !isPrint && onRemoveRow)) && (
                                <button
                                  onClick={() => onRemoveRow!(selection.tableId, row.rowId)}
                                  className="text-slate-300 hover:text-red-500 transition-colors"
                                  title={canRemoveDup ? 'Quitar fila duplicada' : 'Quitar fila'}
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    });
                  })()}
                </tr>
              );
            });
            })()}
          </tbody>
        </table>
          );
        })()}
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

      {accordionActive && expanded && <AccordionConfirmButton onConfirm={markCompleted} completed={completed} />}

      </div>
    </div>
  );
};
