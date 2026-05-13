/**
 * Cloud Function: aviso al técnico cuando el cliente firma una OT remotamente.
 *
 * Trigger: onDocumentUpdated('reportes/{otNumber}').
 * Dispara cuando `signedAt` pasa de null/undefined a un valor con
 * `signedFrom === 'mobile'` (firma remota vía QR, no firma presencial).
 *
 * Comportamiento (híbrido):
 *  - Si la OT ya tiene un ticket linkeado abierto (otIds array-contains otNumber,
 *    estado ∉ {finalizado, no_concretado}) → agrega una posta de comentario en
 *    el más reciente. La notificación push existente (onLeadWritten, rama 3)
 *    avisa al asignado.
 *  - Si no hay ticket abierto linkeado → crea un ticket nuevo con TKT-XXXXX,
 *    area=ing_soporte, prioridad=normal, asignado al ingeniero de la OT (o a
 *    Esteban como fallback hoy, mientras las OTs se crean desde reportes-ot
 *    sin ingenieroAsignadoId).
 *
 * Idempotencia: setea `clientSignatureNotified: true` en el doc del reporte al
 * finalizar. Si el trigger se reejecuta (re-firma, snapshot tardío), skip.
 */
import * as functions from 'firebase-functions/v2';
export declare const onClientSignature: functions.CloudFunction<functions.firestore.FirestoreEvent<functions.firestore.Change<functions.firestore.QueryDocumentSnapshot> | undefined, {
    otNumber: string;
}>>;
