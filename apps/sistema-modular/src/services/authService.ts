import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signInWithCredential,
  getRedirectResult,
  setPersistence,
  browserLocalPersistence,
  indexedDBLocalPersistence,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  type User,
  type Unsubscribe,
} from 'firebase/auth';
import { app } from './firebaseService';

// Tipos para la API expuesta por preload.cjs en Electron.
type ElectronAuthAPI = {
  signInWithGoogle: (opts: {
    clientId: string;
    authDomain: string;
    hd?: string;
  }) => Promise<{ ok?: boolean; error?: string; idToken?: string; accessToken?: string; nonce?: string }>;
};
declare global {
  interface Window {
    authAPI?: ElectronAuthAPI;
  }
}

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
    // Electron desktop: usar OAuth manual via main process. signInWithPopup
    // queda roto en Electron por la pérdida de window.opener en cross-origin nav.
    if (window.authAPI?.signInWithGoogle) {
      const clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID;
      const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
      if (!clientId || !authDomain) {
        throw new Error('Faltan VITE_GOOGLE_OAUTH_CLIENT_ID o VITE_FIREBASE_AUTH_DOMAIN en el build');
      }
      const result = await window.authAPI.signInWithGoogle({
        clientId,
        authDomain,
        hd: ALLOWED_DOMAIN,
      });
      if (result.error || !result.idToken) {
        throw new Error(result.error || 'No se obtuvo id_token de Google');
      }
      const credential = GoogleAuthProvider.credential(result.idToken, result.accessToken);
      const userCredential = await signInWithCredential(auth, credential);
      return userCredential.user;
    }
    // Mobile (Safari iOS sobre todo): usar redirect — popup rompe por ITP, las
    // cookies del popup no vuelven al parent y queda en loop. Desktop sigue con
    // popup por mejor UX.
    if (isMobileUA()) {
      await signInWithRedirect(auth, provider);
      return null; // El user vuelve via getRedirectResult al recargar.
    }
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (err: unknown) {
    const msg = err && typeof err === 'object' && 'message' in err ? String((err as Record<string, unknown>).message) : '';
    if (msg.includes('CONFIGURATION_NOT_FOUND') || msg.includes('configuration-not-found')) {
      throw new Error(
        'Firebase Authentication no esta configurado. Ve a Firebase Console > Authentication > Sign-in method > Google y habilitalo.'
      );
    }
    throw err;
  }
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}
