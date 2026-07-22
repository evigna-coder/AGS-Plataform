import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

/** Entrada del registro de modales minimizados de una pestaña. */
export interface MinimizedModalEntry {
  id: string;
  title: string;
  restore: () => void;
}

export interface TabOverlayContextValue {
  /** Nodo destino de los portales de overlays (Modal/Drawer/ConfirmDialog) de esta pestaña. */
  overlayRoot: HTMLElement | null;
  /** true si la pestaña dueña de este scope es la activa (visible). */
  isTabActive: boolean;
  /** Getter estable para leer la actividad sin re-render (para closures de larga vida). */
  getIsTabActive: () => boolean;
  /** Registro por-pestaña de modales minimizados (chips en la base de la pestaña). */
  registerMinimized: (entry: MinimizedModalEntry) => void;
  unregisterMinimized: (id: string) => void;
}

const TabOverlayContext = createContext<TabOverlayContextValue | null>(null);

/**
 * null ⇒ el componente está fuera del sistema de pestañas (login, overlays
 * globales): los overlays deben usar su comportamiento fullscreen clásico
 * (portal a document.body + position fixed).
 */
export function useTabOverlay(): TabOverlayContextValue | null {
  return useContext(TabOverlayContext);
}

interface TabOverlayScopeProps {
  isTabActive: boolean;
  children: ReactNode;
}

/**
 * Wrapper de cada pestaña (usado por TabContentManager). Provee:
 * - un contenedor `relative h-full` que se oculta con display:none cuando la
 *   pestaña no está activa (los hijos NUNCA se desmontan — estado preservado);
 * - un scroller interno propio (el overlay host queda pineado al viewport de
 *   la pestaña en vez de scrollear con el contenido);
 * - el nodo host donde Modal/Drawer/ConfirmDialog portalean sus overlays con
 *   `absolute inset-0` — cubren solo la pestaña, dejando TabBar y sidebar
 *   clickeables;
 * - la barra de modales minimizados scopeada a esta pestaña.
 */
export function TabOverlayScope({ isTabActive, children }: TabOverlayScopeProps) {
  const [overlayRoot, setOverlayRoot] = useState<HTMLElement | null>(null);
  const [minimized, setMinimized] = useState<MinimizedModalEntry[]>([]);

  const isActiveRef = useRef(isTabActive);
  isActiveRef.current = isTabActive;
  const getIsTabActive = useCallback(() => isActiveRef.current, []);

  // Callback ref + estado (no useRef pelado): los consumidores re-renderizan
  // cuando el nodo existe y el portal puede montarse.
  const overlayRootRef = useCallback((node: HTMLDivElement | null) => {
    setOverlayRoot(node);
  }, []);

  const registerMinimized = useCallback((entry: MinimizedModalEntry) => {
    setMinimized(prev => [...prev.filter(m => m.id !== entry.id), entry]);
  }, []);

  const unregisterMinimized = useCallback((id: string) => {
    setMinimized(prev => (prev.some(m => m.id === id) ? prev.filter(m => m.id !== id) : prev));
  }, []);

  const value = useMemo<TabOverlayContextValue>(
    () => ({ overlayRoot, isTabActive, getIsTabActive, registerMinimized, unregisterMinimized }),
    [overlayRoot, isTabActive, getIsTabActive, registerMinimized, unregisterMinimized],
  );

  return (
    <div className="relative h-full" style={{ display: isTabActive ? undefined : 'none' }}>
      <TabOverlayContext.Provider value={value}>
        {/* Scroller propio de la pestaña: el contenido scrollea acá adentro,
            así los overlays absolutos quedan fijos al área visible del tab. */}
        <div className="h-full overflow-y-auto">{children}</div>
        {/* Host de portales de overlays. Sin posicionamiento propio: los
            overlays (absolute inset-0) se posicionan contra el wrapper relative. */}
        <div ref={overlayRootRef} />
        {/* Chips de modales minimizados de ESTA pestaña */}
        {minimized.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 z-[60] flex gap-2 px-4 py-2 pointer-events-none">
            {minimized.map(m => (
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
          </div>
        )}
      </TabOverlayContext.Provider>
    </div>
  );
}
