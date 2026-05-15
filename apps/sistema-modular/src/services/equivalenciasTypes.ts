/**
 * Shared types for Phase 13 equivalenciasService + test fixtures.
 *
 * Extracted to keep equivalenciasService.ts under 250 LOC per .claude/rules/components.md.
 *
 * Plan 13-03 imports `FirestoreDouble` and `FirestoreTxDouble` verbatim from this file —
 * do NOT redefine them there.
 */

// ── MockState types (used by test fixtures) ───────────────────────────────────

export interface MockEquivalencia {
  articuloIdDestino: string;
  articuloCodigoDestino: string;
  articuloDescripcionDestino: string;
  factor: number;
}

export interface MockArticulo {
  id: string;
  codigo: string;
  descripcion?: string;
  equivalencias: MockEquivalencia[];
  articuloIdDestinoEquivalencia: string | null;
  activo?: boolean;
}

export interface MockUnidadStock {
  id: string;
  articuloId: string;
  estado: string;
  ubicacion: { tipo: string; referenciaId: string; referenciaNombre: string };
  activo?: boolean;
}

export interface MockMovimientoStock {
  id: string;
  tipo: string;
  subtipo?: string;
}

export interface MockEquivalenciasState {
  collections: {
    articulos: MockArticulo[];
    unidades: MockUnidadStock[];
    movimientosStock: MockMovimientoStock[];
  };
}

// ── FirestoreDouble (plan 13-03 runTransaction staging contract) ───────────────

/**
 * A general-purpose Firestore mock for unit tests that need full read/write/delete support.
 *
 * Plan 13-03's `desagregarUnidades` tests use this interface to assert:
 * - STKE-04a: mutations applied when desagregar succeeds
 * - STKE-04b: no mutations when fn throws (atomic rollback via runTransaction)
 * - STKE-04c: exactly one MovimientoStock created with subtipo='conversion'
 *
 * runTransaction semantics (mirrors real Firestore):
 *   - All `tx.update / tx.set / tx.delete` calls inside `fn` are BUFFERED.
 *   - If `fn` resolves: the buffer is applied to fixture state (commit).
 *   - If `fn` throws: the buffer is discarded (rollback); fixture state unchanged.
 *   - `tx.get(collection, id)` reads from CURRENT fixture state (not the buffer),
 *     matching Firestore's snapshot-read semantics.
 *
 * Plan 13-03 imports this interface verbatim — do NOT redefine it there.
 */
export interface FirestoreDouble {
  getDocs(
    collection: string,
    whereClauses?: Array<[string, '==', unknown]>,
  ): Promise<{ docs: Array<{ id: string; data(): Record<string, unknown> }>; empty: boolean }>;

  update(collection: string, id: string, patch: Record<string, unknown>): Promise<void>;
  set(collection: string, id: string, payload: Record<string, unknown>): Promise<void>;
  delete(collection: string, id: string): Promise<void>;

  /**
   * Transactional staging mode.
   * All tx.update/tx.set/tx.delete inside `fn` are buffered; committed iff fn resolves.
   * The `tx` object passed to `fn` has the same surface PLUS `tx.get()`.
   */
  runTransaction<R>(fn: (tx: FirestoreTxDouble) => Promise<R>): Promise<R>;
}

export interface FirestoreTxDouble {
  get(
    collection: string,
    id: string,
  ): Promise<{ exists(): boolean; data(): Record<string, unknown> }>;
  update(collection: string, id: string, patch: Record<string, unknown>): void;
  set(collection: string, id: string, payload: Record<string, unknown>): void;
  delete(collection: string, id: string): void;
}
