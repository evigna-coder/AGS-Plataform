import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const requiredVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

const missing = requiredVars.filter(k => !import.meta.env[k]);
if (missing.length > 0) {
  console.warn('⚠️ Firebase env vars faltantes:', missing);
}

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let db: Firestore;
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

export { db };
export const storage = getStorage(app);
// Fail-fast en uploads: el default del SDK reintenta hasta 10 min ante errores
// transitorios → la cola de fotos quedaba "Sincronizando…" eterna sin reportar
// el error real (UAT 2026-07-29). Acotado, el intento falla, la cola muestra
// lastError en el banner y reintenta con su propio backoff.
// 30s → 120s (2026-08-06): con señal lenta una foto que tarda >30s en subir no
// podía completarse NUNCA (cada reintento moría igual — retry-limit-exceeded
// en loop). 2 min mantiene el fail-fast pero deja terminar subidas lentas.
storage.maxUploadRetryTime = 120_000;
storage.maxOperationRetryTime = 30_000;

// Cloud Functions (callable). Misma región que functions/src (southamerica-east1).
export const functions = getFunctions(app, 'southamerica-east1');
