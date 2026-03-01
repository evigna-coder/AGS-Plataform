import type { TableCatalogColumn, ProtocolSelection } from '../types/tableCatalog';

// ─── Auto-cómputo de Conclusión ───────────────────────────────────────────────

/**
 * Evalúa si un valor medido cumple una especificación textual.
 * Soporta: rangos (95 – 105), NMT/NLT, >, <, >=, <=, número exacto, N/A.
 * Retorna: 'PASS' | 'FAIL' | 'NA' | '' (vacío = no se pudo determinar)
 */
function computeConclusion(resultado: string, spec: string): 'PASS' | 'FAIL' | 'NA' | '' {
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
    const m = str.match(/(\d+[.,]\d+|\d+)/);
    return m ? parseFloat(m[0].replace(',', '.')) : NaN;
  };

  // Rango: "95.0 – 105.0" | "95 - 105"
  const rangeMatch = s.match(/(\d+[.,]?\d*)\s*[–\-]\s*(\d+[.,]?\d*)/);
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
}

const RESULTADO_LABELS: Record<ProtocolSelection['resultado'], string> = {
  CONFORME: 'Conforme',
  NO_CONFORME: 'No conforme',
  PENDIENTE: 'Pendiente',
};

const RESULTADO_COLORS: Record<ProtocolSelection['resultado'], string> = {
  CONFORME: 'text-green-700 bg-green-50 border-green-300',
  NO_CONFORME: 'text-red-700 bg-red-50 border-red-300',
  PENDIENTE: 'text-amber-700 bg-amber-50 border-amber-300',
};

const PASS_LABELS: Record<string, string> = {
  PASS: 'Cumple',
  FAIL: 'No cumple',
  NA: 'N/A',
};

