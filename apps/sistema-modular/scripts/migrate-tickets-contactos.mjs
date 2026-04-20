/**
 * Script de migración idempotente: persiste `contactos[]` en tickets legacy
 * que solo tienen los campos planos `contacto`, `email`, `telefono`.
 *
 * Replica la lógica de `hydrateContactos()` (apps/sistema-modular/src/services/leadsService.ts)
 * pero escribiendo el resultado en Firestore para que el modal de envío de mail no dependa
 * de la hidratación en-memory (Phase 8 FLOW-04 / FLOW-02).
 *
 * Características:
 *   - Idempotente: tickets con `contactos.length > 0` se skipean (no se re-escriben).
 *   - Preserva `contacto/email/telefono` planos (no los borra; `syncFlatFromContactos`
 *     sigue siendo la fuente de verdad para writes futuros).
 *   - Commit en batches de 400 docs.
 *   - Nunca escribe `undefined` (usa `stripUndefined` + omisión de keys vacías).
 *
 * Requiere: Firebase Admin SDK (ya usado por migrate-establecimientos.js).
 *
 * Uso:
 *   node scripts/migrate-tickets-contactos.mjs --dry-run   # Default: log sin escrituras
 *   node scripts/migrate-tickets-contactos.mjs --run       # Escribe en Firestore
 *
 * Opcional: SERVICE_ACCOUNT_PATH=/ruta/a/service-account.json node scripts/migrate-tickets-contactos.mjs --run
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isRun = process.argv.includes('--run');
const isDryRun = process.argv.includes('--dry-run') || !isRun; // dry-run es el default

/**
 * Replica `hydrateContactos()` de leadsService.ts:89-103.
 * Retorna:
 *   - `null`    → ticket ya tiene `contactos[]` con data → skip (idempotency guard).
 *   - `[]`      → ticket sin ningún campo plano → skip (nada para migrar).
 *   - `[{...}]` → array con un contacto principal a persistir.
 *
 * NO muta los campos planos `contacto/email/telefono`.
 * Omite keys en lugar de pasar `undefined` (Firestore rechaza undefined).
 */
function buildContactosArrayFromFlat(data) {
  const existing = Array.isArray(data.contactos) ? data.contactos : [];
  if (existing.length > 0) return null; // skip: ya tiene contactos

  const nombre = (data.contacto ?? '').trim();
  const email = (data.email ?? '').trim();
  const telefono = (data.telefono ?? '').trim();

  if (!nombre && !email && !telefono) return []; // nada que migrar

  // El único contacto generado es el principal (esPrincipal: true).
  // Consumido por getContactoPrincipal() en el modal de envío de mail.
  const contacto = {
    id: 'legacy-principal',
    nombre: nombre || '(Sin nombre)',
    esPrincipal: true,
  };
  if (email) contacto.email = email;       // omitir si vacío — nunca undefined en write
  if (telefono) contacto.telefono = telefono;
  return [contacto];
}

/** Elimina keys con valor `undefined` antes de enviar a Firestore. */
function stripUndefined(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

async function main() {
  let admin;
  try {
    admin = (await import('firebase-admin')).default;
  } catch (e) {
    console.error('Instalar firebase-admin: npm install firebase-admin');
    process.exit(1);
  }

  const serviceAccountPath =
    process.env.SERVICE_ACCOUNT_PATH ||
    path.join(__dirname, '..', 'service-account.json');
  if (!fs.existsSync(serviceAccountPath)) {
    console.error('No se encontró service-account.json en', serviceAccountPath);
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  const db = admin.firestore();

  console.log(isDryRun ? '=== DRY RUN (no se escriben datos) ===' : '=== EJECUCIÓN REAL ===');

  const counts = { migrados: 0, yaConContactos: 0, sinDatos: 0, total: 0 };
  const leadsSnap = await db.collection('leads').get();
  counts.total = leadsSnap.size;

  let batch = db.batch();
  let pendingOps = 0;
  let batchesCommitted = 0;

  for (const doc of leadsSnap.docs) {
    const data = doc.data();
    const result = buildContactosArrayFromFlat(data);

    if (result === null) {
      counts.yaConContactos++;
      continue;
    }
    if (result.length === 0) {
      counts.sinDatos++;
      continue;
    }
    counts.migrados++;

    if (isDryRun) {
      console.log('Ticket', doc.id, '→ contactos:', JSON.stringify(result));
      continue;
    }

    // Build payload — nunca escribir undefined.
    const payload = stripUndefined({
      contactos: result,
      updatedAt: admin.firestore.Timestamp.now(),
    });
    batch.update(doc.ref, payload);
    pendingOps++;

    if (pendingOps >= 400) {
      await batch.commit();
      batchesCommitted++;
      console.log(`Commit batch #${batchesCommitted}: ${pendingOps} tickets`);
      batch = db.batch();
      pendingOps = 0;
    }
  }

  if (pendingOps > 0 && !isDryRun) {
    await batch.commit();
    batchesCommitted++;
    console.log(`Commit batch final #${batchesCommitted}: ${pendingOps} tickets`);
  }

  console.log('\nResumen:');
  console.log(`  Migrados:         ${counts.migrados}`);
  console.log(`  Ya-con-contactos: ${counts.yaConContactos}`);
  console.log(`  Sin-datos (skip): ${counts.sinDatos}`);
  console.log(`  Total tickets:    ${counts.total}`);
  if (!isDryRun) {
    console.log(`  Batches escritos: ${batchesCommitted}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
