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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isSupported(): boolean {
  return 'serviceWorker' in navigator && 'Notification' in window && 'PushManager' in window;
}

function getMessagingInstance() {
  if (!messagingInstance) {
    messagingInstance = getMessaging(app);
  }
  return messagingInstance;
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
  } catch (error) {
    console.error('[Notifications] Error registrando Service Worker:', error);
    return null;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function initNotifications(): Promise<void> {
  if (!isSupported()) return;
  await registerServiceWorker();
}

export async function requestNotificationPermission(): Promise<string | null> {
  if (!isSupported()) return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const registration = await navigator.serviceWorker.getRegistration('/');
    if (!registration) return null;

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.error('[Notifications] VITE_FIREBASE_VAPID_KEY no configurada');
      return null;
    }

    const messaging = getMessagingInstance();
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
    currentToken = token;
    return token;
  } catch (error) {
    console.error('[Notifications] Error obteniendo token FCM:', error);
    return null;
  }
}

export function getCurrentToken(): string | null {
  return currentToken;
}

export function getPermissionStatus(): NotificationPermission | 'unsupported' {
  if (!isSupported()) return 'unsupported';
  return Notification.permission;
}

export function onForegroundNotification(handler: OnForegroundMessage): () => void {
  if (!isSupported()) return () => {};

  foregroundHandler = handler;
  const messaging = getMessagingInstance();

  const unsubscribe = onMessage(messaging, (payload: MessagePayload) => {
    const title = payload.notification?.title || 'AGS Sistema';
    const body = payload.notification?.body || '';
    const data: NotificationData = {
      leadId: payload.data?.leadId || undefined,
      type: (payload.data?.type as NotificationType) || 'generic',
      url: payload.data?.url || '/',
    };
    if (foregroundHandler) {
      foregroundHandler({ title, body, data });
    }
  });

  return () => { foregroundHandler = null; unsubscribe(); };
}
