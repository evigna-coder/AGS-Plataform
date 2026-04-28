import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { pushEscape } from '../../utils/escapeStack';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** Ancho del drawer en desktop. Default: '600px'. En mobile siempre es full width. */
  width?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Panel lateral derecho — alternativa al Modal cuando el usuario necesita ver y
 * usar el contenido detrás (ej. editar una ficha mientras consulta sus fotos).
 *
 * Diferencias clave con Modal:
 * - **Sin backdrop**: el resto de la página queda visible Y interactiva.
 * - **Pegado a la derecha**: ocupa una columna; el detalle a la izquierda no
 *   se mueve.
 * - En mobile (< md) ocupa todo el viewport como un modal tradicional.
 *
 * Usa portal para que su z-index sea independiente del DOM tree origen.
 */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  width = '600px',
  children,
  footer,
}: DrawerProps) {
  // ESC cierra solo si el drawer está en la cima del escape-stack global.
  // Si abrís un lightbox de foto encima, el ESC cierra el lightbox y NO el drawer.
  useEffect(() => {
    if (!open) return;
    return pushEscape(onClose);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <aside
      className="fixed right-0 top-0 bottom-0 z-40 bg-white shadow-2xl border-l border-slate-200 flex flex-col w-full"
      style={{ maxWidth: width }}
      role="dialog"
      aria-modal="false"
    >
      {/* Header */}
      <header className="shrink-0 bg-teal-700 text-white px-5 py-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight truncate">{title}</h2>
          {subtitle && <p className="text-xs text-teal-50/90 mt-0.5 truncate">{subtitle}</p>}
        </div>
        <button
          onClick={onClose}
          className="shrink-0 w-8 h-8 rounded-full hover:bg-white/15 flex items-center justify-center text-xl leading-none"
          aria-label="Cerrar"
          title="Cerrar (ESC)"
        >
          ×
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto bg-[#FAFAFA]">
        {children}
      </div>

      {/* Footer */}
      {footer && (
        <footer className="shrink-0 bg-[#F0F0F0] border-t border-slate-200 px-5 py-3">
          {footer}
        </footer>
      )}
    </aside>,
    document.body,
  );
}
