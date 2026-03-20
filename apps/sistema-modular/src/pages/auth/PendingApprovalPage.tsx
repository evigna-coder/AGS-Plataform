import { useAuth } from '../../contexts/AuthContext';
import { signOut } from '../../services/authService';

export const PendingApprovalPage = () => {
  const { usuario } = useAuth();

  return (
    <div className="h-screen bg-slate-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 w-full max-w-sm text-center">
        <div className="mb-4">
          <span className="text-indigo-600 font-bold text-xl tracking-tight">AGS</span>
        </div>

        {usuario?.photoURL && (
          <img src={usuario.photoURL} alt="" className="w-16 h-16 rounded-full mx-auto mb-3" referrerPolicy="no-referrer" />
        )}

        <h2 className="text-base font-semibold text-slate-900 tracking-tight mb-1">
          {usuario?.displayName || 'Usuario'}
        </h2>
        <p className="text-xs text-slate-400 mb-4">{usuario?.email}</p>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-3 mb-5">
          <p className="text-xs text-yellow-800 font-medium mb-0.5">Cuenta pendiente de aprobacion</p>
          <p className="text-[11px] text-yellow-600">Un administrador debe aprobar tu cuenta y asignarte un rol para acceder al sistema.</p>
        </div>

        <button
          onClick={() => signOut()}
          className="text-xs text-slate-500 hover:text-slate-700 font-medium transition-colors"
        >
          Cerrar sesion
        </button>
      </div>
    </div>
  );
};
