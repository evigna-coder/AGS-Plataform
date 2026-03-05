import type { ProtocolSelection } from '../types/tableCatalog';

interface Props {
  selection: ProtocolSelection;
  readOnly?: boolean;
  isPrint?: boolean;
  onRemove?: (tableId: string) => void;
}

export const CatalogTextView: React.FC<Props> = ({
  selection,
  readOnly = false,
  isPrint = false,
  onRemove,
}) => {
  const table = selection.tableSnapshot;
  const textContent = table.textContent ?? '';

  return (
    <div className={`mb-6 ${isPrint ? 'border border-slate-300' : 'rounded-xl border border-slate-200 shadow-sm overflow-hidden'} bg-white`}>
      {/* Encabezado */}
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

      {/* Contenido de texto (HTML enriquecido) */}
      <div
        className={`catalog-text-content px-3 py-2 ${isPrint ? 'text-[9px] leading-snug' : 'text-xs leading-relaxed text-slate-700'}`}
        dangerouslySetInnerHTML={{ __html: textContent }}
      />
    </div>
  );
};
