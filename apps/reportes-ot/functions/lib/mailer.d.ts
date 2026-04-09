import * as functions from 'firebase-functions/v2';
/**
 * Firestore trigger: cuando se crea un documento en mailQueue,
 * se procesa y se envía el mail correspondiente.
 */
export declare const processMailQueue: functions.CloudFunction<functions.firestore.FirestoreEvent<functions.firestore.QueryDocumentSnapshot | undefined, {
    mailId: string;
}>>;
