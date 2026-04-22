import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { recomputeAndWrite } from './computeStockAmplioAdmin';

const REGION = 'southamerica-east1';

// Trigger 1: unidades
// Covers create + update + delete (onDocumentWritten fires for all three).
// Delete semantics: when a unidad is deleted, after=null, before has articuloId → recomputes correctly.
export const updateResumenStockOnUnidad = onDocumentWritten(
  { document: 'unidades/{unidadId}', region: REGION },
  async (event) => {
    const after = event.data?.after?.data();
    const before = event.data?.before?.data();
    const articuloId: string | undefined = (after ?? before)?.articuloId;
    if (articuloId) await recomputeAndWrite(articuloId);
  }
);

// Trigger 2: ordenes_compra — items array may have MULTIPLE articuloIds.
// IMPORTANT: the automated typecheck only confirms this trigger BUILDS.
// The "every articuloId recomputed" semantic is validated by the human
// checkpoint in Task 3 (multi-articuloId OC scenario, step 7).
export const updateResumenStockOnOC = onDocumentWritten(
  { document: 'ordenes_compra/{ocId}', region: REGION },
  async (event) => {
    const afterItems: Array<{ articuloId?: string }> = event.data?.after?.data()?.items ?? [];
    const beforeItems: Array<{ articuloId?: string }> = event.data?.before?.data()?.items ?? [];
    const allIds = new Set<string>();
    for (const it of [...afterItems, ...beforeItems]) {
      if (it?.articuloId) allIds.add(it.articuloId);
    }
    if (allIds.size === 0) return;
    // Recompute each unique articuloId in parallel — no FK between them
    await Promise.all([...allIds].map(id => recomputeAndWrite(id)));
  }
);

// Trigger 3: requerimientos_compra
// Covers condicional requerimientos transitioning to/from REQ_COMPROMETIDO_EXCL states.
export const updateResumenStockOnRequerimiento = onDocumentWritten(
  { document: 'requerimientos_compra/{reqId}', region: REGION },
  async (event) => {
    const after = event.data?.after?.data();
    const before = event.data?.before?.data();
    const articuloId: string | undefined = (after ?? before)?.articuloId;
    if (articuloId) await recomputeAndWrite(articuloId);
  }
);
