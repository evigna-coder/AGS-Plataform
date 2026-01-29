import React from 'react';
import { signOut, getSupportUrl, getAllowedDomain } from '../services/authService';

export const DomainErrorScreen: React.FC = () => {
  const supportUrl = getSupportUrl();
  const domain = getAllowedDomain();

  const handleClose = () => {
    signOut();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl border border-slate-100">
        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-2">
          Acceso no permitido
        </h1>
        <p className="text-sm text-slate-600 mb-4">
          Solo se permite acceso con cuentas <strong>@{domain}</strong>.
        </p>
        <p className="text-sm text-slate-500 mb-6">
          Si crees que deberías tener acceso, contacta a soporte.
        </p>
        <a
          href={supportUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm font-bold text-blue-600 hover:underline mb-4"
        >
          Ir a soporte →
        </a>
        <button
          type="button"
          onClick={handleClose}
          className="w-full bg-slate-200 text-slate-700 font-bold px-6 py-3 rounded-xl uppercase tracking-widest text-xs hover:bg-slate-300"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
};
