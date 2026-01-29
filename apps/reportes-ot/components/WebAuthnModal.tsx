import React, { useState, useEffect } from 'react';
import { getAuthOptions, submitAuthResult } from '../services/webauthnClient';

interface WebAuthnModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onError: (message: string) => void;
}

/**
 * Modal para completar el segundo factor (WebAuthn: Face/huella/patrón o llave de seguridad).
 * En escritorio permite "Continuar sin segundo factor" para esta sesión si no hay forma de completarlo.
 */
export const WebAuthnModal: React.FC<WebAuthnModalProps> = ({ isOpen, onSuccess, onError }) => {
  const [status, setStatus] = useState<'idle' | 'requesting' | 'waiting' | 'verifying' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleSkipThisDevice = () => {
    onSuccess();
  };

  useEffect(() => {
    if (!isOpen || status !== 'idle') return;

    let cancelled = false;

    const run = async () => {
      setStatus('requesting');
      const { options, error } = await getAuthOptions();
      if (cancelled) return;
      if (error === 'no_registered_devices') {
        onSuccess();
        return;
      }
      if (error || !options) {
        setStatus('error');
        setErrorMessage(error ?? 'No se pudieron obtener las opciones');
        return;
      }
      setStatus('waiting');
      try {
        const credential = await navigator.credentials.get({ publicKey: options });
        if (cancelled) return;
        if (!credential || !(credential instanceof PublicKeyCredential)) {
          setStatus('error');
          setErrorMessage('No se completó el desbloqueo en el dispositivo.');
          return;
        }
        setStatus('verifying');
        const result = await submitAuthResult(credential);
        if (cancelled) return;
        if (result.verified) {
          onSuccess();
        } else {
          setStatus('error');
          setErrorMessage(result.error ?? 'Verificación fallida');
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Error al verificar';
        setStatus('error');
        setErrorMessage(msg);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [isOpen, status, onSuccess, onError]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4 no-print"
      role="dialog"
      aria-modal="true"
      aria-labelledby="webauthn-title"
    >
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100">
        <h2 id="webauthn-title" className="text-lg font-black text-slate-900 uppercase tracking-tighter mb-2">
          Segundo factor requerido
        </h2>
        <p className="text-sm text-slate-600 mb-4">
          Confirma con tu dispositivo (Face ID, huella, patrón) o con una llave de seguridad / passkey.
        </p>

        {status === 'requesting' && (
          <p className="text-sm text-slate-500 animate-pulse mb-4">Preparando…</p>
        )}
        {status === 'waiting' && (
          <p className="text-sm text-slate-600 mb-4">
            Confirma en tu dispositivo o en el diálogo del navegador.
          </p>
        )}
        {status === 'verifying' && (
          <p className="text-sm text-slate-500 animate-pulse mb-4">Verificando…</p>
        )}
        {status === 'error' && (
          <p className="text-sm text-red-600 mb-4">{errorMessage}</p>
        )}

        {/* Siempre visible: permite continuar sin segundo factor en escritorio */}
        <div className="space-y-3 pt-2 border-t border-slate-200">
          <p className="text-xs text-slate-500">
            ¿No puedes usar el segundo factor en este equipo? Puedes continuar solo en esta sesión.
          </p>
          <button
            type="button"
            onClick={handleSkipThisDevice}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-4 py-3 rounded-xl text-sm border border-slate-200"
          >
            Continuar sin segundo factor en este equipo
          </button>
        </div>

        {status === 'error' && (
          <button
            type="button"
            onClick={() => onError(errorMessage)}
            className="w-full mt-3 bg-slate-200 text-slate-700 font-bold px-6 py-2 rounded-xl uppercase tracking-widest text-xs"
          >
            Cerrar
          </button>
        )}
      </div>
    </div>
  );
};
