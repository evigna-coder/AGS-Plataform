import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { auth } from './firebase';

// Sesión persistente entre recargas (la maneja Firebase, no sessionStorage).
setPersistence(auth, browserLocalPersistence).catch(() => {
  /* algunos navegadores en modo privado no permiten persistencia local */
});

const googleProvider = new GoogleAuthProvider();

export function loginEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

export function loginGoogle() {
  // Popup (no redirect) por el gotcha de cookies cross-origin en mobile.
  return signInWithPopup(auth, googleProvider);
}

export function logoutFirebase() {
  return signOut(auth);
}

/** Traduce los códigos de error de Firebase Auth a mensajes en español. */
export function mapAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email o contraseña incorrectos.';
    case 'auth/invalid-email':
      return 'El email no es válido.';
    case 'auth/user-disabled':
      return 'Esta cuenta está deshabilitada.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Probá de nuevo en unos minutos.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Se cerró la ventana de Google antes de terminar.';
    case 'auth/network-request-failed':
      return 'Error de red. Verificá tu conexión.';
    case 'auth/invalid-api-key':
    case 'auth/configuration-not-found':
    case 'auth/operation-not-allowed':
      return 'El portal todavía no está configurado. Contactá a AGS.';
    default:
      return 'No se pudo iniciar sesión. Intentá de nuevo.';
  }
}
