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

// ── desagregarUnidades — plan 13-03 implementation (atomic model) ─────────────

/**
 * Atomically converts N origen UnidadStock docs (estado: consumido) into
 * N×factor new destino UnidadStock docs (estado: disponible) at the same
 * ubicacion, plus one MovimientoStock audit log with subtipo='conversion'.
 *
 * Atomic model: 1 UnidadStock doc = 1 physical unit (Phase 9 convention).
 *
 * @returns { movimientoId, cantidadDestino } on success.
 * @throws 'Stock insuficiente' | 'Artículo origen no existe' | etc. on failure.
 */
export async function desagregarUnidades(params: {
  articuloOrigenId: string;
  cantidad: number;
  ubicacion: UbicacionStock;
  solicitadoPorNombre: string;
}): Promise<{ movimientoId: string; cantidadDestino: number }> {
  // ── Step 1: Argument validation (synchronous, fail-fast) ────────────────
  if (params.cantidad <= 0 || !Number.isInteger(params.cantidad)) {
    throw new Error('Cantidad debe ser entero positivo');
  }
  if (!params.solicitadoPorNombre) {
    throw new Error('solicitadoPorNombre requerido para audit');
  }

  // ── Step 2: Pre-fetch stable data OUTSIDE the tx ────────────────────────
  const origen = await fetchArticulo(params.articuloOrigenId);
  if (!origen) throw new Error('Artículo origen no existe');
  if ((origen.equivalencias?.length ?? 0) === 0) {
    throw new Error('Artículo origen no tiene equivalencia configurada');
  }
  const eq = origen.equivalencias[0];

  const destino = await fetchArticulo(eq.articuloIdDestino);
  if (!destino) throw new Error('Artículo destino no existe');

  // ── Step 3: Pre-generate IDs (deterministic paths inside tx) ───────────
  const rawCantidadDestino = params.cantidad * eq.factor;
  if (Math.abs(rawCantidadDestino - Math.round(rawCantidadDestino)) > 1e-9) {
    throw new Error(
      `Conversión genera cantidad destino no entera (${rawCantidadDestino}) — ajuste el factor o la cantidad`,
    );
  }
  const cantidadDestino = Math.round(rawCantidadDestino);
  const movId = crypto.randomUUID();
  const nuevasDestinoIds = Array.from({ length: cantidadDestino }, () => crypto.randomUUID());
  const nowIso = new Date().toISOString();

  // ── Step 4: Execute — branch on test vs prod ────────────────────────────
  if (_testState) {
    await _runConversionInTestMode(
      _testState,
      params,
      destino.id,
      movId,
      nuevasDestinoIds,
    );
    return { movimientoId: movId, cantidadDestino };
  }

  // Production path: real Firestore runTransaction
  await _runConversionInProd(
    params,
    origen,
    destino,
    eq,
    cantidadDestino,
    movId,
    nuevasDestinoIds,
    nowIso,
  );

  // ── Step 5: Post-tx audit (fire-and-forget) ─────────────────────────────
  void logEvent('stock.conversion_realizada', movId, {
    articuloOrigenId: params.articuloOrigenId,
    articuloDestinoId: destino.id,
    cantidadOrigen: params.cantidad,
    cantidadDestino,
    factor: eq.factor,
  });

  return { movimientoId: movId, cantidadDestino };
}

/** Runs conversion entirely against MockEquivalenciasState (unit test path). */
async function _runConversionInTestMode(
  state: MockEquivalenciasState,
  params: { articuloOrigenId: string; cantidad: number; ubicacion: UbicacionStock },
  destinoId: string,
  movId: string,
  nuevasDestinoIds: string[],
): Promise<void> {
  // Find candidatas (FIFO by index — fixture has no createdAt)
  const candidatas = state.collections.unidades
    .filter(
      u =>
        u.articuloId === params.articuloOrigenId &&
        u.estado === 'disponible' &&
        u.activo !== false &&
        u.ubicacion.referenciaId === params.ubicacion.referenciaId,
    )
    .slice(0, params.cantidad);

  if (candidatas.length < params.cantidad) {
    throw new Error(
      `Stock insuficiente: ${candidatas.length} disponibles, ${params.cantidad} solicitadas`,
    );
  }

  // Mark origen units as consumido
  for (const u of candidatas) {
    const idx = state.collections.unidades.findIndex(x => x.id === u.id);
    if (idx !== -1) {
      state.collections.unidades[idx] = { ...state.collections.unidades[idx], estado: 'consumido' };
    }
  }

  // Create new destino units
  for (const newId of nuevasDestinoIds) {
    state.collections.unidades.push({
      id: newId,
      articuloId: destinoId,
      estado: 'disponible',
      ubicacion: params.ubicacion as { tipo: string; referenciaId: string; referenciaNombre: string },
      activo: true,
    });
  }

  // Write MovimientoStock
  state.collections.movimientosStock.push({
    id: movId,
    tipo: 'transferencia',
    subtipo: 'conversion',
  });
}

