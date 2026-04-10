import { useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { fcmTokensService } from '../../services/firebaseService';
import {
  getPermissionStatus,
  requestNotificationPermission,
  getCurrentToken,
} from '../../services/notificationService';

/**
 * Componente invisible que, al autenticarse el usuario, verifica si tiene
 * permiso de notificaciones ya otorgado. Si lo tiene, intenta obtener el
 * token FCM y guardarlo en Firestore (upsert).
 *
 * Esto maneja el caso donde el usuario ya activó las notificaciones antes
 * pero el token cacheado quedó inválido por cambios en la config del proyecto,
 * rotación de token, o cualquier otro motivo.
 */
export function TokenAutoRefresher() {
  const { firebaseUser, isAuthenticated } = useAuth();
  const didRunRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !firebaseUser?.uid || didRunRef.current) return;
    didRunRef.current = true;

    const permission = getPermissionStatus();
    if (permission !== 'granted') return;

    // Intento obtener token (reutiliza si existe, regenera si expiró)
    (async () => {
      try {
        // Pequeño delay para asegurar que el SW esté registrado
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
