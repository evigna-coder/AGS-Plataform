import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, isAllowedDomain } from '../services/authService';
import type { User } from '../services/authService';
import { LoginScreen } from './LoginScreen';
import { DomainErrorScreen } from './DomainErrorScreen';

interface AuthGateProps {
  children: React.ReactNode;
}

type AuthPhase = 'loading' | 'login' | 'domain_error' | 'authenticated';

/**
 * Envuelve la app: solo login con Google y validación de dominio @agsanalitica.com.
 * (El segundo factor WebAuthn está deshabilitado por ahora.)
 */
export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  // Modo firma por QR: el cliente no tiene cuenta, dejar pasar sin auth
  const isModoFirma = new URLSearchParams(window.location.search).get('modo') === 'firma';

  const [user, setUser] = useState<User | null>(null);
  const [phase, setPhase] = useState<AuthPhase>(isModoFirma ? 'authenticated' : 'loading');
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    if (isModoFirma) return; // No necesita auth
    const unsubscribe = onAuthStateChanged((u) => {
      setUser(u);
      setLoginError(null);
    });
    return () => unsubscribe();
  }, [isModoFirma]);

  useEffect(() => {
    if (isModoFirma) return; // Ya está en 'authenticated'
    if (!user) {
      setPhase('login');
      return;
    }
    if (!isAllowedDomain(user)) {
      setPhase('domain_error');
      return;
    }
    setPhase('authenticated');
  }, [user, isModoFirma]);

  const handleLoginError = (message: string) => {
    setLoginError(message);
  };

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500 animate-pulse">Cargando…</p>
      </div>
    );
  }

  if (phase === 'login') {
    return (
      <>
        <LoginScreen onError={handleLoginError} />
        {loginError && (
          <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto bg-red-50 border border-red-200 text-red-800 text-sm p-4 rounded-xl shadow-lg">
            {loginError}
          </div>
        )}
      </>
    );
  }

  if (phase === 'domain_error') {
    return <DomainErrorScreen />;
  }

  return <>{children}</>;
};
