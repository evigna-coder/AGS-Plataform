/**
 * Backfill OT padre → hija
 * ---------------------------------------------------------------------------
 * Regla (2026-08-09): la OT padre (`29994`) es SOLO un agrupador visual. El
 * trabajo, los vínculos y los estados viven en las hijas (`29994.01`).
 *
 * El código ya está arreglado (`useCreateOTForm` estampa la hija;
 * `PresupuestoOTsVinculadas` usa el join con herencia; `sincronizarPadreConHijas`
 * espeja el estado). Este script limpia lo que YA quedó mal:
 *
 *   PARTE A — Presupuestos que apuntan al padre:
 *     · `otsVinculadasNumbers`: reemplaza cada padre por TODAS sus hijas.
 *     · `otVinculadaNumber` (legacy singular) y `items[].otNumeroVinculada`:
 *       solo se reescriben si el padre tiene UNA sola hija. Con varias, la
 *       elección es ambigua → se reporta para revisión manual, no se adivina.
 *
 *   PARTE B — Padres con el estado desactualizado:
 *     · El padre toma el estado MENOS avanzado de sus hijas (el grupo no está
 *       cerrado hasta que cierra la última). Mismo criterio que el service.
 *     · SOLO AVANZA: un padre ya coordinado / en curso NO retrocede porque una
 *       hija esté atrasada. Se trata de destrabar los que quedaron en CREADA,
 *       no de reescribir OTs en curso.
 *
 * Cómo correrlo (ver memory `console_migration_scripts`):
 *   1. `pnpm dev:modular` — dev pega contra la MISMA Firestore de prod.
 *   2. Loguearse, F12 → Console, pegar desde el `(async () => {`.
 *   3. Primero con `APLICAR = false`: imprime las dos tablas. Revisar sobre todo
 *      las filas 'AMBIGUO' de la Parte A.
 *   4. Recién ahí `APLICAR = true` y volver a pegar.
 *
 * `updatedAt` va como `Timestamp.now()` en las dos colecciones — es la
 * convención del repo; un ISO string rompe los reads que hacen `.toDate()`.
 */

