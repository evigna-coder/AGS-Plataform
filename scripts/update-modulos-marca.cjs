/**
 * Script: Actualizar marca de módulos según categorías
 *
 * Lee las categorías de módulos (categorias_modulo) y construye un mapa
 * codigo → marca desde los modelos. Luego recorre todos los módulos
 * en sistemas/{id}/modulos y actualiza la marca si:
 *   - El módulo tiene marca "Agilent" (case-insensitive)
 *   - El nombre del módulo matchea con un código de modelo en las categorías
 *
 * Uso:
 *   node scripts/update-modulos-marca.cjs [--dry-run]
 *
 * Requiere: scripts/serviceAccountKey.json
 */

const admin = require('./node_modules/firebase-admin');
const path = require('path');
const fs = require('fs');

// ── Config ──────────────────────────────────────────────────────────────────
const SA_KEY_PATH = path.resolve(__dirname, 'serviceAccountKey.json');
const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 400;

// ── Init Firebase Admin ─────────────────────────────────────────────────────
if (DRY_RUN) {
  console.log('🔵 DRY RUN — no se escribirá nada en Firestore\n');
}

if (!fs.existsSync(SA_KEY_PATH)) {
  console.error('❌ No se encontró serviceAccountKey.json en scripts/');
  process.exit(1);
}

const serviceAccount = require(SA_KEY_PATH);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Leer todas las categorías de módulos
  console.log('📚 Leyendo categorías de módulos...');
  const categoriasSnap = await db.collection('categorias_modulo').get();

  // Construir mapa: codigo (lowercase) → marca
  // Esto nos permite matchear por el código del modelo (ej: G1311A)
  const codigoToMarca = new Map();
  let totalModelos = 0;

  for (const doc of categoriasSnap.docs) {
    const cat = doc.data();
    const modelos = cat.modelos || [];
    for (const modelo of modelos) {
      if (modelo.codigo && modelo.marca) {
        codigoToMarca.set(modelo.codigo.toLowerCase().trim(), modelo.marca);
        totalModelos++;
      }
    }
  }

  console.log(`   ${categoriasSnap.size} categorías, ${totalModelos} modelos con marca\n`);

  // Mostrar las marcas únicas en categorías para referencia
  const marcasUnicas = new Set(codigoToMarca.values());
  console.log('   Marcas en categorías:', [...marcasUnicas].join(', '));
  console.log('');

  // 2. Leer todos los sistemas
  console.log('🔍 Leyendo sistemas y sus módulos...');
  const sistemasSnap = await db.collection('sistemas').get();
  console.log(`   ${sistemasSnap.size} sistemas encontrados\n`);

  let totalModulos = 0;
  let modulosAgilent = 0;
  let modulosActualizados = 0;
  let modulosSinMatch = [];
  const updates = []; // { sistemaId, moduloId, oldMarca, newMarca, nombre }

  for (const sistemaDoc of sistemasSnap.docs) {
    const sistemaId = sistemaDoc.id;
    const sistemaData = sistemaDoc.data();
    const modulosSnap = await db.collection('sistemas').doc(sistemaId).collection('modulos').get();

    for (const moduloDoc of modulosSnap.docs) {
      totalModulos++;
      const modulo = moduloDoc.data();
      const marca = (modulo.marca || '').trim();

      // Solo nos interesan los que tienen marca "Agilent" (exacta o variaciones)
      if (!marca.toLowerCase().includes('agilent')) continue;

      // Ya tiene la marca correcta
      if (marca === 'Agilent Technologies ®') continue;

      modulosAgilent++;

      // Simplemente actualizar a "Agilent Technologies ®"
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

  console.log(`📊 Resumen:`);
  console.log(`   Total módulos: ${totalModulos}`);
  console.log(`   Módulos con marca Agilent: ${modulosAgilent}`);
  console.log(`   Módulos a actualizar: ${updates.length}\n`);

  if (updates.length === 0) {
    console.log('✅ No hay módulos para actualizar.');
    return;
  }

  // Mostrar detalle
  console.log('📝 Detalle de actualizaciones:');
  for (const u of updates) {
    console.log(`   [${u.sistemaName}] ${u.moduloName} (serie: ${u.serie}): "${u.oldMarca}" → "${u.newMarca}"`);
  }
  console.log('');

  // 3. Ejecutar actualizaciones en batches
  if (DRY_RUN) {
    console.log('🔵 DRY RUN — no se realizaron cambios.');
    return;
  }

  console.log('🚀 Ejecutando actualizaciones...');
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = updates.slice(i, i + BATCH_SIZE);

    for (const u of chunk) {
      const ref = db.collection('sistemas').doc(u.sistemaId).collection('modulos').doc(u.moduloId);
      batch.update(ref, { marca: u.newMarca });
    }

    await batch.commit();
    console.log(`   Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${chunk.length} módulos actualizados`);
  }

  console.log(`\n✅ ${updates.length} módulos actualizados exitosamente.`);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
