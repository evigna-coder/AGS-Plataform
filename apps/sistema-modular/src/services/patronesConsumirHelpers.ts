/**
 * Phase 14 BOM-03 — consumirComponentes: descuento atómico de componentes BOM.
 *
 * Extracted from patronesService.ts to keep that file under the de-facto service
 * budget (~400 LOC; see plan 14-02 verification note). The single public entry
 * `consumirComponentes` is re-exported from patronesService.ts so callers keep
 * importing it from a stable location.
 *
 * Mirrors Phase 13 equivalenciasService.desagregarUnidades 1:1:
 *   - Public method dispatches to _consumirComponentesInProd / _consumirComponentesInTest
 *   - Production path uses runTransaction (READ FIRST → recompute → WRITE)
 *   - Test path mutates MockPatronBomState in-memory via the patronesService DI hook
 *   - Pre-tx idempotency check (RESEARCH pitfall 2) → throws BEFORE entering tx
 *     if any MovimientoStock already exists for (otNumber, entidadTipo='patron'),
 *     preventing double-discount when admin reopens cierre.
 *   - Granularidad fina: 1 MovimientoStock por componente consumido.
 *   - Atomic: si cualquier saldo<0 throws y rollback completo (sin state change).
 *
 * The test state lives in patronesService.ts (single `_testState` module-level
 * variable + `__setTestFirestore` setter). This helper imports the getter to read
 * it without circular issues — see `_getTestState` below.
 */

import { collection, getDocs, doc, query, where, Timestamp } from 'firebase/firestore';
import type { Patron, PatronLote } from '@ags/shared';
import { computeSaldoComponente } from '@ags/shared/utils/patronBom';
import type { MockPatronBomState } from '../__tests__/fixtures/patronBom';

// ── Public surface ───────────────────────────────────────────────────────────

export interface ConsumirComponentesParams {
  otNumber: string;
  consumos: Array<{
    patronId: string;
    lote: string;              // código natural del lote (NOT loteId — RESEARCH pitfall 3)
    componentes: Array<{ codigoComponente: string; cantidad: number; motivo?: string }>;
  }>;
  creadoPor: string;
}

export interface ConsumirComponentesResult {
  movimientoIds: string[];
  /**
   * Phase 14 BOM-08 — Ids de RequerimientoCompra (origen='patron_minimo') creados
   * por autoCrearRequerimientosPatron en el post-commit best-effort. `[]` si no
   * hubo componentes bajo mínimo, si el responsable no estaba configurado, o si
   * el helper falló (en cuyo caso se loggea error pero el consumo NO se rollbackea).
   */
  requerimientosCreados: string[];
}

/**
 * Factory: returns the `consumirComponentes` function bound to a getter for the
 * test-state and the lazy firebase modules loader. This indirection avoids a
 * circular import: patronesService.ts owns the `_testState` variable and the
 * `getFirebaseModules()` lazy loader; we receive both as dependencies.
 */
export function buildConsumirComponentes(deps: {
  getTestState: () => MockPatronBomState | null;
  getFirebaseModules: () => Promise<{
    db: any;
    deepCleanForFirestore: any;
    getUpdateTrace: any;
  }>;
}): (params: ConsumirComponentesParams) => Promise<ConsumirComponentesResult> {
  return async function consumirComponentes(params) {
    const state = deps.getTestState();
    if (state) return _consumirComponentesInTest(params, state);
    return _consumirComponentesInProd(params, deps.getFirebaseModules);
  };
}

// ── Internal pure helpers (shared between prod and test paths) ───────────────

/**
 * Recomputes lotes[] with new componentesConsumidos for a single patron.
 * Pure: returns a new array, does not mutate input.
 */
function recomputeLotesConConsumos(
  patron: Patron,
  consumosDelPatron: ConsumirComponentesParams['consumos'],
): PatronLote[] {
  return (patron.lotes ?? []).map(lote => {
    const consumosDeEsteLote = consumosDelPatron.filter(c => c.lote === lote.lote);
    if (consumosDeEsteLote.length === 0) return lote;
    const consumidoMap = new Map<string, number>();
    for (const cc of lote.componentesConsumidos ?? []) {
      consumidoMap.set(cc.codigoComponente, cc.cantidadConsumida);
    }
    for (const c of consumosDeEsteLote) {
      for (const comp of c.componentes) {
        consumidoMap.set(
          comp.codigoComponente,
          (consumidoMap.get(comp.codigoComponente) ?? 0) + comp.cantidad,
        );
      }
    }
    return {
      ...lote,
      componentesConsumidos: Array.from(consumidoMap.entries()).map(
        ([codigoComponente, cantidadConsumida]) => ({ codigoComponente, cantidadConsumida }),
      ),
    };
  });
}

