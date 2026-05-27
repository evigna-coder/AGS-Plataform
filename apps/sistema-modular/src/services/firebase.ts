import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore, memoryLocalCache, enableNetwork, collection, addDoc as _addDoc, doc, writeBatch as _writeBatch, runTransaction as _runTransaction, Timestamp, getDocs, getDoc, updateDoc as _updateDoc, setDoc as _setDoc, deleteDoc as _deleteDoc, query, where, orderBy } from 'firebase/firestore';
import type { Firestore, Firestore as FirestoreType } from 'firebase/firestore';
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
  // Cache strategy: in-memory (default del SDK).
  //
  // Probamos persistentLocalCache (IndexedDB) pero falla en el .exe de Electron
  // porque nuestro static server usa puerto random cada launch — el origen
  // (http://localhost:<port>) cambia, así que IndexedDB ve un origen nuevo y
  // arranca con cache vacío. Combinado con la race condition entre
  // signInWithCredential y la primera read de Firestore, generaba
  // "FirebaseError: Failed to get document because the client is offline"
  // y la app se colgaba en "Cargando perfil...".
  //
  // En memoria → cero cache entre sessions, pero la app siempre lee del server
  // y nunca falla por offline. Para AGS (always-online, tool interno) está OK.
  // Si en el futuro queremos persistencia, hay que estabilizar el puerto del
  // static server (fixed port o registrar protocol app://).
  try {
    // experimentalAutoDetectLongPolling: el SDK arranca con WebChannel/WebSocket
    // y si detecta que falla (AV/firewall lo intercepta) cae automáticamente a
    // long-polling. En PCs limpias → WebSocket → sin bug del keyboard router de
    // Chromium que aparecía con force=true. En PCs con AV agresivo → fallback
    // automático a long-polling, el bug podría reaparecer y el wrap del SDK
    // de abajo dispara flashFocus como mitigación. Cero parpadeo en el caso
    // común (WebSocket OK), parpadeo sólo donde sea inevitable.
    // Ver memory/project_search_inputs_disabled_after_write.md
    db = initializeFirestore(app, {
      localCache: memoryLocalCache(),
      experimentalAutoDetectLongPolling: true,
    });
    console.log('%c✅ Firestore inicializado (memoria + auto-detect long-polling)', 'color: green; font-weight: bold');
  } catch (innerErr) {
    console.warn('[Firestore] initializeFirestore falló, fallback a getFirestore:', innerErr);
    db = getFirestore(app);
  }
  // Enable network explícito: por si el SDK arranca en modo offline por defecto
  // en este entorno (Electron + memory cache + sin sesión previa).
  enableNetwork(db).catch(err => console.warn('[Firestore] enableNetwork falló:', err));
  storage = getStorage(app);

  if (typeof window !== 'undefined' && (window as any).electronAPI?.flashFocus) {
    console.log('%c⚡ Electron input wakeup wrap activo (kill switch: FLASH_ENABLED en firebase.ts)', 'color: gray');
  }
} catch (error) {
  console.error('❌ Error al inicializar Firebase:', error);
  if (app! && !db!) {
    try { db = getFirestore(app); } catch {}
  }
}

export { db };

// ========== WRAPPED SDK WRITES — Electron input wakeup ==========
// Cada función expone la misma signature que la original de firebase/firestore,
// pero dispara scheduleFlash() post-resolve. Eso destraba el keyboard router
// de Chromium en Electron (bug long-polling). Debounce 200ms para coalescer
// bursts (ej. batch.commit que dispara N listeners). No-op en browser.
// Ver memory/project_search_inputs_disabled_after_write.md
// Flash reactivado en v1.4.3 — la hipótesis "auto-detect resuelve el bug" no
// se cumplió empíricamente: en v1.4.2 con FLASH_ENABLED=false, el parpadeo
// desapareció pero los SearchableSelect volvieron a trabarse post-save. El
// bug del keyboard router de Chromium NO depende sólo del transport del SDK.
// Volvemos al workaround conocido (parpadea, pero usable) mientras se busca
// una alternativa que destrabe el router sin mover foco OS-level.
// Ver memory/project_search_inputs_disabled_after_write.md
const FLASH_ENABLED = true;
let _flashTimer: ReturnType<typeof setTimeout> | null = null;
let _flashCount = 0;
function scheduleFlash() {
  if (!FLASH_ENABLED) return;
  if (typeof window === 'undefined') return;
  const api = (window as any).electronAPI;
  if (!api?.flashFocus) return;
  if (_flashTimer !== null) return;
  _flashTimer = setTimeout(() => {
    _flashTimer = null;
    _flashCount++;
    (window as any).__inputWakeupCount = _flashCount;
    api.flashFocus();
  }, 200);
}

