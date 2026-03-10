import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  type User,
  type Unsubscribe,
} from 'firebase/auth';
import { app } from './firebase';

const auth = getAuth(app);
const ALLOWED_DOMAIN = 'agsanalitica.com';

export { auth };
export type { User };

export function onAuthStateChanged(
  cb: (user: User | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return firebaseOnAuthStateChanged(auth, cb, onError);
}

export function isAllowedDomain(user: User | null): boolean {
  if (!user?.email) return false;
  return user.email.trim().toLowerCase().split('@')[1] === ALLOWED_DOMAIN;
}

export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ hd: ALLOWED_DOMAIN });
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (err: unknown) {
    const msg = err && typeof err === 'object' && 'message' in err
      ? String((err as Record<string, unknown>).message) : '';
    if (msg.includes('CONFIGURATION_NOT_FOUND') || msg.includes('configuration-not-found')) {
      throw new Error('Firebase Authentication no está configurado. Habilitá Google Sign-In en Firebase Console.');
    }
    throw err;
  }
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}
