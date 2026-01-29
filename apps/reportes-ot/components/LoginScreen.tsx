import React, { useState } from 'react';
import { signInWithGoogle } from '../services/authService';

interface LoginScreenProps {
  onError?: (message: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onError }) => {
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al iniciar sesión';
      onError?.(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        {/* Logo con texto superpuesto; texto subido 2 cm */}
        <div className="relative flex flex-col items-center justify-center my-4" style={{ minHeight: '4cm' }}>
          <img
            src="/Logo.png"
            alt="AGS Analítica"
            className="object-contain"
            style={{
              width: '4cm',
              height: '4cm',
              maxWidth: '45%',
              maxHeight: '45%',
            }}
          />
          <div
            className="absolute left-0 right-0 flex flex-col items-center justify-center text-center"
            style={{ bottom: '0.6cm' }}
          >
            <h1 className="text-xl font-light text-slate-600 tracking-wide leading-tight">
              Reportes
            </h1>
            <p className="text-sm font-medium text-slate-500 tracking-wide mt-0.5">
              Órdenes de trabajo
            </p>
          </div>
        </div>
        <p className="text-sm text-slate-500 mb-6 mt-4">
          Inicia sesión con tu cuenta corporativa para continuar.
        </p>
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-200 text-slate-800 font-bold px-6 py-3.5 rounded-xl uppercase tracking-widest text-xs transition-all hover:bg-slate-50 hover:border-slate-300 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="animate-pulse">Ingresando…</span>
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.18H12v4.13h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Ingresar con Google
            </>
          )}
        </button>
      </div>
    </div>
  );
};
