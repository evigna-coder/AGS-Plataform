import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

if (admin.apps.length === 0) admin.initializeApp();
const auth = admin.auth();
const db = admin.firestore();
const REGION = 'southamerica-east1';

/**
 * Asigna identidad de PROVEEDOR a un usuario, vía custom claims, para el portal de
 * proveedores. Espejo de setClientClaims (Fase B del portal cliente).
 *
 * Setea en el token: { role: 'provider', proveedorId }. Las reglas de Firestore usan
 * estos claims para aislar lo que ve cada proveedor (sus OCs por `proveedorId` y su
 * propio doc de proveedor). Todas las ESCRITURAS del proveedor (cotización, informar
 * entrega) van por Cloud Functions con admin SDK que re-derivan el proveedorId del
 * token — las reglas quedan read-only para el proveedor.
 *
 * Solo puede invocarla STAFF de AGS (email verificado del dominio @agsanalitica.com).
 * No hay autorregistro de proveedores: AGS invita.
 *
 * IMPORTANTE: el claim recién impacta cuando el usuario destino refresca su token
 * (re-login o getIdToken(true)). La UI de invitación debe avisarle que entre de nuevo.
 */
const STAFF_DOMAIN = '@agsanalitica.com';

interface Payload {
  uid?: string;
  proveedorId?: string;
}

export const setProviderClaims = onCall(
  { region: REGION, enforceAppCheck: false },
  async (request): Promise<{ ok: true }> => {
    const caller = request.auth;
    const callerEmail = (caller?.token?.email ?? '').toString().toLowerCase();
    const callerVerified = caller?.token?.email_verified === true;
    if (!caller || !callerVerified || !callerEmail.endsWith(STAFF_DOMAIN)) {
      throw new HttpsError('permission-denied', 'Solo staff de AGS puede asignar proveedores.');
    }

    const data = (request.data ?? {}) as Payload;
    const uid = (data.uid ?? '').toString().trim();
    const proveedorId = (data.proveedorId ?? '').toString().trim();

    if (!uid || !proveedorId) {
      throw new HttpsError('invalid-argument', 'Faltan uid o proveedorId.');
    }

    // Verificar que el proveedor exista (evita asignar a un proveedorId basura).
    const proveedorSnap = await db.doc(`proveedores/${proveedorId}`).get();
    if (!proveedorSnap.exists) {
      throw new HttpsError('not-found', 'El proveedor no existe.');
    }

    // Preservar claims previos (ej. mfa) y sobreescribir solo los de proveedor.
    const user = await auth.getUser(uid);
    const prev = user.customClaims ?? {};
    await auth.setCustomUserClaims(uid, {
      ...prev,
      role: 'provider',
      proveedorId,
    });

    // Marca de auditoría liviana en el doc del usuario.
    await db.doc(`usuarios/${uid}`).set(
      {
        providerAccess: {
          proveedorId,
          grantedBy: callerEmail,
          grantedAt: admin.firestore.Timestamp.now(),
        },
      },
      { merge: true },
    );

    console.log(`[setProviderClaims] ${uid} → proveedor ${proveedorId} por ${callerEmail}`);
    return { ok: true };
  },
);