/**
 * Validates that no componente in any lote has saldo < 0 after the proposed update.
 * Throws on first violation (atomic — caller must not have mutated state yet).
 */
function validarSaldosNoNegativos(patron: Patron, nuevosLotes: PatronLote[]): void {
  const patronProyectado: Patron = { ...patron, lotes: nuevosLotes };
  for (const lote of nuevosLotes) {
    for (const comp of patron.componentes ?? []) {
      const saldo = computeSaldoComponente(patronProyectado, lote, comp.codigoComponente);
      if (saldo < 0) {
        throw new Error(
          `Saldo negativo prohibido: patrón ${patron.codigoArticulo ?? patron.id} ` +
            `lote ${lote.lote} componente ${comp.codigoComponente} = ${saldo} ` +
            `(stock insuficiente)`,
        );
      }
    }
  }
}

// ── Test path (in-memory MockPatronBomState) ─────────────────────────────────

async function _consumirComponentesInTest(
  params: ConsumirComponentesParams,
  state: MockPatronBomState,
): Promise<ConsumirComponentesResult> {
  // STEP A — Idempotency check (RESEARCH pitfall 2 — re-cierre admin)
  const movsExistentes = [...state.movimientos.values()].filter(
    (m: any) => m.otNumber === params.otNumber && m.entidadTipo === 'patron',
  );
  if (movsExistentes.length > 0) {
    throw new Error(
      `Patrones ya descontados para OT ${params.otNumber} (${movsExistentes.length} movimientos previos)`,
    );
  }

  // STEP B — Compute & validate ALL patrones first (atomic: no partial mutation)
  const patronesUnicos = [...new Set(params.consumos.map(c => c.patronId))];
  const updates: Array<{ patronId: string; nuevosLotes: PatronLote[]; patron: Patron }> = [];
  for (const patronId of patronesUnicos) {
    const patron = state.patrones.get(patronId) as Patron | undefined;
    if (!patron) throw new Error(`Patrón ${patronId} no encontrado en mock state`);
    if (!patron.componentes || patron.componentes.length === 0) {
      throw new Error(`Patrón ${patronId} sin BOM declarado — no aplica desagregación de componentes`);
    }
    const consumosDelPatron = params.consumos.filter(c => c.patronId === patronId);
    const nuevosLotes = recomputeLotesConConsumos(patron, consumosDelPatron);
    validarSaldosNoNegativos(patron, nuevosLotes);
    updates.push({ patronId, nuevosLotes, patron });
  }

  // STEP C — Mutate state (all validations passed; safe to commit)
  for (const u of updates) {
    state.patrones.set(u.patronId, { ...u.patron, lotes: u.nuevosLotes });
  }

  const movIds: string[] = [];
  for (const c of params.consumos) {
    for (const comp of c.componentes) {
      const id = crypto.randomUUID();
      movIds.push(id);
      state.movimientos.set(id, {
        id,
        tipo: 'consumo',
        entidadTipo: 'patron',
        patronId: c.patronId,
        lote: c.lote,
        codigoComponente: comp.codigoComponente,
        cantidad: comp.cantidad,
        otNumber: params.otNumber,
        motivo: comp.motivo ?? null,
        creadoPor: params.creadoPor,
      });
    }
  }

  // STEP D — POST-commit: auto-Requerimiento (BOM-08). Best-effort, no throw bloquea.
  let requerimientosCreados: string[] = [];
  try {
    const { autoCrearRequerimientosPatron } = await import('./patronesAutoRequerimiento');
    requerimientosCreados = await autoCrearRequerimientosPatron(
      [...new Set(params.consumos.map(c => c.patronId))],
      { __testState: state },
    );
  } catch (err) {
    console.error('[consumirComponentes/test] autoCrearRequerimientosPatron falló (best-effort):', err);
  }

  return { movimientoIds: movIds, requerimientosCreados };
}

// ── Production path (real Firestore runTransaction) ──────────────────────────

