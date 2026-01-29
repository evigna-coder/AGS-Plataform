import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, isAllowedDomain, signOut } from '../services/authService';
import type { User } from '../services/authService';
import { getAuthOptions } from '../services/webauthnClient';
import { LoginScreen } from './LoginScreen';
import { DomainErrorScreen } from './DomainErrorScreen';
import { WebAuthnModal } from './WebAuthnModal';
import { MfaEnrollModal } from './MfaEnrollModal';

interface AuthGateProps {
  children: React.ReactNode;
}

type AuthPhase = 'loading' | 'login' | 'domain_error' | 'mfa_check' | 'mfa_enroll' | 'mfa_required' | 'authenticated';

type MfaCheckResult = 'pending' | 'no_devices' | 'has_options' | 'error';

/** Segundo factor solo en móvil. En escritorio (Windows, Mac, Linux, Chromebook) se omite. */
function shouldRequireMfa(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // Escritorio: Chrome/Firefox/Edge en Windows, Mac, Linux o Chromebook → no pedir MFA
  if (/Windows NT|Win64|WOW64/i.test(ua)) return false;
  if (/Macintosh|Mac OS X/i.test(ua)) return false;
  if (/CrOS/i.test(ua)) return false; // Chromebook
  if (/Linux/i.test(ua) && !/Android/i.test(ua)) return false;
  // Resto (iPhone, iPad, Android, etc.) → pedir MFA
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

/**
 * Envuelve la app: Google Sign-In → dominio @agsanalitica.com. Segundo factor WebAuthn solo en móvil.
 * En escritorio se accede sin segundo factor. En móvil, si no hay dispositivos registrados se abre
 * el registro (patrón, facial, huella, etc.).
 */
export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [phase, setPhase] = useState<AuthPhase>('loading');
  const [mfaCheckResult, setMfaCheckResult] = useState<MfaCheckResult>('pending');
  const [authOptionsForVerify, setAuthOptionsForVerify] = useState<PublicKeyCredentialRequestOptions | null>(null);
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
    if (!shouldRequireMfa()) {
      setPhase('authenticated');
      return;
    }
    setPhase('mfa_check');
    setMfaCheckResult('pending');
    setAuthOptionsForVerify(null);
  }, [user]);

  // Una vez en mfa_check, consultar si hay dispositivos; si no, mostrar enrolamiento automático.
  useEffect(() => {
    if (phase !== 'mfa_check' || mfaCheckResult !== 'pending') return;
    let cancelled = false;
    getAuthOptions().then((result) => {
      if (cancelled) return;
      if (result.error === 'no_registered_devices') {
        setMfaCheckResult('no_devices');
        setPhase('mfa_enroll');
        return;
      }
      if (result.options) {
        setAuthOptionsForVerify(result.options);
        setMfaCheckResult('has_options');
        setPhase('mfa_required');
        return;
      }
      setMfaCheckResult('error');
      setPhase('mfa_required');
    });
    return () => { cancelled = true; };
  }, [phase, mfaCheckResult]);

  const handleWebAuthnSuccess = () => {
    setPhase('authenticated');
    setAuthOptionsForVerify(null);
  };

  const handleWebAuthnError = (message: string) => {
    setPhase('mfa_check');
    setMfaCheckResult('pending');
    setAuthOptionsForVerify(null);
    setLoginError(message);
    signOut();
  };

  const handleEnrollSuccess = () => {
    setPhase('authenticated');
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

  // Primera vez en dispositivo: no hay dispositivos registrados → enrolamiento automático.
  if (phase === 'mfa_enroll') {
    return (
      <MfaEnrollModal
        isOpen={true}
        onClose={() => {}}
        onSuccess={handleEnrollSuccess}
        isFirstTimeEnrollment
      />
    );
  }

  if (phase === 'mfa_check' && mfaCheckResult === 'pending') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500 animate-pulse">Preparando inicio de sesión…</p>
      </div>
    );
  }

  if (phase === 'mfa_required') {
    return (
      <WebAuthnModal
        isOpen={true}
        initialOptions={authOptionsForVerify}
        onSuccess={handleWebAuthnSuccess}
        onError={handleWebAuthnError}
      />
    );
  }

  return <>{children}</>;
};
