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
}

const widthMap = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-6xl',
};

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  subtitle,
  maxWidth = 'md',
  children,
  footer,
  closeOnBackdropClick = false,
}) => {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const bodyRef = useRef<HTMLDivElement>(null);
  const didAutoFocus = useRef(false);

  // Reset position and auto-focus flag when modal opens
  useEffect(() => {
    if (open) {
      setOffset({ x: 0, y: 0 });
      didAutoFocus.current = false;
    }
  }, [open]);

  // Auto-focus first interactive field once when modal opens
  useLayoutEffect(() => {
    if (!open || didAutoFocus.current || !bodyRef.current) return;
    didAutoFocus.current = true;
    requestAnimationFrame(() => {
      const focusable = bodyRef.current?.querySelector<HTMLElement>(
        'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
      );
      focusable?.focus();
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Solo arrastrar desde el header, no desde botones
    if ((e.target as HTMLElement).closest('button')) return;
    dragging.current = true;
    dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    e.preventDefault();
  }, [offset]);

  useEffect(() => {
    if (!open) return;
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
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={closeOnBackdropClick ? onClose : undefined}
    >
      <div
        className={`w-full ${widthMap[maxWidth]} bg-[#FAFAFA] rounded-xl shadow-xl flex flex-col max-h-[90vh]`}
        style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="shrink-0 flex items-center justify-between px-5 pt-4 pb-3 bg-teal-700 rounded-t-xl border-b border-teal-800 cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleMouseDown}
        >
          <div>
            <h3 className="text-lg font-serif font-semibold text-white tracking-tight">{title}</h3>
            {subtitle && <p className="text-[11px] font-mono text-teal-100/70 mt-0.5 uppercase tracking-wider">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-teal-200 hover:text-white hover:bg-teal-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
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
