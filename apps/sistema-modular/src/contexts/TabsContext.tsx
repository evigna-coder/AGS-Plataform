import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export interface Tab {
  id: string;       // unique id e.g. "tab_1", "tab_2"
  path: string;     // current path within the tab (tracks navigation)
  label: string;
  icon: string;
  sublabel?: string; // contextual sublabel e.g. "HPLC 1100" when on detail page
}

interface TabsContextType {
  tabs: Tab[];
  activeTabId: string;
  openTab: (path: string, label?: string, icon?: string) => void;
  closeTab: (id: string) => void;
  switchTab: (id: string) => void;
}

const TabsContext = createContext<TabsContextType | null>(null);

let nextTabCounter = 1;
function generateTabId(): string {
  return `tab_${nextTabCounter++}`;
}

/** Get the module prefix from a path: /clientes/123 → /clientes */
export function modulePrefix(path: string): string {
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return '/clientes';
  // Stock sub-modules share the /stock prefix
  if (parts[0] === 'stock') return '/stock';
  return '/' + parts[0];
}

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
  const prefix = modulePrefix(path);
  const rest = path.slice(prefix.length).replace(/^\//, '');
  if (!rest) return undefined;
  const segments = rest.split('/').filter(Boolean);
  if (segments.length === 0) return undefined;
  // Skip "nuevo", "editar", "categorias" as sublabel — not meaningful
  const last = segments[segments.length - 1];
  if (['nuevo', 'editar', 'categorias', 'edit'].includes(last) && segments.length > 1) {
    return segments[segments.length - 2];
  }
  if (['nuevo', 'categorias'].includes(last)) return undefined;
  // For stock sub-modules like /stock/articulos → show "Articulos"
  if (prefix === '/stock' && segments.length === 1) {
    return segments[0].charAt(0).toUpperCase() + segments[0].slice(1);
  }
  return last;
}

export const TabsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [tabs, setTabs] = useState<Tab[]>(() => {
    const meta = getNavMeta(location.pathname);
    const id = generateTabId();
    return [{ id, path: location.pathname, label: meta.label, icon: meta.icon, sublabel: computeSublabel(location.pathname) }];
  });
  const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0]?.id ?? '');

  // Track whether the navigation was initiated by switchTab/openTab
  const programmaticNav = useRef(false);

  // Sync current path into the active tab when the route changes
  useEffect(() => {
    if (programmaticNav.current) {
      programmaticNav.current = false;
      return;
    }
    // User navigated via sidebar or link click → update the active tab's path
    const sub = computeSublabel(location.pathname);
    const newPrefix = modulePrefix(location.pathname);

    setTabs(prev => {
      const activeTab = prev.find(t => t.id === activeTabId);

      // If active tab exists and the navigation is within the same module or a normal link click, update it
      if (activeTab) {
        const activePrefix = modulePrefix(activeTab.path);
        // Same module → just update the path
        if (activePrefix === newPrefix) {
          return prev.map(t => t.id === activeTabId ? { ...t, path: location.pathname, sublabel: sub } : t);
        }
        // Different module — if single tab, replace it; if multi-tab, update the active tab
        const meta = getNavMeta(location.pathname);
        return prev.map(t => t.id === activeTabId
          ? { ...t, path: location.pathname, label: meta.label, icon: meta.icon, sublabel: sub }
          : t
        );
      }

      // Fallback: no active tab found → replace first tab
      const meta = getNavMeta(location.pathname);
      if (prev.length === 0) {
        const id = generateTabId();
        setActiveTabId(id);
        return [{ id, path: location.pathname, label: meta.label, icon: meta.icon, sublabel: sub }];
      }
      return prev.map((t, i) => i === 0 ? { ...t, path: location.pathname, label: meta.label, icon: meta.icon, sublabel: sub } : t);
    });
  }, [location.pathname, activeTabId]);

  const openTab = useCallback((path: string, label?: string, icon?: string) => {
    const meta = label && icon ? { label, icon } : getNavMeta(path);
    const id = generateTabId();
    programmaticNav.current = true;
    setTabs(prev => [...prev, { id, path, label: meta.label, icon: meta.icon, sublabel: computeSublabel(path) }]);
    setActiveTabId(id);
    navigate(path);
  }, [navigate]);

  const closeTab = useCallback((closingId: string) => {
    setTabs(prev => {
      if (prev.length <= 1) return prev; // Don't close the last tab
      const idx = prev.findIndex(t => t.id === closingId);
      if (idx === -1) return prev;
      const next = prev.filter(t => t.id !== closingId);
      // If closing the active tab, switch to the nearest remaining
      if (closingId === activeTabId) {
        const newActive = next[Math.min(idx, next.length - 1)];
        setActiveTabId(newActive.id);
        programmaticNav.current = true;
        navigate(newActive.path);
      }
      return next;
    });
  }, [navigate, activeTabId]);

  const switchTab = useCallback((id: string) => {
    setTabs(prev => {
      const tab = prev.find(t => t.id === id);
      if (tab && id !== activeTabId) {
        setActiveTabId(id);
        programmaticNav.current = true;
        navigate(tab.path);
      }
      return prev;
    });
  }, [navigate, activeTabId]);

  return (
    <TabsContext.Provider value={{ tabs, activeTabId, openTab, closeTab, switchTab }}>
      {children}
    </TabsContext.Provider>
  );
};

export const useTabs = () => {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('useTabs must be used within TabsProvider');
  return ctx;
};
