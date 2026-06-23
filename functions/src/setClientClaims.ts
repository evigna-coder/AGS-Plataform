import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

if (admin.apps.length === 0) admin.initializeApp();
const auth = admin.auth();
const db = admin.firestore();
const REGION = 'southamerica-east1';

/**
 * Asigna identidad de CLIENTE a un usuario, vía custom claims, para el portal de
 * cliente del QR (Fase B del plan .claude/plans/seguridad-qr-cliente.md).
 *
 * Setea en el token: { role: 'client', clienteId, establecimientoIds }. Las reglas
 * de Firestore (Fase C) usan estos claims para aislar lo que ve cada cliente
 * (`resource.data.clienteId == request.auth.token.clienteId`).
 *
 * Solo puede invocarla STAFF de AGS: usuario autenticado con email verificado
 * del dominio @agsanalitica.com. No hay autorregistro de clientes: AGS invita.
 *
 * IMPORTANTE: el claim recién impacta cuando el usuario destino refresca su token
 * (re-login o getIdToken(true)). La UI de invitación debe avisarle que entre de nuevo.
 */
const STAFF_DOMAIN = '@agsanalitica.com';

interface Payload {
  uid?: string;
  clienteId?: string;
  establecimientoIds?: string[];
}

export const setClientClaims = onCall(
  { region: REGION, enforceAppCheck: false },
  async (request): Promise<{ ok: true }> => {
    const caller = request.auth;
    const callerEmail = (caller?.token?.email ?? '').toString().toLowerCase();
    const callerVerified = caller?.token?.email_verified === true;
    if (!caller || !callerVerified || !callerEmail.endsWith(STAFF_DOMAIN)) {
      throw new HttpsError('permission-denied', 'Solo staff de AGS puede asignar clientes.');
    }

    const data = (request.data ?? {}) as Payload;
    const uid = (data.uid ?? '').toString().trim();
    const clienteId = (data.clienteId ?? '').toString().trim();
    const establecimientoIds = Array.isArray(data.establecimientoIds)
      ? data.establecimientoIds.filter((x) => typeof x === 'string' && x).slice(0, 100)
      : [];

    if (!uid || !clienteId) {
      throw new HttpsError('invalid-argument', 'Faltan uid o clienteId.');
    }

    // Verificar que el cliente exista (evita asignar a un clienteId basura).
    const clienteSnap = await db.doc(`clientes/${clienteId}`).get();
    if (!clienteSnap.exists) {
      throw new HttpsError('not-found', 'El cliente no existe.');
    }

    // Preservar claims previos (ej. mfa) y sobreescribir solo los de cliente.
    const user = await auth.getUser(uid);
    const prev = user.customClaims ?? {};
    await auth.setCustomUserClaims(uid, {
      ...prev,
      role: 'client',
      clienteId,
      establecimientoIds,
    });

    // Marca de auditoría liviana en el doc del usuario.
    await db.doc(`usuarios/${uid}`).set(
      {
        clientAccess: {
          clienteId,
          establecimientoIds,
          grantedBy: callerEmail,
          grantedAt: admin.firestore.Timestamp.now(),
        },
      },
      { merge: true },
    );

    console.log(`[setClientClaims] ${uid} → cliente ${clienteId} por ${callerEmail}`);
    return { ok: true };
  },
);
