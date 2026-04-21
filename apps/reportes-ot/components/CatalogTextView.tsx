import React from 'react';
import type { ProtocolSelection } from '../types/tableCatalog';
import { useAccordionCard } from '../hooks/useAccordionCard';
import { useIsCompact } from '../hooks/useIsMobile';
import { AccordionHeaderChrome, AccordionConfirmButton } from './protocol/AccordionChrome';

interface Props {
  selection: ProtocolSelection;
  readOnly?: boolean;
  isPrint?: boolean;
  onRemove?: (tableId: string) => void;
  onChangeData?: (tableId: string, rowId: string, colKey: string, value: string) => void;
}

/** Parsea texto con variables {nombre} y devuelve fragmentos de texto y variables */
function parseTextWithVars(text: string): Array<{ type: 'text'; value: string } | { type: 'var'; name: string }> {
  const parts: Array<{ type: 'text'; value: string } | { type: 'var'; name: string }> = [];
  const regex = /\{([^}]+)\}/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'var', name: match[1] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }
  return parts;
}

/** Renderiza contenido HTML con soporte para variables {nombre} como inputs inline */
function TextContentWithVars({
  html,
  filledData,
  tableId,
  readOnly,
  isPrint,
  onChangeData,
  className,
}: {
  html: string;
  filledData: Record<string, Record<string, string>>;
  tableId: string;
  readOnly: boolean;
  isPrint: boolean;
  onChangeData?: (tableId: string, rowId: string, colKey: string, value: string) => void;
  className?: string;
}) {
  const hasVars = /\{[^}]+\}/.test(html);

  if (!hasVars) {
    return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
  }

  // Extraer texto plano del HTML para parsear variables
  const tempDiv = typeof document !== 'undefined' ? document.createElement('div') : null;
  if (tempDiv) tempDiv.innerHTML = html;
  const plainText = tempDiv?.textContent ?? html.replace(/<[^>]*>/g, '');
  const parts = parseTextWithVars(plainText);
  const ROW_KEY = '_text_vars_';

  return (
    <div className={className}>
      {parts.map((part, i) => {
        if (part.type === 'text') {
          return <span key={i}>{part.value}</span>;
        }
        const varKey = part.name.toLowerCase().replace(/\s+/g, '_');
        const value = filledData[ROW_KEY]?.[varKey] ?? '';
        if (isPrint) {
          return (
            <span key={i} className="font-semibold">
              {value || '___'}
            </span>
          );
        }
        return (
          <input
            key={i}
            type="text"
            value={value}
            disabled={readOnly}
            placeholder={part.name}
            onChange={(e) => onChangeData?.(tableId, ROW_KEY, varKey, e.target.value)}
            className="inline-block border-b border-blue-400 bg-blue-50/50 text-center px-1 mx-0.5 outline-none focus:border-blue-600 focus:bg-blue-50 disabled:bg-transparent disabled:border-slate-300"
            style={{ width: `${Math.max(value.length + 2, part.name.length + 2)}ch`, fontSize: 'inherit' }}
          />
        );
      })}
    </div>
  );
}

export const CatalogTextView: React.FC<Props> = ({
  selection,
  readOnly = false,
  isPrint = false,
  onRemove,
  onChangeData,
}) => {
  const table = selection.tableSnapshot;
  const textContent = table.textContent ?? '';
  const isInline = (table.textDisplayMode ?? 'card') === 'inline';

  // ─── Modo inline: texto suelto sin recuadro ───────────────────────────
  if (isInline) {
    return (
      <div className={`mb-4 ${isPrint ? '' : 'relative group'}`}>
        {!isPrint && !readOnly && onRemove && (
          <button
            onClick={() => onRemove(selection.tableId)}
            className="absolute -right-2 -top-2 text-slate-300 hover:text-red-500 transition-colors p-1 opacity-0 group-hover:opacity-100 z-10"
            title="Quitar sección"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {table.name && (
          <p className={`font-semibold mb-1 ${isPrint ? 'text-[10px]' : 'text-sm text-slate-900'}`}>
            {table.name}
          </p>
        )}

        <TextContentWithVars
          html={textContent}
          filledData={selection.filledData}
          tableId={selection.tableId}
          readOnly={readOnly}
          isPrint={isPrint}
          onChangeData={onChangeData}
          className={`catalog-text-content ${isPrint ? 'text-[9px] leading-snug' : 'text-xs leading-relaxed text-slate-700'}`}
        />
      </div>
    );
  }

  // ─── Modo card: con encabezado y borde (default) ──────────────────────
  const isCompact = useIsCompact();
  const { expanded, toggle, completed, markCompleted } = useAccordionCard(selection.tableId);
  const accordionActive = isCompact && !isPrint && !readOnly;
  const showBody = !accordionActive || expanded;
  const isCompletedStyle = accordionActive && completed;

  return (
    <div className={`mb-6 ${isPrint ? 'border border-slate-300' : `rounded-xl border shadow-sm overflow-hidden ${isCompletedStyle ? 'border-emerald-300' : 'border-slate-200'}`} bg-white`}>
      <div className={`flex items-center justify-between px-3 py-2 gap-3 ${isPrint ? 'border-b border-slate-300' : isCompletedStyle ? 'bg-emerald-50 border-b border-emerald-200' : 'bg-slate-50 border-b border-slate-200'}`}>
        <AccordionHeaderChrome isCompact={accordionActive} expanded={expanded} onToggle={toggle} completed={completed}>
          <p className={`font-semibold truncate ${isPrint ? 'text-[10px]' : 'text-sm text-slate-900'}`}>
            {table.name}
          </p>
          {table.description && !isPrint && (
            <p className="text-xs text-slate-500 mt-0.5 truncate">{table.description}</p>
          )}
        </AccordionHeaderChrome>

        <div className="flex items-center gap-3 shrink-0">
          {!isPrint && !readOnly && onRemove && (
            <button
              onClick={() => onRemove(selection.tableId)}
              className="text-slate-400 hover:text-red-500 transition-colors p-1"
              title="Quitar sección"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div hidden={!showBody}>
        <TextContentWithVars
          html={textContent}
          filledData={selection.filledData}
          tableId={selection.tableId}
          readOnly={readOnly}
          isPrint={isPrint}
          onChangeData={onChangeData}
          className={`catalog-text-content px-3 py-2 ${isPrint ? 'text-[9px] leading-snug' : 'text-xs leading-relaxed text-slate-700'}`}
        />
        {accordionActive && expanded && <AccordionConfirmButton onConfirm={markCompleted} completed={completed} />}
      </div>
    </div>
  );
};
