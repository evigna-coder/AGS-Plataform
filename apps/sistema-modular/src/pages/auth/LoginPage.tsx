import { useState } from 'react';
import { signInWithGoogle } from '../../services/authService';

export const LoginPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido al iniciar sesion';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-slate-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 w-full max-w-sm text-center">
        <div className="mb-6">
          <span className="text-indigo-600 font-bold text-2xl tracking-tight">AGS</span>
          <p className="text-slate-400 text-xs mt-1">Sistema Modular</p>
        </div>

        <h1 className="text-lg font-semibold text-slate-900 tracking-tight mb-1">Iniciar sesion</h1>
        <p className="text-xs text-slate-400 mb-6">Solo cuentas @agsanalitica.com</p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium text-sm rounded-lg px-4 py-2.5 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          {loading ? 'Conectando...' : 'Continuar con Google'}
        </button>

        <p className="text-[10px] text-slate-300 mt-4">v0.1.0</p>
      </div>
    </div>
  );
};
