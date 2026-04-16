"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.onLeadWritten = void 0;
/**
 * Cloud Function: notificaciones push para tickets (leads).
 *
 * Trigger: onDocumentWritten en colección `leads`.
 * Detecta el tipo de evento (creación, derivación, comentario, etc.)
 * y envía notificaciones push vía FCM a los usuarios correspondientes.
 */
const functions = __importStar(require("firebase-functions/v2"));
const firestore_1 = require("firebase-admin/firestore");
const messaging_1 = require("firebase-admin/messaging");
// ─── Default preferences ─────────────────────────────────────────────────────
const DEFAULT_PREFS = {
    pushEnabled: true,
    notifyOnAssigned: true,
    notifyOnDerived: true,
    notifyOnComment: true,
    notifyOnFinalized: true,
    notifyOnUrgent: true,
    scope: 'mine',
};
// ─── Event Detection ─────────────────────────────────────────────────────────
function detectEvent(beforeData, afterData, leadId) {
    const razonSocial = afterData.razonSocial || 'Sin nombre';
    const contacto = afterData.contacto || '';
    const label = contacto ? `${razonSocial} — ${contacto}` : razonSocial;
    // 1. Ticket creado (no existía before)
    if (!beforeData) {
        const asignadoA = afterData.asignadoA;
        const createdBy = afterData.createdBy;
        if (!asignadoA)
            return null;
        return {
            type: 'lead_created',
            title: 'Nuevo ticket asignado',
            body: label,
            recipientIds: [asignadoA],
            actorId: createdBy || null,
            leadId,
        };
    }
    // Comparar postas para detectar eventos de derivación/comentario
    const beforePostas = beforeData.postas || [];
    const afterPostas = afterData.postas || [];
    if (afterPostas.length > beforePostas.length) {
        const newPosta = afterPostas[afterPostas.length - 1];
        // 2. Ticket derivado (cambió el asignado)
        if (newPosta.aUsuarioId && newPosta.aUsuarioId !== beforeData.asignadoA) {
            const recipients = new Set();
            recipients.add(newPosta.aUsuarioId);
            // Notificar al creador original también
            if (afterData.createdBy && afterData.createdBy !== newPosta.deUsuarioId) {
                recipients.add(afterData.createdBy);
            }
            return {
                type: 'lead_derived',
                title: 'Ticket derivado',
                body: `${label} — de ${newPosta.deUsuarioNombre || 'alguien'}`,
                recipientIds: Array.from(recipients),
                actorId: newPosta.deUsuarioId,
                leadId,
            };
        }
        // 3. Comentario agregado (posta sin cambio de estado)
        if (newPosta.comentario && newPosta.estadoAnterior === newPosta.estadoNuevo) {
            const recipients = new Set();
            if (afterData.asignadoA)
                recipients.add(afterData.asignadoA);
            if (afterData.createdBy)
                recipients.add(afterData.createdBy);
            return {
                type: 'lead_comment',
                title: 'Nuevo comentario en ticket',
                body: `${label} — "${newPosta.comentario.substring(0, 80)}"`,
                recipientIds: Array.from(recipients),
                actorId: newPosta.deUsuarioId,
                leadId,
            };
        }
    }
    // 4. Ticket finalizado
    const finalStates = ['finalizado', 'no_concretado'];
    if (!finalStates.includes(beforeData.estado) && finalStates.includes(afterData.estado)) {
        const recipients = new Set();
        if (afterData.createdBy)
            recipients.add(afterData.createdBy);
        if (afterData.asignadoA)
            recipients.add(afterData.asignadoA);
        // El actor es quien hizo la última posta (que finalizó)
        const lastPosta = afterPostas.length > 0 ? afterPostas[afterPostas.length - 1] : null;
        const actorId = lastPosta?.deUsuarioId || afterData.updatedBy || null;
        return {
            type: 'lead_finalized',
            title: 'Ticket finalizado',
            body: label,
            recipientIds: Array.from(recipients),
            actorId,
            leadId,
        };
    }
    // 5. Prioridad cambiada a urgente
    if (beforeData.prioridad !== 'urgente' && afterData.prioridad === 'urgente') {
        const recipients = new Set();
        if (afterData.asignadoA)
            recipients.add(afterData.asignadoA);
        if (afterData.createdBy)
            recipients.add(afterData.createdBy);
        return {
            type: 'lead_urgent',
            title: 'Ticket marcado URGENTE',
            body: label,
            recipientIds: Array.from(recipients),
            actorId: afterData.updatedBy || null,
            leadId,
        };
    }
    return null;
}
// ─── Preference check ────────────────────────────────────────────────────────
function shouldNotify(prefs, type) {
    if (!prefs.pushEnabled)
        return false;
    switch (type) {
        case 'lead_created': return prefs.notifyOnAssigned;
        case 'lead_derived': return prefs.notifyOnDerived;
        case 'lead_comment': return prefs.notifyOnComment;
        case 'lead_finalized': return prefs.notifyOnFinalized;
        case 'lead_urgent': return prefs.notifyOnUrgent;
        default: return true;
    }
}
// ─── Send notifications ──────────────────────────────────────────────────────
async function sendPushNotifications(event) {
    const db = (0, firestore_1.getFirestore)();
    const messaging = (0, messaging_1.getMessaging)();
    // Filtrar: nunca notificar al actor de la acción
    const recipientIds = event.recipientIds.filter(id => id !== event.actorId);
    if (recipientIds.length === 0)
        return;
    // Obtener tokens y preferencias de cada destinatario
    // Data-only payload: evita doble display en iOS/Android (auto-display del SW + onBackgroundMessage).
    // El SW construye la notificación desde data.title/data.body en firebase-messaging-sw.js.
    const messages = [];
    for (const userId of recipientIds) {
        // Leer preferencias del usuario
        const userDoc = await db.doc(`usuarios/${userId}`).get();
        if (!userDoc.exists)
            continue;
        const userData = userDoc.data();
        const prefs = userData.notificationPreferences || DEFAULT_PREFS;
        if (!shouldNotify(prefs, event.type))
            continue;
        // Obtener todos los tokens FCM del usuario
        const tokensSnap = await db.collection(`usuarios/${userId}/fcmTokens`).get();
        if (tokensSnap.empty)
            continue;
        const portalUrl = process.env.PORTAL_URL || 'https://portal.agsanalitica.com';
        for (const tokenDoc of tokensSnap.docs) {
            const tokenData = tokenDoc.data();
            messages.push({
                token: tokenData.token,
                data: {
                    title: event.title,
                    body: event.body,
                    leadId: event.leadId,
                    type: event.type,
                    url: `/leads/${event.leadId}`,
                },
                webpush: {
                    fcmOptions: {
                        link: `${portalUrl}/leads/${event.leadId}`,
                    },
                },
            });
        }
    }
    if (messages.length === 0)
        return;
    // Enviar en batch
    const response = await messaging.sendEach(messages);
    // Limpiar tokens inválidos
    const tokensToRemove = [];
    response.responses.forEach((resp, idx) => {
        if (resp.error) {
            const errorCode = resp.error.code;
            // Token expirado o inválido → eliminar
            if (errorCode === 'messaging/invalid-registration-token' ||
                errorCode === 'messaging/registration-token-not-valid-for-sender' ||
                errorCode === 'messaging/unregistered') {
                const failedToken = messages[idx].token;
                console.log(`Eliminando token inválido: ${failedToken.substring(0, 20)}...`);
                // Buscar y eliminar el token de la subcolección
                for (const userId of recipientIds) {
                    tokensToRemove.push(db.collection(`usuarios/${userId}/fcmTokens`)
                        .where('token', '==', failedToken)
                        .get()
                        .then(snap => {
                        const batch = db.batch();
                        snap.docs.forEach(d => batch.delete(d.ref));
                        return batch.commit();
                    })
                        .then(() => ({})));
                }
            }
            else {
                console.error(`Error enviando push a token ${idx}:`, resp.error);
            }
        }
    });
    if (tokensToRemove.length > 0) {
        await Promise.allSettled(tokensToRemove);
    }
    const successCount = response.responses.filter(r => r.success).length;
    console.log(`Notificaciones enviadas: ${successCount}/${messages.length} para lead ${event.leadId} (${event.type})`);
}
// ─── Firestore Trigger ───────────────────────────────────────────────────────
exports.onLeadWritten = functions.firestore.onDocumentWritten('leads/{leadId}', async (firebaseEvent) => {
    const leadId = firebaseEvent.params.leadId;
    const beforeData = firebaseEvent.data?.before?.data();
    const afterData = firebaseEvent.data?.after?.data();
    // Documento eliminado — no notificar
    if (!afterData)
        return;
    try {
        const event = detectEvent(beforeData, afterData, leadId);
        if (!event)
            return;
        await sendPushNotifications(event);
    }
    catch (err) {
        console.error(`Error procesando notificación para lead ${leadId}:`, err);
    }
});
