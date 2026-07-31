import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

/**
 * Presupuestos flotantes MÚLTIPLES (UAT 2026-07-31: "se minimizó el modal de
 * presupuesto, se abrió otro y el minimizado se cerró"). Cada presupuesto
 * abierto/minimizado es una entrada; como máximo UNO está visible (abrir o
 * restaurar minimiza al resto), los demás quedan como pills abajo.
 */
export interface FloatingPresEntry {
  presupuestoId: string;
  minimized: boolean;
  /** Número del presupuesto (label del pill) — lo reporta el editor al cargar. */
  label: string | null;
  /** Callback para refrescar la lista que lo abrió. */
  onUpdated: (() => void) | null;
}

interface FloatingPresupuestoContextValue {
  entries: FloatingPresEntry[];
  open: (id: string, onUpdated?: () => void) => void;
  close: (id: string) => void;
  minimize: (id: string) => void;
  restore: (id: string) => void;
  /** Minimiza todos los visibles (al navegar a otro módulo/pestaña). */
  minimizeAll: () => void;
  setLabel: (id: string, label: string) => void;
}

const FloatingPresupuestoContext = createContext<FloatingPresupuestoContextValue | null>(null);

export function FloatingPresupuestoProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<FloatingPresEntry[]>([]);

  const open = useCallback((id: string, onUpdated?: () => void) => {
    setEntries(prev => {
      const others = prev.map(e => (e.presupuestoId === id ? e : { ...e, minimized: true }));
      const existing = others.find(e => e.presupuestoId === id);
      if (existing) {
        return others.map(e => e.presupuestoId === id
          ? { ...e, minimized: false, onUpdated: onUpdated ?? e.onUpdated }
          : e);
      }
      return [...others, { presupuestoId: id, minimized: false, label: null, onUpdated: onUpdated ?? null }];
    });
  }, []);

  const close = useCallback((id: string) => {
    setEntries(prev => {
      const entry = prev.find(e => e.presupuestoId === id);
      entry?.onUpdated?.();
      return prev.filter(e => e.presupuestoId !== id);
    });
  }, []);

  const minimize = useCallback((id: string) => {
    setEntries(prev => prev.map(e => (e.presupuestoId === id ? { ...e, minimized: true } : e)));
  }, []);

  const restore = useCallback((id: string) => {
    // Restaurar uno minimiza al resto — un solo editor visible a la vez.
    setEntries(prev => prev.map(e => ({ ...e, minimized: e.presupuestoId !== id })));
  }, []);

  const minimizeAll = useCallback(() => {
    setEntries(prev => (prev.some(e => !e.minimized) ? prev.map(e => ({ ...e, minimized: true })) : prev));
  }, []);

  const setLabel = useCallback((id: string, label: string) => {
    setEntries(prev => prev.map(e => (e.presupuestoId === id && e.label !== label ? { ...e, label } : e)));
  }, []);

  return (
    <FloatingPresupuestoContext.Provider value={{ entries, open, close, minimize, restore, minimizeAll, setLabel }}>
      {children}
    </FloatingPresupuestoContext.Provider>
  );
}

export function useFloatingPresupuesto() {
  const ctx = useContext(FloatingPresupuestoContext);
  if (!ctx) throw new Error('useFloatingPresupuesto must be used within FloatingPresupuestoProvider');
  return ctx;
}
