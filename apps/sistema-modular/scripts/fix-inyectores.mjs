/**
 * Fix inyectores HPLC: lee las descripciones correctas de la categoría de módulo
 * "Inyector automático" y actualiza todos los módulos en sistemas que tengan esos códigos.
 *
 * Usage: node scripts/fix-inyectores.mjs
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, getDocs, query, where, updateDoc, doc, writeBatch,
} from 'firebase/firestore';

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

const TARGET_CODIGOS = ['G1329A', 'G1329B', 'G1329C', 'G7129A', 'G7129B', 'G1367A', 'G1367B', 'G1367C', 'G1367D', 'G1313A', 'G1367E'];

async function main() {
  console.log('\n🔧 Fix inyectores HPLC\n');

  // 1. Read correct descriptions from categoría de módulo "Inyector automático"
  console.log('1. Leyendo categoría "Inyector automático"...');
  const catSnap = await getDocs(collection(db, 'categoriasModulo'));
  let correctMap = new Map(); // codigo → { descripcion, marca }

  for (const d of catSnap.docs) {
    const data = d.data();
    const nombre = (data.nombre || '').toLowerCase();
    if (nombre.includes('inyector') && nombre.includes('auto')) {
      console.log(`   Encontrada: "${data.nombre}" (${(data.modelos || []).length} modelos)`);
      for (const modelo of (data.modelos || [])) {
        const codigo = (modelo.codigo || modelo.nombre || '').trim();
        if (TARGET_CODIGOS.includes(codigo)) {
          correctMap.set(codigo, {
            descripcion: (modelo.descripcion || '').trim(),
            marca: (modelo.marca || '').trim(),
          });
        }
      }
    }
  }

  if (correctMap.size === 0) {
    console.log('\n❌ No se encontraron modelos en la categoría. Verificá el nombre.');
    process.exit(1);
  }

  console.log(`\n   Descripciones correctas encontradas:`);
  for (const [codigo, info] of correctMap) {
    console.log(`   ${codigo} → "${info.descripcion}"${info.marca ? ` (${info.marca})` : ''}`);
  }

  // 2. Find all módulos in sistemas that have these códigos
  console.log('\n2. Buscando módulos en sistemas...');
  const modulosSnap = await getDocs(collection(db, 'modulos'));
  const toUpdate = [];

  for (const d of modulosSnap.docs) {
    const data = d.data();
    const nombre = (data.nombre || '').trim();
    if (correctMap.has(nombre)) {
      const correct = correctMap.get(nombre);
      const currentDesc = (data.descripcion || '').trim();
      if (currentDesc !== correct.descripcion) {
        toUpdate.push({
          id: d.id,
          sistemaId: data.sistemaId || '?',
          codigo: nombre,
          oldDesc: currentDesc,
          newDesc: correct.descripcion,
          marca: correct.marca,
        });
      }
    }
  }

  // Also check subcolección modulos inside sistemas
  const sistemasSnap = await getDocs(collection(db, 'sistemas'));
  for (const sDoc of sistemasSnap.docs) {
    try {
      const subModSnap = await getDocs(collection(db, 'sistemas', sDoc.id, 'modulos'));
      for (const mDoc of subModSnap.docs) {
        const data = mDoc.data();
        const nombre = (data.nombre || '').trim();
        if (correctMap.has(nombre)) {
          const correct = correctMap.get(nombre);
          const currentDesc = (data.descripcion || '').trim();
          if (currentDesc !== correct.descripcion) {
            toUpdate.push({
              id: `sistemas/${sDoc.id}/modulos/${mDoc.id}`,
              sistemaId: sDoc.id,
              codigo: nombre,
              oldDesc: currentDesc,
              newDesc: correct.descripcion,
              marca: correct.marca,
              isSubcollection: true,
              parentId: sDoc.id,
              subDocId: mDoc.id,
            });
          }
        }
      }
    } catch (e) {
      // No subcollection — skip
    }
  }

  if (toUpdate.length === 0) {
    console.log('\n✅ Todos los módulos ya tienen las descripciones correctas.');
    process.exit(0);
  }

  console.log(`\n   ${toUpdate.length} módulo(s) a actualizar:\n`);
  for (const item of toUpdate) {
    console.log(`   ${item.codigo} (${item.id})`);
    console.log(`     Antes:  "${item.oldDesc}"`);
    console.log(`     Ahora:  "${item.newDesc}"`);
    console.log('');
  }

  // 3. Apply updates
  console.log('3. Aplicando actualizaciones...');
  let updated = 0;

  for (const item of toUpdate) {
    try {
      const updateData = { descripcion: item.newDesc };
      if (item.marca) updateData.marca = item.marca;

      if (item.isSubcollection) {
        await updateDoc(doc(db, 'sistemas', item.parentId, 'modulos', item.subDocId), updateData);
      } else {
        await updateDoc(doc(db, 'modulos', item.id), updateData);
      }
      updated++;
      console.log(`   ✓ ${item.codigo} actualizado`);
    } catch (e) {
      console.log(`   ✗ ${item.codigo} ERROR: ${e.message}`);
    }
  }

  console.log(`\n✅ ${updated}/${toUpdate.length} módulos actualizados.\n`);
  process.exit(0);
}

main();
