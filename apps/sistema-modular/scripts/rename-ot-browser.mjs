/**
 * Renombrar una OT (hija) en TODAS las colecciones
 * ---------------------------------------------------------------------------
 * Caso 2026-08-09: al borrar items de la OT 29468 quedaron huecos (.05 y .06
 * vacíos) y el trabajo terminó en la .07. Hay que renombrarla a .05.
 *
 * El número de OT es el DOC ID de `reportes`, y además está desnormalizado en
 * una docena de colecciones. Renombrar = copiar el doc al id nuevo, reescribir
 * todas las referencias, y recién entonces borrar el viejo.
 *
 * Orden deliberado: se crea el destino PRIMERO y se borra el origen AL FINAL.
 * Si algo falla en el medio quedan las dos OTs (revisable), nunca ninguna.
 *
 * Cómo correrlo (ver memory `console_migration_scripts`):
 *   1. `pnpm dev:modular`, loguearse, F12 → Console.
 *   2. Pegar con `APLICAR = false`: verifica precondiciones y lista cada
 *      referencia encontrada, colección por colección.
 *   3. Revisar el listado. Recién ahí `APLICAR = true`.
 */

(async () => {
  const { db, firestore: F } = window.__ags;
  const DESDE = '29468.07';
  const HACIA = '29468.05';
  const APLICAR = false;   // true = escribe

  if (!DESDE.includes('.') || !HACIA.includes('.')) {
    console.error('Solo se renombran HIJAS (con .NN). El padre es un agrupador, no se toca.');
    return;
  }

  // ── Precondiciones ─────────────────────────────────────────────────────────
  const origen = await F.getDoc(F.doc(db, 'reportes', DESDE));
  const destino = await F.getDoc(F.doc(db, 'reportes', HACIA));
  if (!origen.exists()) { console.error(`La OT ${DESDE} no existe.`); return; }
  if (destino.exists()) { console.error(`${HACIA} YA EXISTE — no se pisa. Revisar antes.`); return; }
  const otData = origen.data();
  console.log(`OT ${DESDE} → ${HACIA} | estadoAdmin: ${otData.estadoAdmin} | cliente: ${otData.clienteNombre ?? '—'}`);

  const refs = [];   // {coleccion, docId, campo, antes, despues, _apply}
  const reemplazarEnArray = (arr) => (arr ?? []).map(v => (v === DESDE ? HACIA : v));
  const tieneEnArray = (arr) => (arr ?? []).includes(DESDE);

  // ── Helper: recorre una colección y evalúa un mapper por doc ──────────────
  const barrer = async (coleccion, mapper) => {
    const snap = await F.getDocs(F.collection(db, coleccion));
    for (const d of snap.docs) {
      const patch = mapper(d.data());
      if (patch) refs.push({ coleccion, docId: d.id, ...patch });
    }
  };

  // agendaEntries.otNumber
  await barrer('agendaEntries', (x) => x.otNumber === DESDE
    ? { campo: 'otNumber', antes: DESDE, despues: HACIA, _patch: { otNumber: HACIA } } : null);

  // presupuestos: otVinculadaNumber + otsVinculadasNumbers[] + items[].otNumeroVinculada
  await barrer('presupuestos', (x) => {
    const p = {};
    const det = [];
    if (x.otVinculadaNumber === DESDE) { p.otVinculadaNumber = HACIA; det.push('otVinculadaNumber'); }
    if (tieneEnArray(x.otsVinculadasNumbers)) { p.otsVinculadasNumbers = reemplazarEnArray(x.otsVinculadasNumbers); det.push('otsVinculadasNumbers'); }
    if ((x.items ?? []).some(it => it.otNumeroVinculada === DESDE)) {
      p.items = (x.items ?? []).map(it => it.otNumeroVinculada === DESDE ? { ...it, otNumeroVinculada: HACIA } : it);
      det.push('items[].otNumeroVinculada');
    }
    return det.length ? { campo: det.join(' + '), antes: x.numero, despues: HACIA, _patch: p } : null;
  });

  // solicitudesFacturacion.otNumbers[]
  await barrer('solicitudesFacturacion', (x) => tieneEnArray(x.otNumbers)
    ? { campo: 'otNumbers', antes: x.presupuestoNumero ?? '', despues: HACIA, _patch: { otNumbers: reemplazarEnArray(x.otNumbers) } } : null);

  // remitos: otNumbers[] + items[].otNumber
  await barrer('remitos', (x) => {
    const p = {}; const det = [];
    if (tieneEnArray(x.otNumbers)) { p.otNumbers = reemplazarEnArray(x.otNumbers); det.push('otNumbers'); }
    if ((x.items ?? []).some(it => it.otNumber === DESDE)) {
      p.items = (x.items ?? []).map(it => it.otNumber === DESDE ? { ...it, otNumber: HACIA } : it);
      det.push('items[].otNumber');
    }
    return det.length ? { campo: det.join(' + '), antes: x.numero, despues: HACIA, _patch: p } : null;
  });

  // movimientosStock.otNumber
  await barrer('movimientosStock', (x) => x.otNumber === DESDE
    ? { campo: 'otNumber', antes: x.motivo ?? '', despues: HACIA, _patch: { otNumber: HACIA } } : null);

  // asignaciones: items[].otNumber
  await barrer('asignaciones', (x) => (x.items ?? []).some(it => it.otNumber === DESDE)
    ? { campo: 'items[].otNumber', antes: x.numero ?? '', despues: HACIA,
        _patch: { items: (x.items ?? []).map(it => it.otNumber === DESDE ? { ...it, otNumber: HACIA } : it) } } : null);

  // leads (tickets).otIds[]
  await barrer('leads', (x) => tieneEnArray(x.otIds)
    ? { campo: 'otIds', antes: x.numero ?? '', despues: HACIA, _patch: { otIds: reemplazarEnArray(x.otIds) } } : null);

  // sistemas.otIds[]  (+ subcoleccion modulos SOLO del sistema de esta OT)
  await barrer('sistemas', (x) => tieneEnArray(x.otIds)
    ? { campo: 'otIds', antes: x.nombre ?? '', despues: HACIA, _patch: { otIds: reemplazarEnArray(x.otIds) } } : null);
  if (otData.sistemaId) {
    const mods = await F.getDocs(F.collection(db, 'sistemas', otData.sistemaId, 'modulos'));
    for (const m of mods.docs) {
      if (tieneEnArray(m.data().otIds)) {
        refs.push({ coleccion: `sistemas/${otData.sistemaId}/modulos`, docId: m.id, campo: 'otIds',
          antes: m.data().nombre ?? '', despues: HACIA, _patch: { otIds: reemplazarEnArray(m.data().otIds) } });
      }
    }
  }

  // fichasPropiedad: otIds[] + items[].otAsignada + items[].historial[].otNumber
  await barrer('fichasPropiedad', (x) => {
    const p = {}; const det = [];
    if (tieneEnArray(x.otIds)) { p.otIds = reemplazarEnArray(x.otIds); det.push('otIds'); }
    const tocaItems = (x.items ?? []).some(it =>
      it.otAsignada === DESDE || (it.historial ?? []).some(h => h.otNumber === DESDE));
    if (tocaItems) {
      p.items = (x.items ?? []).map(it => ({
        ...it,
        ...(it.otAsignada === DESDE ? { otAsignada: HACIA } : {}),
        historial: (it.historial ?? []).map(h => h.otNumber === DESDE ? { ...h, otNumber: HACIA } : h),
      }));
      det.push('items[].otAsignada / historial');
    }
    return det.length ? { campo: det.join(' + '), antes: x.numero ?? '', despues: HACIA, _patch: p } : null;
  });

  // loaners: otIds[] + prestamos[].otNumber / .otRecalificacionNumber + extracciones[].otNumber
  await barrer('loaners', (x) => {
    const p = {}; const det = [];
    if (tieneEnArray(x.otIds)) { p.otIds = reemplazarEnArray(x.otIds); det.push('otIds'); }
    if ((x.prestamos ?? []).some(pr => pr.otNumber === DESDE || pr.otRecalificacionNumber === DESDE)) {
      p.prestamos = (x.prestamos ?? []).map(pr => ({
        ...pr,
        ...(pr.otNumber === DESDE ? { otNumber: HACIA } : {}),
        ...(pr.otRecalificacionNumber === DESDE ? { otRecalificacionNumber: HACIA } : {}),
      }));
      det.push('prestamos[]');
    }
    if ((x.extracciones ?? []).some(e => e.otNumber === DESDE)) {
      p.extracciones = (x.extracciones ?? []).map(e => e.otNumber === DESDE ? { ...e, otNumber: HACIA } : e);
      det.push('extracciones[]');
    }
    return det.length ? { campo: det.join(' + '), antes: x.codigo ?? '', despues: HACIA, _patch: p } : null;
  });

  // pendientes: resolucionDocId + resolucionDocLabel ("OT-29468.07")
  await barrer('pendientes', (x) => {
    if (x.resolucionDocType !== 'ot' || x.resolucionDocId !== DESDE) return null;
    return { campo: 'resolucionDocId', antes: x.resolucionDocLabel ?? '', despues: HACIA,
      _patch: { resolucionDocId: HACIA, resolucionDocLabel: `OT-${HACIA}` } };
  });

  console.log(`\n=== Referencias encontradas: ${refs.length}`);
  console.table(refs.map(({ _patch, ...r }) => r));

  if (!APLICAR) { console.warn('\nDRY-RUN — poner APLICAR = true para escribir.'); return; }

  // ── Escritura ──────────────────────────────────────────────────────────────
  // 1) Copiar el doc al id nuevo (el campo otNumber, si existe, se realinea).
  await F.setDoc(F.doc(db, 'reportes', HACIA), { ...otData, ...(otData.otNumber ? { otNumber: HACIA } : {}) });
  console.log(`reportes/${HACIA} creado`);
  // 2) Reescribir referencias.
  for (const r of refs) {
    const path = r.coleccion.split('/');
    await F.updateDoc(F.doc(db, ...path, r.docId), { ...r._patch, updatedAt: F.Timestamp.now() });
  }
  console.log(`${refs.length} referencia(s) reescritas`);
  // 3) Borrar el original.
  await F.deleteDoc(F.doc(db, 'reportes', DESDE));
  console.log(`reportes/${DESDE} eliminado — rename completo.`);
})();
