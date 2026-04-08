import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';

// ── Types ──
interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>;

// ── Context ──
const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Hook to show a non-blocking confirmation dialog.
 * Returns a function that resolves to true (confirmed) or false (cancelled).
 *
 * Usage:
 *   const confirm = useConfirm();
 *   const ok = await confirm('¿Eliminar este item?');
 *   if (!ok) return;
 */
export function useConfirm(): ConfirmFn {
  const fn = useContext(ConfirmContext);
  if (!fn) throw new Error('useConfirm must be used within ConfirmDialogProvider');
  return fn;
}

// ── Provider ──
interface PendingConfirm {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm: ConfirmFn = useCallback((optionsOrMessage) => {
    const options: ConfirmOptions =
      typeof optionsOrMessage === 'string'
        ? { message: optionsOrMessage }
        : optionsOrMessage;

    return new Promise<boolean>((resolve) => {
      setPending({ options, resolve });
    });
  }, []);

  const handleResolve = useCallback((value: boolean) => {
    pending?.resolve(value);
    setPending(null);
  }, [pending]);

  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Auto-focus the confirm button when dialog opens
  useEffect(() => {
    if (!pending) return;
    requestAnimationFrame(() => confirmBtnRef.current?.focus());

    // Focus trap + Escape/Enter keyboard handling
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { handleResolve(false); return; }
      if (e.key === 'Enter') { handleResolve(true); return; }

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
  }, [pending, handleResolve]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80] p-4" role="dialog" aria-modal="true">
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
              <Button variant="secondary" size="sm" onClick={() => handleResolve(false)}>
                {pending.options.cancelLabel || 'Cancelar'}
              </Button>
              <button
                ref={confirmBtnRef}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                  pending.options.danger
                    ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                    : 'bg-teal-700 hover:bg-teal-800 focus:ring-teal-500'
                }`}
                onClick={() => handleResolve(true)}
              >
                {pending.options.confirmLabel || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </ConfirmContext.Provider>
  );
}
