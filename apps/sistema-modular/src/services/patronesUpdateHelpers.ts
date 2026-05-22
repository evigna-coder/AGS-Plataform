/**
 * Phase 14 BOM-04 — patronesService.update guard + DI test path.
 *
 * Extracted from patronesService.ts to keep that file under the 250-LOC budget
 * (components.md spirit, also applied to service files). Mirrors the factory
 * pattern used in 14-02 (`buildConsumirComponentes`) so that `_testState` stays
 * owned by patronesService.ts and this helper receives it as a dependency —
 * avoiding circular import while keeping the source of truth single.
 *
 * Defense-in-depth guard:
 *  - The UI sub-component PatronComponentesEditor disables the codigoComponente
 *    input when consumos previos exist (user-friendly fence).
 *  - This helper THROWS on update when the incoming componentes[] would orphan
 *    any componentesConsumidos[].codigoComponente in any lote of the patron —
 *    catches any UI bypass (dev console call, future programmatic update, etc.).
 *
 * The guard only fires when patch.componentes !== undefined. Unrelated patches
 * (e.g. updating only descripcion) skip the guard entirely — no perf hit, no
 * false positives.
 */

import { doc, getDoc, Timestamp } from 'firebase/firestore';
import type { Patron } from '@ags/shared';
import type { MockPatronBomState } from '../__tests__/fixtures/patronBom';

export type PatronUpdatePatch = Partial<Omit<Patron, 'id' | 'createdAt'>>;

interface UpdateDeps {
  getTestState: () => MockPatronBomState | null;
  getFirebaseModules: () => Promise<{
    db: any;
    createBatch: any;
    docRef: any;
    batchAudit: any;
    deepCleanForFirestore: any;
    getUpdateTrace: any;
  }>;
}

/**
 * Throws if `incomingComponentes` would orphan any componentesConsumidos
 * in `patronActual`'s lotes. Pure — no side-effects.
 */
export function validateNoOrphanConsumos(
  patronActual: Patron | null,
  incomingComponentes: Patron['componentes'],
): void {
  if (!patronActual) return; // nothing to orphan if doc doesn't exist
  const incomingCodigos = new Set(
    (incomingComponentes ?? [])
      .map(c => c.codigoComponente.trim())
      .filter(Boolean),
  );
  const huerfanos = new Set<string>();
  for (const lote of patronActual.lotes ?? []) {
    for (const cc of lote.componentesConsumidos ?? []) {
      if (!incomingCodigos.has(cc.codigoComponente)) {
        huerfanos.add(cc.codigoComponente);
      }
    }
  }
  if (huerfanos.size > 0) {
    throw new Error(
      `No se puede actualizar el patrón: los siguientes componentes tienen consumos previos en lotes y quedarían huérfanos si se renombran o eliminan: ${[...huerfanos].join(', ')}`,
    );
  }
}

/**
 * Factory: returns the bound `update` function with DI'd test state + lazy firebase.
 * Mirrors `buildConsumirComponentes` from patronesConsumirHelpers.ts (Phase 14-02).
 */
export function buildUpdatePatron(deps: UpdateDeps): (id: string, patch: PatronUpdatePatch) => Promise<void> {
  return async function update(id, patch) {
    // STEP A — Defense-in-depth guard (BOM-04): only when patch.componentes provided
    if (patch.componentes !== undefined) {
      const current = await _readPatronForGuard(id, deps);
      validateNoOrphanConsumos(current, patch.componentes);
    }

    // STEP B — Write: test path mutates the Map; prod path uses batch.
    const testState = deps.getTestState();
    if (testState) {
      const existing = testState.patrones.get(id);
      if (!existing) throw new Error(`Patron ${id} no encontrado (test state)`);
      testState.patrones.set(id, {
        ...existing,
        ...patch,
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    const { createBatch, docRef, batchAudit, deepCleanForFirestore, getUpdateTrace } = await deps.getFirebaseModules();
    const payload = deepCleanForFirestore({
      ...patch,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.update(docRef('patrones', id), payload);
    batchAudit(batch, { action: 'update', collection: 'patrones', documentId: id, after: payload });
    await batch.commit();
  };
}

async function _readPatronForGuard(
  id: string,
  deps: UpdateDeps,
): Promise<Patron | null> {
  const testState = deps.getTestState();
  if (testState) {
    return (testState.patrones.get(id) as Patron) ?? null;
  }
  const { db } = await deps.getFirebaseModules();
  const snap = await getDoc(doc(db, 'patrones', id));
  return snap.exists() ? ({ id: snap.id, ...(snap.data() as any) } as Patron) : null;
}
