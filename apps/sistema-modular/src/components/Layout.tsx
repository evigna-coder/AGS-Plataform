import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Clientes', path: '/clientes', icon: '🏢' },
  { name: 'Establecimientos', path: '/establecimientos', icon: '🏭' },
  { name: 'Equipos', path: '/equipos', icon: '⚙️' },
  { name: 'Órdenes de Trabajo', path: '/ordenes-trabajo', icon: '📝' },
  { name: 'Leads', path: '/leads', icon: '👥' },
  { name: 'Presupuestos', path: '/presupuestos', icon: '📋' },
  { name: 'Biblioteca Tablas', path: '/table-catalog', icon: '📐' },
  { name: 'Stock', path: '/stock', icon: '📦' },
  { name: 'Agenda', path: '/agenda', icon: '📅' },
  { name: 'Facturación', path: '/facturacion', icon: '💰' },
];

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();

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
