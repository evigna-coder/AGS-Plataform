import { signOut } from '../../services/authService';
import { useAuth } from '../../contexts/AuthContext';

export default function TopBar() {
  const { usuario } = useAuth();

  async function handleSignOut() {
    await signOut();
  }

  return (
    <header className="shrink-0 h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-20">
      <span className="text-sm font-semibold text-slate-800 tracking-tight">Portal Ingeniero</span>

      <div className="flex items-center gap-3">
        {usuario?.photoURL ? (
          <img
            src={usuario.photoURL}
            alt={usuario.displayName}
            className="w-7 h-7 rounded-full object-cover"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center">
            <span className="text-[11px] font-semibold text-indigo-700">
              {usuario?.displayName?.charAt(0).toUpperCase() ?? 'U'}
            </span>
          </div>
        )}
        <span className="text-xs text-slate-600 hidden sm:block max-w-[120px] truncate">
          {usuario?.displayName}
        </span>
        <button
          onClick={handleSignOut}
          className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
          title="Cerrar sesión"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </header>
  );
}
