import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export interface Tab {
  id: string;       // module prefix e.g. "_clientes"
  path: string;     // current path within the tab (tracks navigation)
  label: string;
  icon: string;
}

interface TabsContextType {
  tabs: Tab[];
  openTab: (path: string, label: string, icon: string) => void;
  closeTab: (id: string) => void;
  switchTab: (id: string) => void;
}

const TabsContext = createContext<TabsContextType | null>(null);

/** Get the module prefix from a path: /clientes/123 → /clientes */
function modulePrefix(path: string): string {
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return '/clientes';
  // Stock sub-modules share the /stock prefix
  if (parts[0] === 'stock') return '/stock';
  return '/' + parts[0];
}

/** Derive tab id from a module prefix */
export const tabId = (path: string) => modulePrefix(path).replace(/\//g, '_') || '_home';

/** Lookup table: module prefix → { label, icon } */
const NAV_META: Record<string, { label: string; icon: string }> = {
  '/clientes': { label: 'Clientes', icon: '🏢' },
  '/establecimientos': { label: 'Establecimientos', icon: '🏭' },
  '/equipos': { label: 'Equipos', icon: '⚙️' },
  '/ordenes-trabajo': { label: 'Ordenes de Trabajo', icon: '📝' },
  '/leads': { label: 'Leads', icon: '👥' },
  '/presupuestos': { label: 'Presupuestos', icon: '📋' },
  '/table-catalog': { label: 'Biblioteca Tablas', icon: '📐' },
  '/instrumentos': { label: 'Instrumentos', icon: '🔬' },
  '/fichas': { label: 'Fichas Propiedad', icon: '🔧' },
  '/loaners': { label: 'Loaners', icon: '🔄' },
  '/stock': { label: 'Stock', icon: '📦' },
  '/usuarios': { label: 'Usuarios', icon: '👤' },
  '/agenda': { label: 'Agenda', icon: '📅' },
  '/postas': { label: 'Postas', icon: '🔀' },
  '/facturacion': { label: 'Facturacion', icon: '💰' },
  '/admin': { label: 'Importar Datos', icon: '📥' },
};

/** Get label and icon for a path from the nav metadata */
export function getNavMeta(path: string): { label: string; icon: string } {
  const prefix = modulePrefix(path);
  return NAV_META[prefix] || { label: path, icon: '📄' };
}

export const TabsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [tabs, setTabs] = useState<Tab[]>(() => {
    const meta = getNavMeta(location.pathname);
    return [{ id: tabId(location.pathname), path: location.pathname, label: meta.label, icon: meta.icon }];
  });

  // Track whether the navigation was initiated by switchTab/openTab
  const programmaticNav = useRef(false);

  // Sync current path into the active tab when the route changes
  useEffect(() => {
    if (programmaticNav.current) {
      programmaticNav.current = false;
      return;
    }
    // User navigated via sidebar or link click → update the "current" tab's path
    const currentModuleId = tabId(location.pathname);
    setTabs(prev => {
      // If there's a tab for this module, update its path
      const existing = prev.find(t => t.id === currentModuleId);
      if (existing) {
        return prev.map(t => t.id === currentModuleId ? { ...t, path: location.pathname } : t);
      }
      // No tab for this module → replace the active tab's section with new module
      // (single-tab mode: sidebar navigation replaces the first/only tab)
      if (prev.length <= 1) {
        const meta = getNavMeta(location.pathname);
        return [{ id: currentModuleId, path: location.pathname, label: meta.label, icon: meta.icon }];
      }
      // Multi-tab: add a new tab for the module
      const meta = getNavMeta(location.pathname);
      return [...prev, { id: currentModuleId, path: location.pathname, label: meta.label, icon: meta.icon }];
    });
  }, [location.pathname]);

  const openTab = useCallback((path: string, label: string, icon: string) => {
    const id = tabId(path);
    programmaticNav.current = true;
    setTabs(prev => {
      if (prev.some(t => t.id === id)) return prev;
      return [...prev, { id, path, label, icon }];
    });
    navigate(path);
  }, [navigate]);

  const closeTab = useCallback((id: string) => {
    setTabs(prev => {
      const idx = prev.findIndex(t => t.id === id);
      if (idx === -1 || prev.length <= 1) return prev; // Don't close the last tab
      const next = prev.filter(t => t.id !== id);
      // If we're closing the active tab, navigate to nearest remaining
      const closedTab = prev[idx];
      const currentModuleId = tabId(location.pathname);
      if (closedTab.id === currentModuleId) {
        const newActive = next[Math.min(idx, next.length - 1)];
        programmaticNav.current = true;
        navigate(newActive.path);
      }
      return next;
    });
  }, [navigate, location.pathname]);

  const switchTab = useCallback((id: string) => {
    setTabs(prev => {
      const tab = prev.find(t => t.id === id);
      if (tab) {
        programmaticNav.current = true;
        navigate(tab.path);
      }
      return prev;
    });
  }, [navigate]);

  return (
    <TabsContext.Provider value={{ tabs, openTab, closeTab, switchTab }}>
      {children}
    </TabsContext.Provider>
  );
};

export const useTabs = () => {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('useTabs must be used within TabsProvider');
  return ctx;
};
