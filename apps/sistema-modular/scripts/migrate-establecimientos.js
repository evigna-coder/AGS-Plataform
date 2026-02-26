/**
 * Script de migración: CUIT como id de cliente + Establecimientos + contactos en establecimiento + sistemas con establecimientoId
 *
 * Requiere: Firebase Admin SDK (npm install firebase-admin)
 * Uso:
 *   node scripts/migrate-establecimientos.js --dry-run   # Solo imprime qué haría, escribe mapping.json
 *   node scripts/migrate-establecimientos.js --run       # Ejecuta cambios en Firestore
 *
 * Opcional: SERVICE_ACCOUNT_PATH=/ruta/a/service-account.json node scripts/migrate-establecimientos.js --run
 *
 * mapping.json incluye: clientes (oldId→newId), establecimientos (clienteCuit→estId), sistemas (sistemaId→establecimientoId), contactosMigrados (estId→cantidad)
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

function normalizeCuit(cuit) {
  if (!cuit || typeof cuit !== 'string') return '';
  return cuit.replace(/\D/g, '');
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/x/g, () =>
    (Math.random() * 16 | 0).toString(16)
  );
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

  const mapping = {
    clientes: {},
    establecimientos: {},
    sistemas: {},
    contactosMigrados: {},
    errores: [],
  };
  const errors = [];
  /** Por cada newId (cliente), el doc id donde están los contactos (oldId o newId) */
  const contactosSourceByNewId = {};

  console.log(isDryRun ? '=== DRY RUN (no se escriben datos) ===' : '=== EJECUCIÓN REAL ===');

  // 1) Clientes actuales
  const clientesSnap = await db.collection('clientes').get();
  const clientesByNewId = new Map();

  for (const doc of clientesSnap.docs) {
    const oldId = doc.id;
    const data = doc.data();
    const rawCuit = data.cuit ?? '';
    const normalized = normalizeCuit(rawCuit);
    const newId = normalized ? normalized : 'LEGACY-' + uuid();
    mapping.clientes[oldId] = newId;
    contactosSourceByNewId[newId] = oldId;

    if (oldId === newId && normalized) {
      console.log('Cliente ya tiene id = CUIT:', oldId);
      clientesByNewId.set(newId, { id: newId, ...data });
      continue;
    }

    if (isDryRun) {
      console.log('Cliente:', oldId, '-> nuevo id:', newId, data.razonSocial || '');
      clientesByNewId.set(newId, { id: newId, ...data });
      continue;
    }

    const newData = {
      ...data,
      cuit: normalized || null,
      updatedAt: admin.firestore.Timestamp.now(),
    };
    delete newData.id;
    const newRef = db.collection('clientes').doc(newId);
    if (!(await newRef.get()).exists) {
      await newRef.set({
        ...newData,
        createdAt: data.createdAt || admin.firestore.Timestamp.now(),
      });
      // No copiar contactos al cliente; se migran al establecimiento Principal
      console.log('Creado cliente', newId, 'desde', oldId);
    }
    clientesByNewId.set(newId, { id: newId, ...data });
  }

  // 2) Establecimientos: uno "Principal" por cliente (reutilizar si ya existe)
  const establecimientoIdsByCliente = {};
  for (const [clientNewId, clientData] of clientesByNewId.entries()) {
    const nombre = 'Principal';
    if (!isDryRun) {
      const existing = await db.collection('establecimientos')
        .where('clienteCuit', '==', clientNewId)
        .limit(1)
        .get();
      if (!existing.empty) {
        const estId = existing.docs[0].id;
        establecimientoIdsByCliente[clientNewId] = estId;
        mapping.establecimientos[clientNewId] = estId;
        console.log('Establecimiento ya existe para', clientNewId, '->', estId);
        continue;
      }
    }

    const payload = {
      clienteCuit: clientNewId,
      nombre,
      direccion: clientData.direccion || '',
      localidad: clientData.localidad || '',
      provincia: clientData.provincia || '',
      codigoPostal: clientData.codigoPostal || undefined,
      activo: true,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    };
    if (isDryRun) {
      const fakeId = 'est-' + clientNewId.slice(0, 8);
      establecimientoIdsByCliente[clientNewId] = fakeId;
      mapping.establecimientos[clientNewId] = fakeId;
      console.log('Establecimiento (dry):', clientNewId, '->', fakeId);
      continue;
    }
    const estRef = await db.collection('establecimientos').add(payload);
    establecimientoIdsByCliente[clientNewId] = estRef.id;
    mapping.establecimientos[clientNewId] = estRef.id;
    console.log('Creado establecimiento', estRef.id, 'para cliente', clientNewId);
  }

  // 2b) Migrar contactos: clientes/{sourceId}/contactos -> establecimientos/{estId}/contactos
  console.log('\n--- Migración de contactos ---');
  for (const [clientNewId, estId] of Object.entries(establecimientoIdsByCliente)) {
    const sourceId = contactosSourceByNewId[clientNewId];
    if (!sourceId) continue;
    const contactosRef = db.collection('clientes').doc(sourceId).collection('contactos');
    const contactosSnap = await contactosRef.get();
    const count = contactosSnap.size;
    if (count === 0) continue;

    if (isDryRun) {
      console.log('Contactos:', count, 'en cliente', sourceId, '-> establecimiento', estId);
      mapping.contactosMigrados[estId] = (mapping.contactosMigrados[estId] || 0) + count;
      continue;
    }

    const estContactosRef = db.collection('establecimientos').doc(estId).collection('contactos');
    for (const c of contactosSnap.docs) {
      const data = c.data();
      await estContactosRef.doc(c.id).set({
        ...data,
        establecimientoId: estId,
        esPrincipal: data.esPrincipal ?? false,
      });
    }
    mapping.contactosMigrados[estId] = (mapping.contactosMigrados[estId] || 0) + count;
    console.log('Migrados', count, 'contactos de cliente', sourceId, 'a establecimiento', estId);
  }

  // 3) Sistemas: asignar establecimientoId (y clienteId al newId si migramos)
  const sistemasSnap = await db.collection('sistemas').get();
  for (const doc of sistemasSnap.docs) {
    const data = doc.data();
    const oldClienteId = data.clienteId || data.clienteCuit;
    const newClienteId = mapping.clientes[oldClienteId] || oldClienteId;
    const establecimientoId = establecimientoIdsByCliente[newClienteId];
    if (!establecimientoId) {
      errors.push({ tipo: 'sistema', id: doc.id, clienteId: oldClienteId, mensaje: 'Sin establecimiento para cliente' });
      continue;
    }
    mapping.sistemas[doc.id] = establecimientoId;
    if (isDryRun) {
      console.log('Sistema', doc.id, '-> establecimientoId:', establecimientoId, 'clienteId:', newClienteId);
      continue;
    }
    await doc.ref.update({
      establecimientoId,
      clienteId: newClienteId,
      updatedAt: admin.firestore.Timestamp.now(),
    });
    console.log('Actualizado sistema', doc.id);
  }

  mapping.errores = errors;

  const outDir = path.join(__dirname, '..');
  const mappingPath = path.join(outDir, 'mapping.json');
  const errorsPath = path.join(outDir, 'errors.csv');
  fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2), 'utf8');
  console.log('\nEscrito', mappingPath);

  const csvLines = ['tipo,id,clienteId,mensaje', ...errors.map(e => `${e.tipo},${e.id},${e.clienteId || ''},${e.mensaje}`)];
  fs.writeFileSync(errorsPath, csvLines.join('\n'), 'utf8');
  console.log('Escrito', errorsPath, '(', errors.length, 'errores)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
