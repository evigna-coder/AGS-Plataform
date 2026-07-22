import { collection, getDocs, doc, getDoc, query, where, Timestamp } from 'firebase/firestore';
import { ref as storageRef, getDownloadURL } from 'firebase/storage';
import type { Patron, CategoriaPatron, PatronLoteBajaEntry, MotivoBajaLote } from '@ags/shared';
import type { MockPatronBomState } from '../__tests__/fixtures/patronBom';
import { buildConsumirComponentes } from './patronesConsumirHelpers';
import { buildUpdatePatron } from './patronesUpdateHelpers';

// Phase 14 BOM-03 — ./firebase es lazy-import (mirror Phase 13 equivalenciasService pattern)
// para que el test runner tsx/Node pueda cargar este módulo sin disparar `import.meta.env`
// (Vite-only) en firebase.ts. En producción Vite tree-shakea el dynamic import sin penalty.
let _fb: {
  db: any;
  storage: any;
  createBatch: any;
  docRef: any;
  batchAudit: any;
  deepCleanForFirestore: any;
  getCreateTrace: any;
  getUpdateTrace: any;
  onSnapshot: any;
  uploadBytes: any;
  deleteObject: any;
  runTransaction: any;
  logBusinessEvent: any;
} | null = null;
async function getFirebaseModules() {
  if (!_fb) {
    const m = await import('./firebase');
    _fb = {
      db: m.db,
      storage: m.storage,
      createBatch: m.createBatch,
      docRef: m.docRef,
      batchAudit: m.batchAudit,
      deepCleanForFirestore: m.deepCleanForFirestore,
      getCreateTrace: m.getCreateTrace,
      getUpdateTrace: m.getUpdateTrace,
      onSnapshot: m.onSnapshot,
      uploadBytes: m.uploadBytes,
      deleteObject: m.deleteObject,
      runTransaction: m.runTransaction,
      logBusinessEvent: m.logBusinessEvent,
    };
  }
  return _fb;
}

// --- Test injection (Phase 14 BOM-03) — mirrors equivalenciasService.__setTestFirestore ---
// Unit tests inject a MockPatronBomState so all reads/writes hit in-memory Maps instead
// of Firestore. Production code never touches this. consumirComponentes dispatches to
// _consumirComponentesInTest when testState is set, otherwise _consumirComponentesInProd.
let _testState: MockPatronBomState | null = null;
export function __setTestFirestore(state: MockPatronBomState | null): void {
  _testState = state;
}

// Phase 14 BOM-04 — bound update with rename guard + DI test path.
// Helper accepts a superset of getFirebaseModules() so we can pass it directly.
const _updatePatron = buildUpdatePatron({
  getTestState: () => _testState,
  getFirebaseModules,
});

// --- Patrones (colección /patrones) ---
// Cada patrón es un estándar/material de referencia con múltiples lotes.
// Cada lote tiene su propio vencimiento y certificado.

function toPatron(id: string, data: any): Patron {
  return {
    id,
    ...data,
    lotes: data.lotes ?? [],
    lotesBaja: data.lotesBaja ?? [],
    categorias: data.categorias ?? [],
    createdAt: data.createdAt?.toDate?.().toISOString() ?? data.createdAt ?? new Date().toISOString(),
    updatedAt: data.updatedAt?.toDate?.().toISOString() ?? data.updatedAt ?? new Date().toISOString(),
  } as Patron;
}

