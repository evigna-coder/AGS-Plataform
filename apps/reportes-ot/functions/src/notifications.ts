/**
 * Cloud Function: notificaciones push para tickets (leads).
 *
 * Trigger: onDocumentWritten en colección `leads`.
 * Detecta el tipo de evento (creación, derivación, comentario, etc.)
 * y envía notificaciones push vía FCM a los usuarios correspondientes.
 */
import * as functions from 'firebase-functions/v2';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Posta {
  deUsuarioId: string;
  deUsuarioNombre: string;
  aUsuarioId: string | null;
  aUsuarioNombre: string | null;
  aArea: string | null;
  fecha: string;
  estadoAnterior: string | null;
  estadoNuevo: string;
  comentario: string | null;
  accionRequerida: string | null;
}

interface NotificationPreferences {
  pushEnabled: boolean;
  notifyOnAssigned: boolean;
  notifyOnDerived: boolean;
  notifyOnComment: boolean;
  notifyOnFinalized: boolean;
  notifyOnUrgent: boolean;
  scope: 'mine' | 'all';
}

type NotificationType =
  | 'lead_created'
  | 'lead_derived'
  | 'lead_comment'
  | 'lead_finalized'
  | 'lead_urgent';

interface NotificationEvent {
  type: NotificationType;
  title: string;
  body: string;
  recipientIds: string[];
  actorId: string | null;
  leadId: string;
}

// ─── Default preferences ─────────────────────────────────────────────────────

const DEFAULT_PREFS: NotificationPreferences = {
  pushEnabled: true,
  notifyOnAssigned: true,
  notifyOnDerived: true,
  notifyOnComment: true,
  notifyOnFinalized: true,
  notifyOnUrgent: true,
  scope: 'mine',
};

// ─── Event Detection ─────────────────────────────────────────────────────────

function detectEvent(
  beforeData: Record<string, any> | undefined,
  afterData: Record<string, any>,
  leadId: string,
): NotificationEvent | null {
  const razonSocial = afterData.razonSocial || 'Sin nombre';
  const contacto = afterData.contacto || '';
  const label = contacto ? `${razonSocial} — ${contacto}` : razonSocial;

  // 1. Ticket creado (no existía before)
  if (!beforeData) {
    const asignadoA = afterData.asignadoA;
    const createdBy = afterData.createdBy;
    if (!asignadoA) return null;
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
  const beforePostas: Posta[] = beforeData.postas || [];
  const afterPostas: Posta[] = afterData.postas || [];

  if (afterPostas.length > beforePostas.length) {
    const newPosta = afterPostas[afterPostas.length - 1];

    // 2. Ticket derivado (cambió el asignado)
    if (newPosta.aUsuarioId && newPosta.aUsuarioId !== beforeData.asignadoA) {
      const recipients = new Set<string>();
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
      const recipients = new Set<string>();
      if (afterData.asignadoA) recipients.add(afterData.asignadoA);
      if (afterData.createdBy) recipients.add(afterData.createdBy);
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
    const recipients = new Set<string>();
    if (afterData.createdBy) recipients.add(afterData.createdBy);
    if (afterData.asignadoA) recipients.add(afterData.asignadoA);
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
    const recipients = new Set<string>();
    if (afterData.asignadoA) recipients.add(afterData.asignadoA);
    if (afterData.createdBy) recipients.add(afterData.createdBy);
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

function shouldNotify(prefs: NotificationPreferences, type: NotificationType): boolean {
  if (!prefs.pushEnabled) return false;
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

async function sendPushNotifications(event: NotificationEvent): Promise<void> {
  const db = getFirestore();
  const messaging = getMessaging();

  // Filtrar: nunca notificar al actor de la acción
  const recipientIds = event.recipientIds.filter(id => id !== event.actorId);
  if (recipientIds.length === 0) return;

  // Obtener tokens y preferencias de cada destinatario
  const messages: Array<{
    token: string;
    notification: { title: string; body: string };
    data: Record<string, string>;
    webpush: { fcmOptions: { link: string } };
  }> = [];

  for (const userId of recipientIds) {
    // Leer preferencias del usuario
    const userDoc = await db.doc(`usuarios/${userId}`).get();
    if (!userDoc.exists) continue;

    const userData = userDoc.data()!;
    const prefs: NotificationPreferences = userData.notificationPreferences || DEFAULT_PREFS;

    if (!shouldNotify(prefs, event.type)) continue;

    // Obtener todos los tokens FCM del usuario
    const tokensSnap = await db.collection(`usuarios/${userId}/fcmTokens`).get();
    if (tokensSnap.empty) continue;

    const portalUrl = process.env.PORTAL_URL || 'https://portal.agsanalitica.com';

    for (const tokenDoc of tokensSnap.docs) {
      const tokenData = tokenDoc.data();
      messages.push({
        token: tokenData.token,
        notification: {
          title: event.title,
          body: event.body,
        },
        data: {
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

  if (messages.length === 0) return;

  // Enviar en batch
  const response = await messaging.sendEach(messages);

  // Limpiar tokens inválidos
  const tokensToRemove: Promise<FirebaseFirestore.WriteResult>[] = [];
  response.responses.forEach((resp, idx) => {
    if (resp.error) {
      const errorCode = resp.error.code;
      // Token expirado o inválido → eliminar
      if (
        errorCode === 'messaging/invalid-registration-token' ||
        errorCode === 'messaging/registration-token-not-valid-for-sender' ||
        errorCode === 'messaging/unregistered'
      ) {
        const failedToken = messages[idx].token;
        console.log(`Eliminando token inválido: ${failedToken.substring(0, 20)}...`);
        // Buscar y eliminar el token de la subcolección
        for (const userId of recipientIds) {
          tokensToRemove.push(
            db.collection(`usuarios/${userId}/fcmTokens`)
              .where('token', '==', failedToken)
              .get()
              .then(snap => {
                const batch = db.batch();
                snap.docs.forEach(d => batch.delete(d.ref));
                return batch.commit();
              })
              .then(() => ({} as FirebaseFirestore.WriteResult))
          );
        }
      } else {
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

export const onLeadWritten = functions.firestore.onDocumentWritten(
  'leads/{leadId}',
  async (firebaseEvent) => {
    const leadId = firebaseEvent.params.leadId;
    const beforeData = firebaseEvent.data?.before?.data() as Record<string, any> | undefined;
    const afterData = firebaseEvent.data?.after?.data() as Record<string, any> | undefined;

    // Documento eliminado — no notificar
    if (!afterData) return;

    try {
      const event = detectEvent(beforeData, afterData, leadId);
      if (!event) return;

      await sendPushNotifications(event);
    } catch (err) {
      console.error(`Error procesando notificación para lead ${leadId}:`, err);
    }
  }
);
