/**
 * Servicio de autenticación Firebase (Google Sign-In).
 * Solo proveedor Google como método primario.
 */
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
import { app } from './firebaseService';

const auth = getAuth(app);

// Persistencia explícita: prioriza IndexedDB (resistente a ITP), fallback a localStorage.
// Evita que Firebase caiga silenciosamente a inMemoryPersistence si IndexedDB falla.
// authReady debe resolver antes de cualquier sign-in operation: si getRedirectResult
// corre con la persistencia aún seteándose, Firebase pierde el token tras volver del
// picker de Google y onAuthStateChanged dispara con null → loop al LoginScreen.
const authReady: Promise<void> = setPersistence(auth, indexedDBLocalPersistence)
  .catch(() => setPersistence(auth, browserLocalPersistence))
  .catch((err) => {
    console.warn('⚠️ No se pudo configurar persistencia de Firebase Auth:', err);
  });

// Procesar resultado de signInWithRedirect (mobile flow) recién cuando la persistencia
// esté lista, no en paralelo.
authReady
  .then(() => getRedirectResult(auth))
  .catch((err) => {
    console.warn('⚠️ Error procesando redirect de auth:', err);
  });

function isMobileUA(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

/** Suscripción al estado de auth; usa la instancia correcta de Auth del mismo módulo. */
export function onAuthStateChanged(callback: (user: User | null) => void): Unsubscribe {
  return firebaseOnAuthStateChanged(auth, callback);
}

export { auth };
export type { User };

const ALLOWED_EMAIL_DOMAIN = 'agsanalitica.com';
const SUPPORT_URL = 'https://agsanalitica.com/contacto';

export function getAllowedDomain(): string {
  return ALLOWED_EMAIL_DOMAIN;
}

export function getSupportUrl(): string {
  return SUPPORT_URL;
}

/**
 * Comprueba si el email del usuario pertenece al dominio corporativo.
 */
export function isAllowedDomain(user: User | null): boolean {
  if (!user?.email) return false;
  const domain = user.email.trim().toLowerCase().split('@')[1];
  return domain === ALLOWED_EMAIL_DOMAIN.toLowerCase();
}

/**
 * Inicia sesión con Google (popup).
 */
export async function signInWithGoogle(): Promise<User | null> {
  try {
    // Esperar a que la persistencia esté seteada antes de iniciar el flow,
    // sino el token del redirect se pierde al volver.
    await authReady;
    const provider = new GoogleAuthProvider();
    // Forzar selector de cuenta y restringir al dominio corporativo.
    // Sin esto, Google auto-loguea con la cuenta activa del dispositivo —
    // típicamente la personal cuando se abre desde un WebView móvil — y el
    // usuario queda atrapado en DomainErrorScreen.
    provider.setCustomParameters({
      prompt: 'select_account',
      hd: ALLOWED_EMAIL_DOMAIN,
    });
    // En mobile usar redirect (popup tiene problemas en Safari iOS y Chrome Android).
    // En desktop mantener popup (mejor UX).
    if (isMobileUA()) {
      await signInWithRedirect(auth, provider);
      return null; // El usuario volverá vía getRedirectResult al recargar
    }
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (err: unknown) {
    const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : '';
    if (msg.includes('CONFIGURATION_NOT_FOUND') || msg.includes('configuration-not-found')) {
      throw new Error(
        'Firebase Authentication no esta configurado para este proyecto. ' +
        'Ve a Firebase Console > Build > Authentication > Get started y habilita Authentication (proveedor Google).'
      );
    }
    throw err;
  }
}

/**
 * Cierra sesión.
 */
export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

/**
 * Obtiene el ID token actual (para enviar en Authorization: Bearer).
 */
export async function getIdToken(forceRefresh = false): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('No hay usuario autenticado');
  return user.getIdToken(forceRefresh);
}
