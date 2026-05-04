import { useState, useCallback } from 'react';
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

  /** Right-click → abrir en nueva ventana Electron (con fallback a tab interna en browser). */
  const handleContextMenu = useCallback((e: React.MouseEvent, path: string, label?: string, icon?: string) => {
    if (path.startsWith('#')) return;
    e.preventDefault();
    if (window.electronAPI?.openModuleWindow) {
      window.electronAPI.openModuleWindow(path);
    } else {
      const meta = label && icon ? { label, icon } : getNavMeta(path);
      openTab(path, meta.label, meta.icon);
    }
  }, [openTab]);

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
        title={collapsed ? item.name : 'Click derecho: abrir en nueva ventana'}
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
          title="Click derecho: abrir en nueva ventana"
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
    <aside
      className={`shrink-0 bg-slate-900 overflow-y-auto overflow-x-hidden flex flex-col transition-all duration-300 ease-in-out ${
        collapsed ? 'w-14' : 'w-56'
      }`}
    >
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {visibleNav.map(item => renderNode(item, 0))}
      </nav>
    </aside>
  );
};