export const patronesService = {
  async getAll(filters?: {
    categoria?: CategoriaPatron;
    activoOnly?: boolean;
  }): Promise<Patron[]> {
    const { db } = await getFirebaseModules();
    let q = query(collection(db, 'patrones'));
    if (filters?.activoOnly) {
      q = query(q, where('activo', '==', true));
    }
    const snap = await getDocs(q);
    let items = snap.docs.map(d => toPatron(d.id, d.data()));
    if (filters?.categoria) {
      items = items.filter(p => p.categorias.includes(filters.categoria!));
    }
    items.sort((a, b) => a.codigoArticulo.localeCompare(b.codigoArticulo));
    return items;
  },

  async getById(id: string): Promise<Patron | null> {
    const { db } = await getFirebaseModules();
    const snap = await getDoc(doc(db, 'patrones', id));
    if (!snap.exists()) return null;
    return toPatron(snap.id, snap.data());
  },

  async create(data: Omit<Patron, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const { createBatch, docRef, batchAudit, deepCleanForFirestore, getCreateTrace } = await getFirebaseModules();
    const id = crypto.randomUUID();
    const payload = deepCleanForFirestore({
      ...data,
      ...getCreateTrace(),
      activo: data.activo !== undefined ? data.activo : true,
      lotes: data.lotes ?? [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.set(docRef('patrones', id), payload);
    batchAudit(batch, { action: 'create', collection: 'patrones', documentId: id, after: payload });
    await batch.commit();
    return id;
  },

  // Phase 14 BOM-04 — delegates to _updatePatron (guard + DI test path).
  async update(id: string, data: Partial<Omit<Patron, 'id' | 'createdAt'>>): Promise<void> {
    return _updatePatron(id, data);
  },

  async deactivate(id: string): Promise<void> {
    await this.update(id, { activo: false });
  },

  async activate(id: string): Promise<void> {
    await this.update(id, { activo: true });
  },

  async delete(id: string): Promise<void> {
    const { storage, createBatch, docRef, batchAudit, deleteObject } = await getFirebaseModules();
    // Borrar certificados de Storage de todos los lotes antes de eliminar el documento
    const patron = await this.getById(id);
    const todosLotes = [...(patron?.lotes ?? []), ...(patron?.lotesBaja ?? []).map(e => e.lote)];
    for (const lote of todosLotes) {
      if (lote.certificadoStoragePath) {
        try { await deleteObject(storageRef(storage, lote.certificadoStoragePath)); } catch { /* ignore */ }
      }
    }
    const batch = createBatch();
    batch.delete(docRef('patrones', id));
    batchAudit(batch, { action: 'delete', collection: 'patrones', documentId: id });
    await batch.commit();
  },

  // ── Bajas de lotes ──

  /**
   * Da de baja un lote: lo saca de `lotes` y lo mueve a `lotesBaja` con
   * snapshot completo (el certificado sigue consultable). Transaccional:
   * si otro cliente ya lo dio de baja (sweep concurrente de vencidos),
   * devuelve null y el caller NO debe generar ticket — guard anti-duplicado.
   */
  async darDeBajaLote(patronId: string, loteCodigo: string, motivo: MotivoBajaLote): Promise<PatronLoteBajaEntry | null> {
    const { db, runTransaction, deepCleanForFirestore, getUpdateTrace, logBusinessEvent } = await getFirebaseModules();
    const { getCurrentUserTrace } = await import('./currentUser');
    const user = getCurrentUserTrace();
    const entry: PatronLoteBajaEntry | null = await runTransaction(db, async (txn: any) => {
      const ref = doc(db, 'patrones', patronId);
      const snap = await txn.get(ref);
      if (!snap.exists()) return null;
      const data = snap.data();
      const lotes = (data.lotes ?? []) as Patron['lotes'];
      const idx = lotes.findIndex(l => l.lote === loteCodigo);
      if (idx === -1) return null; // ya procesado por otro cliente
      const nueva: PatronLoteBajaEntry = {
        id: crypto.randomUUID(),
        lote: lotes[idx],
        motivo,
        fechaBaja: new Date().toISOString(),
        bajaPorUid: user?.uid ?? null,
        bajaPorNombre: user?.name ?? null,
        ticketId: null,
      };
      txn.update(ref, deepCleanForFirestore({
        lotes: lotes.filter((_, i) => i !== idx),
        lotesBaja: [...(data.lotesBaja ?? []), nueva],
        ...getUpdateTrace(),
        updatedAt: Timestamp.now(),
      }));
      return nueva;
    });
    if (entry) {
      logBusinessEvent({
        eventName: 'patron.lote_baja',
        collection: 'patrones',
        documentId: patronId,
        details: { loteCodigo, motivo },
      });
    }
    return entry;
  },

  /** Vincula el ticket de descarte a una entrada del historial de bajas. */
  async setTicketDeBaja(patronId: string, entryId: string, ticketId: string): Promise<void> {
    const patron = await this.getById(patronId);
    if (!patron) return;
    const lotesBaja = (patron.lotesBaja ?? []).map(e => e.id === entryId ? { ...e, ticketId } : e);
    await this.update(patronId, { lotesBaja });
  },

  // ── Storage: certificado por lote ──

  /**
   * Sube el certificado de un lote específico y actualiza el array lotes del patrón.
   */
  async uploadCertificadoLote(patronId: string, loteIdx: number, file: File): Promise<{ url: string; path: string }> {
    const { storage, uploadBytes } = await getFirebaseModules();
    const patron = await this.getById(patronId);
    if (!patron) throw new Error(`Patron ${patronId} no encontrado`);
    if (loteIdx < 0 || loteIdx >= patron.lotes.length) throw new Error(`Lote index ${loteIdx} fuera de rango`);

    const path = `certificados/patrones/${patronId}/${loteIdx}/${file.name}`;
    const fileRef = storageRef(storage, path);
    await uploadBytes(fileRef, file, { contentType: file.type || 'application/pdf' });
    const url = await getDownloadURL(fileRef);

    const nuevoLotes = [...patron.lotes];
    nuevoLotes[loteIdx] = {
      ...nuevoLotes[loteIdx],
      certificadoUrl: url,
      certificadoNombre: file.name,
      certificadoStoragePath: path,
    };
    await this.update(patronId, { lotes: nuevoLotes });
    return { url, path };
  },

  /**
   * Elimina el certificado de un lote y limpia las referencias.
   */
  async deleteCertificadoLote(patronId: string, loteIdx: number): Promise<void> {
    const { storage, deleteObject } = await getFirebaseModules();
    const patron = await this.getById(patronId);
    if (!patron) return;
    const lote = patron.lotes[loteIdx];
    if (!lote) return;
    if (lote.certificadoStoragePath) {
      try { await deleteObject(storageRef(storage, lote.certificadoStoragePath)); } catch { /* ignore */ }
    }
    const nuevoLotes = [...patron.lotes];
    nuevoLotes[loteIdx] = {
      ...nuevoLotes[loteIdx],
      certificadoUrl: null,
      certificadoNombre: null,
      certificadoStoragePath: null,
    };
    await this.update(patronId, { lotes: nuevoLotes });
  },

  /**
   * subscribe es sync (devuelve unsubscribe inmediato). Cargamos firebase lazy
   * adentro y devolvemos un wrapper que se conecta al onSnapshot real cuando llega.
   */
  subscribe(
    filters: { categoria?: CategoriaPatron; activoOnly?: boolean } | undefined,
    callback: (items: Patron[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    let realUnsubscribe: (() => void) | null = null;
    let cancelled = false;
    void (async () => {
      const { db, onSnapshot } = await getFirebaseModules();
      if (cancelled) return;
      let q = query(collection(db, 'patrones'));
      if (filters?.activoOnly) {
        q = query(q, where('activo', '==', true));
      }
      realUnsubscribe = onSnapshot(q, (snap: any) => {
        let items = snap.docs.map((d: any) => toPatron(d.id, d.data()));
        if (filters?.categoria) {
          items = items.filter((p: Patron) => p.categorias.includes(filters.categoria!));
        }
        items.sort((a: Patron, b: Patron) => a.codigoArticulo.localeCompare(b.codigoArticulo));
        callback(items);
      }, onError);
    })();
    return () => {
      cancelled = true;
      if (realUnsubscribe) realUnsubscribe();
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Phase 14 BOM-03 — consumirComponentes: re-export bound to the local DI state.
// Implementation lives in ./patronesConsumirHelpers.ts (factory pattern: the
// helper module receives `_testState` getter + lazy firebase loader as deps,
// avoiding a circular import while keeping the service file small).
// ─────────────────────────────────────────────────────────────────────────────

export type { ConsumirComponentesParams, ConsumirComponentesResult } from './patronesConsumirHelpers';

export const consumirComponentes = buildConsumirComponentes({
  getTestState: () => _testState,
  getFirebaseModules: async () => {
    const fb = await getFirebaseModules();
    return {
      db: fb.db,
      deepCleanForFirestore: fb.deepCleanForFirestore,
      getUpdateTrace: fb.getUpdateTrace,
    };
  },
});
