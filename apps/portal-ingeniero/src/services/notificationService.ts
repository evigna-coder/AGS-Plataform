import { getMessaging, getToken, onMessage, type MessagePayload } from 'firebase/messaging';
import { app } from './firebase';

// ─── Types ───────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'lead_created'
  | 'lead_derived'
  | 'lead_comment'
  | 'lead_finalized'
  | 'lead_urgent'
  | 'generic';

export interface NotificationData {
  leadId?: string;
  type: NotificationType;
  url: string;
}

export type OnForegroundMessage = (payload: {
  title: string;
  body: string;
  data: NotificationData;
}) => void;

// ─── State ───────────────────────────────────────────────────────────────────

let messagingInstance: ReturnType<typeof getMessaging> | null = null;
let currentToken: string | null = null;
let foregroundHandler: OnForegroundMessage | null = null;
let lastError: string | null = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isSupported(): boolean {
  return 'serviceWorker' in navigator && 'Notification' in window && 'PushManager' in window;
}

function getMessagingInstance() {
  if (!messagingInstance) {
    try {
      messagingInstance = getMessaging(app);
    } catch (e) {
      console.warn('[Notifications] Firebase Messaging no soportado:', e);
      return null;
    }
  }
  return messagingInstance;
}

// ─── Service Worker Registration ─────────────────────────────────────────────

async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
    });
    return registration;
  } catch (error) {
    console.error('[Notifications] Error registrando Service Worker:', error);
    return null;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Registra el Service Worker al iniciar la app.
 * No pide permisos — solo prepara la infraestructura.
 */
export async function initNotifications(): Promise<void> {
  if (!isSupported()) return;
  await registerServiceWorker();
}

/**
 * Solicita permiso de notificaciones y obtiene el token FCM.
 * Retorna el token si fue exitoso, null si el usuario denegó o hubo error.
 */
export async function requestNotificationPermission(): Promise<string | null> {
  lastError = null;
  if (!isSupported()) {
    lastError = 'unsupported: este navegador no soporta push (en iPhone hay que instalar la PWA primero)';
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      lastError = `permission=${permission}`;
      console.info('[Notifications] Permiso denegado por el usuario');
      return null;
    }

    const registration = await navigator.serviceWorker.getRegistration('/');
    if (!registration) {
      lastError = 'no-service-worker: el Service Worker no terminó de registrarse — recargá la página';
      console.error('[Notifications] No hay Service Worker registrado');
      return null;
    }

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      lastError = 'missing-vapid-key: VITE_FIREBASE_VAPID_KEY no está en el build';
      console.error('[Notifications] VITE_FIREBASE_VAPID_KEY no configurada');
      return null;
    }

    const messaging = getMessagingInstance();
    if (!messaging) {
      lastError = 'messaging-init-failed: Firebase Messaging no se pudo inicializar';
      return null;
    }
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    currentToken = token;
    return token;
  } catch (error) {
    const code = (error as { code?: string })?.code;
    const msg = (error as { message?: string })?.message;
    lastError = code ? `${code}${msg ? `: ${msg}` : ''}` : (msg ?? String(error));
    console.error('[Notifications] Error obteniendo token FCM:', error);
    return null;
  }
}

/**
 * Retorna el token actual sin solicitar permisos.
 */
export function getCurrentToken(): string | null {
  return currentToken;
}

/**
 * Retorna el estado actual del permiso de notificaciones.
 */
export function getPermissionStatus(): NotificationPermission | 'unsupported' {
  if (!isSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Devuelve el motivo del último fallo de requestNotificationPermission.
 * Útil para mostrar diagnóstico cuando getToken falla en silencio.
 */
export function getLastNotificationError(): string | null {
  return lastError;
}

/**
 * Registra un handler para mensajes recibidos cuando la app está en foreground.
 * El handler recibe title, body y data parseados.
 */
export function onForegroundNotification(handler: OnForegroundMessage): () => void {
  if (!isSupported()) return () => {};

  foregroundHandler = handler;
  const messaging = getMessagingInstance();
  if (!messaging) return () => {};

  const unsubscribe = onMessage(messaging, (payload: MessagePayload) => {
    // Payload data-only: title/body vienen en payload.data (ver Cloud Function notifications.ts).
    const title = payload.data?.title || payload.notification?.title || 'Portal AGS';
    const body = payload.data?.body || payload.notification?.body || '';
    const data: NotificationData = {
      leadId: payload.data?.leadId || undefined,
      type: (payload.data?.type as NotificationType) || 'generic',
      url: payload.data?.url || '/',
    };

    if (foregroundHandler) {
      foregroundHandler({ title, body, data });
    }
  });

  return () => {
    foregroundHandler = null;
    unsubscribe();
  };
}
