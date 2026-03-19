import type { ProtocolSelection, ChecklistItem, ChecklistItemAnswer } from '../types/tableCatalog';

interface Props {
  selection: ProtocolSelection;
  readOnly?: boolean;
  isPrint?: boolean;
  onChangeData: (tableId: string, itemId: string, answer: ChecklistItemAnswer) => void;
  onChangeObservaciones?: (tableId: string, value: string) => void;
  onChangeResultado?: (tableId: string, value: ProtocolSelection['resultado']) => void;
  onToggleSection?: (tableId: string, itemId: string, isNA: boolean) => void;
  onRemove?: (tableId: string) => void;
}

const RESULTADO_COLORS = {
  CONFORME: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  NO_CONFORME: 'bg-red-100 text-red-800 border-red-300',
  PENDIENTE: 'bg-amber-100 text-amber-800 border-amber-300',
};

const RESULTADO_LABELS = {
  CONFORME: 'Conforme',
  NO_CONFORME: 'No Conforme',
  PENDIENTE: 'Pendiente',
};

// ─── Helper: detectar si un ítem está dentro de una sección N/A ───────────────
function buildNASet(items: ChecklistItem[], collapsedSections: string[]): Set<string> {
  const collapsed = new Set(collapsedSections);
  const naItems = new Set<string>();
  let naUntilDepth: number | null = null;

  for (const item of items) {
    // Si encontramos una sección al mismo nivel o superior, resetear el bloque NA
    if (naUntilDepth !== null && item.depth <= naUntilDepth) {
      naUntilDepth = null;
    }
    if (collapsed.has(item.itemId)) {
      naUntilDepth = item.depth;
      naItems.add(item.itemId);
    } else if (naUntilDepth !== null && item.depth > naUntilDepth) {
      naItems.add(item.itemId);
    }
  }
  return naItems;
}

