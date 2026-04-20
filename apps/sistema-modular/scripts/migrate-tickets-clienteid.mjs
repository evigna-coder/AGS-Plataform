/**
 * Script de migración: resolver clienteId de tickets legacy (colección `leads`).
 *
 * Estrategia:
 *   1. Lee todos los clientes y construye maps por CUIT normalizado y por razón social normalizada.
 *   2. Lee tickets con clienteId == null.
 *   3. Para cada ticket intenta matchear por CUIT (más fuerte) y si no, por razón social exacta.
 *   4. Categoriza: matched (1 candidato único), ambiguous (>1 candidato), unmatched (0), skipped.
 *   5. En --dry-run NO toca Firestore; solo escribe `mapping-clienteid.json`.
 *   6. En --run aplica batch updates:
 *      - matched  → clienteId resuelto + clienteIdMigradoAt/Por = 'script'
 *      - ambiguous → pendienteClienteId = true + candidatosPropuestos = [...]
 *      - unmatched → pendienteClienteId = true + candidatosPropuestos = []
 *
 * Uso:
 *   node scripts/migrate-tickets-clienteid.mjs --dry-run     # default, no toca Firestore
 *   node scripts/migrate-tickets-clienteid.mjs --run         # aplica cambios
 *
 * Credenciales:
 *   SERVICE_ACCOUNT_PATH=/ruta/a/service-account.json        # default: ./service-account.json
 *
 * Idempotente: un segundo `--run` no modifica tickets ya resueltos.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isDryRun = process.argv.includes('--dry-run');
const isRun = process.argv.includes('--run');
if (!isDryRun && !isRun) {
  console.error('Usar --dry-run o --run');
  process.exit(1);
}

/** Normaliza CUIT: quita todo lo que no sea dígito. */
function normalizeCuit(cuit) {
  if (!cuit || typeof cuit !== 'string') return '';
  return cuit.replace(/\D/g, '');
}

