/**
 * Backfill de tributos arancelarios desde el catálogo de Posiciones Arancelarias
 * ------------------------------------------------------------------------------
 * Contexto (2026-07-28): hasta el picker de posición arancelaria, el campo del
 * artículo era texto libre y los tributos se tipeaban a mano → hay artículos con
 * posición cargada (ej. 9027.90.90.900G) pero con los gravámenes VACÍOS, aunque
 * el catálogo los tiene. Este script copia el tratamiento del catálogo a esos
 * artículos, matcheando por código SIN puntos y case-insensitive (tolera
 * diferencias de formato, NO typos de dígitos — esos se listan para corregir).
 *
 * Qué hace:
 *  - Lee `posiciones_arancelarias` y arma un índice por código normalizado.
 *  - Recorre `articulos` con `posicionArancelaria` seteada:
 *      · match + tributos vacíos  → plan: copiar tratamiento + normalizar el
 *        código al formato del catálogo.
 *      · match + tributos cargados → NO pisa (salvo FORCE = true).
 *      · sin match en el catálogo  → lo lista (típicamente typo de dígito o
 *        posición que falta cargar en el catálogo).
 *
 * CÓMO USARLO
 *  1. Abrí sistema-modular EN DEV con sesión iniciada: `pnpm dev:modular`.
 *     (Dev pega contra la MISMA Firestore de producción. La app instalada NO
 *     sirve: `window.__ags` solo se expone en dev — ver firebase.ts.)
 *  2. F12 -> Console.
 *  3. Corré `node scripts/backfill-tributos-arancelarios-browser.mjs` para
 *     imprimir el snippet, copialo y pegalo en la consola.
 *  4. Primero corre en DRY-RUN: imprime el plan SIN escribir.
 *  5. Si el plan cierra, cambiá `APPLY = false` por `APPLY = true` y volvé a pegar.
 */

const script = `
(async () => {
  // ── Config ────────────────────────────────────────────────────────────────
  const APPLY = false;   // false = dry-run (no escribe); true = aplica
  const FORCE = false;   // true = pisa también artículos que YA tienen tributos cargados

  const ags = window.__ags;
  if (!ags) { console.error('No existe window.__ags. Corré en DEV (pnpm dev:modular), no la app instalada.'); return; }
  const { db } = ags;
  const { collection, getDocs, doc, writeBatch, Timestamp } = ags.firestore;

  const norm = (c) => String(c || '').replace(/[^0-9a-zA-Z]/g, '').toUpperCase();
  const vacio = (t) => !t || Object.values(t).every(v => v == null);

  // ── 1. Catálogo de posiciones ────────────────────────────────────────────
  const posSnap = await getDocs(collection(db, 'posiciones_arancelarias'));
  const porCodigo = new Map();
  posSnap.docs.forEach(d => {
    const p = d.data();
    if (p.codigo) porCodigo.set(norm(p.codigo), { codigo: p.codigo, tratamiento: p.tratamiento ?? {} });
  });
  console.log('Catálogo:', porCodigo.size, 'posiciones');

  // ── 2. Artículos con posición ────────────────────────────────────────────
  const artSnap = await getDocs(collection(db, 'articulos'));
  const plan = [], yaTienen = [], sinMatch = [], discrepantes = [];
  const CAMPOS = ['derechoImportacion', 'estadistica', 'iva', 'ivaAdicional', 'ganancias', 'ingresosBrutos'];
  const difieren = (a, b) => CAMPOS.filter(k => (a?.[k] ?? null) !== (b?.[k] ?? null));
  artSnap.docs.forEach(d => {
    const a = d.data();
    if (!a.posicionArancelaria) return;
    const cat = porCodigo.get(norm(a.posicionArancelaria));
    if (!cat) { sinMatch.push({ codigo: a.codigo, pa: a.posicionArancelaria }); return; }
    if (!vacio(a.tratamientoArancelario) && !FORCE) {
      yaTienen.push(a.codigo);
      // Tributos cargados a mano ANTES del catálogo: si no coinciden, alguno de
      // los dos está mal y hay que mirarlo. No se pisan (para eso está FORCE),
      // pero quedarse callado los deja mal para siempre.
      const dif = difieren(a.tratamientoArancelario, cat.tratamiento);
      if (dif.length) {
        discrepantes.push({
          articulo: a.codigo, pa: a.posicionArancelaria, campos: dif.join(', '),
          ...Object.fromEntries(dif.map(k => [k, (a.tratamientoArancelario?.[k] ?? '—') + ' vs ' + (cat.tratamiento?.[k] ?? '—')])),
        });
      }
      return;
    }
    plan.push({ id: d.id, codigo: a.codigo, paVieja: a.posicionArancelaria, paNueva: cat.codigo, tratamiento: cat.tratamiento });
  });

  console.log('── PLAN ──');
  console.table(plan.map(p => ({ articulo: p.codigo, pa: p.paVieja + (p.paVieja !== p.paNueva ? ' → ' + p.paNueva : ''), ...p.tratamiento })));
  console.log(plan.length + ' a actualizar · ' + yaTienen.length + ' ya tienen tributos (no se pisan' + (FORCE ? ' — FORCE activo, se pisan' : '') + ') · ' + sinMatch.length + ' sin match en catálogo');
  if (sinMatch.length) { console.warn('SIN MATCH (typos o falta en catálogo):'); console.table(sinMatch); }
  if (discrepantes.length) {
    console.warn('YA TIENEN pero NO COINCIDEN con el catálogo (' + discrepantes.length + ') — revisar cuál está bien:');
    console.table(discrepantes);
    console.warn('Para pisarlos con el catálogo: FORCE = true. Ojo, pisa TODOS los que ya tienen, no solo estos.');
  }

  if (!APPLY) { console.log('DRY-RUN: no se escribió nada. Cambiá APPLY = true para aplicar.'); return; }

  // ── 3. Aplicar en batches de 400 ─────────────────────────────────────────
  for (let i = 0; i < plan.length; i += 400) {
    const batch = writeBatch(db);
    for (const p of plan.slice(i, i + 400)) {
      batch.update(doc(db, 'articulos', p.id), {
        posicionArancelaria: p.paNueva,
        tratamientoArancelario: p.tratamiento,
        updatedAt: Timestamp.now(),
      });
    }
    await batch.commit();
    console.log('Batch', Math.floor(i / 400) + 1, 'OK (' + Math.min(i + 400, plan.length) + '/' + plan.length + ')');
  }
  console.log('✅ Backfill aplicado: ' + plan.length + ' artículo(s). Refrescá la app para ver los cambios.');
})();
`;

console.log(script);
