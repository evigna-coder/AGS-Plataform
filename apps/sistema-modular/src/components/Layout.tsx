import { ReactNode, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { signOut } from '../services/authService';
import { MinimizedModalsBar } from './ui/Modal';
import { useLayoutKeyboardShortcuts } from './layout/useLayoutKeyboardShortcuts';
import { TabBar } from './layout/TabBar';
import { SidebarNav } from './layout/SidebarNav';
import { BackgroundTasksIndicator } from './layout/BackgroundTasksIndicator';
import { FloatingPresupuesto } from './layout/FloatingPresupuesto';

interface LayoutProps {
  children: ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { usuario } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  useLayoutKeyboardShortcuts();

  return (
    <div className="h-screen flex flex-col">
      <header className="shrink-0 h-14 bg-white border-b border-slate-200 flex items-center px-4 justify-between z-30">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setCollapsed(c => !c)}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded hover:bg-slate-100"
            title={collapsed ? 'Expandir menu' : 'Colapsar menu'}
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

      <TabBar />

      <div className="flex flex-1 overflow-hidden">
        <SidebarNav collapsed={collapsed} onCollapse={setCollapsed} />
        <main className="flex-1 min-h-0 bg-slate-50">
          {children}
        </main>
      </div>

      <BackgroundTasksIndicator />
      <FloatingPresupuesto />
      <MinimizedModalsBar />
    </div>
  );
};
