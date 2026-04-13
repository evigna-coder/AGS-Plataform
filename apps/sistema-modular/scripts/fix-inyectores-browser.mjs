/**
 * Fix inyectores HPLC — ejecutar desde la consola del browser (localhost:3001)
 * donde ya hay sesión autenticada.
 *
 * Copia este código y pegalo en la consola del browser (F12 → Console)
 */

const script = `
(async () => {
  const { getFirestore, collection, getDocs, updateDoc, doc } = await import('https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js');
  // Use the existing Firebase app
  const { getApp } = await import('https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js');
  const app = getApp();
  const db = getFirestore(app);

  const TARGET = ['G1329A','G1329B','G1329C','G7129A','G7129B','G1367A','G1367B','G1367C','G1367D','G1313A','G1367E'];

  // 1. Leer categoría
  console.log('1. Leyendo categorías de módulo...');
  const catSnap = await getDocs(collection(db, 'categorias_modulo'));
  const correctMap = new Map();
  for (const d of catSnap.docs) {
    const data = d.data();
    if ((data.nombre || '').toLowerCase().includes('inyector')) {
      console.log('Categoría:', data.nombre, '- Modelos:', (data.modelos||[]).length);
      for (const m of (data.modelos || [])) {
        const code = (m.codigo || m.nombre || '').trim();
        if (TARGET.includes(code)) {
          correctMap.set(code, { descripcion: (m.descripcion||'').trim(), marca: (m.marca||'').trim() });
        }
      }
    }
  }
  console.log('Descripciones correctas:', Object.fromEntries(correctMap));

  // 2. Buscar módulos en sistemas
  console.log('2. Buscando módulos en sistemas...');
  const sistemasSnap = await getDocs(collection(db, 'sistemas'));
  let updated = 0, checked = 0;
  for (const sDoc of sistemasSnap.docs) {
    const subSnap = await getDocs(collection(db, 'sistemas', sDoc.id, 'modulos'));
    for (const mDoc of subSnap.docs) {
      const data = mDoc.data();
      const nombre = (data.nombre || '').trim();
      if (correctMap.has(nombre)) {
        checked++;
        const correct = correctMap.get(nombre);
        if ((data.descripcion||'').trim() !== correct.descripcion) {
          const upd = { descripcion: correct.descripcion };
          if (correct.marca) upd.marca = correct.marca;
          await updateDoc(doc(db, 'sistemas', sDoc.id, 'modulos', mDoc.id), upd);
          console.log('✓', nombre, 'en sistema', sDoc.id, ':', data.descripcion, '→', correct.descripcion);
          updated++;
        }
      }
    }
  }
  console.log('✅ Done:', updated, 'actualizados de', checked, 'encontrados');
})();
`;

console.log('=== Copiá y pegá este código en la consola del browser (F12) en localhost:3001 ===\n');
console.log(script);
