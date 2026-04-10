import { type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  if (!open) return null;

  // Track where mousedown started so we only close if both mousedown AND mouseup
  // happen on the backdrop. Prevents accidental close when selecting text inside
  // the modal and releasing outside.
  let backdropMouseDown = false;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-3"
      onMouseDown={e => { backdropMouseDown = e.target === e.currentTarget; }}
      onMouseUp={e => { if (backdropMouseDown && e.target === e.currentTarget) onClose(); backdropMouseDown = false; }}
    >
      <div
        className="w-full sm:max-w-md bg-white sm:rounded-xl rounded-t-2xl shadow-xl flex flex-col max-h-[92vh]"
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900 tracking-tight">{title}</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">{children}</div>
        {footer && <div className="shrink-0 flex justify-end gap-2 px-4 py-2.5 border-t border-slate-100">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
