import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';
import { useTabOverlay } from '../../contexts/TabOverlayContext';

// ── Types ──
interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>;

/** Destino de portal capturado en el call site de useConfirm (scope de pestaña). */
interface OverlayTarget {
  root: HTMLElement;
  getIsActive: () => boolean;
}

type InternalConfirmFn = (options: ConfirmOptions | string, overlay?: OverlayTarget | null) => Promise<boolean>;

// ── Context ──
const ConfirmContext = createContext<InternalConfirmFn | null>(null);

/**
 * Hook to show a non-blocking confirmation dialog.
 * Returns a function that resolves to true (confirmed) or false (cancelled).
 *
 * El provider vive a nivel app (fuera de las pestañas), así que el scope de
 * pestaña se captura ACÁ (call site) y viaja con cada pedido: el diálogo se
 * portalea dentro de la pestaña que lo pidió y queda esperando ahí si el
 * usuario se va a otra pestaña.
 *
 * Usage:
 *   const confirm = useConfirm();
 *   const ok = await confirm('¿Eliminar este item?');
 *   if (!ok) return;
 */
export function useConfirm(): ConfirmFn {
  const base = useContext(ConfirmContext);
  const tabOverlay = useTabOverlay();
  const root = tabOverlay?.overlayRoot ?? null;
  const getIsActive = tabOverlay?.getIsTabActive ?? null;
  const fn = useMemo<ConfirmFn | null>(() => {
    if (!base) return null;
    const overlay: OverlayTarget | null = root && getIsActive ? { root, getIsActive } : null;
    return (options) => base(options, overlay);
  }, [base, root, getIsActive]);
  if (!fn) throw new Error('useConfirm must be used within ConfirmDialogProvider');
  return fn;
}

// ── Provider ──
interface PendingConfirm {
  id: number;
  options: ConfirmOptions;
  overlay: OverlayTarget | null;
  resolve: (value: boolean) => void;
}

let nextConfirmId = 1;

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  // Lista (no singleton): un confirm esperando en una pestaña oculta no debe
  // ser pisado por un confirm abierto en otra pestaña.
  const [pendings, setPendings] = useState<PendingConfirm[]>([]);

  const confirm: InternalConfirmFn = useCallback((optionsOrMessage, overlay = null) => {
    const options: ConfirmOptions =
      typeof optionsOrMessage === 'string'
        ? { message: optionsOrMessage }
        : optionsOrMessage;

    return new Promise<boolean>((resolve) => {
      setPendings(prev => [...prev, { id: nextConfirmId++, options, overlay, resolve }]);
    });
  }, []);

  const handleResolve = useCallback((entry: PendingConfirm, value: boolean) => {
    entry.resolve(value);
    setPendings(prev => prev.filter(p => p !== entry));
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pendings.map(p => (
        <ConfirmDialogView key={p.id} pending={p} onResolve={handleResolve} />
      ))}
    </ConfirmContext.Provider>
  );
}

// ── Vista de un diálogo pendiente ──
function ConfirmDialogView({
  pending,
  onResolve,
}: {
  pending: PendingConfirm;
  onResolve: (entry: PendingConfirm, value: boolean) => void;
}) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const scoped = pending.overlay !== null;
  // Chequeo VIVO (getter): el provider es global y no re-renderiza al cambiar
  // de pestaña, así que la actividad se consulta en el momento del evento.
  const isTabActive = () => !pending.overlay || pending.overlay.getIsActive();

  useEffect(() => {
    if (isTabActive()) requestAnimationFrame(() => confirmBtnRef.current?.focus());

    // Focus trap + Escape/Enter keyboard handling — solo si la pestaña dueña
    // está activa (con dos pestañas con confirm abierto, cada tecla debe
    // afectar solo al diálogo visible).
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isTabActive()) return;
      if (e.key === 'Escape') { onResolve(pending, false); return; }
      if (e.key === 'Enter') { onResolve(pending, true); return; }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, onResolve]);

  return createPortal(
    // Scoped: absolute dentro del wrapper de la pestaña — mismo nodo host que
    // Modal (z-[70]); z-[80] garantiza que el confirm quede SIEMPRE adelante.
    <div
      className={`${scoped ? 'absolute' : 'fixed'} inset-0 bg-black/50 flex items-center justify-center z-[80] p-4`}
      role={isTabActive() ? 'dialog' : undefined}
      aria-modal={isTabActive() ? 'true' : undefined}
    >
      <div ref={dialogRef} className="w-full max-w-sm bg-white rounded-xl shadow-xl overflow-hidden">
        <div className="px-5 pt-4 pb-3 bg-teal-700">
          <h3 className="text-base font-serif font-semibold text-white tracking-tight">
            {pending.options.title || 'Confirmar acción'}
          </h3>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{pending.options.message}</p>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 bg-[#F0F0F0] border-t border-[#E5E5E5]">
          <Button variant="secondary" size="sm" onClick={() => onResolve(pending, false)}>
            {pending.options.cancelLabel || 'Cancelar'}
          </Button>
          <button
            ref={confirmBtnRef}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${
              pending.options.danger
                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                : 'bg-teal-700 hover:bg-teal-800 focus:ring-teal-500'
            }`}
            onClick={() => onResolve(pending, true)}
          >
            {pending.options.confirmLabel || 'Confirmar'}
          </button>
        </div>
      </div>
    </div>,
    pending.overlay?.root ?? document.body,
  );
}
