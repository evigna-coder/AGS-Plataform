import { NavLink, Outlet } from 'react-router-dom';
import { Bell, ChevronDown, LogOut } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAuth } from '@/contexts/AuthContext';
import { Brand } from './Brand';
import { NAV_ITEMS } from './navItems';

function AccountChip() {
  const { proveedor } = useAuth();
  if (!proveedor) return null;
  return (
    <button className="flex items-center gap-2.5 rounded-full bg-surface-muted p-1.5 pr-2.5">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-100 font-mono text-[11px] font-bold text-teal-700">
        {proveedor.iniciales}
      </span>
      <span className="hidden text-[13px] font-medium text-ink sm:inline">{proveedor.razonSocial}</span>
      <ChevronDown className="h-4 w-4 text-ink-faint" />
    </button>
  );
}

function LogoutButton() {
  const { logout } = useAuth();
  return (
    <button
      onClick={logout}
      title="Cerrar sesión"
      aria-label="Cerrar sesión"
      className="flex h-9 w-9 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
    >
      <LogOut className="h-[18px] w-[18px]" />
    </button>
  );
}

function DesktopHeader() {
  return (
    <header className="hidden h-[66px] items-center justify-between border-b border-line bg-surface px-8 md:flex">
      <div className="flex items-center gap-9">
        <Brand />
        <nav className="flex items-center gap-6">
          {NAV_ITEMS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'text-sm transition-colors',
                  isActive ? 'font-semibold text-teal-700' : 'text-ink-soft hover:text-ink',
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <Bell className="h-[19px] w-[19px] text-ink-soft" />
        <AccountChip />
        <LogoutButton />
      </div>
    </header>
  );
}

function MobileTopBar() {
  const { proveedor } = useAuth();
  return (
    <header className="flex h-14 items-center justify-between border-b border-line bg-surface px-[18px] md:hidden">
      <Brand />
      <div className="flex items-center gap-2.5">
        <Bell className="h-[19px] w-[19px] text-ink-soft" />
        <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-teal-100 font-mono text-[10px] font-bold text-teal-700">
          {proveedor?.iniciales}
        </span>
        <LogoutButton />
      </div>
    </header>
  );
}

function MobileTabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex h-16 items-center justify-around border-t border-line bg-surface px-3 md:hidden">
      {NAV_ITEMS.map(({ to, shortLabel, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            cn('flex flex-col items-center gap-1', isActive ? 'text-teal-700' : 'text-ink-faint')
          }
        >
          {({ isActive }) => (
            <>
              <Icon className="h-[21px] w-[21px]" />
              <span className={cn('text-[10px]', isActive && 'font-semibold')}>{shortLabel}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export function AppShell() {
  return (
    <div className="min-h-screen bg-app">
      <DesktopHeader />
      <MobileTopBar />
      <main className="mx-auto max-w-[1440px] px-[18px] pb-24 pt-5 md:px-8 md:pb-8 md:pt-8">
        <Outlet />
      </main>
      <MobileTabBar />
    </div>
  );
}