// ─── Renderizado de un ítem ───────────────────────────────────────────────────
function ChecklistItemRow({
  item,
  answer,
  isNA,
  readOnly,
  isPrint,
  onAnswer,
}: {
  item: ChecklistItem;
  answer: ChecklistItemAnswer | undefined;
  isNA: boolean;
  readOnly: boolean;
  isPrint: boolean;
  onAnswer: (a: ChecklistItemAnswer) => void;
}) {
  const indent = item.depth * 16;
  const disabled = readOnly || isNA;

  // Cabeceras (depth 0): divider sin control de respuesta
  if (item.depth === 0) {
    return (
      <div className="w-full bg-slate-50 border-y border-slate-200 text-[10px] font-bold text-slate-800 tracking-wide px-3 py-1.5 mt-2">
        {item.label}
      </div>
    );
  }

  const isInline = item.itemType === 'value_input';
  const labelEl = (
    <span className={`text-[11px] leading-snug ${isNA ? 'line-through text-slate-400' : 'text-slate-700'} ${isInline ? 'shrink-0' : 'flex-1'}`}>
      {item.numberPrefix && (
        <span className="font-mono text-slate-400 mr-1.5">{item.numberPrefix}</span>
      )}
      {item.label}
    </span>
  );

  // ── selector ──────────────────────────────────────────────────────────────
  if (item.itemType === 'selector') {
    const selected = (answer as { itemType: 'selector'; selected: string } | undefined)?.selected ?? '';
    if (isPrint) {
      return (
        <div className="flex items-center gap-2 py-1 px-3 bg-slate-50 border-b border-slate-200" style={{ paddingLeft: `${indent + 8}px` }}>
          {labelEl}
          <span className="text-[11px] font-bold text-indigo-700">{selected || '—'}</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 py-1.5 px-2 bg-slate-50/50" style={{ paddingLeft: `${indent + 8}px` }}>
        {labelEl}
        <select
          value={selected}
          disabled={disabled}
          onChange={e => onAnswer({ itemType: 'selector', selected: e.target.value })}
          className="text-[11px] border border-slate-300 rounded px-2 py-1 bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed"
        >
          <option value="">Seleccionar...</option>
          {(item.selectorOptions ?? []).map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    );
  }

  // ── checkbox ────────────────────────────────────────────────────────────────
  if (item.itemType === 'checkbox') {
    const checked = (answer as { itemType: 'checkbox'; checked: boolean } | undefined)?.checked ?? false;
    if (isPrint) {
      return (
        <div className="flex items-start gap-2.5 py-0.5" style={{ paddingLeft: `${indent + 8}px` }}>
          <span className={`shrink-0 mt-px w-[14px] h-[14px] border-2 rounded-sm flex items-center justify-center ${
            isNA ? 'border-slate-300 bg-slate-100' : checked ? 'border-slate-700 bg-slate-700' : 'border-slate-400 bg-white'
          }`}>
            {isNA ? <span className="text-[9px] text-slate-400 font-bold leading-none">—</span>
              : checked ? <span className="text-[10px] text-white font-bold leading-none">✓</span>
              : null}
          </span>
          {labelEl}
        </div>
      );
    }
    return (
      <label className={`flex items-start gap-2.5 py-1 px-2 rounded cursor-pointer hover:bg-slate-50 ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        style={{ paddingLeft: `${indent + 8}px` }}>
        <input
          type="checkbox"
          className="mt-0.5 shrink-0 w-4 h-4 accent-slate-700 rounded"
          checked={checked}
          disabled={disabled}
          onChange={e => onAnswer({ itemType: 'checkbox', checked: e.target.checked })}
        />
        {labelEl}
      </label>
    );
  }

  // ── value_input ──────────────────────────────────────────────────────────────
  if (item.itemType === 'value_input') {
    const value = (answer as { itemType: 'value_input'; value: string } | undefined)?.value ?? '';
    if (isPrint) {
      return (
        <div className="flex items-center gap-2 py-0.5" style={{ paddingLeft: `${indent + 8}px` }}>
          {labelEl}
          <span className="text-[11px] font-mono border-b border-slate-400 min-w-[60px] text-center">
            {isNA ? 'N/A' : value || '___'}
          </span>
          {item.unit && <span className="text-[10px] text-slate-500">{item.unit}</span>}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1 py-1 px-2" style={{ paddingLeft: `${indent + 8}px` }}>
        {labelEl}
        <input
          type="text"
          className="text-[11px] bg-transparent border-none outline-none border-b border-slate-300 w-24 shrink-0 disabled:cursor-not-allowed"
          value={isNA ? '' : value}
          disabled={disabled}
          placeholder={isNA ? 'N/A' : '___'}
          onChange={e => onAnswer({ itemType: 'value_input', value: e.target.value })}
        />
        {item.unit && <span className="text-[10px] text-slate-400 select-none pointer-events-none">{item.unit}</span>}
      </div>
    );
  }

  // ── pass_fail ────────────────────────────────────────────────────────────────
  if (item.itemType === 'pass_fail') {
    const result = (answer as { itemType: 'pass_fail'; result: string } | undefined)?.result ?? '';
    if (isPrint) {
      const label = isNA ? 'N/A' : result === 'CUMPLE' ? 'Cumple' : result === 'NO_CUMPLE' ? 'No cumple' : '—';
      return (
        <div className="flex items-center gap-1 py-0.5 border-b border-slate-100"
          style={{ paddingLeft: `${indent + 8}px` }}>
          {labelEl}
          <span className={`text-[11px] font-bold shrink-0 ${result === 'CUMPLE' ? 'text-emerald-700' : result === 'NO_CUMPLE' ? 'text-red-700' : 'text-slate-400'}`}>
            {label}
          </span>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-between gap-2 py-1 px-2" style={{ paddingLeft: `${indent + 8}px` }}>
        {labelEl}
        {isNA ? (
          <span className="text-[10px] text-slate-400 italic shrink-0">N/A</span>
        ) : (
          <div className="flex rounded border border-slate-200 overflow-hidden shrink-0">
            {(['CUMPLE', 'NO_CUMPLE', 'NA'] as const).map(opt => (
              <button
                key={opt}
                disabled={readOnly}
                onClick={() => onAnswer({ itemType: 'pass_fail', result: opt })}
                className={`text-[10px] px-2 py-1 font-medium transition-colors disabled:cursor-not-allowed
                  ${result === opt
                    ? opt === 'CUMPLE' ? 'bg-emerald-600 text-white' : opt === 'NO_CUMPLE' ? 'bg-red-600 text-white' : 'bg-slate-500 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                  } border-r border-slate-200 last:border-r-0`}
              >
                {opt === 'CUMPLE' ? 'Cumple' : opt === 'NO_CUMPLE' ? 'No cumple' : 'N/A'}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ─── Componente principal ─────────────────────────────────────────────────────
export const CatalogChecklistView: React.FC<Props> = ({
  selection,
  readOnly = false,
  isPrint = false,
  onChangeData,
  onChangeObservaciones,
  onChangeResultado,
  onToggleSection,
  onRemove,
}) => {
  const { tableSnapshot, checklistData = {}, collapsedSections = [] } = selection;
  const items = tableSnapshot.checklistItems ?? [];
  const naSet = buildNASet(items, collapsedSections);

  const handleAnswer = (itemId: string, answer: ChecklistItemAnswer) => {
    onChangeData(selection.tableId, itemId, answer);
  };

  return (
    <div className={`border border-slate-200 rounded-xl overflow-hidden ${isPrint ? 'mb-4' : ''}`}>
      {/* Cabecera */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-800 tracking-tight">{tableSnapshot.name}</span>
        </div>
        {!readOnly && !isPrint && onRemove && (
          <button onClick={() => onRemove(selection.tableId)}
            className="text-slate-400 hover:text-slate-700 text-xs">× Quitar</button>
        )}
      </div>

      {/* Cuerpo — ítems del checklist */}
      <div className={`bg-white ${isPrint ? '' : 'divide-y divide-slate-50'}`}>
        {items.map(item => {
          // visibleWhen: ocultar si el selector referenciado no tiene alguno de los valores esperados
          if (item.visibleWhen) {
            const selectorAnswer = checklistData[item.visibleWhen.selectorItemId] as
              { itemType: 'selector'; selected: string } | undefined;
            const selectorValue = selectorAnswer?.selected ?? '';
            // Soporte legacy (value: string) y nuevo (values: string[])
            const allowed = (item.visibleWhen as any).values ?? [(item.visibleWhen as any).value];
            if (!allowed.includes(selectorValue)) return null;
          }

          const isNA = naSet.has(item.itemId);
          const answer = checklistData[item.itemId];

          // Sección con N/A toggle (solo modo edición)
          const showNAToggle = !isPrint && !readOnly && item.canBeNA && item.depth >= 1;
          const isCollapsed = collapsedSections.includes(item.itemId);

          if (item.depth === 0) {
            return (
              <ChecklistItemRow
                key={item.itemId} item={item} answer={answer}
                isNA={isNA} readOnly={readOnly} isPrint={isPrint}
                onAnswer={a => handleAnswer(item.itemId, a)}
              />
            );
          }

          return (
            <div key={item.itemId} className="relative">
              {showNAToggle && (
                <div className="absolute right-2 top-1 z-10">
                  <label className="flex items-center gap-1 text-[9px] text-slate-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="w-3 h-3 accent-slate-400"
                      checked={isCollapsed}
                      onChange={e => onToggleSection?.(selection.tableId, item.itemId, e.target.checked)}
                    />
                    No aplica
                  </label>
                </div>
              )}
              <ChecklistItemRow
                item={item} answer={answer}
                isNA={isNA} readOnly={readOnly} isPrint={isPrint}
                onAnswer={a => handleAnswer(item.itemId, a)}
              />
            </div>
          );
        })}

        {items.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-6 italic">Sin ítems en este checklist.</p>
        )}
      </div>

      {/* Footer — Observaciones (solo si hay contenido en print, siempre editable fuera de print) */}
      {!isPrint ? (
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200">
          <div className="flex items-start gap-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase shrink-0 mt-1">Obs.</span>
            <textarea
              className="flex-1 text-[11px] border border-slate-200 rounded p-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:cursor-not-allowed"
              rows={2}
              value={selection.observaciones ?? ''}
              disabled={readOnly}
              placeholder="Observaciones opcionales..."
              onChange={e => onChangeObservaciones?.(selection.tableId, e.target.value)}
            />
          </div>
        </div>
      ) : (
        selection.observaciones && (
          <div className="px-4 py-2 border-t border-slate-200 text-[10px] text-slate-700">
            <span className="font-bold">Observaciones: </span>{selection.observaciones}
          </div>
        )
      )}
    </div>
  );
};