const PASS_PRINT_CHARS: Record<string, string> = {
  PASS: '✓',
  FAIL: '✗',
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
): React.ReactNode {
  const rawValue = filledData[rowId]?.[col.key] ?? '';

  if (col.type === 'fixed_text') {
    return <span className="text-[10px] text-slate-600">{col.fixedValue ?? ''}</span>;
  }

  if (col.type === 'checkbox') {
    const checked = rawValue === 'true' || rawValue === '1';
    if (isPrint) return <span className="text-[11px]">{checked ? '✓' : '☐'}</span>;
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
    v.trim().length > 0 && !/[0-9A-Za-zÀ-ÖØ-öø-ÿ]/.test(v.trim());

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
      <span className="text-[10px]">
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

  if (!effectiveUnit) {
    return (
      <input
        type="text"
        value={displayValue}
        disabled={readOnly}
        placeholder={placeholder}
        onChange={handleChange}
        className="w-full text-[10px] border border-slate-300 rounded bg-white disabled:bg-slate-50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-300 px-1 py-0.5"
      />
    );
  }

  // Input con unidad fija integrada: parece un solo campo, la unidad no es editable
  return (
    <div className={`flex items-center border border-slate-300 rounded bg-white px-1 py-0.5 gap-0.5 focus-within:ring-1 focus-within:ring-blue-500 ${readOnly ? 'bg-slate-50' : ''}`}>
      <input
        type="text"
        value={displayValue}
        disabled={readOnly}
        placeholder={placeholder}
        onChange={handleChange}
        className="flex-1 min-w-0 text-[10px] bg-transparent border-none outline-none focus:outline-none disabled:cursor-not-allowed placeholder:text-slate-300"
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
  onChangeResultado,
  onToggleClientSpec,
  onRemove,
}) => {
  const table = selection.tableSnapshot;
  const clientSpecEnabled = selection.clientSpecEnabled ?? false;

  // Extraer la regla vs_spec si existe
  const vsSpecRule = table.validationRules?.find(r => r.operator === 'vs_spec');
  const specColKey = vsSpecRule
    ? (vsSpecRule.specColumn ?? String(vsSpecRule.factoryThreshold))
    : null;
  const resultadoColKey = vsSpecRule?.sourceColumn ?? null;
  const conclusionColKey = vsSpecRule?.targetColumn ?? null;

  /** Valor de fábrica para cualquier columna y fila (del template) */
  const getFactoryValue = (rowId: string, colKey: string): string => {
    const row = table.templateRows.find(r => r.rowId === rowId);
    return row ? String(row.cells?.[colKey] ?? '') : '';
  };

  /** Valor de fábrica del campo especificación para una fila (del template) */
  const getFactorySpec = (rowId: string): string => getFactoryValue(rowId, specColKey ?? '');

  // Detectar unidad de la columna Resultado a partir de los valores de Especificación
  // Ej: "≤ 0.500 %" → "%", "≤ 1.500 mL" → "mL"
  const resultadoDisplayUnit: string | null = (() => {
    if (!specColKey || !resultadoColKey) return null;
    for (const row of table.templateRows) {
      if (row.isTitle) continue;
      const specVal = String(row.cells?.[specColKey] ?? '').trim();
      if (!specVal) continue;
      const m = specVal.match(/\s([A-Za-z%°][A-Za-z0-9.%°/]{0,8})\s*$/);
      if (m) return m[1].trim();
    }
    return null;
  })();

  /** Especificación activa: del cliente si está habilitada, de fábrica si no */
  const getActiveSpec = (rowId: string): string => {
    if (clientSpecEnabled && specColKey) {
      const clientVal = selection.filledData[rowId]?.[specColKey];
      if (clientVal) return clientVal;
    }
    return getFactorySpec(rowId);
  };

  const handleCellChange = (rowId: string, colKey: string, value: string) => {
    onChangeData(selection.tableId, rowId, colKey, value);

    // Auto-computar conclusión si cambió resultado o especificación del cliente
    if (vsSpecRule && conclusionColKey && resultadoColKey) {
      const isResultadoChange = colKey === resultadoColKey;
      const isSpecChange = colKey === specColKey && clientSpecEnabled;

      if (isResultadoChange || isSpecChange) {
        const currentResultado = isResultadoChange
          ? value
          : (selection.filledData[rowId]?.[resultadoColKey] ?? '');
        const currentSpec = isSpecChange
          ? value
          : getActiveSpec(rowId);
        const conclusion = computeConclusion(currentResultado, currentSpec);
        if (conclusion !== '') {
          onChangeData(selection.tableId, rowId, conclusionColKey, conclusion);
        }
      }
    }
  };

  /** Renderiza una celda con lógica especial para columnas spec y conclusion */
  const renderTableCell = (col: TableCatalogColumn, rowId: string): React.ReactNode => {
    const rawValue = selection.filledData[rowId]?.[col.key] ?? '';

    // ── Columna Especificación ──────────────────────────────────────────────
    if (col.key === specColKey) {
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
              className="flex-1 min-w-0 text-[10px] bg-transparent border-none outline-none focus:outline-none disabled:cursor-not-allowed placeholder:text-blue-300"
            />
            {col.unit && (
              <span className="text-[10px] text-blue-400 select-none shrink-0 pointer-events-none">
                {col.unit}
              </span>
            )}
          </div>
          {factoryVal && (
            <div className="text-[9px] text-slate-400 truncate" title={`Fábrica: ${factoryVal}`}>
              Ref. fábrica: {factoryVal}
            </div>
          )}
        </div>
      );
    }

    // ── Columna Conclusión (pass_fail calculado) ────────────────────────────
    if (col.key === conclusionColKey) {
      if (isPrint) {
        return (
          <span className="text-[10px]">
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

    // ── Columnas con valor de fábrica fijo (ej. Parámetro) ─────────────────
    // Si la columna tiene valor en templateRows y NO es una columna especial
    // (resultado/spec/conclusión), se muestra como texto de solo lectura.
    const isSpecialCol =
      col.key === specColKey ||
      col.key === resultadoColKey ||
      col.key === conclusionColKey;

    if (!isSpecialCol) {
      const factoryVal = getFactoryValue(rowId, col.key);
      // Solo aplicar si el valor tiene contenido alfanumérico real (no solo símbolos)
      const hasContent = factoryVal.trim().length > 0 &&
        /[0-9A-Za-zÀ-ÖØ-öø-ÿ]/.test(factoryVal.trim());
      if (hasContent) {
        if (isPrint) return <span className="text-[10px]">{factoryVal}</span>;
        return <span className="text-[10px] text-slate-700 cursor-default">{factoryVal}</span>;
      }
    }

    // ── Resto de columnas (Resultado y otras editables) ─────────────────────
    // Para la columna Resultado, inyectar la unidad detectada de las especificaciones
    const colForRender =
      col.key === resultadoColKey && !col.unit && resultadoDisplayUnit
        ? { ...col, unit: resultadoDisplayUnit }
        : col;
    return renderDefaultCell(colForRender, rowId, selection.filledData, readOnly, isPrint, handleCellChange);
  };

  return (
    <div className={`mb-6 ${isPrint ? '' : 'rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white'}`}>

      {/* Encabezado de tabla */}
      <div className={`flex items-center justify-between px-3 py-2 gap-3 ${isPrint ? 'border-b border-slate-300' : 'bg-slate-50 border-b border-slate-200'}`}>
        <div className="min-w-0">
          <p className={`font-semibold truncate ${isPrint ? 'text-[10px]' : 'text-sm text-slate-900'}`}>
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
                Ver especificación del cliente
              </span>
            </label>
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

      {/* Tabla */}
      <div className={isPrint ? '' : 'overflow-x-auto'}>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className={isPrint ? 'border-b border-slate-300' : 'bg-slate-100 border-b border-slate-200'}>
              {table.columns.map(col => (
                <th
                  key={col.key}
                  className={`px-2 py-1.5 font-semibold text-slate-600 whitespace-nowrap ${isPrint ? 'text-[8.5px] border border-slate-300' : 'text-xs border-r border-slate-200'}`}
                >
                  {col.label}
                  {col.unit && <span className="font-normal text-slate-400 ml-1">({col.unit})</span>}
                  {col.required && !isPrint && <span className="text-red-400 ml-0.5">*</span>}
                  {/* Indicador visual de columna calculada */}
                  {col.key === conclusionColKey && !isPrint && (
                    <span className="ml-1 text-blue-400 font-normal text-[9px]">auto</span>
                  )}
                  {/* Indicador de especificación bloqueada / cliente */}
                  {col.key === specColKey && !isPrint && (
                    <span className="ml-1 text-slate-400 font-normal text-[9px]">
                      {clientSpecEnabled ? '✎' : '🔒'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.templateRows.map((row, idx) => {
              if (row.isTitle) {
                return (
                  <tr key={row.rowId} className={isPrint ? 'border-b border-slate-200' : 'bg-slate-50'}>
                    <td
                      colSpan={table.columns.length}
                      className={`px-2 py-1 font-semibold ${isPrint ? 'text-[9px] border border-slate-300' : 'text-xs text-slate-700 border-b border-slate-200'}`}
                    >
                      {row.titleText ?? ''}
                    </td>
                  </tr>
                );
              }
              return (
                <tr
                  key={row.rowId}
                  className={isPrint
                    ? 'border-b border-slate-200'
                    : `${idx % 2 === 0 ? '' : 'bg-slate-50/50'} hover:bg-blue-50/30 transition-colors`
                  }
                >
                  {table.columns.map(col => (
                    <td
                      key={col.key}
                      className={`px-2 py-1.5 align-middle ${isPrint ? 'text-[9px] border border-slate-300' : 'text-xs border-r border-slate-100'}`}
                    >
                      {renderTableCell(col, row.rowId)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer edit: resultado + observaciones */}
      {!isPrint && (
        <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Resultado:</span>
            <div className="flex gap-1">
              {(['CONFORME', 'NO_CONFORME', 'PENDIENTE'] as const).map(r => (
                <button
                  key={r}
                  disabled={readOnly}
                  onClick={() => onChangeResultado?.(selection.tableId, r)}
                  className={`text-xs px-2 py-0.5 rounded border font-medium transition-colors disabled:cursor-not-allowed ${
                    selection.resultado === r
                      ? RESULTADO_COLORS[r]
                      : 'border-slate-200 text-slate-400 bg-white hover:bg-slate-50'
                  }`}
                >
                  {RESULTADO_LABELS[r]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Observaciones..."
              value={selection.observaciones ?? ''}
              disabled={readOnly}
              onChange={(e) => onChangeObservaciones?.(selection.tableId, e.target.value)}
              className="w-full text-xs border border-slate-200 rounded px-2 py-1 bg-white disabled:bg-slate-50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-300"
            />
          </div>
        </div>
      )}

      {/* Footer print: resultado + observaciones */}
      {isPrint && (selection.resultado !== 'PENDIENTE' || selection.observaciones) && (
        <div className="px-2 py-1 border-t border-slate-200 flex gap-4">
          <span className="text-[9px] text-slate-600">
            <strong>Resultado:</strong> {RESULTADO_LABELS[selection.resultado]}
          </span>
          {selection.observaciones && (
            <span className="text-[9px] text-slate-600">
              <strong>Obs.:</strong> {selection.observaciones}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
