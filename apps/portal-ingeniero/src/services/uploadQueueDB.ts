/**
 * IndexedDB queue for foto uploads del portal (fichas, loaners y unidades de stock).
 *
 * Why: planta/campo tienen señal inestable. Queremos que el ingeniero pueda
 * capturar fotos sin esperar la subida — el blob queda en local y se sube cuando
 * hay red. Si el dispositivo se apaga, la cola sobrevive.
 *
 * Los docs (ficha/loaner) existen en Firestore (gracias a `persistentLocalCache`
 * ya configurado en firebase.ts, los writes son offline-tolerant). Las fotos NO —
 * los binarios pasan por esta cola hasta que `uploadQueueManager` los drena a
 * Firebase Storage.
 *
 * Schema v3: cada item lleva un discriminador `tipo` ('ficha' | 'loaner' |
 * 'unidad') con sus campos target propios. Los items v1 (solo fichas) migran a
 * `tipo: 'ficha'` en el upgrade callback sin perderse; v3 -> v4 cambia el
 * indice `unidadId` por `destinoId`: las fotos de mercaderia pasaron a colgar
 * del DOCUMENTO (importacion o remito) y no de cada unidad (2026-09-03).
 */
import type { MomentoFotoFicha, FotoLoaner } from '@ags/shared';
import type { DestinoFotos } from './mercaderiaFotosService';

const DB_NAME = 'ags-portal-uploads';
const DB_VERSION = 4;
const STORE = 'pendingFotos';

export type PendingFotoStatus = 'queued' | 'uploading' | 'error';

interface PendingFotoBase {
  id: string;            // uuid local
  /** Legacy (items encolados antes de 2026-08-06). En iOS/WebKit los Blobs
   *  persistidos en IndexedDB pueden quedar ILEGIBLES tras cerrar la PWA —
   *  la subida falla como si fuera error de red. Por eso los items nuevos
   *  guardan `data` (ArrayBuffer, sobrevive siempre) y este campo quedó
   *  solo para drenar lo ya encolado. */
  blob?: Blob;
  /** Bytes crudos de la foto (items 2026-08-06+). */
  data?: ArrayBuffer;
  /** MIME de `data` (image/jpeg si falta). */
  mime?: string;
  filename: string;
  capturaAt: string;     // ISO
  intentos: number;
  status: PendingFotoStatus;
  lastError?: string;
  subidoPor?: string;
}

/** Blob utilizable del item, venga como venga (data nuevo o blob legacy). */
export function pendingFotoBlob(p: PendingFoto): Blob | null {
  if (p.data) return new Blob([p.data], { type: p.mime || 'image/jpeg' });
  return p.blob ?? null;
}

export interface PendingFotoFicha extends PendingFotoBase {
  tipo: 'ficha';
  fichaId: string;       // FK al doc en Firestore
  fichaNumero: string;   // FPC-XXXX, usado en el storage path
  momento: MomentoFotoFicha;
}

export interface PendingFotoLoaner extends PendingFotoBase {
  tipo: 'loaner';
  loanerId: string;      // FK al doc en Firestore (y parte del storage path)
  loanerCodigo: string;  // LNR-XXXX, solo para mostrar en la UI
  contexto: FotoLoaner['contexto'];
  prestamoId: string | null;
}

export interface PendingFotoMercaderia extends PendingFotoBase {
  tipo: 'mercaderia';
  /** Importacion (recepcion) o remito (entrega). */
  destino: DestinoFotos;
  destinoId: string;      // FK al doc en Firestore (y parte del storage path)
  /** Numero del documento, para mostrarlo en la cola. */
  destinoEtiqueta: string;
}

export type PendingFoto = PendingFotoFicha | PendingFotoLoaner | PendingFotoMercaderia;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      const upgradeTx = req.transaction;
      const store = db.objectStoreNames.contains(STORE)
        ? upgradeTx!.objectStore(STORE)
        : db.createObjectStore(STORE, { keyPath: 'id' });

      if (!store.indexNames.contains('fichaId')) {
        store.createIndex('fichaId', 'fichaId', { unique: false });
      }
      if (!store.indexNames.contains('status')) {
        store.createIndex('status', 'status', { unique: false });
      }
      if (!store.indexNames.contains('loanerId')) {
        // Los items de ficha no tienen `loanerId` — el índice simplemente los omite.
        store.createIndex('loanerId', 'loanerId', { unique: false });
      }
      if (!store.indexNames.contains('destinoId')) {
        store.createIndex('destinoId', 'destinoId', { unique: false });
      }

      // v1 → v2: todos los items existentes eran de fichas (no había otro flujo).
      if (event.oldVersion > 0 && event.oldVersion < 2) {
        const cursorReq = store.openCursor();
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (!cursor) return;
          const value = cursor.value as Partial<PendingFoto> & Record<string, unknown>;
          if (value.tipo !== 'ficha' && value.tipo !== 'loaner') {
            cursor.update({ ...value, tipo: 'ficha' });
          }
          cursor.continue();
        };
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

  async getByFicha(fichaId: string): Promise<PendingFotoFicha[]> {
    const store = await tx('readonly');
    const idx = store.index('fichaId');
    return asPromise(idx.getAll(fichaId) as IDBRequest<PendingFotoFicha[]>);
  },

  async getByLoaner(loanerId: string): Promise<PendingFotoLoaner[]> {
    const store = await tx('readonly');
    const idx = store.index('loanerId');
    return asPromise(idx.getAll(loanerId) as IDBRequest<PendingFotoLoaner[]>);
  },

  async getByDestino(destinoId: string): Promise<PendingFotoMercaderia[]> {
    const store = await tx('readonly');
    const idx = store.index('destinoId');
    return asPromise(idx.getAll(destinoId) as IDBRequest<PendingFotoMercaderia[]>);
  },

  async getQueued(): Promise<PendingFoto[]> {
    const store = await tx('readonly');
    const idx = store.index('status');
    return asPromise(idx.getAll('queued') as IDBRequest<PendingFoto[]>);
  },

  async update(id: string, patch: Partial<PendingFotoBase>): Promise<void> {
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
