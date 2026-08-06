import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { useLandingPath } from '../components/layout/navigation';

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
  /** Trigger the active tab's goBack (parent declarado → state.from → navigate(-1)). */
  goBackInActiveTab: () => void;
  /** Called by TabRouterBridge to register a tab's navigate function */
  registerTabNavigate: (tabId: string, navigate: NavigateFunction | null) => void;
  /** Called by TabRouterBridge to register a tab's goBack function */
  registerTabGoBack: (tabId: string, goBack: (() => void) | null) => void;
  /** Called by Detail pages via useDeclareParent: registra el padre jerárquico
   *  semántico. Permite que goBack vuelva al padre real (ej. equipo →
   *  establecimiento padre) sin depender del history del browser, que se
   *  enredaba en loops cuando se mezclaban entradas a un mismo Detail desde
   *  distintos referrers. */
  setActiveTabParent: (parent: string | null) => void;
  /** Lectura del parent declarado del tab activo (usado por useNavigateBack). */
  getActiveTabParent: () => string | null;
  /** Última query string ('?a=b' o '') vista en este tab para un pathname dado.
   *  useNavigateBack la usa para restaurar los filtros de lista (useUrlFilters
   *  los persiste en la URL) cuando el destino del back es un path pelado. */
  getActiveTabStoredSearch: (pathname: string) => string;
  /** Called by TabRouterBridge when a tab's location changes */
  updateTabLocation: (tabId: string, pathname: string, search: string) => void;
}

const TabsContext = createContext<TabsContextType | null>(null);

