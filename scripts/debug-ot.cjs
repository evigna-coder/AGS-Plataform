// One-off debug: dump current state + audit_log for a single OT.
// Usage: node scripts/debug-ot.cjs <otNumber>

const path = require('path');
const fs = require('fs');

const envPath = path.resolve(__dirname, '..', 'apps', 'sistema-modular', '.env.local');
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf-8')
    .split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(l => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const { initializeApp } = require('./node_modules/firebase/app');
const {
  getFirestore, doc, getDoc, collection, query, where, orderBy, getDocs, limit, Timestamp,
} = require('./node_modules/firebase/firestore');

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});
const db = getFirestore(app);

const otNumber = process.argv[2];
if (!otNumber) { console.error('Falta otNumber'); process.exit(1); }

function fmtTs(t) {
  if (!t) return '—';
  if (t instanceof Timestamp) return t.toDate().toISOString();
  if (typeof t.toDate === 'function') return t.toDate().toISOString();
  return String(t);
}

(async () => {
  // 1) Doc actual
  const snap = await getDoc(doc(db, 'reportes', otNumber));
  if (!snap.exists()) {
    console.log(`❌ reportes/${otNumber} NO existe`);
  } else {
    const d = snap.data();
    console.log(`✅ reportes/${otNumber} existe`);
    console.log('-- summary --');
    const keys = Object.keys(d).sort();
    for (const k of keys) {
      const v = d[k];
      let descr;
      if (Array.isArray(v)) descr = `Array(${v.length})`;
      else if (v && typeof v === 'object' && typeof v.toDate === 'function') descr = `Timestamp(${fmtTs(v)})`;
      else if (v && typeof v === 'object') descr = `Object{${Object.keys(v).slice(0, 6).join(',')}${Object.keys(v).length > 6 ? ',…' : ''}}`;
      else if (typeof v === 'string') descr = v.length > 60 ? `"${v.slice(0, 60)}…" (len ${v.length})` : `"${v}"`;
      else descr = String(v);
      console.log(`  ${k}: ${descr}`);
    }
    console.log('-- fields críticos crudos --');
    console.log('  pdfUrl FULL =', d.pdfUrl);
    console.log('  pdfGeneratedAt =', d.pdfGeneratedAt);
    for (const k of ['estadoAdmin','status','estadoHistorial','equipos','protocolos','adjuntos','articulos','horasTrabajadas','tiempoViaje','cierreAdmin','creadoPor','updatedAt','updatedBy','updatedByName','createdAt']) {
      if (k in d) console.log(`  ${k} =`, JSON.stringify(d[k], null, 2).slice(0, 500));
    }
  }

  // 2) audit_log (sin orderBy para evitar requerir index compuesto)
  console.log('\n=== audit_log (collection=ordenes_trabajo, documentId=', otNumber, ') ===');
  const q = query(
    collection(db, 'audit_log'),
    where('collection', '==', 'ordenes_trabajo'),
    where('documentId', '==', otNumber),
    limit(200),
  );
  const auditRaw = await getDocs(q);
  // Sort en memoria
  const sorted = auditRaw.docs.slice().sort((a, b) => {
    const ta = a.data().timestamp?.toDate?.()?.getTime() ?? 0;
    const tb = b.data().timestamp?.toDate?.()?.getTime() ?? 0;
    return tb - ta;
  });
  const audit = { size: sorted.length, docs: sorted };
  console.log(`Total entries: ${audit.size}`);
  audit.docs.forEach((d, i) => {
    const x = d.data();
    console.log(`\n[${i + 1}] ${fmtTs(x.timestamp)} — ${x.action} — ${x.userName ?? x.userId ?? 'unknown'}`);
    if (x.eventName) console.log(`    event: ${x.eventName}`);
    if (x.details) console.log(`    details: ${JSON.stringify(x.details).slice(0, 400)}`);
    if (x.changes?.before) console.log(`    before keys: ${Object.keys(x.changes.before).join(', ')}`);
    if (x.changes?.after) {
      const ak = Object.keys(x.changes.after);
      console.log(`    after  keys (${ak.length}): ${ak.join(', ')}`);
      // Show critical "could-wipe" fields if present
      const interesting = ['equipos','protocolos','adjuntos','articulos','horasTrabajadas','tiempoViaje','cierreAdmin','estadoAdmin','status','estadoHistorial'];
      for (const k of interesting) {
        if (k in x.changes.after) {
          const v = x.changes.after[k];
          let descr;
          if (Array.isArray(v)) descr = `Array(${v.length})${v.length === 0 ? '  ← EMPTY' : ''}`;
          else if (v === null) descr = 'null  ← NULL';
          else if (v === '') descr = '""  ← EMPTY STRING';
          else if (typeof v === 'object') descr = `Object{${Object.keys(v).join(',')}}`;
          else descr = JSON.stringify(v);
          console.log(`      ${k} = ${descr}`);
        }
      }
    }
  });

  // 2b) Adjuntos por OT (fotos / archivos sobreviven en otra colección)
  console.log('\n=== adjuntos (otNumber=', otNumber, ') ===');
  try {
    const qAdj = query(collection(db, 'adjuntos'), where('otNumber', '==', otNumber));
    const adj = await getDocs(qAdj);
    console.log(`Total adjuntos: ${adj.size}`);
    adj.docs.forEach((d, i) => {
      const x = d.data();
      console.log(`  [${i + 1}] id=${d.id} caption="${(x.caption||'').toString().slice(0,40)}" url=${(x.url||'').toString().slice(0,80)}…`);
    });
  } catch (e) { console.error('adjuntos query error:', e.message); }

  // 3) También buscar audit en collection='reportes' por si algún path no usa el alias 'ordenes_trabajo'
  console.log('\n=== audit_log (collection=reportes, documentId=', otNumber, ') ===');
  const q2 = query(
    collection(db, 'audit_log'),
    where('collection', '==', 'reportes'),
    where('documentId', '==', otNumber),
    limit(200),
  );
  const audit2Raw = await getDocs(q2);
  const sorted2 = audit2Raw.docs.slice().sort((a, b) => {
    const ta = a.data().timestamp?.toDate?.()?.getTime() ?? 0;
    const tb = b.data().timestamp?.toDate?.()?.getTime() ?? 0;
    return tb - ta;
  });
  const audit2 = { size: sorted2.length, docs: sorted2 };
  console.log(`Total entries: ${audit2.size}`);
  audit2.docs.forEach((d, i) => {
    const x = d.data();
    console.log(`[${i + 1}] ${fmtTs(x.timestamp)} — ${x.action} — ${x.userName ?? x.userId ?? 'unknown'}`);
    if (x.changes?.after) console.log(`    after keys: ${Object.keys(x.changes.after).join(', ')}`);
  });

  process.exit(0);
})().catch(err => { console.error('FATAL:', err); process.exit(1); });
