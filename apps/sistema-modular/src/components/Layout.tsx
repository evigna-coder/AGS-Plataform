import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: ReactNode;
}

interface NavItem {
  name: string;
  path: string;
  icon: string;
  children?: { name: string; path: string; separator?: boolean }[];
}

const navigation: NavItem[] = [
  { name: 'Clientes', path: '/clientes', icon: '🏢' },
  { name: 'Establecimientos', path: '/establecimientos', icon: '🏭' },
  { name: 'Equipos', path: '/equipos', icon: '⚙️' },
  { name: 'Órdenes de Trabajo', path: '/ordenes-trabajo', icon: '📝' },
  { name: 'Leads', path: '/leads', icon: '👥' },
  { name: 'Presupuestos', path: '/presupuestos', icon: '📋' },
  { name: 'Biblioteca Tablas', path: '/table-catalog', icon: '📐' },
  { name: 'Instrumentos', path: '/instrumentos', icon: '🔬' },
  { name: 'Fichas Propiedad', path: '/fichas', icon: '🔧' },
  { name: 'Loaners', path: '/loaners', icon: '🔄' },
  {
    name: 'Stock', path: '/stock', icon: '📦',
    children: [
      { name: 'Artículos', path: '/stock/articulos' },
      { name: 'Unidades', path: '/stock/unidades' },
      { name: 'Minikits', path: '/stock/minikits' },
      { name: 'Remitos', path: '/stock/remitos' },
      { name: 'Movimientos', path: '/stock/movimientos' },
      { name: 'Alertas', path: '/stock/alertas' },
      { name: 'Ingenieros', path: '/stock/ingenieros', separator: true },
      { name: 'Proveedores', path: '/stock/proveedores' },
      { name: 'Posiciones', path: '/stock/posiciones' },
      { name: 'Marcas', path: '/stock/marcas' },
    ],
  },
  { name: 'Agenda', path: '/agenda', icon: '📅' },
  { name: 'Facturación', path: '/facturacion', icon: '💰' },
];

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    location.pathname.startsWith('/stock') ? { '/stock': true } : {}
  );

  const toggleGroup = (path: string) => {
    setExpandedGroups(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const isStockExpanded = expandedGroups['/stock'] || location.pathname.startsWith('/stock');

  return (
    <div className="h-screen flex flex-col">
      {/* Header — blanco limpio */}
      <header className="shrink-0 h-14 bg-white border-b border-slate-200 flex items-center px-6 justify-between z-30">
        <div className="flex items-center gap-2.5">
          <span className="text-indigo-600 font-bold text-base tracking-tight">AGS</span>
          <span className="text-slate-300 text-sm">|</span>
          <span className="text-slate-600 text-sm font-medium">Sistema Modular</span>
          {window.electronAPI && (
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-xs font-medium">
              Desktop
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400 font-medium">v0.1.0</span>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — oscuro con indicador de borde izquierdo */}
        <aside className="w-56 shrink-0 bg-slate-900 overflow-y-auto flex flex-col">
          <nav className="flex-1 px-3 py-4 space-y-0.5">
            {navigation.map((item) => {
              const isActive =
                location.pathname === item.path ||
                location.pathname.startsWith(item.path + '/');

              // Expandable group (Stock)
              if (item.children) {
                const isExpanded = item.path === '/stock' ? isStockExpanded : !!expandedGroups[item.path];
                return (
                  <div key={item.path}>
                    <button
                      onClick={() => toggleGroup(item.path)}
                      className={`w-full flex items-center gap-3 py-2 px-3 text-sm transition-all border-l-2 ${
                        isActive
                          ? 'border-indigo-500 bg-slate-800 text-white font-medium'
                          : 'border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                      }`}
                    >
                      <span className="text-base leading-none">{item.icon}</span>
                      <span className="leading-tight flex-1 text-left">{item.name}</span>
                      <span className={`text-[10px] transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
                    </button>
                    {isExpanded && (
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
                                className={`block py-1.5 pl-10 pr-3 text-xs transition-all border-l-2 ${
                                  childActive
                                    ? 'border-indigo-500 bg-slate-800 text-white font-medium'
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

              // Regular nav item
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 py-2 px-3 text-sm transition-all border-l-2 ${
                    isActive
                      ? 'border-indigo-500 bg-slate-800 text-white font-medium'
                      : 'border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`}
                >
                  <span className="text-base leading-none">{item.icon}</span>
                  <span className="leading-tight">{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main — fondo neutro claro, scroll independiente */}
        <main className="flex-1 overflow-y-auto bg-slate-50 p-6">
          {children}
        </main>
      </div>
    </div>
  );
};
