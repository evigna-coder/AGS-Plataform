/**
 * equivalenciasService — Phase 13 (STKE-02).
 *
 * Manages the 1→1 compra↔uso equivalence between Articulo documents.
 *
 * === DI hook (`__setTestFirestore`) ===
 * Unit tests inject a `MockEquivalenciasState` so all Firestore reads/writes are
 * intercepted without touching real Firestore. Only `equivalencias.test.ts` calls it;
 * production code never does.
 *
 * === Module-load cycle AND import.meta.env avoidance ===
 * ALL Firebase imports are deferred (lazy dynamic) — no static imports from 'firebase/*'
 * or './firebase'. This avoids import.meta.env errors when running under tsx/Node.js in
 * unit tests. In production (Vite), imports are tree-shaken and bundled normally.
 *
 * articulosService is also lazy-loaded to break the module cycle: equivalenciasService
 * is lazy-imported by stockService.ts, which itself exports articulosService.  A static
 * import in either direction leaves the other module undefined at first call.
 *
 * === runTransaction staging contract ===
 * See `FirestoreDouble` / `FirestoreTxDouble` in `./equivalenciasTypes` — plan 13-03
 * reuses those interfaces verbatim for atomic rollback assertions.
 */

import type { Articulo, ArticuloEquivalencia, UbicacionStock } from '@ags/shared';
import type {
  MockArticulo,
  MockEquivalenciasState,
} from './equivalenciasTypes';

// Re-export interfaces so consumers can import from a single place
export type {
  MockEquivalencia,
  MockArticulo,
  MockUnidadStock,
  MockMovimientoStock,
  MockEquivalenciasState,
  FirestoreDouble,
  FirestoreTxDouble,
} from './equivalenciasTypes';

// ── Firebase deferred modules (avoids import.meta.env at test time) ───────────

let _fb: {
  collection: any; doc: any; getDocs: any; query: any;
  Timestamp: any; where: any; db: any; createBatch: any;
  deepCleanForFirestore: any; getUpdateTrace: any; logBusinessEvent: any;
} | null = null;

async function getFirebaseModules() {
  if (!_fb) {
    const [ff, helpers] = await Promise.all([
      import('firebase/firestore'),
      import('./firebase'),
    ]);
    _fb = {
      collection: ff.collection, doc: ff.doc, getDocs: ff.getDocs,
      query: ff.query, Timestamp: ff.Timestamp, where: ff.where,
      db: helpers.db, createBatch: helpers.createBatch,
      deepCleanForFirestore: helpers.deepCleanForFirestore,
      getUpdateTrace: helpers.getUpdateTrace,
      logBusinessEvent: helpers.logBusinessEvent,
    };
  }
  return _fb!;
}

// ── DI state ─────────────────────────────────────────────────────────────────

let _testState: MockEquivalenciasState | null = null;

/**
 * Dependency injection hook for unit tests.
 * Pass a MockEquivalenciasState to bypass Firestore; pass null to reset.
 * NEVER call from production code.
 */
export function __setTestFirestore(state: MockEquivalenciasState | null): void {
  _testState = state;
}

// ── Lazy articulosService (avoids module-load cycle) ─────────────────────────

async function loadArticulosService() {
  const mod = await import('./stockService');
  return mod.articulosService;
}

// ── Private helpers ───────────────────────────────────────────────────────────

async function fetchArticulo(id: string): Promise<MockArticulo | null> {
  if (_testState) {
    return _testState.collections.articulos.find(a => a.id === id) ?? null;
  }
  const svc = await loadArticulosService();
  return svc.getById(id) as Promise<MockArticulo | null>;
}

