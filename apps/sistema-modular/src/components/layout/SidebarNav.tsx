import { useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTabs, getNavMeta } from '../../contexts/TabsContext';
import { navigation, NavItem } from './navigation';

interface SidebarNavProps {
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({ collapsed, onCollapse }) => {
  const { activeTabPath, openTab, navigateInActiveTab } = useTabs();
  const { canAccess } = useAuth();

  // Extract pathname (without search params) for active highlighting
  const pathname = activeTabPath.split('?')[0];

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    pathname.startsWith('/stock') ? { '/stock': true } : {}
  );

  const toggleGroup = (path: string) => {
    setExpandedGroups(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const isStockExpanded = expandedGroups['/stock'] || pathname.startsWith('/stock');

  const visibleNav = navigation.filter(item =>
    !item.modulo || canAccess(item.modulo)
  );

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

  const renderNavItem = (item: NavItem) => {
    const isActive =
      pathname === item.path ||
      pathname.startsWith(item.path + '/');

    if (item.children) {
      return renderGroupItem(item, isActive);
    }

    return (
      <div key={item.path} className="flex items-center">
        <a
          href={item.path}
          onClick={(e) => handleNavClick(e, item.path, item.name, item.icon)}
          onAuxClick={(e) => handleNavClick(e, item.path, item.name, item.icon)}
          className={`flex-1 flex items-center gap-3 py-2 px-3 text-sm transition-all border-l-2 ${
            isActive
              ? 'border-teal-500 bg-slate-800 text-white font-medium'
              : 'border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
          }`}
          title={collapsed ? item.name : undefined}
        >
          <span className="text-base leading-none shrink-0">{item.icon}</span>
          {!collapsed && <span className="leading-tight whitespace-nowrap">{item.name}</span>}
        </a>
        {!collapsed && (
          <button
            onClick={() => {
              if (window.electronAPI?.openModuleWindow) {
                window.electronAPI.openModuleWindow(item.path);
              } else {
                openTab(item.path, item.name, item.icon);
              }
            }}
            className="shrink-0 p-1.5 mr-1 rounded text-slate-600 hover:text-slate-200 hover:bg-slate-700 transition-colors"
            title="Abrir en nueva ventana"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
        )}
      </div>
    );
  };

  const renderGroupItem = (item: NavItem, isActive: boolean) => {
    const isExpanded = !collapsed && (item.path === '/stock' ? isStockExpanded : !!expandedGroups[item.path]);
    return (
      <div key={item.path}>
        <button
          onClick={() => collapsed ? onCollapse(false) : toggleGroup(item.path)}
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
            {item.children!.map((child) => {
              const childActive = pathname === child.path ||
                pathname.startsWith(child.path + '/');
              return (
                <div key={child.path}>
                  {child.separator && (
                    <div className="border-t border-slate-700 mx-3 my-1.5" />
                  )}
                  <a
                    href={child.path}
                    onClick={(e) => handleNavClick(e, child.path)}
                    onAuxClick={(e) => handleNavClick(e, child.path)}
                    className={`block py-1.5 pl-10 pr-3 text-xs transition-all border-l-2 whitespace-nowrap ${
                      childActive
                        ? 'border-teal-500 bg-slate-800 text-white font-medium'
                        : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
                    }`}
                  >
                    {child.name}
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className={`shrink-0 bg-slate-900 overflow-y-auto overflow-x-hidden flex flex-col transition-all duration-300 ease-in-out ${
        collapsed ? 'w-14' : 'w-56'
      }`}
    >
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {visibleNav.map(renderNavItem)}
      </nav>
    </aside>
  );
};
