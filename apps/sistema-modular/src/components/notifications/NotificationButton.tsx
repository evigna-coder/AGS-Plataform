import { useState, useEffect } from 'react';

/**
 * Botón de campana en el header (sistema-modular). Pide permiso de
 * notificaciones nativas via la API web estándar. No usa FCM porque
 * Electron no lo soporta bien — las notificaciones se disparan
 * directamente desde un listener de Firestore (useLeadNotifications).
 */
export function NotificationButton() {
  const [status, setStatus] = useState<NotificationPermission | 'unsupported'>('default');
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    if (!('Notification' in window)) {
      setStatus('unsupported');
      return;
    }
    setStatus(Notification.permission);
  }, []);

  const handleClick = async () => {
    if (status === 'granted' || status === 'unsupported') return;
    setActivating(true);
    try {
      const result = await Notification.requestPermission();
      setStatus(result);
    } finally {
      setActivating(false);
    }
  };

  if (status === 'unsupported') return null;

  return (
    <button
      onClick={handleClick}
      disabled={activating || status === 'granted'}
      title={
        status === 'granted' ? 'Notificaciones activas' :
        status === 'denied' ? 'Notificaciones bloqueadas — revisar config del navegador' :
        'Activar notificaciones'
      }
      className={`relative p-1.5 rounded-lg transition-colors ${
        status === 'granted'
          ? 'text-teal-600'
          : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
      } ${activating ? 'animate-pulse' : ''}`}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      {status === 'granted' && (
        <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-teal-500 rounded-full" />
      )}
    </button>
  );
}
