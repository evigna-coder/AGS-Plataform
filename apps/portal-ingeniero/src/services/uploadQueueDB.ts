/**
 * IndexedDB queue for foto uploads from the recepcion tool.
 *
 * Why: planta tiene wifi inestable. Queremos que el técnico/responsable de materiales
 * pueda capturar fotos sin esperar la subida — el blob queda en local y se sube cuando
 * hay red. Si el dispositivo se apaga, la cola sobrevive.
 *
 * Una ficha existe en Firestore (gracias a `persistentLocalCache` ya configurado en
 * firebase.ts, los writes son offline-tolerant). Las fotos NO — los binarios pasan por
 * esta cola hasta que `useUploadQueue` los drena a Firebase Storage.
 */
import type { MomentoFotoFicha } from '@ags/shared';

const DB_NAME = 'ags-portal-uploads';
const DB_VERSION = 1;
const STORE = 'pendingFotos';

export type PendingFotoStatus = 'queued' | 'uploading' | 'error';

export interface PendingFoto {
  id: string;            // uuid local
  fichaId: string;       // FK al doc en Firestore
  fichaNumero: string;   // FPC-XXXX, usado en el storage path
  blob: Blob;
  filename: string;
  momento: MomentoFotoFicha;
  capturaAt: string;     // ISO
  intentos: number;
  status: PendingFotoStatus;
  lastError?: string;
  subidoPor?: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('fichaId', 'fichaId', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return openDB().then(db => db.transaction(STORE, mode).objectStore(STORE));
}

function asPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const uploadQueueDB = {
  async enqueue(item: PendingFoto): Promise<void> {
    const store = await tx('readwrite');
    await asPromise(store.add(item));
  },

  async getAll(): Promise<PendingFoto[]> {
    const store = await tx('readonly');
    return asPromise(store.getAll() as IDBRequest<PendingFoto[]>);
  },

  async getByFicha(fichaId: string): Promise<PendingFoto[]> {
    const store = await tx('readonly');
    const idx = store.index('fichaId');
    return asPromise(idx.getAll(fichaId) as IDBRequest<PendingFoto[]>);
  },

  async getQueued(): Promise<PendingFoto[]> {
    const store = await tx('readonly');
    const idx = store.index('status');
    return asPromise(idx.getAll('queued') as IDBRequest<PendingFoto[]>);
  },

  async update(id: string, patch: Partial<PendingFoto>): Promise<void> {
    const store = await tx('readwrite');
    const existing = await asPromise(store.get(id) as IDBRequest<PendingFoto | undefined>);
    if (!existing) return;
    await asPromise(store.put({ ...existing, ...patch }));
  },

  async remove(id: string): Promise<void> {
    const store = await tx('readwrite');
    await asPromise(store.delete(id));
  },

  async count(): Promise<number> {
    const store = await tx('readonly');
    return asPromise(store.count());
  },
};
