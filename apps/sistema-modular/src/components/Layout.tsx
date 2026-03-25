import { ReactNode, useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { ModuloId } from '@ags/shared';
import { useAuth } from '../contexts/AuthContext';
import { signOut } from '../services/authService';
import { useTabs, getNavMeta } from '../contexts/TabsContext';
import { useBackgroundTasks } from '../contexts/BackgroundTasksContext';
import { useFloatingPresupuesto } from '../contexts/FloatingPresupuestoContext';
import { EditPresupuestoModal } from './presupuestos/EditPresupuestoModal';
import { MinimizedModalsBar } from './ui/Modal';

interface LayoutProps {
  children: ReactNode;
}

interface NavItem {
  name: string;
  path: string;
  icon: string;
  modulo?: ModuloId;
  children?: { name: string; path: string; separator?: boolean }[];
}

const navigation: NavItem[] = [
  { name: 'Clientes', path: '/clientes', icon: '🏢', modulo: 'clientes' },
  { name: 'Establecimientos', path: '/establecimientos', icon: '🏭', modulo: 'establecimientos' },
  { name: 'Equipos', path: '/equipos', icon: '⚙️', modulo: 'equipos' },
  { name: 'Ordenes de Trabajo', path: '/ordenes-trabajo', icon: '📝', modulo: 'ordenes-trabajo' },
  { name: 'Leads', path: '/leads', icon: '👥', modulo: 'leads' },
  { name: 'Presupuestos', path: '/presupuestos', icon: '📋', modulo: 'presupuestos' },
  { name: 'Biblioteca Tablas', path: '/table-catalog', icon: '📐', modulo: 'table-catalog' },
  { name: 'Instrumentos', path: '/instrumentos', icon: '🔬', modulo: 'instrumentos' },
  { name: 'Fichas Propiedad', path: '/fichas', icon: '🔧', modulo: 'fichas' },
  { name: 'Loaners', path: '/loaners', icon: '🔄', modulo: 'loaners' },
  {
    name: 'Stock', path: '/stock', icon: '📦', modulo: 'stock',
    children: [
      { name: 'Articulos', path: '/stock/articulos' },
      { name: 'Unidades', path: '/stock/unidades' },
      { name: 'Minikits', path: '/stock/minikits' },
      { name: 'Remitos', path: '/stock/remitos' },
      { name: 'Movimientos', path: '/stock/movimientos' },
      { name: 'Alertas', path: '/stock/alertas' },
      { name: 'Requerimientos', path: '/stock/requerimientos', separator: true },
      { name: 'Ordenes de Compra', path: '/stock/ordenes-compra' },
      { name: 'Importaciones', path: '/stock/importaciones' },
      { name: 'Ingenieros', path: '/stock/ingenieros', separator: true },
      { name: 'Proveedores', path: '/stock/proveedores' },
      { name: 'Posiciones', path: '/stock/posiciones' },
      { name: 'Pos. Arancelarias', path: '/stock/posiciones-arancelarias' },
      { name: 'Marcas', path: '/stock/marcas' },
    ],
  },
  { name: 'Usuarios', path: '/usuarios', icon: '👤', modulo: 'usuarios' },
  { name: 'Agenda', path: '/agenda', icon: '📅', modulo: 'agenda' },
  { name: 'Facturacion', path: '/facturacion', icon: '💰', modulo: 'facturacion' },
  { name: 'Importar Datos', path: '/admin/importar', icon: '📥', modulo: 'admin' },
];

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { usuario, canAccess } = useAuth();
  const { tabs, activeTabId, openTab, closeTab, switchTab } = useTabs();
  const { runningTaskIds, getTask } = useBackgroundTasks();
  const floatingPres = useFloatingPresupuesto();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    location.pathname.startsWith('/stock') ? { '/stock': true } : {}
  );

  // Module root paths — Escape stops here, never navigates past a module boundary
  const MODULE_ROOTS = new Set(navigation.flatMap(item =>
    item.children ? item.children.map(c => c.path) : [item.path]
  ));

  // Compute parent path by stripping the last segment, but never go past a module root
  const getParentPath = useCallback((pathname: string): string | null => {
    if (MODULE_ROOTS.has(pathname)) return null; // already at root
    const segments = pathname.split('/').filter(Boolean);
    // Try removing last segment
    while (segments.length > 1) {
      segments.pop();
      const candidate = '/' + segments.join('/');
      // If this is a valid module root or a route above it, return it
      return candidate;
    }
    return '/' + segments[0]; // fallback to top-level module
  }, []);

  // Global keyboard shortcuts: Escape (navigate back) + Ctrl+Tab (switch tabs) + Ctrl+1-9
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ── Ctrl+1-9 → jump to tab by position ──
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key) - 1;
        if (idx < tabs.length) {
          e.preventDefault();
          switchTab(tabs[idx].id);
        }
        return;
      }

      // ── Ctrl+Tab / Ctrl+Shift+Tab → cycle tabs ──
      if ((e.ctrlKey || e.metaKey) && (e.key === 'Tab' || e.key === 'PageDown' || e.key === 'PageUp')) {
        if (tabs.length <= 1) return;
        e.preventDefault();
        const currentIdx = tabs.findIndex(t => t.id === activeTabId);
        const forward = e.key === 'Tab' ? !e.shiftKey : e.key === 'PageDown';
        const nextIdx = forward
          ? (currentIdx + 1) % tabs.length
          : (currentIdx - 1 + tabs.length) % tabs.length;
        switchTab(tabs[nextIdx].id);
        return;
      }

      // ── Escape → navigate to parent ──
      if (e.key !== 'Escape') return;
      // If user is in an input, blur it first — second Escape will navigate
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        (e.target as HTMLElement).blur();
        e.preventDefault();
        return;
      }
      if (document.querySelector('[role="dialog"], .modal-overlay, [data-modal]')) return;

      // Prefer navigation memory (state.from) over parent path
      const stateFrom = (location.state as any)?.from;
      if (stateFrom && typeof stateFrom === 'string') {
        e.preventDefault();
        navigate(stateFrom);
        return;
      }

      const parent = getParentPath(location.pathname);
      if (!parent) return; // at module root, don't navigate
      e.preventDefault();
      navigate(parent);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, location.pathname, location.state, getParentPath, tabs, activeTabId, switchTab]);

  const toggleGroup = (path: string) => {
    setExpandedGroups(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const isStockExpanded = expandedGroups['/stock'] || location.pathname.startsWith('/stock');

  const visibleNav = navigation.filter(item =>
    !item.modulo || canAccess(item.modulo)
  );

  /** Ctrl+click o middle-click → abrir en nueva pestaña interna */
  const handleNavClick = useCallback((e: React.MouseEvent, path: string) => {
    if (e.ctrlKey || e.metaKey || e.button === 1) {
      e.preventDefault();
      const meta = getNavMeta(path);
      openTab(path, meta.label, meta.icon);
    }
  }, [openTab]);

  return (
    <div className="h-screen flex flex-col">
      <header className="shrink-0 h-14 bg-white border-b border-slate-200 flex items-center px-4 justify-between z-30">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setCollapsed(c => !c)}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded hover:bg-slate-100"
            title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-teal-600 font-bold text-base tracking-tight">AGS</span>
          <span className="text-slate-300 text-sm">|</span>
          <span className="text-slate-600 text-sm font-medium">Sistema Modular</span>
          {window.electronAPI && (
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-xs font-medium">
              Desktop
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {usuario?.photoURL && (
            <img src={usuario.photoURL} alt="" className="w-7 h-7 rounded-full" referrerPolicy="no-referrer" />
          )}
          <span className="text-xs text-slate-600 font-medium max-w-[120px] truncate">{usuario?.displayName}</span>
          <button onClick={() => signOut()} className="text-xs text-slate-400 hover:text-slate-600 font-medium transition-colors">
            Salir
          </button>
        </div>
      </header>

      {/* Tab bar — always visible */}
      <div className="shrink-0 bg-white border-b border-slate-200 flex items-center gap-0 px-2 overflow-x-auto z-20">
        {tabs.map((tab, idx) => {
          const isActiveTab = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer border-b-2 transition-colors shrink-0 ${
                isActiveTab
                  ? 'border-teal-500 text-teal-700 bg-teal-50/50 font-medium'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
              onClick={() => switchTab(tab.id)}
              onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); closeTab(tab.id); } }}
            >
              <span className="text-sm leading-none">{tab.icon}</span>
              <span className="whitespace-nowrap">{tab.label}</span>
              {tab.sublabel && (
                <span className="text-[10px] text-slate-400 whitespace-nowrap">/ {tab.sublabel}</span>
              )}
              {idx < 9 && tabs.length > 1 && (
                <span className="text-[9px] text-slate-300 font-mono ml-0.5">{idx + 1}</span>
              )}
              {tabs.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                  className="ml-1 p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                  title="Cerrar pestaña"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside
          className={`shrink-0 bg-slate-900 overflow-y-auto overflow-x-hidden flex flex-col transition-all duration-300 ease-in-out ${
            collapsed ? 'w-14' : 'w-56'
          }`}
        >
          <nav className="flex-1 px-2 py-4 space-y-0.5">
            {visibleNav.map((item) => {
              const isActive =
                location.pathname === item.path ||
                location.pathname.startsWith(item.path + '/');

              if (item.children) {
                const isExpanded = !collapsed && (item.path === '/stock' ? isStockExpanded : !!expandedGroups[item.path]);
                return (
                  <div key={item.path}>
                    <button
                      onClick={() => collapsed ? setCollapsed(false) : toggleGroup(item.path)}
                      className={`w-full flex items-center gap-3 py-2 px-3 text-sm transition-all border-l-2 ${
                        isActive
                          ? 'border-teal-500 bg-slate-800 text-white font-medium'
                          : 'border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                      }`}
                      title={collapsed ? item.name : undefined}
                    >
                      <span className="text-base leading-none shrink-0">{item.icon}</span>
                      {!collapsed && (
                        <>
                          <span className="leading-tight flex-1 text-left whitespace-nowrap">{item.name}</span>
                          <span className={`text-[10px] transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
                        </>
                      )}
                    </button>
                    {isExpanded && !collapsed && (
                      <div className="ml-2 space-y-0.5 mt-0.5">
                        {item.children.map((child) => {
                          const childActive = location.pathname === child.path ||
                            location.pathname.startsWith(child.path + '/');
                          return (
                            <div key={child.path}>
                              {child.separator && (
                                <div className="border-t border-slate-700 mx-3 my-1.5" />
                              )}
                              <Link
                                to={child.path}
                                onClick={(e) => handleNavClick(e, child.path)}
                                onAuxClick={(e) => handleNavClick(e, child.path)}
                                className={`block py-1.5 pl-10 pr-3 text-xs transition-all border-l-2 whitespace-nowrap ${
                                  childActive
                                    ? 'border-teal-500 bg-slate-800 text-white font-medium'
                                    : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
                                }`}
                              >
                                {child.name}
                              </Link>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div key={item.path} className="flex items-center">
                  <Link
                    to={item.path}
                    onClick={(e) => handleNavClick(e, item.path)}
                    onAuxClick={(e) => handleNavClick(e, item.path)}
                    className={`flex-1 flex items-center gap-3 py-2 px-3 text-sm transition-all border-l-2 ${
                      isActive
                        ? 'border-teal-500 bg-slate-800 text-white font-medium'
                        : 'border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                    }`}
                    title={collapsed ? item.name : undefined}
                  >
                    <span className="text-base leading-none shrink-0">{item.icon}</span>
                    {!collapsed && <span className="leading-tight whitespace-nowrap">{item.name}</span>}
                  </Link>
                  {!collapsed && (
                    <button
                      onClick={() => openTab(item.path, item.name, item.icon)}
                      className="shrink-0 p-1.5 mr-1 rounded text-slate-600 hover:text-slate-200 hover:bg-slate-700 transition-colors"
                      title="Abrir en nueva pestaña"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 min-h-0 bg-slate-50">
          {children}
        </main>
      </div>

      {/* Floating background task indicator */}
      {runningTaskIds.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
          {runningTaskIds.map(id => {
            const task = getTask(id);
            if (!task) return null;
            const pct = task.progress.total > 0
              ? Math.round((task.progress.current / task.progress.total) * 100)
              : 0;
            const label = id === 'bulk-cuit-validation' ? 'Validando CUITs'
              : id === 'bulk-address-validation' ? 'Validando direcciones'
              : id === 'dedup-modulos' ? 'Escaneando duplicados'
              : id === 'repair-sistema-est' ? 'Reparando sistemas'
              : id === 'unify-sistemas' ? 'Unificando sistemas'
              : 'Procesando...';
            return (
              <div key={id} className="bg-white rounded-lg shadow-lg border border-slate-200 px-3 py-2 flex items-center gap-3 min-w-[200px]">
                <div className="shrink-0 w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-slate-700">{label}</p>
                  <div className="w-full bg-slate-100 rounded-full h-1 mt-1">
                    <div className="h-1 rounded-full bg-teal-500 transition-all duration-300" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 tabular-nums shrink-0">{pct}%</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating presupuesto modal — persists across route changes */}
      {floatingPres.presupuestoId && !floatingPres.minimized && (
        <EditPresupuestoModal
          presupuestoId={floatingPres.presupuestoId}
          open={true}
          onClose={floatingPres.close}
          onUpdated={floatingPres.onUpdated || undefined}
          onMinimize={floatingPres.minimize}
        />
      )}

      {/* Minimized presupuesto pill */}
      {floatingPres.presupuestoId && floatingPres.minimized && (
        <button
          onClick={floatingPres.restore}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 hover:bg-teal-700 text-white rounded-full px-4 py-2 shadow-lg flex items-center gap-2 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          <span className="text-xs font-medium">Presupuesto abierto</span>
          <svg className="w-3 h-3 ml-1 opacity-70" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
          </svg>
        </button>
      )}

      {/* Generic minimized modals bar */}
      <MinimizedModalsBar />
    </div>
  );
};
