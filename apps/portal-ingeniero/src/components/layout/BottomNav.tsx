import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { canAccessModulo } from '@ags/shared';
import { useAuth } from '../../contexts/AuthContext';
import MasMenu from './MasMenu';

const ICON = (d: string) => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
  </svg>
);

interface Tab { to: string; label: string; icon: React.ReactNode; show: boolean; }

export default function BottomNav() {
  const [showMas, setShowMas] = useState(false);
  const { usuario } = useAuth();
  // "Ingeniero" = tiene el módulo de OTs; tesorería/pagos no lo tiene.
  const isEngineer = usuario ? canAccessModulo(usuario, 'ordenes-trabajo') : false;
  const canPagos = usuario ? canAccessModulo(usuario, 'pagos') : false;

  const allTabs: Tab[] = [
    { to: '/reportes', label: 'Reportes', show: isEngineer, icon: ICON('M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z') },
    { to: '/mis-pendientes', label: 'Pendientes', show: isEngineer, icon: ICON('M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z') },
    { to: '/leads', label: 'Tickets', show: usuario ? canAccessModulo(usuario, 'leads') : false, icon: ICON('M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z') },
    { to: '/agenda', label: 'Agenda', show: usuario ? canAccessModulo(usuario, 'agenda') : false, icon: ICON('M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z') },
    { to: '/pagos-vep', label: 'Pagos', show: canPagos, icon: ICON('M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z') },
  ];
  const tabs = allTabs.filter(t => t.show).slice(0, 4);

  return (
    <>
      <nav className="md:hidden shrink-0 bg-white border-t border-slate-200 flex items-stretch" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {tabs.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] text-[10px] font-medium transition-colors ${
                isActive ? 'text-teal-600' : 'text-slate-400 hover:text-slate-600'
              }`
            }
          >
            {tab.icon}
            {tab.label}
          </NavLink>
        ))}
        <button
          onClick={() => setShowMas(true)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] text-[10px] font-medium text-slate-400 hover:text-slate-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M5 12h.01M12 12h.01M19 12h.01" />
          </svg>
          Más
        </button>
      </nav>
      <MasMenu open={showMas} onClose={() => setShowMas(false)} />
    </>
  );
}
