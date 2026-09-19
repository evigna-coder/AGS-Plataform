import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';

export interface MenuButtonItem {
  label: string;
  onClick: () => void;
  /** Tilde a la izquierda: convierte el menú en uno de selección múltiple. */
  checked?: boolean;
  /** No cerrar al elegir — necesario para marcar varias opciones seguidas. */
  keepOpen?: boolean;
  /** Línea divisoria por encima del item. */
  separador?: boolean;
}

interface Props {
  /** Texto del botón disparador (se le agrega el caret ▾). */
  label: string;
  items: MenuButtonItem[];
  /** Deshabilita el disparador (ej. lista vacía en ExportarButton). */
  disabled?: boolean;
  /** Tooltip del disparador. */
  title?: string;
  /** Disparador chico para menús de fila (2026-09-18); el menú se abre alineado a la derecha. */
  compacto?: boolean;
  /** Texto del disparador compacto (default "⋯"). */
  disparador?: string;
  /** Contenido del disparador compacto (ej. un badge): reemplaza a `disparador`. */
  children?: ReactNode;
}

/**
 * Botón que despliega un menú de acciones — para agrupar acciones secundarias
 * de un header (ej. "Configuración ▾" en listas). Portal + click-outside + Escape,
 * mismo patrón que ColMenu.
 */
export const MenuButton: React.FC<Props> = ({ label, items, disabled, title, compacto = false, disparador = '⋯', children }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const toggle = () => {
    if (open) { setOpen(false); return; }
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Compacto: alineado al borde derecho del disparador, sin salirse de la ventana.
    const left = compacto ? Math.max(8, Math.min(rect.right - 190, window.innerWidth - 200)) : rect.left;
    setPos({ top: rect.bottom + 4, left });
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
        {compacto && children ? (
          <button type="button" onClick={toggle} disabled={disabled} title={title ?? label} aria-label={title ?? label}
            className={`inline-flex items-center rounded-full leading-none disabled:opacity-40 ${open ? 'ring-2 ring-teal-400' : 'hover:ring-2 hover:ring-slate-300'}`}>
            {children}
          </button>
        ) : compacto ? (
          <button type="button" onClick={toggle} disabled={disabled} title={title ?? label} aria-label={title ?? label}
            className="text-sm font-bold text-slate-400 hover:text-slate-700 px-1 py-0.5 rounded hover:bg-slate-100 leading-none disabled:opacity-40">
            {disparador}
          </button>
        ) : (
          <Button size="sm" variant="outline" onClick={toggle} disabled={disabled} title={title}>
            {label} <span className="text-[9px] ml-0.5">▾</span>
          </Button>
        )}
      </span>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[60] w-max min-w-[190px] max-w-sm bg-white border border-slate-200 rounded-lg shadow-lg py-1"
          style={{ top: pos.top, left: pos.left }}
        >
          {items.map(item => (
            <button
              key={item.label}
              type="button"
              onClick={() => { if (!item.keepOpen) setOpen(false); item.onClick(); }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 hover:text-teal-700 ${
                item.separador ? 'border-t border-slate-100 mt-1 pt-2' : ''
              } ${item.checked ? 'text-teal-700 font-medium' : 'text-slate-600'}`}
            >
              {item.checked !== undefined && (
                <span className="inline-block w-3 mr-1.5 font-mono">{item.checked ? '✓' : ''}</span>
              )}
              {item.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
};
