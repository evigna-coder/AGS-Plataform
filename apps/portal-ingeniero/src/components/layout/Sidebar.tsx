import { NavLink } from 'react-router-dom';
import { signOut } from '../../services/authService';
import { useAuth } from '../../contexts/AuthContext';

const NAV_ITEMS = [
  { to: '/ordenes-trabajo', label: 'Mis OTs' },
  { to: '/historial', label: 'Historial' },
  { to: '/agenda', label: 'Agenda' },
  { to: '/leads', label: 'Leads' },
  { to: '/perfil', label: 'Perfil' },
];

export default function Sidebar() {
  const { usuario } = useAuth();

  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 bg-slate-900 min-h-0">
      {/* Branding */}
      <div className="px-5 py-4 border-b border-slate-700">
        <p className="text-xs font-semibold text-slate-400 tracking-widest uppercase">AGS Analítica</p>
        <p className="text-sm font-semibold text-white mt-0.5">Portal Ingeniero</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white border-l-2 border-indigo-300 pl-[10px]'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div className="px-3 py-3 border-t border-slate-700 flex items-center gap-2">
        {usuario?.photoURL ? (
          <img src={usuario.photoURL} alt="" className="w-7 h-7 rounded-full shrink-0" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
            <span className="text-[11px] text-slate-300">{usuario?.displayName?.charAt(0)}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium text-slate-200 truncate">{usuario?.displayName}</p>
          <p className="text-[10px] text-slate-500 truncate">{usuario?.email}</p>
        </div>
        <button
          onClick={() => signOut()}
          className="text-slate-500 hover:text-slate-300 transition-colors"
          title="Cerrar sesión"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