export const setDoc: typeof _setDoc = (async (...args: any[]) => {
  const r = await (_setDoc as any)(...args);
  scheduleFlash();
  return r;
}) as typeof _setDoc;

export const updateDoc: typeof _updateDoc = (async (...args: any[]) => {
  const r = await (_updateDoc as any)(...args);
  scheduleFlash();
  return r;
}) as typeof _updateDoc;

export const addDoc: typeof _addDoc = (async (...args: any[]) => {
  const r = await (_addDoc as any)(...args);
  scheduleFlash();
  return r;
}) as typeof _addDoc;

export const deleteDoc: typeof _deleteDoc = (async (...args: any[]) => {
  const r = await (_deleteDoc as any)(...args);
  scheduleFlash();
  return r;
}) as typeof _deleteDoc;

export function writeBatch(firestore: FirestoreType): ReturnType<typeof _writeBatch> {
  const batch = _writeBatch(firestore);
  const origCommit = batch.commit.bind(batch);
  (batch as any).commit = async () => {
    const r = await origCommit();
    scheduleFlash();
    return r;
  };
  return batch;
}

export const runTransaction: typeof _runTransaction = (async (...args: any[]) => {
  const r = await (_runTransaction as any)(...args);
  scheduleFlash();
  return r;
}) as typeof _runTransaction;

