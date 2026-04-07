/**
 * Script: Actualizar marca de módulos "Agilent" → "Agilent Technologies ®"
 *
 * Usa Firebase client SDK (no requiere service account key).
 * Recorre sistemas/{id}/modulos y actualiza la marca.
 *
 * Uso:
 *   node scripts/update-modulos-marca.mjs [--dry-run]
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';

// ── Config ──────────────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run');

const firebaseConfig = {
  apiKey: 'AIzaSyD5oxchnQBK69zXGE-hrbRZ8vdduvwVjWw',
  authDomain: 'agssop-e7353.firebaseapp.com',
  projectId: 'agssop-e7353',
  storageBucket: 'agssop-e7353.firebasestorage.app',
  messagingSenderId: '818451692964',
  appId: '1:818451692964:web:e9c4c9485f81d823e45531',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const BATCH_SIZE = 400;

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  if (DRY_RUN) console.log('🔵 DRY RUN — no se escribirá nada en Firestore\n');

  // 1. Leer categorías (para referencia)
  console.log('📚 Leyendo categorías de módulos...');
  const categoriasSnap = await getDocs(collection(db, 'categorias_modulo'));
  let totalModelos = 0;
  const marcasEnCategorias = new Set();

  for (const catDoc of categoriasSnap.docs) {
    const cat = catDoc.data();
    for (const modelo of (cat.modelos || [])) {
      if (modelo.marca) {
        marcasEnCategorias.add(modelo.marca);
        totalModelos++;
      }
    }
  }
  console.log(`   ${categoriasSnap.size} categorías, ${totalModelos} modelos con marca`);
  console.log('   Marcas en categorías:', [...marcasEnCategorias].join(', '), '\n');

  // 2. Recorrer todos los sistemas y sus módulos
  console.log('🔍 Leyendo sistemas y módulos...');
  const sistemasSnap = await getDocs(collection(db, 'sistemas'));
  console.log(`   ${sistemasSnap.size} sistemas encontrados\n`);

  let totalModulos = 0;
  const updates = [];

  // Paralelizar lecturas de subcollections en lotes de 50
  const CONCURRENCY = 50;
  const sistemaDocs = sistemasSnap.docs;

  for (let i = 0; i < sistemaDocs.length; i += CONCURRENCY) {
    const chunk = sistemaDocs.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map(async (sistemaDoc) => {
        const sistemaId = sistemaDoc.id;
        const sistemaData = sistemaDoc.data();
        const modulosSnap = await getDocs(collection(db, 'sistemas', sistemaId, 'modulos'));
        return { sistemaId, sistemaData, modulosSnap };
      })
    );

    for (const { sistemaId, sistemaData, modulosSnap } of results) {
      for (const moduloDoc of modulosSnap.docs) {
        totalModulos++;
        const modulo = moduloDoc.data();
        const marca = (modulo.marca || '').trim();

        if (!marca.toLowerCase().includes('agilent')) continue;
        if (marca === 'Agilent Technologies ®') continue;

        updates.push({
          sistemaId,
          moduloId: moduloDoc.id,
          sistemaName: sistemaData.nombre || sistemaData.codigoInternoCliente || sistemaId,
          moduloName: modulo.nombre || '(sin nombre)',
          oldMarca: marca,
          newMarca: 'Agilent Technologies ®',
          serie: modulo.serie || '',
        });
      }
    }
    process.stdout.write(`\r   Procesados ${Math.min(i + CONCURRENCY, sistemaDocs.length)}/${sistemaDocs.length} sistemas...`);
  }
  console.log('');

  console.log(`📊 Resumen:`);
  console.log(`   Total módulos escaneados: ${totalModulos}`);
  console.log(`   Módulos a actualizar: ${updates.length}\n`);

  if (updates.length === 0) {
    console.log('✅ No hay módulos para actualizar.');
    process.exit(0);
  }

  // Mostrar detalle
  console.log('📝 Detalle:');
  for (const u of updates) {
    console.log(`   [${u.sistemaName}] ${u.moduloName} (serie: ${u.serie}): "${u.oldMarca}" → "${u.newMarca}"`);
  }
  console.log('');

  if (DRY_RUN) {
    console.log('🔵 DRY RUN — no se realizaron cambios.');
    process.exit(0);
  }

  // 3. Ejecutar actualizaciones en batches
  console.log('🚀 Ejecutando actualizaciones...');
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = updates.slice(i, i + BATCH_SIZE);

    for (const u of chunk) {
      const ref = doc(db, 'sistemas', u.sistemaId, 'modulos', u.moduloId);
      batch.update(ref, { marca: u.newMarca });
    }

    await batch.commit();
    console.log(`   Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${chunk.length} módulos actualizados`);
  }

  console.log(`\n✅ ${updates.length} módulos actualizados exitosamente.`);
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error:', err.message || err);
  process.exit(1);
});
