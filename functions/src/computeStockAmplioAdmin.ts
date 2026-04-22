import * as admin from 'firebase-admin';

if (admin.apps.length === 0) admin.initializeApp();
const db = admin.firestore();

/* =========================================================================
 * SYNC CONTRACT — Source of truth: `packages/shared/src/types/index.ts`
 *   (EstadoOC union type)
 * Mirror: `apps/sistema-modular/src/services/stockAmplioService.ts`
 *   (OC_OPEN_STATES + REQ_COMPROMETIDO_EXCL)
 *
 * These constants MUST MATCH both the shared EstadoOC union and the client-side
 * stockAmplioService exports. `functions/` is a separate workspace and cannot
 * cross-import from `apps/`, so duplication is the only path. If you add/remove
 * a state in EstadoOC or the client-side Set, update ALL THREE locations.
 *
 * EstadoOC full union: 'borrador' | 'pendiente_aprobacion' | 'aprobada' |
 *   'enviada_proveedor' | 'confirmada' | 'en_transito' | 'recibida_parcial' |
 *   'recibida' | 'cancelada'
 *
 * OC_OPEN_STATES (7 states — items pending arrival, counted in enTransito):
 *   borrador, pendiente_aprobacion, aprobada, enviada_proveedor,
 *   confirmada, en_transito, recibida_parcial
 * Excluded (2): recibida (already landed as unidades), cancelada (dead)
 *
 * REQ_COMPROMETIDO_EXCL (3 states — NOT counted in comprometido):
 *   cancelado, comprado, en_compra (already handled by another path)
 * ========================================================================= */
const OC_OPEN_STATES = [
  'borrador', 'pendiente_aprobacion', 'aprobada',
  'enviada_proveedor', 'confirmada', 'en_transito', 'recibida_parcial',
];
const REQ_COMPROMETIDO_EXCL = new Set(['cancelado', 'comprado', 'en_compra']);

interface StockAmplio {
  disponible: number;
  enTransito: number;
  reservado: number;
  comprometido: number;
  breakdown: {
    // reservas OMITTED — deferred in v2.0 per 09-CONTEXT.md. Consumers treat as optional.
    requerimientosCondicionales: Array<{ id: string; cantidad: number; referencia?: string | null }>;
    ocsAbiertas: Array<{ id: string; cantidad: number; referencia?: string | null }>;
  };
  updatedAt: string;
}

export async function computeStockAmplioAdmin(articuloId: string): Promise<StockAmplio> {
  // 1. Unidades
  const unidadesSnap = await db.collection('unidades')
    .where('articuloId', '==', articuloId)
    .where('activo', '==', true)
    .get();

  let disponible = 0, reservado = 0, unidadesEnTransito = 0;
  unidadesSnap.forEach(d => {
    const e = d.data().estado;
    if (e === 'disponible') disponible++;
    else if (e === 'reservado') reservado++;
    else if (e === 'en_transito') unidadesEnTransito++;
  });

  // 2. OCs abiertas — iterate all open states, walk items
  // Firestore `in` operator max 10 values — 7 states fit comfortably
  let ocEnTransito = 0;
  const ocsBreakdown: Array<{ id: string; cantidad: number; referencia?: string | null }> = [];
  const ocSnap = await db.collection('ordenes_compra')
    .where('estado', 'in', OC_OPEN_STATES).get();
  ocSnap.forEach(d => {
    const items: Array<{ articuloId?: string; cantidad?: number; cantidadRecibida?: number }> = d.data().items ?? [];
    for (const item of items) {
      if (item.articuloId !== articuloId) continue;
      const pendiente = Math.max((item.cantidad ?? 0) - (item.cantidadRecibida ?? 0), 0);
      if (pendiente > 0) {
        ocEnTransito += pendiente;
        ocsBreakdown.push({ id: d.id, cantidad: pendiente, referencia: d.data().numero ?? null });
      }
    }
  });

  // 3. Requerimientos condicionales
  const reqSnap = await db.collection('requerimientos_compra')
    .where('articuloId', '==', articuloId)
    .where('condicional', '==', true)
    .get();
  let comprometido = 0;
  const reqsBreakdown: Array<{ id: string; cantidad: number; referencia?: string | null }> = [];
  reqSnap.forEach(d => {
    const data = d.data();
    if (REQ_COMPROMETIDO_EXCL.has(data.estado)) return;
    const cant: number = data.cantidad ?? 1;
    comprometido += cant;
    reqsBreakdown.push({ id: d.id, cantidad: cant, referencia: data.presupuestoId ?? null });
  });

  return {
    disponible,
    enTransito: unidadesEnTransito + ocEnTransito,
    reservado,
    comprometido,
    breakdown: {
      // reservas intentionally omitted — consumer uses `breakdown.reservas ?? []`
      requerimientosCondicionales: reqsBreakdown,
      ocsAbiertas: ocsBreakdown,
    },
    updatedAt: new Date().toISOString(),
  };
}

export async function recomputeAndWrite(articuloId: string): Promise<void> {
  if (!articuloId) return;
  const articuloRef = db.doc(`articulos/${articuloId}`);
  const articuloSnap = await articuloRef.get();
  if (!articuloSnap.exists) {
    console.warn(`[recomputeAndWrite] articulo ${articuloId} not found — skipping`);
    return;
  }
  const resumenStock = await computeStockAmplioAdmin(articuloId);
  await articuloRef.update({ resumenStock });
  console.log(`[recomputeAndWrite] recomputed for ${articuloId}: disponible=${resumenStock.disponible} enTransito=${resumenStock.enTransito}`);
}
