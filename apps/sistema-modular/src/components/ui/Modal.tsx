import { ReactNode, useEffect, useRef, useState, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  children: ReactNode;
  footer?: ReactNode;
  /** Si true, un click en el fondo oscuro cierra el modal. Default: false */
  closeOnBackdropClick?: boolean;
  /** Si true, el modal se puede minimizar. Default: true */
  minimizable?: boolean;
}

const widthMap = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-6xl',
};

// Global registry for minimized modals — shared across all Modal instances
let minimizedModals: { id: string; title: string; restore: () => void }[] = [];
let notifyListeners: (() => void)[] = [];
function subscribe(fn: () => void) { notifyListeners.push(fn); return () => { notifyListeners = notifyListeners.filter(f => f !== fn); }; }
function notifyAll() { notifyListeners.forEach(fn => fn()); }

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  subtitle,
  maxWidth = 'md',
  children,
  footer,
  closeOnBackdropClick = false,
  minimizable = true,
}) => {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [minimized, setMinimized] = useState(false);
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const bodyRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const didAutoFocus = useRef(false);
  const modalId = useRef(`modal-${Math.random().toString(36).slice(2, 8)}`);

  // Reset position, minimized state, and auto-focus flag when modal opens
  useEffect(() => {
    if (open) {
      setOffset({ x: 0, y: 0 });
      setMinimized(false);
      didAutoFocus.current = false;
    }
  }, [open]);

  // Register/unregister from minimized registry
  useEffect(() => {
    const id = modalId.current;
    if (open && minimized) {
      const entry = { id, title, restore: () => setMinimized(false) };
      minimizedModals = [...minimizedModals.filter(m => m.id !== id), entry];
      notifyAll();
    } else {
      minimizedModals = minimizedModals.filter(m => m.id !== id);
      notifyAll();
    }
    return () => {
      minimizedModals = minimizedModals.filter(m => m.id !== id);
      notifyAll();
    };
  }, [open, minimized, title]);

  // Auto-focus first interactive field once when modal opens
  useLayoutEffect(() => {
    if (!open || minimized || didAutoFocus.current || !bodyRef.current) return;
    didAutoFocus.current = true;
    requestAnimationFrame(() => {
      const focusable = bodyRef.current?.querySelector<HTMLElement>(
        'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
      );
      focusable?.focus();
    });
  }, [open, minimized]);

  useEffect(() => {
    if (!open || minimized) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // If user is typing in an input, blur it first — second Escape will close
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        (e.target as HTMLElement).blur();
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      e.stopImmediatePropagation();
      onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, minimized, onClose]);

  // Focus trap — keep Tab within the modal
  useEffect(() => {
    if (!open || minimized) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusables = dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [open, minimized]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    dragging.current = true;
    dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    e.preventDefault();
  }, [offset]);

  useEffect(() => {
    if (!open || minimized) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setOffset({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y,
      });
    };
    const handleMouseUp = () => { dragging.current = false; };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [open, minimized]);

  if (!open || minimized) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`modal-title-${modalId.current}`}
      onClick={closeOnBackdropClick ? onClose : undefined}
    >
      <div
        ref={dialogRef}
        className={`w-full ${widthMap[maxWidth]} bg-[#FAFAFA] rounded-xl shadow-xl flex flex-col max-h-[90vh] relative`}
        style={{ left: `${offset.x}px`, top: `${offset.y}px` }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="shrink-0 flex items-center justify-between px-5 pt-4 pb-3 bg-teal-700 rounded-t-xl border-b border-teal-800 cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleMouseDown}
        >
          <div>
            <h3 id={`modal-title-${modalId.current}`} className="text-lg font-serif font-semibold text-white tracking-tight">{title}</h3>
            {subtitle && <p className="text-[11px] font-mono text-teal-100/70 mt-0.5 uppercase tracking-wider">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-1">
            {minimizable && (
              <button
                onClick={() => setMinimized(true)}
                className="w-7 h-7 flex items-center justify-center rounded-md text-teal-200 hover:text-white hover:bg-teal-800 transition-colors"
                title="Minimizar"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-md text-teal-200 hover:text-white hover:bg-teal-800 transition-colors"
              title="Cerrar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div
          ref={bodyRef}
          className="flex-1 overflow-y-auto px-5 py-4"
        >{children}</div>

        {footer && (
          <div className="shrink-0 flex justify-end gap-2 px-5 py-3 bg-[#F0F0F0] rounded-b-xl border-t border-[#E5E5E5]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

/**
 * Barra de modales minimizados — renderizar una vez en Layout.
 * Muestra chips en la parte inferior con los modales minimizados.
 */
export const MinimizedModalsBar: React.FC = () => {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    return subscribe(() => forceUpdate(n => n + 1));
  }, []);

  if (minimizedModals.length === 0) return null;

  return createPortal(
    <div className="fixed bottom-0 left-0 right-0 z-[60] flex gap-2 px-4 py-2 pointer-events-none">
      {minimizedModals.map(m => (
        <button
          key={m.id}
          onClick={m.restore}
          className="pointer-events-auto flex items-center gap-2 bg-teal-700 text-white text-xs font-medium px-3 py-2 rounded-t-lg shadow-lg hover:bg-teal-600 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
          {m.title}
        </button>
      ))}
    </div>,
    document.body
  );
};
