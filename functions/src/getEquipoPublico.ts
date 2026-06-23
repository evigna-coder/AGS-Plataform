import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

if (admin.apps.length === 0) admin.initializeApp();
const db = admin.firestore();
const REGION = 'southamerica-east1';

/**
 * Proyección pública SEGURA de un equipo (sistema), para la página /equipo/:agsId
 * del portal-ingeniero cuando el visitante NO está autenticado.
 *
 * Por qué existe: la regla histórica `sistemas → read: if true` entregaba el doc
 * COMPLETO a cualquiera (clienteId, establecimiento, observaciones internas, etc.).
 * Esta función devuelve únicamente los campos que la UI pública muestra, y permite
 * cerrar la lectura directa de `sistemas` a `signedIn()` (Fase A.1 del plan
 * .claude/plans/seguridad-qr-cliente.md).
 *
 * Los usuarios autenticados (IST AGS) NO usan esta función: leen el sistema completo
 * por reglas (`read: if signedIn()`) para ver el historial de OTs.
 *
 * App Check: hoy NO se exige (enforceAppCheck:false) porque el cliente todavía no
 * inicializa App Check. Fase E lo activa tras provisionar reCAPTCHA Enterprise.
 */
type SoftwarePublico = { nombre: string; revision?: string | null };

interface EquipoPublico {
  found: boolean;
  nombre?: string;
  software?: string | null;
  softwareRevision?: string | null;
  softwares?: SoftwarePublico[];
  agsVisibleId?: string | null;
}

export const getEquipoPublico = onCall(
  { region: REGION, enforceAppCheck: false, cors: true },
  async (request): Promise<EquipoPublico> => {
    const agsId = (request.data?.agsId ?? '').toString().trim();
    if (!agsId) {
      throw new HttpsError('invalid-argument', 'Falta agsId.');
    }

    const snap = await db
      .collection('sistemas')
      .where('agsVisibleId', '==', agsId)
      .limit(1)
      .get();

    if (snap.empty) {
      return { found: false };
    }

    const d = snap.docs[0].data();

    // Whitelist explícita: SOLO campos seguros de mostrar a un anónimo.
    const softwares: SoftwarePublico[] | undefined = Array.isArray(d.softwares)
      ? d.softwares
          .filter((sw: unknown): sw is Record<string, unknown> => !!sw && typeof sw === 'object')
          .map((sw: Record<string, unknown>) => ({
            nombre: (sw.nombre as string) ?? '',
            revision: (sw.revision as string) ?? null,
          }))
      : undefined;

    return {
      found: true,
      nombre: (d.nombre as string) ?? '',
      software: (d.software as string) ?? null,
      softwareRevision: (d.softwareRevision as string) ?? null,
      softwares,
      agsVisibleId: (d.agsVisibleId as string) ?? agsId,
    };
  },
);