async function fetchOriginPointingTo(destinoId: string): Promise<MockArticulo | null> {
  if (_testState) {
    return _testState.collections.articulos.find(
      a => a.articuloIdDestinoEquivalencia === destinoId && a.activo !== false,
    ) ?? null;
  }
  const fb = await getFirebaseModules();
  const snap = await fb.getDocs(
    fb.query(
      fb.collection(fb.db, 'articulos'),
      fb.where('articuloIdDestinoEquivalencia', '==', destinoId),
      fb.where('activo', '==', true),
    ),
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as unknown as MockArticulo;
}

async function applyUpdate(id: string, patch: Record<string, unknown>): Promise<void> {
  if (_testState) {
    const idx = _testState.collections.articulos.findIndex(a => a.id === id);
    if (idx !== -1) {
      _testState.collections.articulos[idx] = {
        ..._testState.collections.articulos[idx],
        ...(patch as Partial<MockArticulo>),
      };
    }
    return;
  }
  const svc = await loadArticulosService();
  await svc.update(id, patch as Partial<Omit<Articulo, 'id' | 'createdAt'>>);
}

async function logEvent(
  eventName: string,
  documentId: string,
  details?: Record<string, unknown>,
): Promise<void> {
  if (_testState) return; // no-op in test mode
  const fb = await getFirebaseModules();
  fb.logBusinessEvent({ eventName, collection: 'articulos', documentId, details });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Links origenId → destinoId with the given factor (STKE-02a..e validations).
 */
export async function linkEquivalencia(
  origenId: string,
  destinoId: string,
  factor: number,
): Promise<void> {
  // a) self-link
  if (origenId === destinoId) {
    throw new Error('Un artículo no puede vincularse consigo mismo (self-link)');
  }
  // b) invalid factor
  if (!Number.isFinite(factor) || factor <= 0) {
    throw new Error(`Factor inválido: ${factor}. Debe ser un número finito > 0`);
  }
  // c) origen already linked
  const origen = await fetchArticulo(origenId);
  if (!origen) throw new Error('Artículo origen no existe');
  if ((origen.equivalencias?.length ?? 0) > 0) {
    throw new Error('Este artículo ya tiene una equivalencia configurada');
  }
  // d) destino already taken by another origen
  const conflicto = await fetchOriginPointingTo(destinoId);
  if (conflicto) {
    throw new Error(`Destino ya vinculado por ${conflicto.codigo} (${conflicto.id})`);
  }
  // e) cycle A→B→A
  const destino = await fetchArticulo(destinoId);
  if (!destino) throw new Error('Artículo destino no existe');
  if (destino.articuloIdDestinoEquivalencia === origenId) {
    throw new Error(`Ciclo detectado: ${destino.codigo} ya apunta a ${origen.codigo}`);
  }

  const eq: ArticuloEquivalencia = {
    articuloIdDestino: destino.id,
    articuloCodigoDestino: destino.codigo,
    articuloDescripcionDestino: destino.descripcion ?? '',
    factor,
  };
  await applyUpdate(origenId, {
    equivalencias: [eq],
    articuloIdDestinoEquivalencia: destino.id,
  });
  await logEvent('articulo.equivalencia_creada', origenId, { articuloIdDestino: destinoId, factor });
}

/**
 * Clears `equivalencias` and `articuloIdDestinoEquivalencia` in one write (STKE-02f).
 */
export async function unlinkEquivalencia(origenId: string): Promise<void> {
  await applyUpdate(origenId, { equivalencias: [], articuloIdDestinoEquivalencia: null });
  await logEvent('articulo.equivalencia_eliminada', origenId);
}

/**
 * Returns the artículo with `articuloIdDestinoEquivalencia === destinoId`, or null.
 * Used by plan 13-06 ArticuloDetail for dual display (destino side).
 */
export async function findOrigenDeDestino(destinoId: string): Promise<Articulo | null> {
  const result = await fetchOriginPointingTo(destinoId);
  return result as unknown as Articulo | null;
}

/**
 * Refreshes `articuloCodigoDestino` / `articuloDescripcionDestino` on every artículo
 * pointing to `articuloId`. Called fire-and-forget by `articulosService.update()` when
 * codigo/descripcion change. Best-effort — never re-throws.
 *
 * Lives here (not stockService.ts) to prevent the module-load cycle. stockService.ts
 * invokes via `await import('./equivalenciasService')`.
 */
export async function recomputeEquivalenciaDenormalization(articuloId: string): Promise<void> {
  try {
    const [fb, svc] = await Promise.all([getFirebaseModules(), loadArticulosService()]);
    const fresh = await svc.getById(articuloId);
    if (!fresh) return;
    const snap = await fb.getDocs(
      fb.query(fb.collection(fb.db, 'articulos'), fb.where('articuloIdDestinoEquivalencia', '==', articuloId)),
    );
    if (snap.empty) return;
    const batch = fb.createBatch();
    for (const d of snap.docs) {
      const eqs = (d.data().equivalencias ?? []) as ArticuloEquivalencia[];
      if (!eqs.length) continue;
      const updated = eqs.map((e: ArticuloEquivalencia) =>
        e.articuloIdDestino === articuloId
          ? { ...e, articuloCodigoDestino: fresh.codigo, articuloDescripcionDestino: fresh.descripcion }
          : e,
      );
      batch.update(
        fb.doc(fb.db, 'articulos', d.id),
        fb.deepCleanForFirestore({ equivalencias: updated, ...fb.getUpdateTrace(), updatedAt: fb.Timestamp.now() }),
      );
    }
    await batch.commit();
  } catch (err) {
    console.error('[recomputeEquivalenciaDenormalization] failed:', err);
  }
}

/**
 * Stub — plan 13-03 owns the implementation.
 * In test mode, pre-validates stock availability to make STKE-04b assertable.
 * In prod mode, always throws NOT_IMPLEMENTED (loud-fail on premature caller).
 */
export async function desagregarUnidades(_params: {
  articuloOrigenId: string;
  cantidad: number;
  ubicacion: UbicacionStock;
  solicitadoPorNombre: string;
}): Promise<{ movimientoId: string; cantidadDestino: number }> {
  if (_testState) {
    const origen = _testState.collections.articulos.find(a => a.id === _params.articuloOrigenId);
    if (!origen?.equivalencias?.length) throw new Error('Sin equivalencia configurada');
    const disponibles = _testState.collections.unidades.filter(
      u =>
        u.articuloId === _params.articuloOrigenId &&
        u.estado === 'disponible' &&
        u.activo !== false &&
        u.ubicacion.referenciaId === _params.ubicacion.referenciaId,
    );
    if (disponibles.length < _params.cantidad) {
      throw new Error(
        `stock insuficiente: ${disponibles.length} disponible(s), se requieren ${_params.cantidad}`,
      );
    }
  }
  throw new Error('NOT_IMPLEMENTED — plan 13-03 owns this function. Loud-fail on premature caller.');
}
