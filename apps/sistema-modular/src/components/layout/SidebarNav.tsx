import { useState, useCallback, useEffect } from 'react';
import { useTabs, getNavMeta } from '../../contexts/TabsContext';
import { useNavigation, NavItem } from './navigation';

interface SidebarNavProps {
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({ collapsed, onCollapse }) => {
  const { activeTabPath, openTab, navigateInActiveTab } = useTabs();

  const pathname = activeTabPath.split('?')[0];

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [menu, setMenu] = useState<{ x: number; y: number; path: string; label: string; icon: string } | null>(null);

  /** Recursivo: el grupo se auto-expande cuando la ruta activa cae adentro suyo (a cualquier profundidad). */
  const isPathInside = (item: NavItem): boolean => {
    if (!item.path.startsWith('#')) {
      if (pathname === item.path || pathname.startsWith(item.path + '/')) return true;
    }
    return item.children?.some(isPathInside) ?? false;
  };

  /** Toggle invierte el estado *visible* — un click siempre cierra/abre lo que se ve. */
  const toggleGroup = (item: NavItem) => {
    const currentlyExpanded = expandedGroups[item.path] ?? isPathInside(item);
    setExpandedGroups(prev => ({ ...prev, [item.path]: !currentlyExpanded }));
  };

  const visibleNav = useNavigation();

  /** Normal click → navigate active tab. Ctrl/Meta/middle → open new tab. */
  const handleNavClick = useCallback((e: React.MouseEvent, path: string, label?: string, icon?: string) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey || e.button === 1) {
      const meta = label && icon ? { label, icon } : getNavMeta(path);
      openTab(path, meta.label, meta.icon);
    } else {
      navigateInActiveTab(path);
    }
  }, [openTab, navigateInActiveTab]);

  /** Right-click → abrir menú contextual con opciones de pestaña / ventana. */
  const handleContextMenu = useCallback((e: React.MouseEvent, path: string, label?: string, icon?: string) => {
    if (path.startsWith('#')) return;
    e.preventDefault();
    const meta = label && icon ? { label, icon } : getNavMeta(path);
    setMenu({ x: e.clientX, y: e.clientY, path, label: meta.label, icon: meta.icon });
  }, []);

  // Cerrar menú con click fuera o ESC.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
    window.addEventListener('click', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  const renderNode = (item: NavItem, depth: number): React.ReactNode => {
    if (item.children) return renderGroupNode(item, depth);
    return renderLeafNode(item, depth);
  };

  // ── Top-level leaf ──
  const renderTopLeaf = (item: NavItem) => {
    const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
    return (
      <a
        key={item.path}
        href={item.path}
        onClick={(e) => handleNavClick(e, item.path, item.name, item.icon)}
        onAuxClick={(e) => handleNavClick(e, item.path, item.name, item.icon)}
        onContextMenu={(e) => handleContextMenu(e, item.path, item.name, item.icon)}
        className={`flex items-center gap-3 py-2 px-3 text-sm transition-all border-l-2 ${
          isActive
            ? 'border-teal-500 bg-slate-800 text-white font-medium'
            : 'border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
        }`}
        title={collapsed ? item.name : 'Click derecho: opciones'}
      >
        <span className="text-base leading-none shrink-0">{item.icon}</span>
        {!collapsed && <span className="leading-tight whitespace-nowrap">{item.name}</span>}
      </a>
    );
  };

  // ── Nested leaf: smaller, indented per depth ──
  const renderNestedLeaf = (item: NavItem, depth: number) => {
    const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
    // depth 1: pl-7 (con icon) / pl-10 (sin icon).  depth 2+: indent extra.
    const basePadding = depth === 1
      ? (item.icon ? 'pl-7' : 'pl-10')
      : (item.icon ? 'pl-12' : 'pl-14');
    return (
      <div key={item.path}>
        {item.separator && (
          <div className="border-t border-slate-700 mx-3 my-1.5" />
        )}
        <a
          href={item.path}
          onClick={(e) => handleNavClick(e, item.path)}
          onAuxClick={(e) => handleNavClick(e, item.path)}
          onContextMenu={(e) => handleContextMenu(e, item.path, item.name, item.icon)}
          title="Click derecho: opciones"
          className={`flex items-center gap-2 py-1.5 ${basePadding} pr-3 text-xs transition-all border-l-2 whitespace-nowrap ${
            isActive
              ? 'border-teal-500 bg-slate-800 text-white font-medium'
              : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
          }`}
        >
          {item.icon && <span className="text-sm leading-none shrink-0">{item.icon}</span>}
          <span>{item.name}</span>
        </a>
      </div>
    );
  };

  const renderLeafNode = (item: NavItem, depth: number) => {
    return depth === 0 ? renderTopLeaf(item) : renderNestedLeaf(item, depth);
  };

  // ── Top-level group: full-size header ──
  const renderTopGroup = (item: NavItem) => {
    const userToggle = expandedGroups[item.path];
    const isExpanded = !collapsed && (userToggle ?? isPathInside(item));
    const isActive =
      (!item.path.startsWith('#') && (pathname === item.path || pathname.startsWith(item.path + '/'))) ||
      isPathInside(item);
    return (
      <div key={item.path}>
        <button
          onClick={() => collapsed ? onCollapse(false) : toggleGroup(item)}
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
            {item.children!.map(c => renderNode(c, 1))}
          </div>
        )}
      </div>
    );
  };

  // ── Nested group (sub-grupo dentro de un grupo): header más chico, indentado ──
  const renderNestedGroup = (item: NavItem, depth: number) => {
    const userToggle = expandedGroups[item.path];
    const isExpanded = userToggle ?? isPathInside(item);
    const isActive = isPathInside(item);
    return (
      <div key={item.path}>
        {item.separator && (
          <div className="border-t border-slate-700 mx-3 my-1.5" />
        )}
        <button
          onClick={() => toggleGroup(item)}
          className={`w-full flex items-center gap-2 py-1.5 ${item.icon ? 'pl-7' : 'pl-10'} pr-3 text-xs transition-all border-l-2 whitespace-nowrap ${
            isActive
              ? 'border-teal-500 text-white font-medium'
              : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
          }`}
        >
          {item.icon && <span className="text-sm leading-none shrink-0">{item.icon}</span>}
          <span className="flex-1 text-left">{item.name}</span>
          <span className={`text-[10px] transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
        </button>
        {isExpanded && (
          <div className="space-y-0.5 mt-0.5">
            {item.children!.map(c => renderNode(c, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderGroupNode = (item: NavItem, depth: number) => {
    return depth === 0 ? renderTopGroup(item) : renderNestedGroup(item, depth);
  };

  return (
    <>
      <aside
        className={`shrink-0 bg-slate-900 overflow-y-auto overflow-x-hidden flex flex-col transition-all duration-300 ease-in-out ${
          collapsed ? 'w-14' : 'w-56'
        }`}
      >
        <nav className="flex-1 px-2 py-4 space-y-0.5">
          {visibleNav.map(item => renderNode(item, 0))}
        </nav>
      </aside>
      {menu && (
        <div
          className="fixed z-50 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[200px]"
          style={{ left: menu.x, top: menu.y }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            onClick={() => { openTab(menu.path, menu.label, menu.icon); setMenu(null); }}
            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-teal-50 hover:text-teal-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
            </svg>
            Abrir en nueva pestaña
          </button>
          <button
            onClick={() => {
              if (window.electronAPI?.openModuleWindow) window.electronAPI.openModuleWindow(menu.path);
              else window.open(menu.path, '_blank', 'noopener,noreferrer');
              setMenu(null);
            }}
            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-teal-50 hover:text-teal-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            Abrir en nueva ventana
          </button>
        </div>
      )}
    </>
  );
};
