import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import type { PendingAction } from '@ags/shared';
import { db, deepCleanForFirestore, getUpdateTrace } from './firebase';
import { adminConfigService } from './adminConfigService';
import { usuariosService } from './personalService';

/**
 * Helpers for `ordenesCompraClienteService.cargarOC` (FLOW-02).
 *
 * Kept apart from the main service to keep the transactional method readable.
 * All logic here runs OUTSIDE the `runTransaction` (post-commit side-effects).
 *
 * 08-03 may introduce a canonical `_appendPendingAction` on `presupuestosService`.
 * When that lands, `appendPendingActionInline` can be replaced with a delegating
 * call — the behavior (append new action; no mutation of existing) is identical.
 */

/** Reads the presupuesto's `pendingActions[]`, appends a new action, writes back.
 *  NO `arrayUnion` — consistent with the tx-merge-manual pattern enforced in 08-02. */
export async function appendPendingActionInline(
  presupuestoId: string,
  type: PendingAction['type'],
  reason: string,
): Promise<void> {
  const presRef = doc(db, 'presupuestos', presupuestoId);
  const snap = await getDoc(presRef);
  if (!snap.exists()) return;
  const current = ((snap.data() as any).pendingActions as PendingAction[] | undefined) || [];
  const nuevo: PendingAction = {
    id: crypto.randomUUID(),
    type,
    reason,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  await updateDoc(presRef, deepCleanForFirestore({
    pendingActions: [...current, nuevo],
    updatedAt: Timestamp.now(),
    ...getUpdateTrace(),
  }));
}

/**
 * Post-commit side-effect: notifica al coordinador OT configurado en
 * `adminConfig/flujos.usuarioCoordinadorOTId`. Best-effort.
 *
 * Si falla (no configurado / usuario inexistente / inactivo) → appendea
 * pendingAction `'notificar_coordinador_ot'` a cada presupuesto afectado
 * con un reason concreto. Si tiene éxito, NO appendea nada.
 *
 * v2.0: verify + dashboard surface. v2.1: side-channel real (FCM / mail).
 */
export async function notifyCoordinadorOTBestEffort(
  presupuestosIds: string[],
): Promise<void> {
  try {
    const cfg = await adminConfigService.getWithDefaults();
    if (!cfg.usuarioCoordinadorOTId) {
      throw new Error('adminConfig/flujos.usuarioCoordinadorOTId no configurado');
    }
    const coordinador = await usuariosService.getById(cfg.usuarioCoordinadorOTId);
    if (!coordinador) {
      throw new Error(`usuario coordinador OT ${cfg.usuarioCoordinadorOTId} no encontrado`);
    }
    if (coordinador.status !== 'activo') {
      throw new Error(
        `usuario coordinador OT ${cfg.usuarioCoordinadorOTId} no está activo (status: ${coordinador.status})`,
      );
    }
    // TODO(v2.1): side-channel real (in-app posta dirigida / mail / FCM push).
    // En v2.0 el ticket en `oc_recibida` + dashboard ya funciona como señal.
  } catch (err: any) {
    const reason = err?.message || 'notificación coordinador OT falló';
    for (const pid of presupuestosIds) {
      try {
        await appendPendingActionInline(pid, 'notificar_coordinador_ot', reason);
      } catch (appendErr) {
        console.error('[notifyCoordinadorOTBestEffort] append failed:', appendErr);
      }
    }
  }
}
