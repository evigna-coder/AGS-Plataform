/**
 * Cloud Function: notificaciones push para tickets (leads).
 *
 * Trigger: onDocumentWritten en colección `leads`.
 * Detecta el tipo de evento (creación, derivación, comentario, etc.)
 * y envía notificaciones push vía FCM a los usuarios correspondientes.
 */
import * as functions from 'firebase-functions/v2';
export declare const onLeadWritten: functions.CloudFunction<functions.firestore.FirestoreEvent<functions.firestore.Change<functions.firestore.DocumentSnapshot> | undefined, {
    leadId: string;
}>>;
