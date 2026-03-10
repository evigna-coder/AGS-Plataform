import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import MasMenu from './MasMenu';

const NAV_TABS = [
  {
    to: '/reportes',
    label: 'Reportes',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    to: '/ordenes-trabajo',
    label: 'OTs',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    to: '/equipos',
    label: 'Equipos',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
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
                isActive ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
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
