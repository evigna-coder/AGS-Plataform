import { collection, getDocs, doc, getDoc, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { ref as storageRef, getDownloadURL } from 'firebase/storage';
import type { Loaner, PrestamoLoaner, ExtraccionLoaner, VentaLoaner, FotoLoaner } from '@ags/shared';
import type { MockVentaLoanerState } from './__tests__/fixtures/ventaLoaner';
import {
  buildRegistrarVenta,
  type RegistrarVentaParams,
  type RegistrarVentaResult,
} from './loanersVentaHelpers';

// Re-export public types so callers can import everything from one place.
export type { RegistrarVentaParams, RegistrarVentaResult };

// --- Loaners (Equipos en préstamo) ---

// ── Lazy firebase modules loader ─────────────────────────────────────────────
// Phase 15 — ./firebase es lazy-import (mirror Phase 13 equivalenciasService +
// Phase 14 patronesService) para que tsx/Node puedan cargar este módulo en
// unit tests sin disparar `import.meta.env` (Vite-only) en firebase.ts.
// En producción Vite tree-shakea el dynamic import sin penalty.
let _fb: {
  db: any;
  createBatch: any;
  docRef: any;
  batchAudit: any;
  deepCleanForFirestore: any;
  getCreateTrace: any;
  getUpdateTrace: any;
  getCurrentUserTrace: any;
  onSnapshot: any;
  logBusinessEvent: any;
  storage: any;
  uploadBytes: any;
  deleteObject: any;
} | null = null;

async function getFirebaseModules() {
  if (!_fb) {
    const m = await import('./firebase');
    _fb = {
      db: m.db,
      createBatch: m.createBatch,
      docRef: m.docRef,
      batchAudit: m.batchAudit,
      deepCleanForFirestore: m.deepCleanForFirestore,
      getCreateTrace: m.getCreateTrace,
      getUpdateTrace: m.getUpdateTrace,
      getCurrentUserTrace: m.getCurrentUserTrace,
      onSnapshot: m.onSnapshot,
      logBusinessEvent: m.logBusinessEvent,
      storage: m.storage,
      uploadBytes: m.uploadBytes,
      deleteObject: m.deleteObject,
    };
  }
  return _fb!;
}

// ── Phase 15 (VLN-02) — DI test state ─────────────────────────────────────────
// Mirror pattern: patronesService.ts:44-47, equivalenciasService.ts:70-79.
// Unit tests (`ventaLoaner.test.ts`) inject a `MockVentaLoanerState` so all
// Firestore reads/writes for the `registrarVenta` transaction hit in-memory
// arrays instead of real Firestore. Production code MUST NEVER call this.

let _testState: MockVentaLoanerState | null = null;

/**
 * Phase 15 DI hook — sets/clears the in-memory mock state used by the
 * `registrarVenta` named export when running under the unit-test harness.
 * Pass `null` to reset between tests (the `beforeEach` in the test suite does this).
 */
export function __setTestFirestore(state: MockVentaLoanerState | null): void {
  _testState = state;
}

/**
 * Phase 15 (VLN-02) — venta transaccional de loaner con espejo en stock.
 *
 * Bound implementation from `loanersVentaHelpers.buildRegistrarVenta`. The factory
 * receives our `_testState` getter and `getFirebaseModules` loader so the
 * function dispatches test vs prod transparently while keeping the test-state
 * variable colocated with the `__setTestFirestore` setter in this file.
 *
 * See `loanersVentaHelpers.ts` for the full implementation (READ-FIRST guard,
 * 3-write atomic tx, in-memory test path with rollback hook, post-commit audit).
 */
export const registrarVenta = buildRegistrarVenta({
  getTestState: () => _testState,
  getFirebaseModules,
});

// ── loanersService — public CRUD surface ─────────────────────────────────────

export const loanersService = {
  async getNextLoanerCodigo(): Promise<string> {
    const { db } = await getFirebaseModules();
    const q = query(collection(db, 'loaners'), orderBy('codigo', 'desc'));
    const snap = await getDocs(q);
    let maxNum = 0;
    snap.docs.forEach((d: any) => {
      const codigo = d.data().codigo;
      const match = codigo?.match(/LNR-(\d+)/);
      if (match) {
        const num = parseInt(match[1]);
        if (num > maxNum) maxNum = num;
      }
    });
    return `LNR-${String(maxNum + 1).padStart(4, '0')}`;
  },

  async getAll(filters?: {
    estado?: string;
    activoOnly?: boolean;
  }): Promise<Loaner[]> {
    const { db } = await getFirebaseModules();
    let q = query(collection(db, 'loaners'));
    if (filters?.estado) {
      q = query(q, where('estado', '==', filters.estado));
    }
    const snap = await getDocs(q);
    let items = snap.docs.map((d: any) => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    })) as Loaner[];
    if (filters?.activoOnly) {
      items = items.filter(l => l.activo);
    }
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return items;
  },

  subscribe(
    filters: { estado?: string; activoOnly?: boolean } | undefined,
    callback: (items: Loaner[]) => void,
    onError?: (error: Error) => void,
  ) {
    // subscribe es sync — fire-and-forget el lazy load y devuelve un unsub que
    // recién engancha cuando los módulos estén listos. Esto sólo se ejecuta en
    // browser/Electron (no en tests — los tests no llaman a subscribe).
    let realUnsub: (() => void) | null = null;
    let cancelled = false;
    getFirebaseModules().then(({ db, onSnapshot }) => {
      if (cancelled) return;
      let q = query(collection(db, 'loaners'));
      if (filters?.estado) {
        q = query(q, where('estado', '==', filters.estado));
      }
      realUnsub = onSnapshot(q, (snap: any) => {
        let items = snap.docs.map((d: any) => ({
          id: d.id,
          ...d.data(),
          createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
          updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
        })) as Loaner[];
        if (filters?.activoOnly) {
          items = items.filter(l => l.activo);
        }
        items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callback(items);
      }, onError);
    });
    return () => {
      cancelled = true;
      if (realUnsub) realUnsub();
    };
  },

  async getById(id: string): Promise<Loaner | null> {
    const { db } = await getFirebaseModules();
    const snap = await getDoc(doc(db, 'loaners', id));
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...snap.data(),
      createdAt: snap.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: snap.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    } as Loaner;
  },

  subscribeById(
    id: string,
    callback: (item: Loaner | null) => void,
    onError?: (err: Error) => void,
  ): () => void {
    let realUnsub: (() => void) | null = null;
    let cancelled = false;
    getFirebaseModules().then(({ db, onSnapshot }) => {
      if (cancelled) return;
      realUnsub = onSnapshot(doc(db, 'loaners', id), (snap: any) => {
        if (!snap.exists()) { callback(null); return; }
        callback({
          id: snap.id,
          ...snap.data(),
          createdAt: snap.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
          updatedAt: snap.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
        } as Loaner);
      }, (err: Error) => {
        console.error('loaners subscription error:', err);
        onError?.(err);
      });
    });
    return () => {
      cancelled = true;
      if (realUnsub) realUnsub();
    };
  },

  async create(data: Omit<Loaner, 'id' | 'codigo' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const { createBatch, docRef, batchAudit, deepCleanForFirestore, getCreateTrace } =
      await getFirebaseModules();
    const id = crypto.randomUUID();
    const codigo = await this.getNextLoanerCodigo();
    const payload = deepCleanForFirestore({
      ...data,
      ...getCreateTrace(),
      codigo,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.set(docRef('loaners', id), payload);
    batchAudit(batch, { action: 'create', collection: 'loaners', documentId: id, after: payload });
    await batch.commit();
    return id;
  },

  async update(id: string, data: Partial<Omit<Loaner, 'id' | 'createdAt'>>): Promise<void> {
    const { createBatch, docRef, batchAudit, deepCleanForFirestore, getUpdateTrace } =
      await getFirebaseModules();
    const payload = deepCleanForFirestore({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.update(docRef('loaners', id), payload);
    batchAudit(batch, { action: 'update', collection: 'loaners', documentId: id, after: payload });
    await batch.commit();
  },

  async delete(id: string): Promise<void> {
    const { createBatch, docRef, batchAudit } = await getFirebaseModules();
    const batch = createBatch();
    batch.delete(docRef('loaners', id));
    batchAudit(batch, { action: 'delete', collection: 'loaners', documentId: id });
    await batch.commit();
  },

  async getDisponibles(): Promise<Loaner[]> {
    return this.getAll({ estado: 'en_base', activoOnly: true });
  },

  /** Registra el préstamo y devuelve el id generado (necesario para vincular fotos de salida). */
  async registrarPrestamo(id: string, prestamo: Omit<PrestamoLoaner, 'id'>): Promise<string> {
    const loaner = await this.getById(id);
    if (!loaner) throw new Error('Loaner no encontrado');
    const newPrestamo: PrestamoLoaner = { ...prestamo, id: crypto.randomUUID() };
    await this.update(id, {
      estado: 'en_cliente',
      prestamos: [...loaner.prestamos, newPrestamo],
    });
    return newPrestamo.id;
  },

  async registrarDevolucion(loanerId: string, prestamoId: string, data: {
    fechaRetornoReal: string;
    condicionRetorno: string;
    remitoRetornoId?: string;
    remitoRetornoNumero?: string;
    /** Ciclo de recalificación: si true (default), el loaner NO vuelve disponible —
     *  queda 'en_recalificacion' hasta que su OT de recalificación cierre técnicamente. */
    requiereRecalificacion?: boolean;
  }): Promise<void> {
    const loaner = await this.getById(loanerId);
    if (!loaner) throw new Error('Loaner no encontrado');
    const { requiereRecalificacion, ...rest } = data;
    const recalifica = requiereRecalificacion ?? true;
    const prestamos = loaner.prestamos.map(p =>
      p.id === prestamoId
        ? { ...p, ...rest, requiereRecalificacion: recalifica, estado: 'devuelto' as const }
        : p
    );
    await this.update(loanerId, {
      estado: recalifica ? 'en_recalificacion' : 'en_base',
      prestamos,
      condicion: data.condicionRetorno,
    });
  },

  /** Vincula un número de OT al loaner (dedup, no pisa los existentes). */
  async vincularOT(loanerId: string, otNumber: string): Promise<void> {
    if (!loanerId || !otNumber) return;
    const loaner = await this.getById(loanerId);
    if (!loaner) return;
    const actuales = loaner.otIds ?? [];
    if (actuales.includes(otNumber)) return;
    await this.update(loanerId, { otIds: [...actuales, otNumber] });
  },

  /** Anota en el préstamo el número de la OT de recalificación auto-creada. */
  async setOtRecalificacionEnPrestamo(loanerId: string, prestamoId: string, otNumber: string): Promise<void> {
    const loaner = await this.getById(loanerId);
    if (!loaner) return;
    const prestamos = loaner.prestamos.map(p =>
      p.id === prestamoId ? { ...p, otRecalificacionNumber: otNumber } : p
    );
    await this.update(loanerId, { prestamos });
  },

  /**
   * Libera el loaner tras la recalificación: 'en_recalificacion' → 'en_base'.
   * Idempotente — si el loaner ya no está en recalificación no hace nada.
   * Devuelve true si efectivamente lo liberó.
   */
  async liberarTrasRecalificacion(loanerId: string): Promise<boolean> {
    const loaner = await this.getById(loanerId);
    if (!loaner || loaner.estado !== 'en_recalificacion') return false;
    await this.update(loanerId, { estado: 'en_base' });
    const { logBusinessEvent } = await getFirebaseModules();
    logBusinessEvent({
      eventName: 'loaner.liberado_recalificacion',
      collection: 'loaners',
      documentId: loanerId,
      entityLabel: `Loaner ${loaner.codigo}`,
    });
    return true;
  },

  /** Sube una foto a Storage (`loaners/{id}/fotos/…`) y la agrega al array `fotos`. */
  async agregarFoto(loanerId: string, file: File | Blob, meta: {
    nombre?: string | null;
    descripcion?: string | null;
    contexto: FotoLoaner['contexto'];
    prestamoId?: string | null;
  }): Promise<FotoLoaner> {
    const { storage, uploadBytes, getCurrentUserTrace } = await getFirebaseModules();
    const loaner = await this.getById(loanerId);
    if (!loaner) throw new Error('Loaner no encontrado');
    const rawName = meta.nombre || (file instanceof File ? file.name : 'foto.jpg');
    const safeName = rawName.replace(/[^\w.\-]/g, '_');
    const storagePath = `loaners/${loanerId}/fotos/${Date.now()}-${safeName}`;
    const r = storageRef(storage, storagePath);
    await uploadBytes(r, file, { contentType: file.type || 'image/jpeg' });
    const url = await getDownloadURL(r);
    const trace = getCurrentUserTrace?.();
    const foto: FotoLoaner = {
      id: crypto.randomUUID(),
      url,
      storagePath,
      nombre: rawName,
      descripcion: meta.descripcion ?? null,
      contexto: meta.contexto,
      prestamoId: meta.prestamoId ?? null,
      fecha: new Date().toISOString(),
      subidoPor: trace?.name ?? null,
    };
    await this.update(loanerId, { fotos: [...(loaner.fotos ?? []), foto] });
    return foto;
  },

  /** Quita la foto del array y borra el archivo de Storage (best-effort). */
  async eliminarFoto(loanerId: string, fotoId: string): Promise<void> {
    const { storage, deleteObject } = await getFirebaseModules();
    const loaner = await this.getById(loanerId);
    if (!loaner) return;
    const foto = (loaner.fotos ?? []).find(f => f.id === fotoId);
    if (!foto) return;
    if (foto.storagePath) {
      try {
        await deleteObject(storageRef(storage, foto.storagePath));
      } catch (err) {
        // Ya borrada o ruta inválida — no es fatal
        console.warn('No se pudo eliminar foto de Storage:', foto.storagePath, err);
      }
    }
    await this.update(loanerId, { fotos: (loaner.fotos ?? []).filter(f => f.id !== fotoId) });
  },

  async registrarExtraccion(id: string, extraccion: Omit<ExtraccionLoaner, 'id'>): Promise<void> {
    const loaner = await this.getById(id);
    if (!loaner) throw new Error('Loaner no encontrado');
    const newExtraccion: ExtraccionLoaner = { ...extraccion, id: crypto.randomUUID() };
    await this.update(id, {
      extracciones: [...loaner.extracciones, newExtraccion],
    });
  },

  /**
   * Phase 15 (VLN-02) — venta transaccional. Delegates to the `registrarVenta` named export
   * (defined above; implementation in `loanersVentaHelpers.ts`) so both the imperative
   * caller surface (`loanersService.registrarVenta(...)`) and the test-import surface
   * (`import { registrarVenta } from '../loanersService'`) share one implementation.
   *
   * Signature widened vs Phase 14: requires `costoUnitario` + `monedaCosto` in `venta`
   * at runtime, returns `{ unidadId, movimientoId }` (was `void`), accepts an
   * optional `articuloRecienVinculado` third param.
   */
  async registrarVenta(
    id: string,
    venta: VentaLoaner & { costoUnitario: number; monedaCosto: 'ARS' | 'USD' },
    articuloRecienVinculado?: {
      articuloId: string;
      articuloCodigo: string;
      articuloDescripcion: string;
    } | null,
  ): Promise<RegistrarVentaResult> {
    return registrarVenta({
      loanerId: id,
      venta,
      articuloRecienVinculado: articuloRecienVinculado ?? null,
    });
  },
};
