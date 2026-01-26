import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Clientes', path: '/clientes', icon: '🏢' },
  { name: 'Equipos', path: '/equipos', icon: '⚙️' },
  { name: 'Órdenes de Trabajo', path: '/ordenes-trabajo', icon: '📝' },
  { name: 'Leads', path: '/leads', icon: '👥' },
  { name: 'Presupuestos', path: '/presupuestos', icon: '📋' },
  { name: 'Stock', path: '/stock', icon: '📦' },
  { name: 'Agenda', path: '/agenda', icon: '📅' },
  { name: 'Facturación', path: '/facturacion', icon: '💰' },
];

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                AGS Sistema Modular
              </h1>
              {window.electronAPI && (
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-bold uppercase">
                  🖥️ Desktop
                </span>
              )}
            </div>
            <div className="text-sm text-slate-500 font-medium">
              Versión 0.1.0
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar Navigation */}
        <aside className="w-64 bg-white border-r border-slate-200 min-h-[calc(100vh-73px)]">
          <nav className="p-4 space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.path || 
                              location.pathname.startsWith(item.path + '/');
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm uppercase tracking-widest transition-all ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
};
