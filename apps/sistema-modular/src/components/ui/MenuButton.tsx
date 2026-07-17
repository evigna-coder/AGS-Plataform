import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';

export interface MenuButtonItem {
  label: string;
  onClick: () => void;
}

interface Props {
  /** Texto del botón disparador (se le agrega el caret ▾). */
  label: string;
  items: MenuButtonItem[];
}

/**
 * Botón que despliega un menú de acciones — para agrupar acciones secundarias
 * de un header (ej. "Configuración ▾" en listas). Portal + click-outside + Escape,
 * mismo patrón que ColMenu.
 */
export const MenuButton: React.FC<Props> = ({ label, items }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const toggle = () => {
    if (open) { setOpen(false); return; }
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ top: rect.bottom + 4, left: rect.left });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || wrapRef.current?.contains(t)) return;
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
      <span ref={wrapRef}>
        <Button size="sm" variant="outline" onClick={toggle}>
          {label} <span className="text-[9px] ml-0.5">▾</span>
        </Button>
      </span>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[60] min-w-[190px] bg-white border border-slate-200 rounded-lg shadow-lg py-1"
          style={{ top: pos.top, left: pos.left }}
        >
          {items.map(item => (
            <button
              key={item.label}
              type="button"
              onClick={() => { setOpen(false); item.onClick(); }}
              className="w-full text-left px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 hover:text-teal-700"
            >
              {item.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
};
