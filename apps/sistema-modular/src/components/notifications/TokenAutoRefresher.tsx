import { useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { fcmTokensService } from '../../services/fcmService';
import {
  getPermissionStatus,
  requestNotificationPermission,
  getCurrentToken,
} from '../../services/notificationService';

/**
 * Al autenticarse, si el usuario ya otorgó permiso de notificaciones,
 * intenta obtener y guardar el token FCM en Firestore (upsert).
 * Maneja el caso de tokens cacheados inválidos.
 */
export function TokenAutoRefresher() {
  const { firebaseUser, isAuthenticated } = useAuth();
  const didRunRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !firebaseUser?.uid || didRunRef.current) return;
    didRunRef.current = true;

    const permission = getPermissionStatus();
    if (permission !== 'granted') return;

    (async () => {
      try {
        await new Promise(r => setTimeout(r, 1500));
        let token = getCurrentToken();
        if (!token) {
          token = await requestNotificationPermission();
        }
        if (token && firebaseUser.uid) {
          await fcmTokensService.saveToken(firebaseUser.uid, token);
          console.info('[Notifications] Token FCM sincronizado con Firestore');
        }
      } catch (err) {
        console.warn('[Notifications] No se pudo refrescar token FCM:', err);
      }
    })();
  }, [isAuthenticated, firebaseUser?.uid]);

  return null;
}
