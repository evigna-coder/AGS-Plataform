import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import type { NavigateFunction } from 'react-router-dom';

export interface Tab {
  id: string;       // unique id e.g. "tab_1", "tab_2"
  path: string;     // current full path within the tab (pathname + search)
  label: string;
  icon: string;
  sublabel?: string; // contextual sublabel e.g. "HPLC 1100" when on detail page
}

interface TabsContextType {
  tabs: Tab[];
  activeTabId: string;
  /** Full path (pathname+search) of the active tab — use for highlighting, display */
  activeTabPath: string;
  openTab: (path: string, label?: string, icon?: string) => void;
  closeTab: (id: string) => void;
  switchTab: (id: string) => void;
  /** Navigate within the active tab's MemoryRouter. Accepts path string or delta number. */
  navigateInActiveTab: (to: string | number, options?: { replace?: boolean; state?: any }) => void;
  /** Called by TabRouterBridge to register a tab's navigate function */
  registerTabNavigate: (tabId: string, navigate: NavigateFunction | null) => void;
  /** Called by TabRouterBridge when a tab's location changes */
  updateTabLocation: (tabId: string, pathname: string, search: string) => void;
}

const TabsContext = createContext<TabsContextType | null>(null);

let nextTabCounter = 1;
function generateTabId(): string {
  return `tab_${nextTabCounter++}`;
}

/** Get the module prefix from a path: /clientes/123 → /clientes */
export function modulePrefix(path: string): string {
  const clean = path.split('?')[0]; // strip search params
  const parts = clean.split('/').filter(Boolean);
  if (parts.length === 0) return '/clientes';
  if (parts[0] === 'stock') return '/stock';
  return '/' + parts[0];
}

/** Lookup table: module prefix → { label, icon } */
const NAV_META: Record<string, { label: string; icon: string }> = {
  '/clientes': { label: 'Clientes', icon: '🏢' },
  '/establecimientos': { label: 'Establecimientos', icon: '🏭' },
  '/equipos': { label: 'Equipos', icon: '⚙️' },
  '/ordenes-trabajo': { label: 'Ordenes de Trabajo', icon: '📝' },
  '/leads': { label: 'Tickets', icon: '👥' },
  '/presupuestos': { label: 'Presupuestos', icon: '📋' },
  '/table-catalog': { label: 'Biblioteca Tablas', icon: '📐' },
  '/instrumentos': { label: 'Instrumentos', icon: '🔬' },
  '/fichas': { label: 'Fichas Propiedad', icon: '🔧' },
  '/loaners': { label: 'Loaners', icon: '🔄' },
  '/stock': { label: 'Stock', icon: '📦' },
  '/usuarios': { label: 'Usuarios', icon: '👤' },
  '/agenda': { label: 'Agenda', icon: '📅' },
  '/facturacion': { label: 'Facturacion', icon: '💰' },
  '/admin': { label: 'Importar Datos', icon: '📥' },
};

/** Get label and icon for a path from the nav metadata */
export function getNavMeta(path: string): { label: string; icon: string } {
  const prefix = modulePrefix(path);
  return NAV_META[prefix] || { label: path, icon: '📄' };
}

/** Compute sublabel from path (last segment when deeper than module root) */
function computeSublabel(path: string): string | undefined {
  const clean = path.split('?')[0];
  const prefix = modulePrefix(clean);
  const rest = clean.slice(prefix.length).replace(/^\//, '');
  if (!rest) return undefined;
  const segments = rest.split('/').filter(Boolean);
  if (segments.length === 0) return undefined;
  const last = segments[segments.length - 1];
  if (['nuevo', 'editar', 'categorias', 'edit'].includes(last) && segments.length > 1) {
    return segments[segments.length - 2];
  }
  if (['nuevo', 'categorias'].includes(last)) return undefined;
  if (prefix === '/stock' && segments.length === 1) {
    return segments[0].charAt(0).toUpperCase() + segments[0].slice(1);
  }
  return last;
}

export const TabsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Use window.location for initial path (read once on mount)
  const [tabs, setTabs] = useState<Tab[]>(() => {
    const initPath = window.location.pathname + window.location.search || '/clientes';
    const meta = getNavMeta(initPath);
    const id = generateTabId();
    return [{ id, path: initPath, label: meta.label, icon: meta.icon, sublabel: computeSublabel(initPath) }];
  });
  const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0]?.id ?? '');

  // Registry of per-tab navigate functions (from MemoryRouters)
  const tabNavigators = useRef(new Map<string, NavigateFunction>());

  const registerTabNavigate = useCallback((tabId: string, navigate: NavigateFunction | null) => {
    if (navigate) {
      tabNavigators.current.set(tabId, navigate);
    } else {
      tabNavigators.current.delete(tabId);
    }
  }, []);

  const updateTabLocation = useCallback((tabId: string, pathname: string, search: string) => {
    const fullPath = pathname + search;
    setTabs(prev => {
      const tab = prev.find(t => t.id === tabId);
      if (!tab) return prev;
      const sub = computeSublabel(pathname);
      const meta = getNavMeta(pathname);
      // Only update if something actually changed
      if (tab.path === fullPath && tab.label === meta.label && tab.icon === meta.icon && tab.sublabel === sub) {
        return prev;
      }
      return prev.map(t =>
        t.id === tabId ? { ...t, path: fullPath, label: meta.label, icon: meta.icon, sublabel: sub } : t
      );
    });
  }, []);

  // Derive active tab path from state
  const activeTab = tabs.find(t => t.id === activeTabId);
  const activeTabPath = activeTab?.path || '/clientes';

  const navigateInActiveTab = useCallback((to: string | number, options?: { replace?: boolean; state?: any }) => {
    const nav = tabNavigators.current.get(activeTabId);
    if (nav) nav(to as any, options);
  }, [activeTabId]);

  const openTab = useCallback((path: string, label?: string, icon?: string) => {
    const meta = label && icon ? { label, icon } : getNavMeta(path);
    const id = generateTabId();
    setTabs(prev => [...prev, { id, path, label: meta.label, icon: meta.icon, sublabel: computeSublabel(path) }]);
    setActiveTabId(id);
    // Sync browser URL to new tab's path
    window.history.replaceState(null, '', path);
  }, []);

  const closeTab = useCallback((closingId: string) => {
    setTabs(prev => {
      if (prev.length <= 1) return prev;
      const idx = prev.findIndex(t => t.id === closingId);
      if (idx === -1) return prev;
      const next = prev.filter(t => t.id !== closingId);
      if (closingId === activeTabId) {
        const newActive = next[Math.min(idx, next.length - 1)];
        setActiveTabId(newActive.id);
        window.history.replaceState(null, '', newActive.path);
      }
      return next;
    });
    tabNavigators.current.delete(closingId);
  }, [activeTabId]);

  const switchTab = useCallback((id: string) => {
    if (id === activeTabId) return;
    setTabs(prev => {
      const tab = prev.find(t => t.id === id);
      if (tab) {
        setActiveTabId(id);
        window.history.replaceState(null, '', tab.path);
      }
      return prev;
    });
  }, [activeTabId]);

  return (
    <TabsContext.Provider value={{
      tabs, activeTabId, activeTabPath,
      openTab, closeTab, switchTab,
      navigateInActiveTab, registerTabNavigate, updateTabLocation,
    }}>
      {children}
    </TabsContext.Provider>
  );
};

export const useTabs = () => {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('useTabs must be used within TabsProvider');
  return ctx;
};