(async () => {
  const { db, firestore: F } = window.__ags;
  const APLICAR = false;   // true = escribe

  const ORDEN = ['CREADA', 'ASIGNADA', 'COORDINADA', 'EN_CURSO', 'CIERRE_TECNICO', 'CIERRE_ADMINISTRATIVO', 'FINALIZADO'];

  // ── Universo de OTs ────────────────────────────────────────────────────────
  const otsSnap = await F.getDocs(F.collection(db, 'reportes'));
  const ots = otsSnap.docs.map(d => ({ otNumber: d.id, ...d.data() }));
  const hijasDe = new Map();          // padre → [hijas]
  for (const o of ots) {
    if (!o.otNumber.includes('.')) continue;
    const p = o.otNumber.split('.')[0];
    hijasDe.set(p, [...(hijasDe.get(p) ?? []), o]);
  }
  console.log(`OTs totales: ${ots.length} · padres con hijas: ${hijasDe.size}`);

  // ── PARTE A — presupuestos apuntando al padre ─────────────────────────────
  const pptosSnap = await F.getDocs(F.collection(db, 'presupuestos'));
  const accionesA = [];

  for (const d of pptosSnap.docs) {
    const p = d.data();
    const lista = [...(p.otsVinculadasNumbers ?? [])];
    const padresEnLista = lista.filter(n => n && !n.includes('.') && hijasDe.has(n));
    const singularEsPadre = p.otVinculadaNumber && !p.otVinculadaNumber.includes('.') && hijasDe.has(p.otVinculadaNumber);
    const itemsPadre = (p.items ?? []).filter(it =>
      it.otNumeroVinculada && !it.otNumeroVinculada.includes('.') && hijasDe.has(it.otNumeroVinculada));
    if (padresEnLista.length === 0 && !singularEsPadre && itemsPadre.length === 0) continue;

    // Array: cada padre se reemplaza por todas sus hijas (igual que el join).
    const nuevaLista = [];
    for (const n of lista) {
      if (padresEnLista.includes(n)) nuevaLista.push(...hijasDe.get(n).map(h => h.otNumber));
      else nuevaLista.push(n);
    }
    const listaFinal = [...new Set(nuevaLista)].sort();

    // Singular + items: solo si el padre tiene UNA hija.
    const unicaHija = (padre) => {
      const hs = hijasDe.get(padre) ?? [];
      return hs.length === 1 ? hs[0].otNumber : null;
    };
    let nuevoSingular = p.otVinculadaNumber ?? null;
    let ambiguo = [];
    if (singularEsPadre) {
      const h = unicaHija(p.otVinculadaNumber);
      if (h) nuevoSingular = h;
      else ambiguo.push(`otVinculadaNumber=${p.otVinculadaNumber} (${hijasDe.get(p.otVinculadaNumber).length} hijas)`);
    }
    let itemsCambiados = 0;
    const nuevosItems = (p.items ?? []).map(it => {
      if (!it.otNumeroVinculada || it.otNumeroVinculada.includes('.') || !hijasDe.has(it.otNumeroVinculada)) return it;
      const h = unicaHija(it.otNumeroVinculada);
      if (!h) { ambiguo.push(`item ${it.descripcion ?? it.id}: OT ${it.otNumeroVinculada}`); return it; }
      itemsCambiados++;
      return { ...it, otNumeroVinculada: h };
    });

    accionesA.push({
      ppto: p.numero, estado: p.estado,
      listaAntes: (p.otsVinculadasNumbers ?? []).join(', ') || '—',
      listaDespues: listaFinal.join(', ') || '—',
      singularAntes: p.otVinculadaNumber ?? '—',
      singularDespues: nuevoSingular ?? '—',
      itemsCambiados,
      ambiguo: ambiguo.length ? `AMBIGUO: ${ambiguo.join(' | ')}` : '',
      _id: d.id, _payload: { otsVinculadasNumbers: listaFinal, otVinculadaNumber: nuevoSingular, items: nuevosItems },
    });
  }

  console.log(`\n=== PARTE A — presupuestos que apuntan al padre: ${accionesA.length}`);
  console.table(accionesA.map(({ _id, _payload, ...row }) => row));
  const ambiguos = accionesA.filter(a => a.ambiguo);
  if (ambiguos.length) console.warn(`${ambiguos.length} presupuesto(s) con padres de MÚLTIPLES hijas — el singular/los items quedan como están, revisalos a mano.`);

  // ── PARTE B — padres con estado desactualizado ────────────────────────────
  const accionesB = [];
  for (const [padreNum, hijas] of hijasDe) {
    const padre = ots.find(o => o.otNumber === padreNum);
    if (!padre) continue;
    let menor = ORDEN.length - 1;
    for (const h of hijas) {
      const i = ORDEN.indexOf(h.estadoAdmin ?? 'CREADA');
      if (i >= 0 && i < menor) menor = i;
    }
    const objetivo = ORDEN[menor];
    // SOLO AVANZA: un padre ya coordinado/en curso no retrocede porque una hija
    // esté atrasada. El objetivo es destrabar los que quedaron en CREADA.
    const actualIdx = ORDEN.indexOf(padre.estadoAdmin ?? 'CREADA');
    if (actualIdx >= menor) continue;
    accionesB.push({
      padre: padreNum, antes: padre.estadoAdmin ?? '(sin estado)', despues: objetivo,
      hijas: hijas.map(h => `${h.otNumber}:${h.estadoAdmin ?? '?'}`).join(', '),
    });
  }
  console.log(`\n=== PARTE B — padres a sincronizar: ${accionesB.length}`);
  console.table(accionesB);

  // ── Escritura ──────────────────────────────────────────────────────────────
  if (!APLICAR) {
    console.warn('\nDRY-RUN — poner APLICAR = true para escribir.');
    return;
  }
  for (const a of accionesA) {
    await F.updateDoc(F.doc(db, 'presupuestos', a._id), {
      ...a._payload,
      updatedAt: F.Timestamp.now(),
    });
  }
  for (const b of accionesB) {
    await F.updateDoc(F.doc(db, 'reportes', b.padre), {
      estadoAdmin: b.despues,
      estadoAdminFecha: new Date().toISOString(),
      updatedAt: F.Timestamp.now(),
    });
  }
  console.log(`\nListo: ${accionesA.length} presupuesto(s) y ${accionesB.length} padre(s) actualizados.`);
})();
