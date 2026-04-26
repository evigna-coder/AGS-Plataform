/**
 * Agrega el modelo "GC HSS HTA 6890 / HT2800T" al campo `modelos` de todas las tablas
 * que pertenecen a los 3 proyectos:
 *   - "Calibración GC sin MSD"
 *   - "Calificación de operación GC 6850/90/7890/8860"
 *   - "Mantenimiento preventivo GC"
 *
 * Conserva los modelos ya presentes (union, sin duplicar).
 *
 * Requisitos:
 *   - sistema-modular corriendo en localhost:3001 con sesión iniciada.
 *   - `firebase.ts` expone `window.__ags` en dev.
 *   - El modelo "GC HSS HTA 6890 / HT2800T" ya debe existir como categoría/modelo
 *     en categorias_equipo si querés que aparezca tildado en el picker visual.
 *     Si no existe, este script lo escribe igual en `modelos[]` pero el picker
 *     no lo va a mostrar.
 *
 * Uso:
 *   1. node apps/sistema-modular/scripts/add-modelo-gc-hss-hta-browser.mjs
 *   2. Pegar snippet en consola (F12) en localhost:3001.
 *   3. DRY_RUN = true → revisar plan; cambiar a false para aplicar.
 */

const script = `
(async () => {
  const DRY_RUN = true; // ← cambiar a false para escribir

  const ags = window.__ags;
  if (!ags) {
    console.error('✗ window.__ags no está expuesto. ¿Estás en dev mode (localhost:3001)?');
    return;
  }
  const { db } = ags;
  const { collection, getDocs, updateDoc, doc, Timestamp } = ags.firestore;

  const PROJECT_NAMES = [
    'Calibración GC sin MSD',
    'Calificación de operación GC 6850/90/7890/8860',
    'Mantenimiento preventivo GC',
  ];

  const MODELS_TO_ADD = [
    'GC HSS HTA 6890 / HT2800T',
  ];

  const norm = s => (s || '')
    .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
    .toLowerCase().replace(/\\s+/g, ' ').trim();

  const targetNorms = new Set(PROJECT_NAMES.map(norm));

  console.log('1. Buscando proyectos...');
  const projSnap = await getDocs(collection(db, 'tableProjects'));
  const matchedProjects = [];
  for (const d of projSnap.docs) {
    const data = d.data();
    if (targetNorms.has(norm(data.name))) {
      matchedProjects.push({ id: d.id, name: data.name });
    }
  }
  console.log('   Proyectos encontrados:', matchedProjects);

  if (matchedProjects.length !== PROJECT_NAMES.length) {
    const found = new Set(matchedProjects.map(p => norm(p.name)));
    const missing = PROJECT_NAMES.filter(n => !found.has(norm(n)));
    console.warn('   ⚠ NO se encontraron estos proyectos:', missing);
  }
  if (matchedProjects.length === 0) {
    console.error('   ✗ Sin proyectos. Abortando.');
    return;
  }

  console.log('2. Leyendo tableCatalog...');
  const tablesSnap = await getDocs(collection(db, 'tableCatalog'));
  const projectIds = new Set(matchedProjects.map(p => p.id));
  const projectNameById = new Map(matchedProjects.map(p => [p.id, p.name]));

  const candidates = [];
  for (const d of tablesSnap.docs) {
    const data = d.data();
    if (data.projectId && projectIds.has(data.projectId)) {
      candidates.push({ id: d.id, ...data });
    }
  }
  console.log('   Tablas en esos 3 proyectos:', candidates.length);

  let toUpdate = 0, alreadyOk = 0;
  const plan = [];
  for (const t of candidates) {
    const current = Array.isArray(t.modelos) ? t.modelos : [];
    const set = new Set(current);
    const before = set.size;
    for (const m of MODELS_TO_ADD) set.add(m);
    if (set.size === before) {
      alreadyOk++;
      continue;
    }
    const next = Array.from(set);
    plan.push({
      id: t.id,
      project: projectNameById.get(t.projectId),
      name: t.name,
      sysType: t.sysType,
      added: MODELS_TO_ADD.filter(m => !current.includes(m)),
      modelosBefore: current,
      modelosAfter: next,
    });
    toUpdate++;
  }

  console.log('3. Plan:');
  console.log('   Tablas que ya tenían el modelo:', alreadyOk);
  console.log('   Tablas a actualizar:', toUpdate);
  console.table(plan.map(p => ({
    proyecto: p.project,
    tabla: p.name,
    sysType: p.sysType,
    agregar: p.added.join(', '),
    modelosAntes: p.modelosBefore.length,
    modelosDespues: p.modelosAfter.length,
  })));

  if (DRY_RUN) {
    console.log('🔎 DRY_RUN = true. No se escribió nada. Cambiá DRY_RUN a false y re-ejecutá.');
    return;
  }

  console.log('4. Escribiendo cambios...');
  let written = 0;
  for (const p of plan) {
    await updateDoc(doc(db, 'tableCatalog', p.id), {
      modelos: p.modelosAfter,
      updatedAt: Timestamp.now(),
    });
    written++;
    console.log('   ✓', p.project, '·', p.name, '→ +' + p.added.length, 'modelo(s)');
  }
  console.log('✅ Done. ' + written + ' tabla(s) actualizadas.');
})();
`;

console.log('=== Pegá este código en la consola del browser (F12) en localhost:3001 ===\n');
console.log(script);
