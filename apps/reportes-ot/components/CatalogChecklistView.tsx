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
      <div className="w-full bg-slate-700 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 mt-2">
        {item.label}
      </div>
    );
  }

  const labelEl = (
    <span className={`text-[11px] flex-1 leading-snug ${isNA ? 'line-through text-slate-400' : 'text-slate-700'}`}>
      {item.numberPrefix && (
        <span className="font-mono text-slate-400 mr-1.5">{item.numberPrefix}</span>
      )}
      {item.label}
    </span>
  );

  // ── checkbox ────────────────────────────────────────────────────────────────
  if (item.itemType === 'checkbox') {
    const checked = (answer as { itemType: 'checkbox'; checked: boolean } | undefined)?.checked ?? false;
    if (isPrint) {
      return (
        <div className="flex items-start gap-2 py-0.5" style={{ paddingLeft: `${indent + 8}px` }}>
          <span className="text-[11px] shrink-0 mt-0.5">{isNA ? '—' : checked ? '☑' : '☐'}</span>
          {labelEl}
        </div>
      );
    }
    return (
      <label className={`flex items-start gap-2 py-1 px-2 rounded cursor-pointer hover:bg-slate-50 ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        style={{ paddingLeft: `${indent + 8}px` }}>
        <input
          type="checkbox"
          className="mt-0.5 shrink-0 w-3.5 h-3.5 accent-slate-700"
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
      <div className="flex items-center gap-2 py-1 px-2" style={{ paddingLeft: `${indent + 8}px` }}>
        {labelEl}
        <div className="flex items-center border border-slate-300 rounded bg-white px-1.5 py-0.5 gap-1 focus-within:ring-1 focus-within:ring-blue-500 shrink-0">
          <input
            type="text"
            className="text-[11px] bg-transparent border-none outline-none w-24 disabled:cursor-not-allowed"
            value={isNA ? '' : value}
            disabled={disabled}
            placeholder={isNA ? 'N/A' : '___'}
            onChange={e => onAnswer({ itemType: 'value_input', value: e.target.value })}
          />
          {item.unit && <span className="text-[10px] text-slate-400 select-none pointer-events-none">{item.unit}</span>}
        </div>
      </div>
    );
  }

  // ── pass_fail ────────────────────────────────────────────────────────────────
  if (item.itemType === 'pass_fail') {
    const result = (answer as { itemType: 'pass_fail'; result: string } | undefined)?.result ?? '';
    if (isPrint) {
      const icon = isNA ? 'N/A' : result === 'CUMPLE' ? '✓' : result === 'NO_CUMPLE' ? '✗' : '—';
      return (
        <div className="flex items-center justify-between gap-2 py-0.5 border-b border-slate-100"
          style={{ paddingLeft: `${indent + 8}px` }}>
          {labelEl}
          <span className={`text-[11px] font-bold shrink-0 ${result === 'CUMPLE' ? 'text-emerald-700' : result === 'NO_CUMPLE' ? 'text-red-700' : 'text-slate-400'}`}>
            {icon}
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
      <div className={`flex items-center justify-between px-4 py-2 ${
        isPrint ? 'bg-slate-800 text-white' : 'bg-slate-800 text-white'
      }`}>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wide">{tableSnapshot.name}</span>
          <span className="text-[10px] bg-white/20 rounded px-1.5 py-0.5 uppercase">Checklist</span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${RESULTADO_COLORS[selection.resultado]}`}>
            {RESULTADO_LABELS[selection.resultado]}
          </span>
        </div>
        {!readOnly && !isPrint && onRemove && (
          <button onClick={() => onRemove(selection.tableId)}
            className="text-white/60 hover:text-white text-xs">× Quitar</button>
        )}
      </div>

      {/* Cuerpo — ítems del checklist */}
      <div className={`bg-white ${isPrint ? '' : 'divide-y divide-slate-50'}`}>
        {items.map(item => {
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

      {/* Footer — Observaciones + Resultado */}
      {!isPrint ? (
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase shrink-0">Resultado</span>
            <div className="flex rounded border border-slate-200 overflow-hidden">
              {(['CONFORME', 'NO_CONFORME', 'PENDIENTE'] as const).map(r => (
                <button
                  key={r}
                  disabled={readOnly}
                  onClick={() => onChangeResultado?.(selection.tableId, r)}
                  className={`text-[10px] px-3 py-1.5 font-medium transition-colors disabled:cursor-not-allowed border-r border-slate-200 last:border-r-0
                    ${selection.resultado === r ? RESULTADO_COLORS[r] : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  {RESULTADO_LABELS[r]}
                </button>
              ))}
            </div>
          </div>
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
