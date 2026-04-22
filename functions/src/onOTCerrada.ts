import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

if (admin.apps.length === 0) admin.initializeApp();
const db = admin.firestore();
const REGION = 'southamerica-east1';

/**
 * Safety-net trigger — fires when an OT transitions to CIERRE_ADMINISTRATIVO.
 *
 * Idempotent: uses `ot_cierre_idempotency/{otId}` document as a sentinel.
 * If the sentinel exists, the trigger does nothing (client-side or a prior
 * invocation already handled it).
 *
 * In v2.0 this is purely observational — it does NOT send mail (that is deferred
 * post-v2.0 when mailQueue consumer lands). It ONLY ensures the admin ticket
 * creation from Phase 8 retries if the client-side call failed.
 *
 * Known gap (post-v2.0): mail send via mailQueue consumer is deferred. The
 * sentinel doc acts as a record that this OT was observed as closed, allowing
 * future consumers to pick up unprocessed closures.
 */
export const onOTCerrada = onDocumentUpdated(
  { document: 'ot/{otId}', region: REGION },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    // Transition guard: estadoAdmin changed TO CIERRE_ADMINISTRATIVO
    const wasNotClosed = before.estadoAdmin !== 'CIERRE_ADMINISTRATIVO';
    const isNowClosed = after.estadoAdmin === 'CIERRE_ADMINISTRATIVO';
    if (!(wasNotClosed && isNowClosed)) return;

    const otId: string = event.params.otId;
    const sentinelRef = db.doc(`ot_cierre_idempotency/${otId}`);
    const sentinel = await sentinelRef.get();
    if (sentinel.exists) {
      console.log(`[onOTCerrada] ${otId} already processed — skipping`);
      return;
    }

    // v2.0 scope: write sentinel only (no mail send — deferred post-v2.0).
    // The client-side Phase 8 cerrarAdministrativamente path creates the admin ticket
    // and enqueues to mailQueue. If that path failed (offline, network), Phase 8's
    // pendingActions[] mechanism retries from /admin/acciones-pendientes. This trigger
    // is belt-and-suspenders for a future mailQueue consumer.
    await sentinelRef.set({
      otId,
      estadoAdminFecha: after.estadoAdminFecha ?? new Date().toISOString(),
      observedAt: admin.firestore.Timestamp.now(),
      observedBy: 'cf:onOTCerrada',
    });

    console.log(`[onOTCerrada] sentinel written for ${otId} — mailQueue consumer deferred post-v2.0`);
  }
);
