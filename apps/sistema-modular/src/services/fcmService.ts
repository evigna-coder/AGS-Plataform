import { doc, setDoc, updateDoc, deleteDoc, getDocs, collection, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { NotificationPreferences } from '@ags/shared';
import { getDoc } from 'firebase/firestore';

function detectDevice(): 'desktop' | 'mobile' {
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
}

function detectBrowser(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Electron')) return 'Electron';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  return 'Unknown';
}

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
}

export const fcmTokensService = {
  async saveToken(userId: string, token: string): Promise<void> {
    const tokenId = await hashToken(token);
    await setDoc(doc(db, 'usuarios', userId, 'fcmTokens', tokenId), {
      token,
      device: detectDevice(),
      browser: detectBrowser(),
      createdAt: Timestamp.now(),
      lastRefreshed: Timestamp.now(),
    }, { merge: true });
  },

  async removeToken(userId: string, token: string): Promise<void> {
    const tokenId = await hashToken(token);
    try { await deleteDoc(doc(db, 'usuarios', userId, 'fcmTokens', tokenId)); } catch { /* ok */ }
  },

  async removeAllTokens(userId: string): Promise<void> {
    const snap = await getDocs(collection(db, 'usuarios', userId, 'fcmTokens'));
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
  },
};

export const notificationPrefsService = {
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
