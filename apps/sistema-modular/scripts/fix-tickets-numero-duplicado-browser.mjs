/**
 * Fix de números de ticket duplicados + resync del counter `_counters/tickets`
 * ---------------------------------------------------------------------------
 * Contexto: el portal-ingeniero generaba números con scan-and-max NO
 * transaccional, sin tocar `_counters/tickets`. Eso desincronizó el portal de
 * sistema-modular y produjo números repetidos (ej. dos TKT-00164). El bug de
 * generación ya está arreglado en código (portal usa el counter atómico). Este
 * script limpia los datos que YA quedaron duplicados y deja el counter alineado.
 *
 * Qué hace:
 *  - Detecta TODOS los grupos de `leads` con el mismo `numero` (no solo 164).
 *  - Por cada grupo: conserva el ticket creado PRIMERO con su número original y
 *    renumera el/los posteriores a números frescos por encima del máximo global.
 *  - Deja `_counters/tickets.value` en el máximo real, para que el próximo
 *    ticket (cualquier app) siga desde ahí sin volver a chocar.
 *
 * OJO: `numero` es el correlativo visible (TKT-NNNNN). Los vínculos a OTs y
 * presupuestos NO usan `numero` (usan doc id / otIds / presupuestosIds), así que
 * renumerar es seguro para las relaciones. Lo único que cambia es el número que
 * ve el usuario en el ticket renumerado.
 *
 * CÓMO USARLO
 *  1. Abrí sistema-modular EN DEV con sesión iniciada: `pnpm dev:modular`.
 *     (Dev pega contra la MISMA Firestore de producción. La app instalada NO
 *     sirve: `window.__ags` solo se expone en dev — ver firebase.ts.)
 *  2. F12 -> Console.
 *  3. Corré `node scripts/fix-tickets-numero-duplicado-browser.mjs` para imprimir
 *     el snippet, copialo y pegalo en la consola.
 *  4. Primero corre en DRY-RUN: lista duplicados y el plan SIN escribir.
 *  5. Si el plan te cierra, cambiá `APPLY = false` por `APPLY = true` y volvé a
 *     pegar para aplicar.
 */

const script = `
(async () => {
  // ── Config ────────────────────────────────────────────────────────────────
  const APPLY = false;   // false = dry-run (no escribe); true = aplica los cambios

  // Reusa la instancia de Firestore YA autenticada que la app expone en dev.
  const ags = window.__ags;
  if (!ags) { console.error('No existe window.__ags. Corré en DEV (pnpm dev:modular), no la app instalada.'); return; }
  const { db } = ags;
  const { collection, getDocs, updateDoc, doc, getDoc, setDoc, Timestamp } = ags.firestore;

  const extractNum = (numero) => {
    if (typeof numero !== 'string') return 0;
    const m = numero.match(/TKT-(\\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  };
  const fmt = (n) => 'TKT-' + String(n).padStart(5, '0');
  const toMillis = (ts) => {
    if (!ts) return 0;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (typeof ts.toDate === 'function') return ts.toDate().getTime();
    const d = new Date(ts); return isNaN(d) ? 0 : d.getTime();
  };

  // ── 1. Leer todos los leads/tickets ─────────────────────────────────────────
  const snap = await getDocs(collection(db, 'leads'));
  const docs = snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      numero: data.numero,
      num: extractNum(data.numero),
      createdMs: toMillis(data.createdAt),
      razonSocial: data.razonSocial || data.contacto || '(sin razón social)',
      estado: data.estado || '-',
    };
  });
  console.log('Total de tickets:', docs.length);

  let globalMax = 0;
  for (const d of docs) if (d.num > globalMax) globalMax = d.num;

  // ── 2. Agrupar por numero y detectar duplicados ─────────────────────────────
  const groups = new Map();
  for (const d of docs) {
    if (!d.num) continue; // legacy sin numero válido: ignorar
    if (!groups.has(d.num)) groups.set(d.num, []);
    groups.get(d.num).push(d);
  }
  const dups = [...groups.entries()].filter(([, arr]) => arr.length > 1).sort((a, b) => a[0] - b[0]);

  if (dups.length === 0) {
    console.log('✅ No hay números de ticket duplicados.');
  } else {
    console.log('⚠️ Grupos duplicados encontrados:', dups.length);
  }

  // ── 3. Armar plan de renumeración ───────────────────────────────────────────
  // Por grupo: el más viejo (menor createdAt) conserva su número; el resto se
  // reasigna a números nuevos por encima del máximo global.
  let nextFree = globalMax;
  const plan = [];
  for (const [num, arr] of dups) {
    const sorted = [...arr].sort((a, b) => a.createdMs - b.createdMs);
    const keep = sorted[0];
    const reassign = sorted.slice(1);
    console.log('\\n— ' + fmt(num) + ' (x' + arr.length + ')');
    console.log('   CONSERVA:', keep.id, '|', keep.razonSocial, '|', keep.estado,
      '| creado', keep.createdMs ? new Date(keep.createdMs).toLocaleString() : '?');
    for (const r of reassign) {
      nextFree += 1;
      plan.push({ id: r.id, from: r.numero, to: fmt(nextFree) });
      console.log('   RENUMERA:', r.id, '|', r.razonSocial, '|', r.estado,
        '| creado', r.createdMs ? new Date(r.createdMs).toLocaleString() : '?',
        '→', r.numero, '➜', fmt(nextFree));
    }
  }

  const finalMax = Math.max(globalMax, nextFree);

  // ── 4. Estado del counter ───────────────────────────────────────────────────
  const counterRef = doc(db, '_counters', 'tickets');
  const counterSnap = await getDoc(counterRef);
  const counterVal = counterSnap.exists() ? counterSnap.data().value : '(no existe)';
  console.log('\\n_counters/tickets actual:', counterVal, '| máx real en leads:', globalMax,
    '| quedará en:', finalMax);

  // ── 5. Aplicar ──────────────────────────────────────────────────────────────
  if (!APPLY) {
    console.log('\\n🔸 DRY-RUN. Nada escrito. Poné APPLY = true para aplicar (' + plan.length + ' renumeraciones + counter).');
    return;
  }

  for (const p of plan) {
    await updateDoc(doc(db, 'leads', p.id), { numero: p.to, updatedAt: Timestamp.now() });
    console.log('✓ renumerado', p.id, p.from, '→', p.to);
  }
  await setDoc(counterRef, { value: finalMax, updatedAt: Timestamp.now() }, { merge: true });
  console.log('✓ _counters/tickets = ' + finalMax);
  console.log('\\n✅ Listo:', plan.length, 'tickets renumerados, counter alineado.');
})();
`;

console.log('=== Copiá y pegá este código en la consola del browser (F12) en sistema-modular dev ===\n');
console.log(script);
