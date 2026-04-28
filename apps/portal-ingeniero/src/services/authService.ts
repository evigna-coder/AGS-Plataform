import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  setPersistence,
  browserLocalPersistence,
  indexedDBLocalPersistence,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  type User,
  type Unsubscribe,
} from 'firebase/auth';
import { app } from './firebase';

const auth = getAuth(app);
const ALLOWED_DOMAIN = 'agsanalitica.com';

// Persistencia explícita: IndexedDB primero (resistente a ITP de Safari),
// fallback a localStorage. Sin esto Safari mobile cae a in-memory y la sesión
// no sobrevive al redirect de Google.
setPersistence(auth, indexedDBLocalPersistence)
  .catch(() => setPersistence(auth, browserLocalPersistence))
  .catch((err) => {
    console.warn('No se pudo configurar persistencia de Firebase Auth:', err);
  });

// Procesar resultado de signInWithRedirect (mobile flow). Se llama una sola vez
// al cargar el módulo; si no hay redirect pendiente, resuelve en null.
getRedirectResult(auth).catch((err) => {
  console.warn('Error procesando redirect de auth:', err);
});

function isMobileUA(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

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

export async function signInWithGoogle(): Promise<User | null> {
  const provider = new GoogleAuthProvider();
  // hd: filtra el picker al dominio Workspace (si aplica).
  // prompt=select_account: fuerza el picker — sin esto Google auto-loguea con
  // la cuenta activa del navegador, típicamente la personal, generando loop
  // "logueás → te echa por dominio → vuelve a auto-loguear con la misma".
  provider.setCustomParameters({ hd: ALLOWED_DOMAIN, prompt: 'select_account' });
  try {
    // Mobile (Safari iOS y Android Chrome): usar redirect — popup rompe por ITP
    // y restricciones de cookies cross-site, las cookies del popup no vuelven
    // al parent y queda en loop. Desktop sigue con popup por mejor UX.
    if (isMobileUA()) {
      await signInWithRedirect(auth, provider);
      return null; // El user vuelve via getRedirectResult al recargar.
    }
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
