import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager, collection, addDoc, doc, writeBatch, Timestamp, getDocs, getDoc, updateDoc, setDoc, deleteDoc, query, where, orderBy } from 'firebase/firestore';
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

// Expone Firebase a window en dev para scripts de migración (consola del browser).
// No se incluye en builds de producción.
if (import.meta.env.DEV && typeof window !== 'undefined' && db!) {
  (window as any).__ags = {
    app: app!, db: db!, storage: storage!,
    firestore: {
      collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
      query, where, orderBy, writeBatch, Timestamp,
    },
  };
}

// ========== AUDIT LOG ==========
/**
 * Fire-and-forget audit — no await needed, no extra latency.
 *
 * `before`/`after` aceptan cualquier objeto serializable. Firestore acepta
 * objetos arbitrarios en `set`/`addDoc`, así que tipar como `object` evita
 * que callers tengan que castear sus payloads tipados (Partial<Lead>, etc.)
 * a Record<string, unknown> con `as any`.
 */
export function logAudit(params: {
  action: AuditAction;
  collection: string;
  documentId: string;
  before?: object | null;
  after?: object | null;
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

/** Build audit entry for use inside writeBatch */
function buildAuditEntry(params: {
  action: AuditAction;
  collection: string;
  documentId: string;
  after?: object | null;
}) {
  const user = getCurrentUserTrace();
  return {
    action: params.action,
    collection: params.collection,
    documentId: params.documentId,
    userId: user?.uid ?? 'unknown',
    userName: user?.name ?? 'unknown',
    timestamp: Timestamp.now(),
    changes: params.after ? { before: null, after: params.after } : null,
  };
}

/** Create a Firestore WriteBatch pre-configured with db */
export function createBatch() {
  return writeBatch(db);
}

/** Get a new auto-id doc ref for a collection */
export function newDocRef(collectionName: string) {
  return doc(collection(db, collectionName));
}

/** Get a doc ref for an existing document */
export function docRef(collectionName: string, docId: string) {
  return doc(db, collectionName, docId);
}

/** Add audit entry to an existing batch (single round-trip) */
export function batchAudit(
  batch: ReturnType<typeof writeBatch>,
  params: { action: AuditAction; collection: string; documentId: string; after?: object | null }
) {
  const auditRef = doc(collection(db, 'audit_log'));
  batch.set(auditRef, buildAuditEntry(params));
}

// Re-export currentUser utilities for convenience
export { getCreateTrace, getUpdateTrace, getCurrentUserTrace } from './currentUser';

// ========== FIRESTORE SNAPSHOT RE-EXPORT ==========
export { onSnapshot } from 'firebase/firestore';

// inTransition kept as no-op for any leftover imports
export function inTransition<T extends (...args: any[]) => void>(cb: T): T {
  return cb;
}