// Expone Firebase a window en dev para scripts de migración (consola del browser).
// No se incluye en builds de producción. Usa las wrapped (también disparan flash).
if (import.meta.env.DEV && typeof window !== 'undefined' && db!) {
  (window as any).__ags = {
    app: app!, db: db!, storage: storage!,
    firestore: {
      collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
      query, where, orderBy, writeBatch, Timestamp, runTransaction,
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
  _addDoc(collection(db, 'audit_log'), {
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

/** Create a Firestore WriteBatch pre-configured con db (commit dispara flash) */
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
  batch: ReturnType<typeof _writeBatch>,
  params: { action: AuditAction; collection: string; documentId: string; after?: object | null }
) {
  const auditRef = doc(collection(db, 'audit_log'));
  batch.set(auditRef, buildAuditEntry(params));
}

/* ============================================================================
 * AUDIT v2 — diff-based updates + business events
 *
 * Diseño:
 * - `auditDiff(before, after)` calcula los campos que cambiaron y los devuelve
 *   en formato { before: {...changedKeys}, after: {...changedKeys} }. Reduce
 *   storage en Firestore a 1/N comparado con guardar el doc completo en cada
 *   update.
 * - `auditUpdate(...)` es la API recomendada para updates: calcula el diff
 *   solo, agrega entityLabel opcional y soporta tanto fire-and-forget como
 *   in-batch (si pasás `batch`).
 * - `logBusinessEvent(...)` registra eventos nombrados del dominio (no CRUD)
 *   tipo 'presupuesto.enviado', 'ot.cerrada'. Estos son los que más valor
 *   aportan en la auditoría — los CRUD muchas veces son ruido.
 * - Las funciones viejas (`logAudit`, `batchAudit`) siguen exportadas y
 *   funcionando igual; los call sites existentes no se rompen.
 * ============================================================================ */

/** Calcula el diff entre dos objetos. Devuelve solo las claves cuyos valores
 * difieren (comparación profunda vía JSON). Si nada cambió devuelve null.
 *
 * Limitaciones intencionales:
 * - JSON.stringify NO maneja Date/Timestamp idénticos como iguales si la
 *   referencia difiere — usar antes de cleanFirestoreData/después de toDate
 *   si querés diff sobre strings ISO.
 * - undefined se trata como ausencia de la clave.
 */
/** Convierte undefined → null recursivamente. Firestore rechaza undefined; null
 * es válido. Necesario en el payload del audit porque `before`/`after` vienen
 * directos del doc del usuario y pueden tener undefined en campos opcionales.
 */
function nullifyUndefined(v: unknown): unknown {
  if (v === undefined) return null;
  if (v === null) return null;
  if (Array.isArray(v)) return v.map(nullifyUndefined);
  if (typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k] = nullifyUndefined(val);
    }
    return out;
  }
  return v;
}

export function auditDiff(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): { before: Record<string, unknown>; after: Record<string, unknown> } | null {
  const b = before ?? {};
  const a = after ?? {};
  const keys = new Set<string>([...Object.keys(b), ...Object.keys(a)]);
  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};
  let any = false;
  for (const k of keys) {
    const bv = (b as Record<string, unknown>)[k];
    const av = (a as Record<string, unknown>)[k];
    // Comparación por JSON. Aproximación pragmática que evita falsos positivos
    // por orden de keys y captura cambios en arrays/objetos anidados.
    if (JSON.stringify(bv) !== JSON.stringify(av)) {
      // Firestore no acepta undefined → convertir a null. Aplica recursivo
      // por si bv/av son objetos con undefined dentro (ej. cliente con
      // convenioMultilateral: undefined).
      changedBefore[k] = nullifyUndefined(bv);
      changedAfter[k] = nullifyUndefined(av);
      any = true;
    }
  }
  if (!any) return null;
  return { before: changedBefore, after: changedAfter };
}

/** Audit de update con diff automático.
 * - Si pasás `batch`, agrega el set al batch (no se ejecuta hasta batch.commit()).
 * - Si no pasás `batch`, hace fire-and-forget (no bloquea, no retorna await).
 * - Si before === after (nada cambió), no escribe nada (skip silencioso).
 */
export function auditUpdate(params: {
  collection: string;
  documentId: string;
  before: object;
  after: object;
  entityLabel?: string;
  batch?: ReturnType<typeof _writeBatch>;
}): void {
  const diff = auditDiff(
    params.before as Record<string, unknown>,
    params.after as Record<string, unknown>,
  );
  if (!diff) return; // nada cambió → no auditar
  const user = getCurrentUserTrace();
  const entry = {
    action: 'update' as AuditAction,
    collection: params.collection,
    documentId: params.documentId,
    userId: user?.uid ?? 'unknown',
    userName: user?.name ?? 'unknown',
    timestamp: Timestamp.now(),
    changes: diff,
    entityLabel: params.entityLabel ?? null,
  };
  if (params.batch) {
    const ref = doc(collection(db, 'audit_log'));
    params.batch.set(ref, entry);
  } else {
    _addDoc(collection(db, 'audit_log'), entry).catch(err =>
      console.error('Audit update failed:', err)
    );
  }
}

/** Audit de evento de negocio (no CRUD).
 * `eventName` debe ser dotted/scoped: 'presupuesto.enviado', 'ot.cerrada',
 * 'ticket.derivado', 'factura.solicitada'. Mantener un namespace por entidad
 * facilita filtrar después.
 *
 * `details` es opcional — para guardar contexto del evento (ej. el destinatario
 * de la derivación, el estado al que se cerró, etc.).
 */
export function logBusinessEvent(params: {
  eventName: string;
  collection: string;
  documentId: string;
  details?: object | null;
  entityLabel?: string;
  batch?: ReturnType<typeof _writeBatch>;
}): void {
  const user = getCurrentUserTrace();
  // details viene de los servicios y puede tener undefined en campos opcionales;
  // Firestore rechaza undefined, así que normalizamos a null recursivo.
  const cleanedDetails = params.details ? (nullifyUndefined(params.details) as Record<string, unknown>) : null;
  const entry = {
    action: 'business_event' as AuditAction,
    eventName: params.eventName,
    collection: params.collection,
    documentId: params.documentId,
    userId: user?.uid ?? 'unknown',
    userName: user?.name ?? 'unknown',
    timestamp: Timestamp.now(),
    details: cleanedDetails,
    entityLabel: params.entityLabel ?? null,
  };
  if (params.batch) {
    const ref = doc(collection(db, 'audit_log'));
    params.batch.set(ref, entry);
  } else {
    _addDoc(collection(db, 'audit_log'), entry).catch(err =>
      console.error('Audit business_event failed:', err)
    );
  }
}

// Re-export currentUser utilities for convenience
export { getCreateTrace, getUpdateTrace, getCurrentUserTrace } from './currentUser';

// ========== FIRESTORE SNAPSHOT RE-EXPORT ==========
export { onSnapshot } from 'firebase/firestore';
