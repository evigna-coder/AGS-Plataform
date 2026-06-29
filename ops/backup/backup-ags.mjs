/**
 * backup-ags.mjs — Backup local AGS vía Firebase Admin SDK (NO usa gcloud).
 * Plan: .claude/plans/backup-implementacion.md
 *
 * Por qué Node y no gcloud: en las PCs con Avast el SSL de gcloud (Python) rechaza
 * el cert corporativo. Node con --use-system-ca usa el almacén de Windows y funciona.
 *
 * Hace dos cosas (configurable por --mode):
 *   - firestore : dump recursivo de TODAS las colecciones (incl. subcolecciones) a
 *                 NDJSON (una línea {path,data} por documento). Legible y re-importable.
 *   - storage   : descarga incremental de los archivos del bucket al disco
 *                 (salta los que ya están con el mismo tamaño).
 *
 * Uso:
 *   node backup-ags.mjs --mode=all --dest=D:/backups-ags --key=C:/ags-backup/sa-key.json
 *   node backup-ags.mjs --mode=firestore --dest=...        (solo base)
 *   node backup-ags.mjs --mode=storage --prefix=reports/   (solo PDFs de informes)
 *   node backup-ags.mjs --mode=storage --limit=50          (test: primeros 50 archivos)
 *
 * Correr SIEMPRE con:  NODE_OPTIONS=--use-system-ca node backup-ags.mjs ...
 * (el wrapper run-backup.ps1 ya lo hace).
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp, GeoPoint } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { createWriteStream, existsSync, mkdirSync, statSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

// ── args ──
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const MODE   = args.mode   || 'all';                 // firestore | storage | all
const DEST   = args.dest   || process.env.AGS_BACKUP_DEST;
const KEY    = args.key    || process.env.AGS_BACKUP_KEY;
const PREFIX = args.prefix || '';                    // filtro de Storage (ej. reports/)
const LIMIT  = args.limit ? Number(args.limit) : 0;  // 0 = sin límite (para test)
const BUCKET = args.bucket || 'agssop-e7353.firebasestorage.app';

if (!DEST || !KEY) {
  console.error('Falta --dest y/o --key (o las env AGS_BACKUP_DEST / AGS_BACKUP_KEY).');
  process.exit(2);
}

const day = new Date().toISOString().slice(0, 10);
const log = (m) => console.log(`${new Date().toISOString().slice(11, 19)}  ${m}`);

initializeApp({ credential: cert(JSON.parse(readFileSync(KEY, 'utf8'))), storageBucket: BUCKET });

// ── serialización con fidelidad de tipos Firestore ──
function convert(v) {
  if (v === null || typeof v !== 'object') return v;
  if (v instanceof Timestamp) return { __t: 'ts', s: v.seconds, n: v.nanoseconds };
  if (v instanceof GeoPoint)  return { __t: 'geo', lat: v.latitude, lng: v.longitude };
  if (Buffer.isBuffer(v))     return { __t: 'bytes', b64: v.toString('base64') };
  if (v.constructor && v.constructor.name === 'DocumentReference') return { __t: 'ref', path: v.path };
  if (Array.isArray(v)) return v.map(convert);
  const out = {};
  for (const [k, val] of Object.entries(v)) out[k] = convert(val);
  return out;
}

async function dumpFirestore() {
  const db = getFirestore();
  const outDir = join(DEST, 'firestore');
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, `${day}.ndjson`);
  const ws = createWriteStream(file, { flags: 'w' });
  let count = 0;

  async function dumpCol(colRef) {
    const snap = await colRef.get();
    for (const doc of snap.docs) {
      ws.write(JSON.stringify({ path: doc.ref.path, data: convert(doc.data()) }) + '\n');
      count++;
      if (count % 1000 === 0) log(`  ...${count} docs`);
      const subs = await doc.ref.listCollections();
      for (const s of subs) await dumpCol(s);
    }
  }

  log(`Firestore → ${file}`);
  for (const root of await db.listCollections()) {
    log(`  colección: ${root.id}`);
    await dumpCol(root);
  }
  await new Promise((res) => ws.end(res));
  log(`Firestore OK: ${count} documentos.`);
}

async function dumpStorage() {
  const bucket = getStorage().bucket();
  const baseDir = join(DEST, 'storage');
  let scanned = 0, downloaded = 0, skipped = 0;
  log(`Storage gs://${BUCKET}/${PREFIX} → ${baseDir} (incremental)`);

  await new Promise((resolve, reject) => {
    const stream = bucket.getFilesStream({ prefix: PREFIX });
    stream.on('error', reject);
    stream.on('data', (file) => {
      scanned++;
      if (LIMIT && downloaded >= LIMIT) { stream.destroy(); return; }
      stream.pause();
      (async () => {
        const dest = join(baseDir, file.name);
        const remoteSize = Number(file.metadata.size || 0);
        if (existsSync(dest) && statSync(dest).size === remoteSize) { skipped++; stream.resume(); return; }
        mkdirSync(dirname(dest), { recursive: true });
        await file.download({ destination: dest });
        downloaded++;
        if (downloaded % 100 === 0) log(`  ...${downloaded} bajados`);
        stream.resume();
      })().catch(reject);
    });
    stream.on('end', resolve);
    stream.on('close', resolve);
  });
  log(`Storage OK: escaneados ${scanned}, bajados ${downloaded}, ya estaban ${skipped}.`);
}

(async () => {
  try {
    log(`===== Backup AGS — modo: ${MODE} =====`);
    if (MODE === 'firestore' || MODE === 'all') await dumpFirestore();
    if (MODE === 'storage'   || MODE === 'all') await dumpStorage();
    log('===== OK =====');
    process.exit(0);
  } catch (e) {
    console.error('XXXXX ERROR:', e?.message || e);
    process.exit(1);
  }
})();
