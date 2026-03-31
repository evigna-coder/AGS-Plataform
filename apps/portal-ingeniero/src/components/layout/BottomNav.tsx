import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import MasMenu from './MasMenu';

const NAV_TABS = [
  {
    to: '/ordenes-trabajo',
    label: 'Mis OTs',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    to: '/historial',
    label: 'Historial',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    to: '/leads',
    label: 'Tickets',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    ),
  },
  {
    to: '/agenda',
    label: 'Agenda',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const [showMas, setShowMas] = useState(false);

  return (
    <>
      <nav className="md:hidden shrink-0 bg-white border-t border-slate-200 flex items-stretch" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {NAV_TABS.map(tab => (
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