async function _consumirComponentesInProd(
  params: ConsumirComponentesParams,
  getFirebaseModules: () => Promise<{
    db: any;
    deepCleanForFirestore: any;
    getUpdateTrace: any;
  }>,
): Promise<ConsumirComponentesResult> {
  const { db, deepCleanForFirestore, getUpdateTrace } = await getFirebaseModules();
  const { runTransaction } = await import('firebase/firestore');

  // STEP A — Idempotency check (pre-tx; RESEARCH pitfall 2 — re-cierre admin)
  const movsExistentesQ = query(
    collection(db, 'movimientosStock'),
    where('otNumber', '==', params.otNumber),
    where('entidadTipo', '==', 'patron'),
  );
  const movsExistentesSnap = await getDocs(movsExistentesQ);
  if (!movsExistentesSnap.empty) {
    throw new Error(
      `Patrones ya descontados para OT ${params.otNumber} (${movsExistentesSnap.size} movimientos previos)`,
    );
  }

  // STEP B — Pre-generate Mov IDs (N por componente consumido — granularidad fina)
  const totalMovs = params.consumos.reduce((acc, c) => acc + c.componentes.length, 0);
  const movIds = Array.from({ length: totalMovs }, () => crypto.randomUUID());

  const patronesUnicos = [...new Set(params.consumos.map(c => c.patronId))];

  // STEP C — runTransaction (READ FIRST then WRITES; mirrors equivalenciasService)
  await runTransaction(db, async (tx) => {
    // READ — load all patrones under tx lock
    const patronesActuales = new Map<string, Patron>();
    for (const patronId of patronesUnicos) {
      const snap = await tx.get(doc(db, 'patrones', patronId));
      if (!snap.exists()) {
        throw new Error(`Patrón ${patronId} no encontrado (race?)`);
      }
      patronesActuales.set(patronId, { id: snap.id, ...(snap.data() as any) } as Patron);
    }

    // VALIDATE + COMPUTE — all patrones first (atomic: no partial writes)
    const updates: Array<{ patronId: string; nuevosLotes: PatronLote[] }> = [];
    for (const patronId of patronesUnicos) {
      const patron = patronesActuales.get(patronId)!;
      if (!patron.componentes || patron.componentes.length === 0) {
        throw new Error(
          `Patrón ${patronId} sin BOM declarado — no aplica desagregación de componentes`,
        );
      }
      const consumosDelPatron = params.consumos.filter(c => c.patronId === patronId);
      const nuevosLotes = recomputeLotesConConsumos(patron, consumosDelPatron);
      validarSaldosNoNegativos(patron, nuevosLotes);
      updates.push({ patronId, nuevosLotes });
    }

    // WRITE — patrones
    for (const u of updates) {
      tx.update(
        doc(db, 'patrones', u.patronId),
        deepCleanForFirestore({
          lotes: u.nuevosLotes,
          ...getUpdateTrace(),
          updatedAt: Timestamp.now(),
        }),
      );
    }

    // WRITE — N MovimientoStock (1 per componente consumido)
    const nowTs = Timestamp.now();
    let movIdx = 0;
    for (const c of params.consumos) {
      for (const comp of c.componentes) {
        const movRef = doc(db, 'movimientosStock', movIds[movIdx++]);
        tx.set(
          movRef,
          deepCleanForFirestore({
            tipo: 'consumo',
            entidadTipo: 'patron',
            patronId: c.patronId,
            lote: c.lote,                       // string natural (NOT loteId — pitfall 3)
            codigoComponente: comp.codigoComponente,
            cantidad: comp.cantidad,
            articuloId: null,
            articuloCodigo: null,
            articuloDescripcion: null,
            origenTipo: 'patron',
            origenId: c.patronId,
            origenNombre: `Patrón ${c.patronId} · lote ${c.lote}`,
            destinoTipo: 'consumo_ot',
            destinoId: params.otNumber,
            destinoNombre: `OT ${params.otNumber}`,
            otNumber: params.otNumber,
            motivo: comp.motivo ?? null,
            creadoPor: params.creadoPor,
            createdAt: nowTs,
            ...getUpdateTrace(),
          }),
        );
      }
    }
  });

  // STEP D — POST-commit: auto-Requerimiento (BOM-08). Best-effort, no throw bloquea.
  // El consumo ya está commiteado; si esto falla, el admin puede crear el REQ manual.
  let requerimientosCreados: string[] = [];
  try {
    const { autoCrearRequerimientosPatron } = await import('./patronesAutoRequerimiento');
    requerimientosCreados = await autoCrearRequerimientosPatron(patronesUnicos);
  } catch (err) {
    console.error(
      '[consumirComponentes/prod] autoCrearRequerimientosPatron falló (best-effort):',
      err,
    );
  }

  return { movimientoIds: movIds, requerimientosCreados };
}
