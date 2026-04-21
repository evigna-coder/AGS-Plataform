import React from 'react';

export const AccordionChevron: React.FC<{ expanded: boolean; completed?: boolean }> = ({ expanded, completed }) => (
  <svg
    className={`w-4 h-4 transition-transform shrink-0 ${expanded ? 'rotate-90' : ''} ${completed ? 'text-emerald-500' : 'text-slate-400'}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const CompletedCheck: React.FC = () => (
  <svg
    className="w-4 h-4 text-emerald-600 shrink-0"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-label="Completado"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
);

interface HeaderChromeProps {
  isCompact: boolean;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  completed?: boolean;
  className?: string;
}

/**
 * Wrapper clickeable para el área de título del header accordion.
 * En mobile/tablet dispara toggle; en desktop es pass-through sin cursor pointer.
 */
export const AccordionHeaderChrome: React.FC<HeaderChromeProps> = ({
  isCompact, expanded, onToggle, children, completed, className = '',
}) => {
  if (!isCompact) {
    return <div className={`flex-1 min-w-0 ${className}`}>{children}</div>;
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex-1 min-w-0 text-left flex items-center gap-2 cursor-pointer select-none ${className}`}
      aria-expanded={expanded}
    >
      <AccordionChevron expanded={expanded} completed={completed} />
      {completed && <CompletedCheck />}
      <div className="min-w-0 flex-1">{children}</div>
    </button>
  );
};

interface ConfirmButtonProps {
  onConfirm: () => void;
  label?: string;
  completed?: boolean;
}

export const AccordionConfirmButton: React.FC<ConfirmButtonProps> = ({
  onConfirm, label, completed,
}) => (
  <div className="px-3 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
    <button
      type="button"
      onClick={onConfirm}
      className={`px-4 py-2 text-white text-sm font-semibold rounded-lg shadow-sm active:scale-95 transition ${
        completed ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-teal-700 hover:bg-teal-800'
      }`}
    >
      {label ?? (completed ? 'Actualizar' : 'Confirmar')}
    </button>
  </div>
);

/** Utility hook para armar className del outer wrapper según estado de completitud. */
export function accordionCardBorder(accordionActive: boolean, completed: boolean, base: string): string {
  if (!accordionActive || !completed) return base;
  return base.replace(/border-slate-\d+/g, 'border-emerald-300');
}
