import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';
import { useTabOverlay } from '../../contexts/TabOverlayContext';

/**
 * Reemplazo de `window.prompt()` (2026-08-11). Electron NO soporta prompt() en
 * el renderer — tira "prompt() is not supported" y la acción muere: el
 * "Cancelar item" de OT no hacía nada en las terminales instaladas, aunque en
 * el browser de dev funcionara. Mismo patrón que ConfirmDialog (provider global
 * + overlay por pestaña).
 *
 * Usage:
 *   const promptText = usePrompt();
 *   const motivo = await promptText({ title: 'Baja del item', label: 'Motivo', required: true });
 *   if (motivo === null) return; // canceló
 */

// ── Types ──
interface PromptOptions {
  title?: string;
  /** Label del campo (arriba del input). */
  label: string;
  placeholder?: string;
  initialValue?: string;
  /** true → no deja confirmar con el campo vacío. */
  required?: boolean;
  /** true → textarea en lugar de input (motivos largos). */
  multiline?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
}

/** Resuelve al texto ingresado, o null si canceló. */
type PromptFn = (options: PromptOptions) => Promise<string | null>;

interface OverlayTarget {
  root: HTMLElement;
  getIsActive: () => boolean;
}

type InternalPromptFn = (options: PromptOptions, overlay?: OverlayTarget | null) => Promise<string | null>;

// ── Context ──
const PromptContext = createContext<InternalPromptFn | null>(null);

export function usePrompt(): PromptFn {
  const base = useContext(PromptContext);
  const tabOverlay = useTabOverlay();
  const root = tabOverlay?.overlayRoot ?? null;
  const getIsActive = tabOverlay?.getIsTabActive ?? null;
  const fn = useMemo<PromptFn | null>(() => {
    if (!base) return null;
    const overlay: OverlayTarget | null = root && getIsActive ? { root, getIsActive } : null;
    return (options) => base(options, overlay);
  }, [base, root, getIsActive]);
  if (!fn) throw new Error('usePrompt must be used within PromptDialogProvider');
  return fn;
}

// ── Provider ──
interface PendingPrompt {
  id: number;
  options: PromptOptions;
  overlay: OverlayTarget | null;
  resolve: (value: string | null) => void;
}

let nextPromptId = 1;

export function PromptDialogProvider({ children }: { children: ReactNode }) {
  const [pendings, setPendings] = useState<PendingPrompt[]>([]);

  const promptFn: InternalPromptFn = useCallback((options, overlay = null) => {
    return new Promise<string | null>((resolve) => {
      setPendings(prev => [...prev, { id: nextPromptId++, options, overlay, resolve }]);
    });
  }, []);

  const handleResolve = useCallback((entry: PendingPrompt, value: string | null) => {
    entry.resolve(value);
    setPendings(prev => prev.filter(p => p !== entry));
  }, []);

  return (
    <PromptContext.Provider value={promptFn}>
      {children}
      {pendings.map(p => (
        <PromptDialogView key={p.id} pending={p} onResolve={handleResolve} />
      ))}
    </PromptContext.Provider>
  );
}

// ── Vista ──
function PromptDialogView({
  pending,
  onResolve,
}: {
  pending: PendingPrompt;
  onResolve: (entry: PendingPrompt, value: string | null) => void;
}) {
  const [texto, setTexto] = useState(pending.options.initialValue ?? '');
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const scoped = pending.overlay !== null;
  const isTabActive = () => !pending.overlay || pending.overlay.getIsActive();
  const puedeConfirmar = !pending.options.required || texto.trim().length > 0;

  const confirmar = () => {
    if (!puedeConfirmar) return;
    onResolve(pending, texto.trim());
  };

  useEffect(() => {
    if (isTabActive()) requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.select(); });
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isTabActive()) return;
      if (e.key === 'Escape') onResolve(pending, null);
      // Enter confirma solo en input simple; en textarea hace salto de línea.
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, onResolve]);

  const ctrl = 'w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500';

  return createPortal(
    <div
      className={`${scoped ? 'absolute' : 'fixed'} inset-0 bg-black/50 flex items-center justify-center z-[80] p-4`}
      role={isTabActive() ? 'dialog' : undefined}
      aria-modal={isTabActive() ? 'true' : undefined}
    >
      <div ref={dialogRef} className="w-full max-w-sm bg-white rounded-xl shadow-xl overflow-hidden">
        <div className="px-5 pt-4 pb-3 bg-teal-700">
          <h3 className="text-base font-serif font-semibold text-white tracking-tight">
            {pending.options.title || 'Ingresar dato'}
          </h3>
        </div>
        <div className="px-5 py-4 space-y-1.5">
          <label className="block text-[10px] font-mono uppercase tracking-wide text-slate-500">
            {pending.options.label}{pending.options.required ? ' *' : ''}
          </label>
          {pending.options.multiline ? (
            <textarea
              ref={inputRef as React.Ref<HTMLTextAreaElement>}
              value={texto}
              onChange={e => setTexto(e.target.value)}
              placeholder={pending.options.placeholder}
              rows={3}
              className={`${ctrl} resize-y`}
            />
          ) : (
            <input
              ref={inputRef as React.Ref<HTMLInputElement>}
              value={texto}
              onChange={e => setTexto(e.target.value)}
              placeholder={pending.options.placeholder}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmar(); } }}
              className={ctrl}
            />
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 bg-[#F0F0F0] border-t border-[#E5E5E5]">
          <Button variant="secondary" size="sm" onClick={() => onResolve(pending, null)}>
            {pending.options.cancelLabel || 'Cancelar'}
          </Button>
          <Button size="sm" onClick={confirmar} disabled={!puedeConfirmar}>
            {pending.options.confirmLabel || 'Confirmar'}
          </Button>
        </div>
      </div>
    </div>,
    pending.overlay?.root ?? document.body,
  );
}
