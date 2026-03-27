import { useState, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTabs, getNavMeta } from '../../contexts/TabsContext';
import { navigation, NavItem } from './navigation';

interface SidebarNavProps {
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({ collapsed, onCollapse }) => {
  const location = useLocation();
  const { canAccess } = useAuth();
  const { openTab } = useTabs();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    location.pathname.startsWith('/stock') ? { '/stock': true } : {}
  );

  const toggleGroup = (path: string) => {
    setExpandedGroups(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const isStockExpanded = expandedGroups['/stock'] || location.pathname.startsWith('/stock');

  const visibleNav = navigation.filter(item =>
    !item.modulo || canAccess(item.modulo)
  );

  /** Ctrl+click or middle-click opens in new internal tab */
  const handleNavClick = useCallback((e: React.MouseEvent, path: string) => {
    if (e.ctrlKey || e.metaKey || e.button === 1) {
      e.preventDefault();
      const meta = getNavMeta(path);
      openTab(path, meta.label, meta.icon);
    }
  }, [openTab]);

  const renderNavItem = (item: NavItem) => {
    const isActive =
      location.pathname === item.path ||
      location.pathname.startsWith(item.path + '/');

    if (item.children) {
      return renderGroupItem(item, isActive);
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
            title="Abrir en nueva pestana"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
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
