import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';

if (admin.apps.length === 0) admin.initializeApp();
const db = admin.firestore();
const REGION = 'southamerica-east1';

const BUCKET = 'agssop-e7353.firebasestorage.app';
const PREFIX = 'backups/firestore';
const KEEP = 14;

// Subcolecciones del modelo. Se respaldan con collectionGroup (UNA query por nombre
// trae todas, sin recorrer parent por parent → muchísimo más rápido). El path completo
// del doc (clientes/X/contactos/Y) se preserva en doc.ref.path.
const SUBCOL_GROUPS = ['contactos', 'modulos', 'fcmTokens'];

function convert(v: any): any {
  if (v === null || typeof v !== 'object') return v;
  if (v instanceof admin.firestore.Timestamp) return { __t: 'ts', s: v.seconds, n: v.nanoseconds };
  if (v instanceof admin.firestore.GeoPoint) return { __t: 'geo', lat: v.latitude, lng: v.longitude };
  if (Buffer.isBuffer(v)) return { __t: 'bytes', b64: v.toString('base64') };
  if (v.constructor && v.constructor.name === 'DocumentReference') return { __t: 'ref', path: v.path };
  if (Array.isArray(v)) return v.map(convert);
  const out: Record<string, any> = {};
  for (const [k, val] of Object.entries(v)) out[k] = convert(val);
  return out;
}

/**
 * Backup diario de Firestore → NDJSON en Storage. Corre 17:30 ART, lun-vie.
 * Sin claves (SA del runtime). Equivalente automático del dump manual del browser.
 */
export const backupDiarioFirestore = onSchedule(
  {
    schedule: '30 17 * * 1-5',
    timeZone: 'America/Argentina/Buenos_Aires',
    region: REGION,
    timeoutSeconds: 540,
    memory: '2GiB',
    retryCount: 1,
  },
  async () => {
    const date = new Date().toISOString().slice(0, 10);
    const bucket = admin.storage().bucket(BUCKET);
    const file = bucket.file(`${PREFIX}/${date}.ndjson`);
    const stream = file.createWriteStream({ metadata: { contentType: 'application/x-ndjson' } });

    // Promesa que se resuelve al terminar de subir, o rechaza si el stream falla
    // (ej. permiso de Storage) — así un error de escritura NO queda silencioso.
    const finished = new Promise<void>((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });
    const write = (obj: unknown): Promise<void> => {
      const ok = stream.write(JSON.stringify(obj) + '\n');
      if (ok) return Promise.resolve();
      return new Promise<void>((res, rej) => {
        stream.once('drain', res);
        stream.once('error', rej);
      });
    };

    let count = 0;
    async function dumpQuery(base: FirebaseFirestore.Query, label: string) {
      const PAGE = 500;
      let last: FirebaseFirestore.QueryDocumentSnapshot | null = null;
      for (;;) {
        let q = base.orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE);
        if (last) q = q.startAfter(last);
        const snap = await q.get();
        if (snap.empty) break;
        for (const doc of snap.docs) {
          await write({ path: doc.ref.path, data: convert(doc.data()) });
          count++;
        }
        last = snap.docs[snap.docs.length - 1];
        if (snap.size < PAGE) break;
      }
      console.log(`[backupDiario]   ${label}: total acumulado ${count}`);
    }

    try {
      console.log(`[backupDiario] inicio ${date}`);
      // Colecciones raíz (auto-descubiertas).
      for (const root of await db.listCollections()) {
        await dumpQuery(root, root.id);
      }
      // Subcolecciones vía collectionGroup.
      for (const name of SUBCOL_GROUPS) {
        await dumpQuery(db.collectionGroup(name), `group:${name}`);
      }
      stream.end();
      await finished;
      console.log(`[backupDiario] OK: ${count} docs → gs://${BUCKET}/${PREFIX}/${date}.ndjson`);
    } catch (e: any) {
      try { stream.destroy(); } catch { /* noop */ }
      console.error(`[backupDiario] ERROR tras ${count} docs:`, e?.message || e);
      throw e; // que Cloud Functions lo marque como fallo (dispara el retry)
    }

    // Retención: conservar solo los últimos KEEP dumps.
    try {
      const [files] = await bucket.getFiles({ prefix: `${PREFIX}/` });
      const dumps = files
        .filter((f) => f.name.endsWith('.ndjson'))
        .sort((a, b) => (a.name < b.name ? 1 : -1));
      for (const old of dumps.slice(KEEP)) {
        await old.delete();
        console.log(`[backupDiario] rotado: ${old.name}`);
      }
    } catch (e: any) {
      console.warn('[backupDiario] retención falló (no crítico):', e?.message || e);
    }
  },
);