/** Normaliza razón social: trim + lowercase + sin acentos + colapsa whitespace. */
function normalizeRazonSocial(s) {
  if (!s || typeof s !== 'string') return '';
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/** Quita undefined del payload — firebase-admin Firestore rechaza undefined igual que el SDK cliente. */
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
    console.error('Instalar firebase-admin: pnpm add -D firebase-admin (en apps/sistema-modular)');
    process.exit(1);
  }

  const serviceAccountPath =
    process.env.SERVICE_ACCOUNT_PATH ||
    path.join(__dirname, '..', 'service-account.json');
  if (!fs.existsSync(serviceAccountPath)) {
    console.error('No se encontró service-account.json en', serviceAccountPath);
    console.error('Setear SERVICE_ACCOUNT_PATH o ubicar el archivo en apps/sistema-modular/');
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  const db = admin.firestore();

  console.log(isDryRun ? '=== DRY RUN (no se escriben datos) ===' : '=== EJECUCIÓN REAL ===');

  // 1) Cargar clientes en maps indexados por CUIT normalizado y razón social normalizada.
  console.log('Cargando clientes...');
  const clientesSnap = await db.collection('clientes').get();
  /** @type {Map<string, {id: string, razonSocial: string, cuit: string}>} */
  const byCuit = new Map();
  /** @type {Map<string, Array<{id: string, razonSocial: string, cuit: string}>>} */
  const byRazonSocial = new Map();

  for (const doc of clientesSnap.docs) {
    const data = doc.data();
    const rawCuit = data.cuit ?? '';
    const cuitKey = normalizeCuit(rawCuit);
    const razonKey = normalizeRazonSocial(data.razonSocial ?? '');
    const entry = {
      id: doc.id,
      razonSocial: data.razonSocial ?? '',
      cuit: cuitKey,
    };
    if (cuitKey && cuitKey.length >= 8) {
      // CUIT se asume único (id del cliente suele SER el CUIT post-migración Fase establecimientos).
      if (!byCuit.has(cuitKey)) byCuit.set(cuitKey, entry);
    }
    if (razonKey) {
      if (!byRazonSocial.has(razonKey)) byRazonSocial.set(razonKey, []);
      byRazonSocial.get(razonKey).push(entry);
    }
  }
  console.log(`  ${clientesSnap.size} clientes (indexed: ${byCuit.size} por CUIT, ${byRazonSocial.size} razones sociales únicas)`);

  // 2) Cargar tickets con clienteId == null.
  console.log('Cargando tickets sin clienteId...');
  const ticketsSnap = await db.collection('leads').where('clienteId', '==', null).get();
  console.log(`  ${ticketsSnap.size} tickets pendientes de resolución`);

  /** @type {{matched: any[], ambiguous: any[], unmatched: any[], skipped: any[]}} */
  const mapping = { matched: [], ambiguous: [], unmatched: [], skipped: [] };

  // 3) Clasificar cada ticket.
  for (const ticketDoc of ticketsSnap.docs) {
    const data = ticketDoc.data();
    const ticketId = ticketDoc.id;

    // Defensive: si ya tiene clienteId no-null, skip.
    if (data.clienteId != null) {
      mapping.skipped.push({ ticketId, reason: 'ya_tiene_clienteId', existing: data.clienteId });
      continue;
    }

    const ticketCuit = normalizeCuit(data.cuit ?? '');
    const ticketRazon = normalizeRazonSocial(data.razonSocial ?? '');

    // Match 1 — CUIT (más fuerte).
    if (ticketCuit && ticketCuit.length >= 8 && byCuit.has(ticketCuit)) {
      const cliente = byCuit.get(ticketCuit);
      mapping.matched.push({
        ticketId,
        clienteId: cliente.id,
        via: 'cuit',
        razonSocial: data.razonSocial ?? '',
      });
      continue;
    }

    // Match 2 — razón social exacta.
    const candidatosRazon = ticketRazon ? (byRazonSocial.get(ticketRazon) ?? []) : [];
    if (candidatosRazon.length === 1) {
      mapping.matched.push({
        ticketId,
        clienteId: candidatosRazon[0].id,
        via: 'razonSocial',
        razonSocial: data.razonSocial ?? '',
      });
      continue;
    }
    if (candidatosRazon.length > 1) {
      mapping.ambiguous.push({
        ticketId,
        razonSocial: data.razonSocial ?? '',
        candidatos: candidatosRazon.map(c => ({
          clienteId: c.id,
          razonSocial: c.razonSocial,
          score: 'razonSocial',
        })),
      });
      continue;
    }

    // Sin candidato.
    mapping.unmatched.push({
      ticketId,
      razonSocial: data.razonSocial ?? '',
      candidatos: [],
    });
  }

  console.log(`\nResumen de clasificación:`);
  console.log(`  Matcheados: ${mapping.matched.length}`);
  console.log(`  Ambiguos:   ${mapping.ambiguous.length}`);
  console.log(`  Sin candidato: ${mapping.unmatched.length}`);
  console.log(`  Skipped:    ${mapping.skipped.length}`);

  // 4) Aplicar writes (solo en --run).
  if (isRun) {
    console.log('\nAplicando writes a Firestore...');
    let batch = db.batch();
    let ops = 0;
    const commitIfFull = async () => {
      if (ops >= 400) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    };

    // Matched: clienteId resuelto.
    for (const m of mapping.matched) {
      const payload = stripUndefined({
        clienteId: m.clienteId,
        clienteIdMigradoAt: admin.firestore.Timestamp.now(),
        clienteIdMigradoPor: 'script',
        pendienteClienteId: false,
        updatedAt: admin.firestore.Timestamp.now(),
      });
      batch.update(db.collection('leads').doc(m.ticketId), payload);
      ops++;
      await commitIfFull();
    }

    // Ambiguous: pendienteClienteId + candidatos.
    for (const a of mapping.ambiguous) {
      const payload = stripUndefined({
        pendienteClienteId: true,
        candidatosPropuestos: a.candidatos.map(c => stripUndefined({
          clienteId: c.clienteId,
          razonSocial: c.razonSocial,
          score: c.score,
        })),
        updatedAt: admin.firestore.Timestamp.now(),
      });
      batch.update(db.collection('leads').doc(a.ticketId), payload);
      ops++;
      await commitIfFull();
    }

    // Unmatched: pendienteClienteId + candidatos vacíos.
    for (const u of mapping.unmatched) {
      const payload = stripUndefined({
        pendienteClienteId: true,
        candidatosPropuestos: [],
        updatedAt: admin.firestore.Timestamp.now(),
      });
      batch.update(db.collection('leads').doc(u.ticketId), payload);
      ops++;
      await commitIfFull();
    }

    if (ops > 0) {
      await batch.commit();
    }
    console.log('  Writes aplicados.');
  }

  // 5) Escribir mapping.json.
  const outPath = path.join(__dirname, '..', 'mapping-clienteid.json');
  fs.writeFileSync(outPath, JSON.stringify(mapping, null, 2), 'utf8');
  console.log(`\nMapping escrito en ${outPath}`);
  console.log(`Matcheados: ${mapping.matched.length}, ambiguos: ${mapping.ambiguous.length}, sin candidato: ${mapping.unmatched.length}, skipped: ${mapping.skipped.length}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
