import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface FloatingPresupuestoState {
  presupuestoId: string | null;
  minimized: boolean;
  /** Callback to refresh the list that opened the modal */
  onUpdated: (() => void) | null;
}

interface FloatingPresupuestoContextValue extends FloatingPresupuestoState {
  open: (id: string, onUpdated?: () => void) => void;
  close: () => void;
  minimize: () => void;
  restore: () => void;
}

const FloatingPresupuestoContext = createContext<FloatingPresupuestoContextValue | null>(null);

export function FloatingPresupuestoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FloatingPresupuestoState>({
    presupuestoId: null,
    minimized: false,
    onUpdated: null,
  });

  const open = useCallback((id: string, onUpdated?: () => void) => {
    setState({ presupuestoId: id, minimized: false, onUpdated: onUpdated || null });
  }, []);

  const close = useCallback(() => {
    const cb = state.onUpdated;
    setState({ presupuestoId: null, minimized: false, onUpdated: null });
    cb?.();
  }, [state.onUpdated]);

  const minimize = useCallback(() => {
    setState(prev => ({ ...prev, minimized: true }));
  }, []);

  const restore = useCallback(() => {
    setState(prev => ({ ...prev, minimized: false }));
  }, []);

  return (
    <FloatingPresupuestoContext.Provider value={{ ...state, open, close, minimize, restore }}>
      {children}
    </FloatingPresupuestoContext.Provider>
  );
}

export function useFloatingPresupuesto() {
  const ctx = useContext(FloatingPresupuestoContext);
  if (!ctx) throw new Error('useFloatingPresupuesto must be used within FloatingPresupuestoProvider');
  return ctx;
}
