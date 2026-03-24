import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager, collection, addDoc, Timestamp } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import type { AuditAction } from '@ags/shared';
import { getCurrentUserTrace } from './currentUser';

// --- Utilidades para CUIT como id de cliente ---
/** Normaliza CUIT: quita caracteres no numéricos y formatea como XX-XXXXXXXX-X. */
export function normalizeCuit(cuit: string): string {
  const digits = (cuit || '').replace(/\D/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
  }
  return digits;
}

/** Genera id para cliente sin CUIT: LEGACY-{uuid}. */
export function generateLegacyClientId(): string {
  return 'LEGACY-' + crypto.randomUUID();
}

/** Limpia payload asegurando que no haya undefineds, los cuales fallan en Firestore */
export function cleanFirestoreData<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;           // Firestore NO acepta undefined
    out[k] = v === '' ? null : v;            // opcional: strings vacías a null
  }
  return out;
}

// Re-export from shared package
export { deepCleanForFirestore } from '@ags/shared';

// Configuración de Firebase (usar la misma que reportes-ot)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Validar que las variables de entorno estén definidas
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
];

const missingVars = requiredEnvVars.filter(varName => !import.meta.env[varName]);
if (missingVars.length > 0) {
  console.warn('⚠️ Variables de entorno de Firebase faltantes:', missingVars);
  console.warn('Copia el archivo .env.local desde apps/reportes-ot/ o crea uno nuevo');
} else {
  console.log('%c✅ Variables de entorno de Firebase cargadas correctamente', 'color: green; font-weight: bold');
  console.log('%c📋 Project ID: ' + firebaseConfig.projectId, 'color: blue; font-weight: bold');
}

export let app: ReturnType<typeof initializeApp>;
let db: Firestore;
export let storage: ReturnType<typeof getStorage>;

try {
  // Reutilizar instancia existente en HMR (Vite hot-reload)
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    // Ya inicializado (HMR): reutilizar instancia existente
    db = getFirestore(app);
  }
  storage = getStorage(app);
  console.log('%c✅ Firebase inicializado con caché local persistente', 'color: green; font-weight: bold');
} catch (error) {
  console.error('❌ Error al inicializar Firebase:', error);
}

export { db };

// ========== AUDIT LOG (fire-and-forget) ==========
export function logAudit(params: {
  action: AuditAction;
  collection: string;
  documentId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}): void {
  const user = getCurrentUserTrace();
  if (!user) return;
  addDoc(collection(db, 'audit_log'), {
    action: params.action,
    collection: params.collection,
    documentId: params.documentId,
    userId: user.uid,
    userName: user.name,
    timestamp: Timestamp.now(),
    changes: params.before || params.after
      ? { before: params.before ?? null, after: params.after ?? null }
      : null,
  }).catch(err => console.error('Audit log failed:', err));
}

// Re-export currentUser utilities for convenience
export { getCreateTrace, getUpdateTrace, getCurrentUserTrace } from './currentUser';
