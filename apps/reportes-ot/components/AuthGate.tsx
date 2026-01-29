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

type AuthPhase = 'loading' | 'login' | 'domain_error' | 'mfa_check' | 'mfa_enroll' | 'mfa_required' | 'mfa_error' | 'authenticated';

type MfaCheckResult = 'pending' | 'no_devices' | 'has_options' | 'error';

/** En producción (app desplegada) siempre se pide segundo factor. En localhost solo en móvil. */
function shouldRequireMfa(): boolean {
  if (import.meta.env.PROD) return true;
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // En desarrollo, escritorio (Windows, Mac, Linux, Chromebook) → no pedir MFA
  if (/Windows NT|Win64|WOW64/i.test(ua)) return false;
  if (/Macintosh|Mac OS X/i.test(ua)) return false;
  if (/CrOS/i.test(ua)) return false;
  if (/Linux/i.test(ua) && !/Android/i.test(ua)) return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

/**
 * Envuelve la app: Google Sign-In → dominio @agsanalitica.com.
 * En app desplegada: siempre segundo factor (escritorio y móvil). En localhost: solo en móvil.
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
    getAuthOptions()
      .then((result) => {
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
      })
      .catch(() => {
        if (cancelled) return;
        setMfaCheckResult('error');
        setPhase('mfa_error');
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

  const handleMfaErrorRetry = () => {
    setMfaCheckResult('pending');
    setPhase('mfa_check');
  };

  const handleMfaErrorContinue = () => {
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

  if (phase === 'mfa_error') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 max-w-sm w-full text-center">
          <h2 className="text-lg font-bold text-slate-800 mb-2">No se pudo comprobar el segundo factor</h2>
          <p className="text-sm text-slate-600 mb-6">
            Comprueba la conexión o vuelve a intentar. Si el problema continúa, puedes continuar sin segundo factor en esta sesión.
          </p>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleMfaErrorRetry}
              className="w-full bg-emerald-600 text-white font-bold py-3 px-4 rounded-xl uppercase tracking-wider text-sm"
            >
              Reintentar
            </button>
            <button
              type="button"
              onClick={handleMfaErrorContinue}
              className="w-full bg-slate-200 text-slate-700 font-medium py-3 px-4 rounded-xl text-sm"
            >
              Continuar sin segundo factor
            </button>
          </div>
        </div>
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
        onRegisterDevice={() => {
          setPhase('mfa_enroll');
          setAuthOptionsForVerify(null);
        }}
      />
    );
  }

  return <>{children}</>;
};
