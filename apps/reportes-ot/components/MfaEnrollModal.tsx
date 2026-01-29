import React, { useState } from 'react';
import { getRegisterOptions, submitRegisterResult } from '../services/webauthnClient';

interface MfaEnrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** Primera vez en el dispositivo: mensaje orientado a elegir cómo desbloquear (patrón, facial, etc.). */
  isFirstTimeEnrollment?: boolean;
}

/**
 * Modal para registrar un dispositivo como segundo factor (Face/patrón/huella).
 * Con isFirstTimeEnrollment se muestra texto para primera vez y opción "Configurar más tarde".
 */
export const MfaEnrollModal: React.FC<MfaEnrollModalProps> = ({ isOpen, onClose, onSuccess, isFirstTimeEnrollment }) => {
  const [deviceName, setDeviceName] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'waiting' | 'verifying' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleRegister = async () => {
    if (!window.PublicKeyCredential) {
      setStatus('error');
      setErrorMessage('Tu navegador o dispositivo no soporta desbloqueo con Face/patrón/huella. Usa un dispositivo compatible.');
      return;
    }

    setStatus('loading');
    setErrorMessage('');
    const name = deviceName.trim() || 'Dispositivo';

    try {
      const { options, error } = await getRegisterOptions(name);
      if (error || !options) {
        setStatus('error');
        setErrorMessage(error ?? 'No se pudieron obtener las opciones');
        return;
      }
      setStatus('waiting');
      const credential = await navigator.credentials.create({ publicKey: options });
      if (!credential || !(credential instanceof PublicKeyCredential)) {
        setStatus('error');
        setErrorMessage('No se completó el registro en el dispositivo.');
        return;
      }
      setStatus('verifying');
      const result = await submitRegisterResult(credential, name);
      if (result.verified) {
        setStatus('success');
        onSuccess?.();
      } else {
        setStatus('error');
        setErrorMessage(result.error ?? 'Error al registrar');
      }
    } catch (err: unknown) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Error al registrar');
    }
  };

  const handleClose = () => {
    setStatus('idle');
    setErrorMessage('');
    setDeviceName('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 no-print"
      onClick={isFirstTimeEnrollment ? undefined : handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mfa-enroll-title"
    >
      <div
        className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="mfa-enroll-title" className="text-lg font-black text-slate-900 uppercase tracking-tighter mb-2">
          {isFirstTimeEnrollment ? 'Configura cómo desbloquear en este dispositivo' : 'Activar desbloqueo con dispositivo'}
        </h2>
        <p className="text-sm text-slate-600 mb-4">
          {isFirstTimeEnrollment
            ? 'Es la primera vez que usas esta app en este dispositivo. Elige cómo quieres iniciar sesión: patrón, desbloqueo facial, huella o sin desbloqueo. El sistema te pedirá la opción al continuar.'
            : 'Usa Face ID, huella dactilar o patrón de tu dispositivo para iniciar sesión de forma más segura.'}
        </p>

        {status === 'idle' || status === 'loading' || status === 'waiting' || status === 'verifying' ? (
          <>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              Nombre del dispositivo (opcional)
            </label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="ej. iPhone, Mi PC"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-6"
              disabled={status !== 'idle'}
            />
            {(status === 'waiting' || status === 'verifying') && (
              <p className="text-sm text-slate-500 mb-4 animate-pulse">
                {status === 'waiting' ? 'Confirma en tu dispositivo…' : 'Verificando…'}
              </p>
            )}
            <div className="flex flex-col gap-3">
              <div className="flex gap-3">
                {!isFirstTimeEnrollment && (
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 bg-slate-200 text-slate-700 font-bold px-6 py-3 rounded-xl uppercase tracking-widest text-xs"
                  >
                    Cancelar
                  </button>
                )}
                <button
                type="button"
                onClick={handleRegister}
                disabled={status !== 'idle' && status !== 'loading'}
                className="flex-1 bg-emerald-600 text-white font-bold px-6 py-3 rounded-xl uppercase tracking-widest text-xs disabled:opacity-60"
              >
                {status === 'loading' ? 'Preparando…' : status === 'idle' ? 'Registrar' : '…'}
              </button>
              </div>
              {isFirstTimeEnrollment && (
                <button
                  type="button"
                  onClick={() => onSuccess?.()}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium px-6 py-3 rounded-xl text-sm border border-slate-200"
                >
                  Configurar más tarde
                </button>
              )}
            </div>
          </>
        ) : status === 'success' ? (
          <div className="space-y-4">
            <p className="text-sm text-emerald-600 font-medium">Dispositivo registrado correctamente.</p>
            <button
              type="button"
              onClick={handleClose}
              className="w-full bg-emerald-600 text-white font-bold px-6 py-3 rounded-xl uppercase tracking-widest text-xs"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-red-600">{errorMessage}</p>
            <button
              type="button"
              onClick={() => { setStatus('idle'); setErrorMessage(''); }}
              className="w-full bg-slate-200 text-slate-700 font-bold px-6 py-3 rounded-xl uppercase tracking-widest text-xs"
            >
              Reintentar
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="w-full bg-slate-100 text-slate-600 font-bold px-6 py-3 rounded-xl uppercase tracking-widest text-xs"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
