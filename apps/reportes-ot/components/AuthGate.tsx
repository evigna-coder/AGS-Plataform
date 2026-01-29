import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, isAllowedDomain, signOut } from '../services/authService';
import type { User } from '../services/authService';
import { LoginScreen } from './LoginScreen';
import { DomainErrorScreen } from './DomainErrorScreen';
import { WebAuthnModal } from './WebAuthnModal';
import { MfaEnrollModal } from './MfaEnrollModal';

interface AuthGateProps {
  children: React.ReactNode;
}

type AuthPhase = 'loading' | 'login' | 'domain_error' | 'mfa_required' | 'authenticated';

/**
 * Envuelve la app y exige: Google Sign-In → dominio @agsanalitica.com → segundo factor WebAuthn (si tiene dispositivo registrado).
 */
export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [phase, setPhase] = useState<AuthPhase>('loading');
  const [showWebAuthnModal, setShowWebAuthnModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged((u) => {
      setUser(u);
      setLoginError(null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setPhase('login');
      return;
    }
    if (!isAllowedDomain(user)) {
      setPhase('domain_error');
      return;
    }
    setPhase('mfa_required');
    setShowWebAuthnModal(true);
  }, [user]);

  const handleWebAuthnSuccess = () => {
    setShowWebAuthnModal(false);
    setPhase('authenticated');
  };

  const handleWebAuthnError = (message: string) => {
    setShowWebAuthnModal(false);
    setLoginError(message);
    signOut();
  };

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

  if (phase === 'mfa_required' && showWebAuthnModal) {
    return (
      <WebAuthnModal
        isOpen={true}
        onSuccess={handleWebAuthnSuccess}
        onError={handleWebAuthnError}
      />
    );
  }

  return (
    <>
      {children}
      <button
        type="button"
        onClick={() => setShowEnrollModal(true)}
        className="fixed bottom-6 left-6 no-print z-40 text-xs font-bold text-slate-500 hover:text-slate-700 uppercase tracking-wider"
        aria-label="Seguridad y segundo factor"
      >
        Seguridad
      </button>
      {showEnrollModal && (
        <MfaEnrollModal
          isOpen={true}
          onClose={() => setShowEnrollModal(false)}
          onSuccess={() => setShowEnrollModal(false)}
        />
      )}
    </>
  );
};
