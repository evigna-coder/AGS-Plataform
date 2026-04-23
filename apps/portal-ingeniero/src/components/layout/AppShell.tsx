import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import TopBar from './TopBar';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import { NotificationBanner } from '../notifications/NotificationBanner';
import { InstallBanner } from './InstallBanner';

const LS_KEY = 'pi-sidebar-collapsed';

export default function AppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(
    () => typeof window !== 'undefined' && localStorage.getItem(LS_KEY) === 'true',
  );

  useEffect(() => {
    localStorage.setItem(LS_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden">
      <TopBar />
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        <Sidebar collapsed={sidebarCollapsed} />
        <button
          onClick={() => setSidebarCollapsed(c => !c)}
          className="hidden md:flex absolute top-3 z-20 w-6 h-6 items-center justify-center rounded-full bg-white border border-slate-200 shadow-md hover:shadow-lg text-slate-500 hover:text-teal-600 transition-all duration-200"
          style={{ left: sidebarCollapsed ? '8px' : 'calc(12rem - 12px)' }}
          title={sidebarCollapsed ? 'Mostrar menú' : 'Ocultar menú'}
          aria-label={sidebarCollapsed ? 'Mostrar menú lateral' : 'Ocultar menú lateral'}
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform duration-200 ${sidebarCollapsed ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <main className="flex-1 overflow-y-auto bg-slate-50">
          <InstallBanner />
          <NotificationBanner />
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