// ID único real (no un contador de módulo): con HMR en dev el módulo se
// re-evalúa y un contador volvía a 1 → la próxima pestaña duplicaba el id de
// una existente y las dos colisionaban (navegación pisada, ambas "activas",
// una pestaña "se transformaba" en la otra — UAT 2026-07-20).
function generateTabId(): string {
  return `tab_${crypto.randomUUID()}`;
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
  '/patrones': { label: 'Patrones', icon: '⚗️' },
  '/columnas': { label: 'Columnas', icon: '📊' },
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

// ── Persistencia de pestañas (2026-08-06) ────────────────────────────────────
// Las tabs vivían solo en memoria: cada reinicio de la app (en la práctica,
// cada auto-update — los usuarios no la cierran nunca) las borraba y quedaba
// una sola tab de landing. Reportado como "el release me pisó las pestañas"
// en cada corte. Se persisten los paths + tab activa y se restauran al abrir.
const TABS_STORAGE_KEY = 'ags-tabs-v1';

function mkTab(path: string): Tab {
  const meta = getNavMeta(path);
  return { id: generateTabId(), path, label: meta.label, icon: meta.icon, sublabel: computeSublabel(path) };
}

function buildInitialTabs(landingPath: string): { tabs: Tab[]; activeId: string } {
  const fromUrl = window.location.pathname + window.location.search;
  const deepLink = fromUrl && fromUrl !== '/' ? fromUrl : null;

  let stored: { paths: string[]; active: number } | null = null;
  try {
    const raw = localStorage.getItem(TABS_STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as { paths?: unknown; active?: unknown };
      if (Array.isArray(p.paths) && p.paths.every(x => typeof x === 'string' && x.startsWith('/'))) {
        stored = { paths: (p.paths as string[]).slice(0, 12), active: typeof p.active === 'number' ? p.active : 0 };
      }
    }
  } catch { /* storage corrupto/bloqueado → arranque limpio */ }

  const tabs: Tab[] = (stored?.paths ?? []).map(mkTab);
  let activeIdx = Math.min(Math.max(stored?.active ?? 0, 0), Math.max(tabs.length - 1, 0));

  // Deep-link explícito: activa la tab existente con ese path o abre una nueva.
  if (deepLink) {
    const existing = tabs.findIndex(t => t.path === deepLink);
    if (existing >= 0) activeIdx = existing;
    else { tabs.push(mkTab(deepLink)); activeIdx = tabs.length - 1; }
  }

  // Sin nada restaurado ni deep-link → landing por permisos, como siempre.
  if (tabs.length === 0) { tabs.push(mkTab(landingPath)); activeIdx = 0; }

  return { tabs, activeId: tabs[activeIdx].id };
}

export const TabsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Landing según permisos: arrancar en '/clientes' fijo dejaba a los usuarios
  // sin ese módulo entrando directo a "Acceso denegado".
  const landingPath = useLandingPath();
  const initialRef = useRef<{ tabs: Tab[]; activeId: string } | null>(null);
  if (initialRef.current === null) initialRef.current = buildInitialTabs(landingPath);
  const [tabs, setTabs] = useState<Tab[]>(initialRef.current.tabs);
  const [activeTabId, setActiveTabId] = useState<string>(initialRef.current.activeId);

  // Persistir en cada cambio (paths + índice activo). Best-effort.
  useEffect(() => {
    try {
      const active = Math.max(0, tabs.findIndex(t => t.id === activeTabId));
      localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify({ paths: tabs.map(t => t.path), active }));
    } catch { /* quota/privado: sin persistencia, la app sigue */ }
  }, [tabs, activeTabId]);

  // Al restaurar, alinear la URL del browser con la tab activa (igual que switchTab).
  useEffect(() => {
    const tab = initialRef.current?.tabs.find(t => t.id === initialRef.current?.activeId);
    if (tab && window.location.pathname + window.location.search !== tab.path) {
      window.history.replaceState(null, '', tab.path);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Registry of per-tab navigate functions (from MemoryRouters)
  const tabNavigators = useRef(new Map<string, NavigateFunction>());
  // Registry of per-tab goBack functions (from MemoryRouters via useNavigateBack)
  const tabGoBackers = useRef(new Map<string, () => void>());
  // Registry of per-tab parent paths declarados por cada Detail page via
  // useDeclareParent. Es un ref para que las lecturas sean siempre frescas
  // sin forzar re-renders de useNavigateBack (que se reconstruye en cada
  // useEffect dep change).
  const tabParents = useRef(new Map<string, string>());
  // Por tab: pathname → última search vista ahí. Sin esto, volver a una lista
  // vía parent declarado (path pelado, ej. '/clientes') pisa los filtros que
  // useUrlFilters había persistido en la query string de esa lista.
  const tabSearches = useRef(new Map<string, Map<string, string>>());

  const registerTabNavigate = useCallback((tabId: string, navigate: NavigateFunction | null) => {
    if (navigate) {
      tabNavigators.current.set(tabId, navigate);
    } else {
      tabNavigators.current.delete(tabId);
    }
  }, []);

  const registerTabGoBack = useCallback((tabId: string, goBack: (() => void) | null) => {
    if (goBack) {
      tabGoBackers.current.set(tabId, goBack);
    } else {
      tabGoBackers.current.delete(tabId);
    }
  }, []);

  const setActiveTabParent = useCallback((parent: string | null) => {
    if (parent) {
      tabParents.current.set(activeTabId, parent);
    } else {
      tabParents.current.delete(activeTabId);
    }
  }, [activeTabId]);

  const getActiveTabParent = useCallback((): string | null => {
    return tabParents.current.get(activeTabId) ?? null;
  }, [activeTabId]);

  const getActiveTabStoredSearch = useCallback((pathname: string): string => {
    return tabSearches.current.get(activeTabId)?.get(pathname) ?? '';
  }, [activeTabId]);

  const updateTabLocation = useCallback((tabId: string, pathname: string, search: string) => {
    let byPath = tabSearches.current.get(tabId);
    if (!byPath) { byPath = new Map(); tabSearches.current.set(tabId, byPath); }
    byPath.set(pathname, search);
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

  const goBackInActiveTab = useCallback(() => {
    const goBack = tabGoBackers.current.get(activeTabId);
    if (goBack) goBack();
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
    tabGoBackers.current.delete(closingId);
    tabParents.current.delete(closingId);
    tabSearches.current.delete(closingId);
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
      navigateInActiveTab, goBackInActiveTab,
      registerTabNavigate, registerTabGoBack,
      setActiveTabParent, getActiveTabParent, getActiveTabStoredSearch,
      updateTabLocation,
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
