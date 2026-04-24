import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ColAlign } from '../../hooks/useResizableColumns';

interface Props {
  align: ColAlign;
  onAlign: (a: ColAlign) => void;
  onHide: () => void;
}

export interface ColMenuHandle {
  /** Abre el menú en coordenadas absolutas de viewport (e.g. desde un context menu). */
  openAt: (x: number, y: number) => void;
}

const ALIGN_LABELS: Record<ColAlign, string> = {
  left: 'Izquierda',
  center: 'Centrada',
  right: 'Derecha',
};

const ALIGN_PATHS: Record<ColAlign, string> = {
  left:   'M3 6h18M3 12h12M3 18h16',
  center: 'M3 6h18M6 12h12M4 18h16',
  right:  'M3 6h18M9 12h12M5 18h16',
};

export const ColMenu = forwardRef<ColMenuHandle, Props>(({ align, onAlign, onHide }, ref) => {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useImperativeHandle(ref, () => ({
    openAt: (x, y) => {
      setPos({ top: y, left: x });
      setOpen(true);
    },
  }), []);

  const openFromButton = () => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); if (open) setOpen(false); else openFromButton(); }}
        title="Opciones de columna (click derecho en el header también)"
        aria-label="Opciones de columna"
        className="absolute left-0.5 top-0.5 p-0.5 rounded hover:bg-slate-200/60 text-slate-400 hover:text-teal-700 transition-colors"
      >
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[60] min-w-[150px] bg-white border border-slate-200 rounded-lg shadow-lg py-1"
          style={{ top: pos.top, left: pos.left }}
        >
          <div className="px-2 py-1 text-[9px] font-mono uppercase tracking-wide text-slate-400">Alinear</div>
          {(['left', 'center', 'right'] as ColAlign[]).map(a => (
            <button
              key={a}
              onClick={(e) => { e.stopPropagation(); onAlign(a); setOpen(false); }}
              className={`w-full text-left px-2 py-1 text-xs hover:bg-slate-100 flex items-center gap-2 ${
                align === a ? 'text-teal-700 font-semibold' : 'text-slate-600'
              }`}
            >
              <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={ALIGN_PATHS[a]} />
              </svg>
              {ALIGN_LABELS[a]}
            </button>
          ))}
          <div className="h-px bg-slate-100 my-1" />
          <button
            onClick={(e) => { e.stopPropagation(); onHide(); setOpen(false); }}
            className="w-full text-left px-2 py-1 text-xs hover:bg-slate-100 flex items-center gap-2 text-slate-600"
          >
            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
            </svg>
            Ocultar columna
          </button>
        </div>,
        document.body,
      )}
    </>
  );
});
