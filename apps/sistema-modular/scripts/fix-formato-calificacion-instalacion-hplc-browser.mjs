/**
 * Fix formato del proyecto "Calificación de instalación HPLC" (biblioteca de tablas)
 * ---------------------------------------------------------------------------------
 * Limpia el HTML de `textContent` de las tablas tipo `text` de ese proyecto:
 * saca color / fuente / tamaño / clases / links pegados desde Word o web, dejando
 * solo la estructura (párrafos, listas, negrita/cursiva/subrayado). Así el texto
 * vuelve a heredar el formato por defecto del protocolo.
 *
 * CÓMO USARLO
 *  1. Abrí sistema-modular EN DEV con sesión iniciada: `pnpm dev:modular`.
 *     (Dev pega contra la MISMA Firestore de producción. La app instalada NO
 *     sirve: `window.__ags` solo se expone en dev — ver firebase.ts.)
 *  2. F12 -> Console.
 *  3. Corré `node scripts/fix-formato-calificacion-instalacion-hplc-browser.mjs`
 *     para imprimir el snippet, copialo y pegalo en la consola.
 *  4. Primero corre en DRY-RUN: imprime antes/después de cada tabla SIN escribir.
 *  5. Si te gusta el resultado, cambiá `APPLY = false` por `APPLY = true` y volvé
 *     a pegar para aplicar.
 */

const script = `
(async () => {
  // ── Config ────────────────────────────────────────────────────────────────
  const APPLY = false;                       // false = dry-run; true = escribe en Firestore
  const PROJECT_MATCH = 'instalacion hplc';  // substring (lowercase, sin tildes) del nombre del proyecto
  const KEEP_BOLD_ITALIC = true;             // true = conserva negrita/cursiva/subrayado; false = texto 100% plano

  // Reusa la instancia de Firestore YA autenticada que la app expone en dev.
  const ags = window.__ags;
  if (!ags) { console.error('No existe window.__ags. Corré en DEV (pnpm dev:modular), no la app instalada.'); return; }
  const { db } = ags;
  const { collection, getDocs, updateDoc, doc, Timestamp } = ags.firestore;

  const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');

  // ── 1. Encontrar el proyecto ────────────────────────────────────────────────
  const projSnap = await getDocs(collection(db, 'tableProjects'));
  const projects = projSnap.docs
    .map(d => ({ id: d.id, name: d.data().name || '' }))
    .filter(p => norm(p.name).includes(PROJECT_MATCH));
  if (projects.length === 0) { console.error('No encontré proyecto con nombre que contenga:', PROJECT_MATCH); return; }
  if (projects.length > 1) console.warn('Varios proyectos matchean — se procesan todos:', projects.map(p => p.name));
  const projectIds = new Set(projects.map(p => p.id));
  console.log('Proyecto(s):', projects.map(p => p.name + ' (' + p.id + ')').join(', '));

  // ── 2. Cleaner de HTML ───────────────────────────────────────────────────────
  const KEEP = new Set(['P','BR','UL','OL','LI','DIV', ...(KEEP_BOLD_ITALIC ? ['B','STRONG','I','EM','U'] : [])]);
  const STRIP_ATTRS = ['style','class','color','face','size','align','bgcolor','width','height','dir','lang'];
  function clean(html) {
    const wrap = document.createElement('div');
    wrap.innerHTML = html || '';
    (function walk(node) {
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === 3) {               // texto: colapsa espacios + nbsp del pegado de Word
          child.nodeValue = child.nodeValue.replace(/\\s+/g, ' ');
          continue;
        }
        if (child.nodeType !== 1) continue;       // sólo elementos
        walk(child);                              // limpiar descendientes primero
        if (KEEP.has(child.tagName)) {
          STRIP_ATTRS.forEach(a => child.removeAttribute(a));
          // descartar bloques vacíos (p/div sin texto ni listas/br) que dejan huecos
          if ((child.tagName === 'P' || child.tagName === 'DIV') && !child.textContent.trim() && !child.querySelector('ul,ol,li,br')) {
            node.removeChild(child);
          }
        } else {                                   // FONT / SPAN / A / Word junk -> desenvolver
          while (child.firstChild) node.insertBefore(child.firstChild, child);
          node.removeChild(child);
        }
      }
    })(wrap);
    return wrap.innerHTML.replace(/>\\s+</g, '><').trim();
  }

  // ── 3. Procesar tablas de texto del proyecto ─────────────────────────────────
  const catSnap = await getDocs(collection(db, 'tableCatalog'));
  const targets = catSnap.docs.filter(d => projectIds.has(d.data().projectId) && d.data().tableType === 'text');
  let changed = 0, skipped = 0, pending = 0;
  for (const d of targets) {
    const t = d.data();
    const before = t.textContent || '';
    const after = clean(before);
    if (after === before) { skipped++; continue; }
    pending++;
    console.log('\\n-- ' + t.name + ' (' + d.id + ')');
    console.log('   ANTES :', before.slice(0, 240));
    console.log('   DESPUES:', after.slice(0, 240));
    if (APPLY) {
      await updateDoc(doc(db, 'tableCatalog', d.id), { textContent: after, updatedAt: Timestamp.now().toDate().toISOString() });
      changed++;
    }
  }

  console.log('\\n' + (APPLY ? 'APLICADO' : 'DRY-RUN (no se escribió nada)'));
  console.log('   Tablas de texto en el proyecto:', targets.length);
  console.log(APPLY ? '   Tablas actualizadas: ' + changed : '   Tablas que cambiarían: ' + pending);
  console.log('   Tablas ya limpias / sin cambios:', skipped);
  if (!APPLY && pending > 0) console.log('   -> Si el resultado te convence, poné APPLY = true y volvé a pegar.');
})();
`;

console.log('=== Pegá este código en la consola (F12) de sistema-modular EN DEV con sesión iniciada ===\n');
console.log(script);
