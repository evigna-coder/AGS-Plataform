import { Outlet } from 'react-router-dom';
import TopBar from './TopBar';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import { NotificationBanner } from '../notifications/NotificationBanner';

export default function AppShell() {
  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden">
      <TopBar />
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-slate-50">
          <NotificationBanner />
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