/** Runs conversion via real Firestore runTransaction (production path). */
async function _runConversionInProd(
  params: { articuloOrigenId: string; cantidad: number; ubicacion: UbicacionStock; solicitadoPorNombre: string },
  origen: MockArticulo,
  destino: MockArticulo,
  eq: { articuloIdDestino: string; articuloCodigoDestino: string; articuloDescripcionDestino: string; factor: number },
  cantidadDestino: number,
  movId: string,
  nuevasDestinoIds: string[],
  nowIso: string,
): Promise<void> {
  const fb = await getFirebaseModules();
  const { runTransaction: _runTx } = await import('firebase/firestore');

  // Pre-fetch candidatas (outside tx for query support)
  const candidatasSnap = await fb.getDocs(
    fb.query(
      fb.collection(fb.db, 'unidades'),
      fb.where('articuloId', '==', params.articuloOrigenId),
      fb.where('estado', '==', 'disponible'),
      fb.where('activo', '==', true),
      fb.where('ubicacion.referenciaId', '==', params.ubicacion.referenciaId),
    ),
  );
  type CandidataRow = { id: string; createdAt?: string; [k: string]: unknown };
  const candidatas: CandidataRow[] = candidatasSnap.docs
    .map((d: { id: string; data(): Record<string, unknown> }) => ({ id: d.id, ...d.data() }))
    .sort((a: CandidataRow, b: CandidataRow) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))
    .slice(0, params.cantidad);

  if (candidatas.length < params.cantidad) {
    throw new Error(
      `Stock insuficiente: ${candidatas.length} disponibles, ${params.cantidad} solicitadas`,
    );
  }

  await _runTx(fb.db, async (tx) => {
    // READ FIRST — validate state under lock
    const snaps = await Promise.all(
      candidatas.map((u: any) => tx.get(fb.doc(fb.db, 'unidades', u.id))),
    );
    for (const snap of snaps) {
      if (!snap.exists() || (snap.data() as any).estado !== 'disponible') {
        throw new Error('Unidad ya no disponible (race con otro proceso)');
      }
    }

    // WRITE — bajas
    for (const u of candidatas) {
      tx.update(fb.doc(fb.db, 'unidades', (u as any).id), fb.deepCleanForFirestore({
        estado: 'consumido',
        ...fb.getUpdateTrace(),
        updatedAt: nowIso,
      }));
    }

    // WRITE — altas destino
    for (const newId of nuevasDestinoIds) {
      tx.set(fb.doc(fb.db, 'unidades', newId), fb.deepCleanForFirestore({
        articuloId: destino.id,
        articuloCodigo: (destino as any).codigo,
        articuloDescripcion: (destino as any).descripcion ?? null,
        condicion: 'nuevo',
        estado: 'disponible',
        ubicacion: params.ubicacion,
        activo: true,
        ...fb.getUpdateTrace(),
        createdAt: nowIso,
        updatedAt: nowIso,
      }));
    }

    // WRITE — MovimientoStock (4 STKE-01 destino-side fields; NO codigo/descripcion on mov)
    tx.set(fb.doc(fb.db, 'movimientosStock', movId), fb.deepCleanForFirestore({
      id: movId,
      tipo: 'transferencia',
      subtipo: 'conversion',
      unidadId: candidatas[0] ? (candidatas[0] as any).id : null,
      articuloId: params.articuloOrigenId,
      articuloCodigo: (origen as any).codigo,
      articuloDescripcion: (origen as any).descripcion ?? null,
      cantidad: params.cantidad,
      articuloDestinoId: destino.id,
      cantidadDestino,
      factorConversion: eq.factor,
      origenTipo: params.ubicacion.tipo,
      origenId: params.ubicacion.referenciaId,
      origenNombre: params.ubicacion.referenciaNombre,
      destinoTipo: params.ubicacion.tipo,
      destinoId: params.ubicacion.referenciaId,
      destinoNombre: params.ubicacion.referenciaNombre,
      motivo: `Conversión ${(origen as any).codigo} × ${params.cantidad} → ${(destino as any).codigo} × ${cantidadDestino} (factor ${eq.factor})`,
      creadoPor: params.solicitadoPorNombre,
      createdAt: nowIso,
    }));
  });
}
