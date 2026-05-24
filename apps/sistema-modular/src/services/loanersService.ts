import { collection, getDocs, doc, getDoc, query, where, orderBy, Timestamp } from 'firebase/firestore';
import type { Loaner, PrestamoLoaner, ExtraccionLoaner, VentaLoaner } from '@ags/shared';
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
  onSnapshot: any;
  logBusinessEvent: any;
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
      onSnapshot: m.onSnapshot,
      logBusinessEvent: m.logBusinessEvent,
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

  async registrarPrestamo(id: string, prestamo: Omit<PrestamoLoaner, 'id'>): Promise<void> {
    const loaner = await this.getById(id);
    if (!loaner) throw new Error('Loaner no encontrado');
    const newPrestamo: PrestamoLoaner = { ...prestamo, id: crypto.randomUUID() };
    await this.update(id, {
      estado: 'en_cliente',
      prestamos: [...loaner.prestamos, newPrestamo],
    });
  },

  async registrarDevolucion(loanerId: string, prestamoId: string, data: {
    fechaRetornoReal: string;
    condicionRetorno: string;
    remitoRetornoId?: string;
    remitoRetornoNumero?: string;
  }): Promise<void> {
    const loaner = await this.getById(loanerId);
    if (!loaner) throw new Error('Loaner no encontrado');
    const prestamos = loaner.prestamos.map(p =>
      p.id === prestamoId
        ? { ...p, ...data, estado: 'devuelto' as const }
        : p
    );
    await this.update(loanerId, { estado: 'en_base', prestamos, condicion: data.condicionRetorno });
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
