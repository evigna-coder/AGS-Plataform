import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

if (admin.apps.length === 0) admin.initializeApp();
const db = admin.firestore();
const REGION = 'southamerica-east1';

/**
 * Alta de ticket de soporte desde el formulario público del QR (/equipo/:agsId),
 * SIN autenticación. Reemplaza el `leadsService.create()` directo que hacía la
 * página, de modo que `leads` pueda cerrarse a `signedIn()` (Fase A.2 del plan
 * .claude/plans/seguridad-qr-cliente.md).
 *
 * Beneficios de seguridad:
 *  - cierra la lectura/alta anónima directa de `leads` (fuga de tickets + spam),
 *  - asigna el número de ticket server-side con el counter atómico
 *    `_counters/tickets` (el MISMO que usan sistema-modular y portal). NO usar
 *    scan-and-max: reabre el bug de números duplicados (TKT-00164, 2026-06-18).
 *
 * App Check: hoy NO se exige (Fase E lo activa con reCAPTCHA Enterprise).
 */

const MAX_LEN = 2000;
const clean = (v: unknown, max = 300): string =>
  typeof v === 'string' ? v.trim().slice(0, max) : '';

interface SoportePayload {
  agsId?: string;
  razonSocial?: string;
  contacto?: string;
  email?: string;
  telefono?: string;
  motivoContacto?: string;
}

/** Próximo número correlativo TKT-NNNNN, atómico vía _counters/tickets. */
async function nextTicketNumero(): Promise<string> {
  const counterRef = db.doc('_counters/tickets');
  const next = await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    let current: number;
    if (snap.exists) {
      current = (snap.data()?.value as number) ?? 0;
    } else {
      // Bootstrap único: el counter no existe → escanear leads una sola vez.
      const leads = await db.collection('leads').get();
      let max = 0;
      leads.forEach((d) => {
        const m = (d.data().numero as string | undefined)?.match(/TKT-(\d+)/);
        const n = m ? parseInt(m[1], 10) : 0;
        if (n > max) max = n;
      });
      current = max;
    }
    const val = current + 1;
    tx.set(counterRef, { value: val, updatedAt: admin.firestore.Timestamp.now() });
    return val;
  });
  return `TKT-${String(next).padStart(5, '0')}`;
}

export const submitSoporte = onCall(
  { region: REGION, enforceAppCheck: false, cors: true },
  async (request): Promise<{ ok: true; numero: string }> => {
    const data = (request.data ?? {}) as SoportePayload;

    const agsId = clean(data.agsId, 60);
    const razonSocial = clean(data.razonSocial);
    const contacto = clean(data.contacto);
    const email = clean(data.email, 200);
    const telefono = clean(data.telefono, 60);
    const motivoContacto = clean(data.motivoContacto, MAX_LEN);

    if (!agsId || !razonSocial || !contacto || !email || !motivoContacto) {
      throw new HttpsError('invalid-argument', 'Faltan datos requeridos.');
    }

    // Resolver el equipo server-side: el cliente no envía sistemaId/clienteId.
    const snap = await db
      .collection('sistemas')
      .where('agsVisibleId', '==', agsId)
      .limit(1)
      .get();
    if (snap.empty) {
      throw new HttpsError('not-found', 'Equipo no encontrado.');
    }
    const sistemaDoc = snap.docs[0];
    const sistema = sistemaDoc.data();

    const numero = await nextTicketNumero();
    const now = admin.firestore.Timestamp.now();

    const payload = {
      numero,
      razonSocial,
      contacto,
      email,
      telefono,
      motivoLlamado: 'soporte',
      motivoContacto,
      sistemaId: sistemaDoc.id,
      sistemaAgsVisibleId: agsId,
      clienteId: (sistema.clienteId as string) ?? null,
      contactoId: null,
      estado: 'nuevo',
      postas: [],
      presupuestosIds: [],
      otIds: [],
      asignadoA: null,
      derivadoPor: null,
      source: 'qr',
      createdBy: 'qr-publico',
      createdByName: 'Formulario QR',
      createdAt: now,
      updatedAt: now,
    };

    const ref = await db.collection('leads').add(payload);
    console.log(`[submitSoporte] ticket ${numero} creado (${ref.id}) desde equipo ${agsId}`);

    return { ok: true, numero };
  },
);
