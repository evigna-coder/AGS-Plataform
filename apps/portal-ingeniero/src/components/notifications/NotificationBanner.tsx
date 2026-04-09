import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import {
  getPermissionStatus,
  requestNotificationPermission,
} from '../../services/notificationService';
import { fcmTokensService } from '../../services/firebaseService';

const DISMISSED_KEY = 'ags_notif_banner_dismissed';

/**
 * Banner no intrusivo que aparece cuando el usuario visita Tickets
 * por primera vez sin tener notificaciones activadas.
 * Se descarta con "Ahora no" y no vuelve a aparecer hasta limpiar storage.
 */
export function NotificationBanner() {
  const { firebaseUser } = useAuth();
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    // Solo mostrar en la sección de tickets
    if (!location.pathname.startsWith('/leads')) return;

    const permission = getPermissionStatus();
    const dismissed = localStorage.getItem(DISMISSED_KEY);

    if (permission === 'default' && !dismissed) {
      // Pequeño delay para no molestar al cargar
      const timer = setTimeout(() => setVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [location.pathname]);

  const handleActivate = async () => {
    if (!firebaseUser?.uid) return;
    setActivating(true);
    const token = await requestNotificationPermission();
    if (token) {
      await fcmTokensService.saveToken(firebaseUser.uid, token);
    }
    setVisible(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="mx-4 mt-2 mb-0 bg-teal-50 border border-teal-200 rounded-xl p-3 flex items-center gap-3 animate-slide-in">
      <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-teal-900">Activar notificaciones</p>
        <p className="text-xs text-teal-700">Enterate cuando te asignan o derivan tickets.</p>
      </div>
      <div className="flex gap-1.5 flex-shrink-0">
        <button
          onClick={handleDismiss}
          className="text-xs text-teal-600 hover:text-teal-800 px-2 py-1"
        >
          Ahora no
        </button>
        <button
          onClick={handleActivate}
          disabled={activating}
          className="text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 px-3 py-1 rounded-lg disabled:opacity-50"
        >
          {activating ? 'Activando...' : 'Activar'}
        </button>
      </div>
    </div>
  );
}
