/**
 * Cleanup script: deletes all Firestore documents created by E2E tests.
 * Searches for documents containing '[E2E]' in key text fields across all affected collections.
 *
 * Usage: node e2e/cleanup-e2e-data.mjs
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, getDocs, query, deleteDoc, doc, writeBatch,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyD5oxchnQBK69zXGE-hrbRZ8vdduvwVjWw',
  authDomain: 'agssop-e7353.firebaseapp.com',
  projectId: 'agssop-e7353',
  storageBucket: 'agssop-e7353.firebasestorage.app',
  messagingSenderId: '818451692964',
  appId: '1:818451692964:web:e9c4c9485f81d823e45531',
};

const E2E_PREFIX = '[E2E]';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * Collections and the field(s) to check for E2E prefix.
 * Each entry: [collectionName, ...fieldsToCheck]
 */
const TARGETS = [
  ['clientes',          'razonSocial'],
  ['leads',             'razonSocial', 'contacto', 'descripcion', 'motivoContacto'],
  ['presupuestos',      'origenRef'],
  ['ordenes_trabajo',   'razonSocial', 'problemaFallaInicial'],
  ['contratos',         'clienteNombre'],
  ['pendientes',        'descripcion', 'clienteNombre', 'origenTicketRazonSocial'],
  ['agendaEntries',     'clienteNombre'],
  ['auditLog',          'documentId'],   // catches audit entries for E2E docs
];

async function cleanCollection(colName, fields) {
  const snap = await getDocs(query(collection(db, colName)));
  const toDelete = [];

  for (const d of snap.docs) {
    const data = d.data();
    const isE2E = fields.some(f => {
      const val = data[f];
      return typeof val === 'string' && val.includes(E2E_PREFIX);
    });
    if (isE2E) toDelete.push(d.id);
  }

  if (toDelete.length === 0) {
    console.log(`  ${colName}: 0 docs (clean)`);
    return 0;
  }

  // Delete in batches of 500 (Firestore limit)
  for (let i = 0; i < toDelete.length; i += 500) {
    const batch = writeBatch(db);
    const chunk = toDelete.slice(i, i + 500);
    for (const id of chunk) {
      batch.delete(doc(db, colName, id));
    }
    await batch.commit();
  }

  console.log(`  ${colName}: ${toDelete.length} doc(s) deleted`);
  return toDelete.length;
}

async function main() {
  console.log(`\n🧹 Cleaning E2E data (prefix: "${E2E_PREFIX}")...\n`);

  let total = 0;
  for (const [colName, ...fields] of TARGETS) {
    try {
      total += await cleanCollection(colName, fields);
    } catch (err) {
      console.log(`  ${colName}: ERROR — ${err.message}`);
    }
  }

  console.log(`\n✅ Done. ${total} total document(s) deleted.\n`);
  process.exit(0);
}

main();
