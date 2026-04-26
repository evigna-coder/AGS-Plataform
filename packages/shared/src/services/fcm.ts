import {
  Firestore,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  collection,
  Timestamp,
} from 'firebase/firestore';
import type { NotificationPreferences } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

export function detectDevice(): 'desktop' | 'mobile' {
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
}

export function detectBrowser(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Electron')) return 'Electron';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  return 'Unknown';
}

/**
 * ID persistente del dispositivo/navegador (guardado en localStorage).
 * Se usa como document ID en fcmTokens para que el mismo dispositivo
 * siempre sobreescriba su propio doc cuando rota el token FCM.
 * Esto evita acumulación de tokens duplicados y notificaciones repetidas.
 */
export function getDeviceId(): string {
  const KEY = 'ags_device_id';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
    localStorage.setItem(KEY, id);
  }
  return id;
}

// ── Factories ────────────────────────────────────────────────────────────────

/** Build a fcmTokens service bound to a specific Firestore instance. */
export function makeFcmTokensService(db: Firestore) {
  return {
    /** Guarda o actualiza el token FCM del dispositivo actual (upsert por deviceId). */
    async saveToken(userId: string, token: string): Promise<void> {
      const deviceId = getDeviceId();
      await setDoc(doc(db, 'usuarios', userId, 'fcmTokens', deviceId), {
        token,
        device: detectDevice(),
        browser: detectBrowser(),
        createdAt: Timestamp.now(),
        lastRefreshed: Timestamp.now(),
      }, { merge: true });
    },

    /** Actualiza el timestamp de refresh de un token existente. */
    async refreshToken(userId: string, _token: string): Promise<void> {
      const deviceId = getDeviceId();
      await updateDoc(doc(db, 'usuarios', userId, 'fcmTokens', deviceId), {
        lastRefreshed: Timestamp.now(),
      });
    },

    /** Elimina el token FCM del dispositivo actual (ej. al cerrar sesión). */
    async removeToken(userId: string, _token: string): Promise<void> {
      const deviceId = getDeviceId();
      try {
        await deleteDoc(doc(db, 'usuarios', userId, 'fcmTokens', deviceId));
      } catch {
        // Token ya no existe, ignorar.
      }
    },

    /** Elimina todos los tokens del usuario (ej. al desactivar notificaciones). */
    async removeAllTokens(userId: string): Promise<void> {
      const snap = await getDocs(collection(db, 'usuarios', userId, 'fcmTokens'));
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    },
  };
}

/** Build a notificationPrefs service bound to a specific Firestore instance. */
export function makeNotificationPrefsService(db: Firestore) {
  return {
    async get(userId: string): Promise<NotificationPreferences | null> {
      const snap = await getDoc(doc(db, 'usuarios', userId));
      if (!snap.exists()) return null;
      return (snap.data() as Record<string, unknown>).notificationPreferences as NotificationPreferences | null ?? null;
    },

    async save(userId: string, prefs: NotificationPreferences): Promise<void> {
      await updateDoc(doc(db, 'usuarios', userId), {
        notificationPreferences: prefs,
        updatedAt: Timestamp.now(),
      });
    },
  };
}
