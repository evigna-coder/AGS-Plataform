import { collection, getDocs, doc, getDoc, query, where, Timestamp, addDoc, runTransaction } from 'firebase/firestore';
import type { WorkOrder, CierreAdministrativo, OTEstadoAdmin, Lead, TicketArea, TicketEstado, Presupuesto } from '@ags/shared';
import { db, createBatch, docRef, batchAudit, getCreateTrace, getUpdateTrace, getCurrentUserTrace, deepCleanForFirestore, onSnapshot, newDocRef } from './firebase';
import { leadsService } from './leadsService';
import { presupuestosService } from './presupuestosService';
import { agendaService } from './agendaService';
import { adminConfigService } from './adminConfigService';

/**
 * FLOW-04: build a minimal plaintext body for the cierre_admin_ot mailQueue doc.
 * The real HTML/PDF rendering + attachments resolution live in the Cloud Function
 * consumer of `mailQueue` (deferred to Phase 9+). This body is enough for a human
 * reader if the mail is sent as-is, and keeps the `mailQueue` doc self-describing.
 */
function buildAvisoFacturacionBody(
  ot: WorkOrder,
  presupuestos: Array<Presupuesto | null>,
): string {
  const presValid = presupuestos.filter((p): p is Presupuesto => !!p);
  const lines: string[] = [
    `OT ${ot.otNumber} cerrada administrativamente.`,
    ``,
    `Cliente: ${ot.razonSocial || ot.clienteId || '—'}`,
    `Fecha de cierre: ${new Date().toLocaleDateString('es-AR')}`,
    ``,
    `Presupuestos vinculados:`,
  ];
  if (presValid.length === 0) {
    lines.push('  (sin presupuesto vinculado — revisar manualmente)');
  } else {
    for (const p of presValid) {
      lines.push(`  - ${p.numero} (${p.moneda}) — total ${p.total}`);
    }
  }
  lines.push(``);
  lines.push(`Adjuntos: PDF de presupuesto(s) + adjuntos de OC (resueltos por el consumer)`);
  return lines.join('\n');
}

// Servicio para Órdenes de Trabajo (OTs) - usa la colección 'reportes' existente
export const ordenesTrabajoService = {
  // Generar siguiente número de OT con transacción atómica (counter doc pattern)
  async getNextOtNumber(): Promise<string> {
    console.log('🔢 Generando siguiente número de OT (transacción)...');
    const counterRef = doc(db, '_counters', 'otNumber');

    const nextOt = await runTransaction(db, async (transaction) => {
      const counterSnap = await transaction.get(counterRef);

      let current: number;
      if (counterSnap.exists()) {
        current = counterSnap.data().value as number;
      } else {
        // Primera vez: escanear colección para inicializar el counter
        const querySnapshot = await getDocs(collection(db, 'reportes'));
        let maxNumber = 29999;
        querySnapshot.docs.forEach(d => {
          const id = d.id;
          if (!id.includes('.')) {
            const m = id.match(/^(\d{5})$/);
            if (m) {
              const n = parseInt(m[1]);
              if (n > maxNumber) maxNumber = n;
            }
          }
        });
        current = maxNumber;
      }

      const next = current + 1;
      transaction.set(counterRef, { value: next, updatedAt: Timestamp.now() });
      return String(next).padStart(5, '0');
    });

    console.log(`✅ Siguiente OT: ${nextOt}`);
    return nextOt;
  },

  // Generar siguiente número de item con transacción atómica
  async getNextItemNumber(otPadre: string): Promise<string> {
    console.log(`🔢 Generando siguiente item para OT ${otPadre} (transacción)...`);
    const counterRef = doc(db, '_counters', `otItem_${otPadre}`);

    const nextItemNumber = await runTransaction(db, async (transaction) => {
      const counterSnap = await transaction.get(counterRef);

      let currentMax: number;
      if (counterSnap.exists()) {
        currentMax = counterSnap.data().value as number;
      } else {
        // Primera vez: escanear items existentes para inicializar
        const querySnapshot = await getDocs(collection(db, 'reportes'));
        const prefix = otPadre + '.';
        let maxItem = 0;
        querySnapshot.docs.forEach(d => {
          if (d.id.startsWith(prefix)) {
            const m = d.id.match(/\.(\d{2})$/);
            if (m) {
              const n = parseInt(m[1]);
              if (n > maxItem) maxItem = n;
            }
          }
        });
        currentMax = maxItem;
      }

      const next = currentMax + 1;
      transaction.set(counterRef, { value: next, updatedAt: Timestamp.now() });
      return `${otPadre}.${String(next).padStart(2, '0')}`;
    });

    console.log(`✅ Siguiente item: ${nextItemNumber}`);
    return nextItemNumber;
  },

  /** Obtener solo OTs activas/pendientes (para agenda sidebar). Mucho más rápido que getAll(). */
  async getPending(): Promise<WorkOrder[]> {
    const PENDING_ESTADOS = ['CREADA', 'ASIGNADA', 'COORDINADA', 'EN_CURSO'];
    const [byEstado, byBorrador] = await Promise.all([
      getDocs(query(collection(db, 'reportes'), where('estadoAdmin', 'in', PENDING_ESTADOS))),
      getDocs(query(collection(db, 'reportes'), where('status', '==', 'BORRADOR'))),
    ]);
    const seen = new Set<string>();
    const results: WorkOrder[] = [];
    for (const snap of [byEstado, byBorrador]) {
      for (const d of snap.docs) {
        if (!seen.has(d.id)) {
          seen.add(d.id);
          results.push({ otNumber: d.id, ...d.data(), updatedAt: d.data().updatedAt || new Date().toISOString() } as WorkOrder);
        }
      }
    }
    return results;
  },

  // Obtener todas las OTs (con filtros opcionales)
  async getAll(filters?: { clienteId?: string; sistemaId?: string; status?: WorkOrder['status'] }) {
    console.log('📥 Cargando órdenes de trabajo desde Firestore...');
    let q = query(collection(db, 'reportes'));

    // Aplicar filtros si existen
    if (filters?.clienteId) {
      q = query(q, where('clienteId', '==', filters.clienteId));
    }
    if (filters?.sistemaId) {
      q = query(q, where('sistemaId', '==', filters.sistemaId));
    }
    if (filters?.status) {
      q = query(q, where('status', '==', filters.status));
    }

    const querySnapshot = await getDocs(q);
    const ordenes = querySnapshot.docs.map(doc => ({
      otNumber: doc.id,
      ...doc.data(),
      updatedAt: doc.data().updatedAt || new Date().toISOString(),
    })) as WorkOrder[];

    // Ordenar por número de OT (descendente - más recientes primero)
    ordenes.sort((a, b) => {
      const numA = parseInt(a.otNumber.split('.')[0]);
      const numB = parseInt(b.otNumber.split('.')[0]);
      if (numA !== numB) return numB - numA;
      // Si mismo número base, ordenar por item
      const itemA = a.otNumber.includes('.') ? parseInt(a.otNumber.split('.')[1]) : 0;
      const itemB = b.otNumber.includes('.') ? parseInt(b.otNumber.split('.')[1]) : 0;
      return itemB - itemA;
    });

    console.log(`✅ ${ordenes.length} órdenes de trabajo cargadas`);
    return ordenes;
  },

  /** Real-time subscription for OTs. Returns unsubscribe function. */
  subscribe(
    filters: { clienteId?: string; sistemaId?: string; status?: WorkOrder['status'] } | undefined,
    callback: (ots: WorkOrder[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    let q = query(collection(db, 'reportes'));
    if (filters?.clienteId) q = query(q, where('clienteId', '==', filters.clienteId));
    if (filters?.sistemaId) q = query(q, where('sistemaId', '==', filters.sistemaId));
    if (filters?.status) q = query(q, where('status', '==', filters.status));

    return onSnapshot(q, snap => {
      const ordenes = snap.docs.map(d => ({
        otNumber: d.id,
        ...d.data(),
        updatedAt: d.data().updatedAt || new Date().toISOString(),
      })) as WorkOrder[];
      ordenes.sort((a, b) => {
        const numA = parseInt(a.otNumber.split('.')[0]);
        const numB = parseInt(b.otNumber.split('.')[0]);
        if (numA !== numB) return numB - numA;
        const itemA = a.otNumber.includes('.') ? parseInt(a.otNumber.split('.')[1]) : 0;
        const itemB = b.otNumber.includes('.') ? parseInt(b.otNumber.split('.')[1]) : 0;
        return itemB - itemA;
      });
      callback(ordenes);
    }, err => {
      console.error('OT subscription error:', err);
      onError?.(err);
    });
  },

  // Obtener items de una OT padre
  async getItemsByOtPadre(otPadre: string): Promise<WorkOrder[]> {
    const q = query(collection(db, 'reportes'));
    const querySnapshot = await getDocs(q);
    const prefix = otPadre + '.';

    const items = querySnapshot.docs
      .filter(doc => doc.id.startsWith(prefix))
      .map(doc => ({
        otNumber: doc.id,
        ...doc.data(),
        updatedAt: doc.data().updatedAt || new Date().toISOString(),
      })) as WorkOrder[];

    // Ordenar por número de item
    items.sort((a, b) => {
      const itemA = parseInt(a.otNumber.split('.')[1]);
      const itemB = parseInt(b.otNumber.split('.')[1]);
      return itemA - itemB;
    });

    return items;
  },

  // Obtener OT por número
  async getByOtNumber(otNumber: string) {
    const otDocRef = doc(db, 'reportes', otNumber);
    const docSnap = await getDoc(otDocRef);
    if (docSnap.exists()) {
      return {
        otNumber: docSnap.id,
        ...docSnap.data(),
        updatedAt: docSnap.data().updatedAt || new Date().toISOString(),
      } as WorkOrder;
    }
    return null;
  },

  /** Real-time subscription to a single OT by otNumber. Returns unsubscribe function. */
  subscribeByOtNumber(
    otNumber: string,
    callback: (ot: WorkOrder | null) => void,
    onError?: (err: Error) => void,
  ): () => void {
    return onSnapshot(doc(db, 'reportes', otNumber), snap => {
      if (!snap.exists()) { callback(null); return; }
      callback({
        otNumber: snap.id,
        ...snap.data(),
        updatedAt: snap.data().updatedAt || new Date().toISOString(),
      } as WorkOrder);
    }, err => {
      console.error('OT single subscription error:', err);
      onError?.(err);
    });
  },

  // Crear nueva OT (usa setDoc para controlar el ID)
  async create(otData: Omit<WorkOrder, 'otNumber'> & { otNumber: string }) {
    console.log('📝 Creando orden de trabajo:', otData.otNumber);

    const otDocRef = doc(db, 'reportes', otData.otNumber);
    const cleanedData = deepCleanForFirestore({
      ...otData,
      ...getCreateTrace(),
      status: otData.status || 'BORRADOR',
      updatedAt: Timestamp.now(),
      createdAt: Timestamp.now(),
    });

    const batch = createBatch();
    batch.set(otDocRef, cleanedData);
    batchAudit(batch, { action: 'create', collection: 'ordenes_trabajo', documentId: otData.otNumber, after: cleanedData as any });
    await batch.commit();
    console.log('✅ Orden de trabajo creada exitosamente');

    // Auto-create agenda entry if engineer + date assigned
    if (otData.ingenieroAsignadoId && otData.fechaServicioAprox && !otData.otNumber.includes('.')) {
      try {
        await agendaService.autoCreateFromOT(otData as any);
      } catch (err) {
        console.error('[otService] Error auto-creating agenda entry:', err);
      }
    }

    return otData.otNumber;
  },

  // Actualizar OT
  async update(otNumber: string, data: Partial<WorkOrder>) {
    // Branching: si la transición es → CIERRE_ADMINISTRATIVO, delegar a
    // cerrarAdministrativamente para que corra la tx atómica (crea
    // solicitudFacturacion, mailQueue, admin ticket). Sin esto, el dropdown
    // del EditOTModal cambiaba estadoAdmin sin side-effects de Phase 10.
    if (data.estadoAdmin === 'CIERRE_ADMINISTRATIVO') {
      const current = await this.getByOtNumber(otNumber);
      const currentEstado = current?.estadoAdmin;
      if (currentEstado !== 'CIERRE_ADMINISTRATIVO' && currentEstado !== 'FINALIZADO') {
        await this.cerrarAdministrativamente(otNumber, {});
        const { estadoAdmin: _omit, estadoAdminFecha: _omit2, estadoHistorial: _omit3, ...otherFields } = data;
        if (Object.keys(otherFields).length > 0) {
          const cleaned2 = deepCleanForFirestore({
            ...otherFields,
            ...getUpdateTrace(),
            updatedAt: Timestamp.now(),
          });
          const batch2 = createBatch();
          batch2.update(docRef('reportes', otNumber), cleaned2);
          batchAudit(batch2, { action: 'update', collection: 'ordenes_trabajo', documentId: otNumber, after: cleaned2 as any });
          await batch2.commit();
        }
        return;
      }
    }

    const cleanedData = deepCleanForFirestore({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });

    const batch = createBatch();
    batch.update(docRef('reportes', otNumber), cleanedData);
    batchAudit(batch, { action: 'update', collection: 'ordenes_trabajo', documentId: otNumber, after: cleanedData as any });
    await batch.commit();

    // ── Auto-sync lead when OT estadoAdmin changes ──
    if (data.estadoAdmin) {
      try {
        const ot = await this.getByOtNumber(otNumber);
        console.info(`[otService.update] estadoAdmin → ${data.estadoAdmin} for OT ${otNumber}`, {
          leadId: ot?.leadId, budgets: ot?.budgets,
        });
        const leadIdsToSync = new Set<string>();
        if (ot?.leadId) leadIdsToSync.add(ot.leadId);
        // Fallback: si no hay leadId directo, buscar tickets linkeados al(los)
        // ppto(s) de la OT via presupuestosIds array-contains. Necesario porque
        // los tickets de FLOW-01 / Phase 10 se linkean vía presupuestosIds,
        // no vía OT.leadId. Sin esto, transiciones de agenda/cierre técnico/
        // admin no propagaban al ticket.
        if (ot && (ot.budgets || []).length > 0) {
          const budgetsForQuery = ot.budgets!.slice(0, 10);
          try {
            const pressSnap = await getDocs(
              query(collection(db, 'presupuestos'), where('numero', 'in', budgetsForQuery)),
            );
            const presIds = pressSnap.docs.map(d => d.id);
            console.info(`[otService.update] resolved ${presIds.length} presupuesto ids from budgets:`, budgetsForQuery, '→', presIds);
            for (const pid of presIds) {
              try {
                const tksSnap = await getDocs(
                  query(collection(db, 'leads'), where('presupuestosIds', 'array-contains', pid)),
                );
                console.info(`[otService.update] found ${tksSnap.docs.length} tickets for ppto ${pid}`);
                for (const d of tksSnap.docs) {
                  const t = d.data() as any;
                  if (t.estado !== 'finalizado' && t.estado !== 'no_concretado') {
                    leadIdsToSync.add(d.id);
                  }
                }
              } catch (err) {
                console.error(`[otService.update] tickets query for ppto ${pid} failed:`, err);
              }
            }
          } catch (err) {
            console.error('[otService.update] presupuestos query by numero failed:', err);
          }
        } else {
          console.info(`[otService.update] OT ${otNumber} has no budgets — cannot fallback-resolve tickets`);
        }
        console.info(`[otService.update] will sync ${leadIdsToSync.size} ticket(s):`, Array.from(leadIdsToSync));
        for (const lid of leadIdsToSync) {
          await leadsService.syncFromOT(lid, otNumber, data.estadoAdmin as OTEstadoAdmin)
            .catch(err => console.error(`[otService] syncFromOT ${lid} failed:`, err));
        }
        // Sync presupuesto estado
        if (ot && data.estadoAdmin === 'FINALIZADO') {
          await this._syncPresupuestoOnFinalize(ot).catch(err =>
            console.error('[otService] Error syncing presupuesto:', err)
          );
        }
      } catch (err) {
        console.error('[otService] Error syncing lead from OT:', err);
      }
    }

    // ── Auto-sync agenda when engineer or date changes ──
    if (data.ingenieroAsignadoId !== undefined || data.fechaServicioAprox !== undefined) {
      try {
        await agendaService.syncFromOT(otNumber, {
          ingenieroId: data.ingenieroAsignadoId as string | null | undefined,
          ingenieroNombre: data.ingenieroAsignadoNombre as string | null | undefined,
          fechaServicioAprox: data.fechaServicioAprox as string | undefined,
        });
        // If engineer+date now present but no entry existed, auto-create
        if (data.ingenieroAsignadoId && data.fechaServicioAprox) {
          const ot = await this.getByOtNumber(otNumber);
          if (ot) await agendaService.autoCreateFromOT(ot as any);
        }
      } catch (err) {
        console.error('[otService] Error syncing agenda:', err);
      }
    }
  },

  /**
   * Al finalizar una OT, intenta sincronizar el estado de los presupuestos
   * vinculados via `presupuestosService.trySyncFinalizacion` — que chequea
   * work-unit OTs + solicitudesFacturacion antes de transicionar a `finalizado`.
   * Reemplaza la lógica vieja que miraba solo parent OTs (bug: parents nunca
   * llegan a FINALIZADO — son contenedores).
   */
  async _syncPresupuestoOnFinalize(ot: WorkOrder): Promise<void> {
    const budgetNumbers = ot.budgets || [];
    if (budgetNumbers.length === 0) return;
    const allPresupuestos = await presupuestosService.getAll();
    for (const budgetNum of budgetNumbers) {
      const pres = allPresupuestos.find(p => p.numero === budgetNum);
      if (!pres) continue;
      await presupuestosService.trySyncFinalizacion(pres.id).catch(err =>
        console.error(`[_syncPresupuestoOnFinalize] trySyncFinalizacion ${pres.numero} failed:`, err)
      );
    }
  },

  async delete(otNumber: string) {
    const batch = createBatch();
    batch.delete(docRef('reportes', otNumber));
    batchAudit(batch, { action: 'delete', collection: 'ordenes_trabajo', documentId: otNumber });
    await batch.commit();
  },

  /**
   * FLOW-04: cierra una OT administrativamente de forma atómica.
   *
   * Modelo Tier-1 (Presupuesto-céntrico): ya NO crea solicitudesFacturacion aquí.
   * En su lugar registra `otNumber` en `presupuesto.otsListasParaFacturar[]` de
   * cada presupuesto vinculado — el admin del ppto agrupa las OTs manualmente y
   * genera el aviso de facturación desde EditPresupuestoModal.
   *
   * runTransaction — Firestore reads-before-writes invariant respetado estrictamente:
   *   Reads (READ PHASE):
   *     R1. OT doc (validate existencia)
   *     R2+. doc de cada presupuesto vinculado (para leer otsListasParaFacturar actual)
   *   Writes (WRITE PHASE — todos después del READ PHASE):
   *     1. Update OT: estadoAdmin='CIERRE_ADMINISTRATIVO' + fechaCierre
   *     2. Ticket admin nuevo (colección `leads`, area='administracion') — notificación para admin
   *     3. mailQueue doc (type='cierre_admin_ot') — aviso al contable de que la OT cerró
   *     4+. tx.update por cada presupuesto vinculado: merge otNumber en otsListasParaFacturar[]
   *         (no se usa arrayUnion — prohibido dentro de tx; se computa manualmente)
   *
   * Post-commit (best-effort, fuera de tx):
   *   - `leadsService.syncFromOT` para ticket origen de la OT (si tiene leadId)
   *     → transiciona ticket a `pendiente_aviso_facturacion`
   *
   * @returns `{ adminTicketId, mailQueueId, pptosNotificados }` — pptosNotificados
   *   son los IDs de presupuestos que recibieron el otNumber en otsListasParaFacturar.
   */
  async cerrarAdministrativamente(
    otNumber: string,
    cierreData: { notas?: string; fechaCierre?: string },
    actor?: { uid: string; name?: string },
  ): Promise<{ adminTicketId: string; mailQueueId: string; pptosNotificados: string[] }> {
    // ── Pre-reads fuera de tx ─────────────────────────────────────
    const ot = await this.getByOtNumber(otNumber);
    if (!ot) throw new Error('OT no encontrada');

    // Config con defaults (fallback hardcoded si adminConfig lectura falla).
    let mailTo = 'mbarrios@agsanalitica.com';
    try {
      const cfg = await adminConfigService.getWithDefaults();
      mailTo = cfg.mailFacturacion || mailTo;
    } catch (err) {
      console.warn('[cerrarAdministrativamente] adminConfig read failed; using default mail:', err);
    }

    // Pre-cargar presupuestos vinculados para el body del mail. OT.budgets contiene
    // los `numero` (PRE-XXXX.NN) — aquí los resolvemos a IDs para el tx.update.
    const presupuestoNumeros = ot.budgets || [];
    let presupuestosPorNumero: Array<Presupuesto | null> = [];
    let presupuestoIds: string[] = [];
    if (presupuestoNumeros.length > 0) {
      try {
        const all = await presupuestosService.getAll();
        presupuestosPorNumero = presupuestoNumeros.map(num => all.find(p => p.numero === num) ?? null);
        presupuestoIds = presupuestosPorNumero.filter((p): p is Presupuesto => !!p).map(p => p.id);
      } catch (err) {
        console.warn('[cerrarAdministrativamente] presupuestos read failed:', err);
      }
    }

    const ocIds = Array.from(new Set(
      presupuestosPorNumero.flatMap(p => (p?.ordenesCompraIds || [])),
    ));

    const subject = `Aviso facturación — OT ${otNumber}`;
    const body = buildAvisoFacturacionBody(ot, presupuestosPorNumero);
    const bodyWithCTA = `${body}\n\n---\nVer en sistema: /facturacion`;

    const nowIso = new Date().toISOString();

    const newAdminTicketRef = newDocRef('leads');
    const newMailQueueRef = newDocRef('mailQueue');

    // ── Transaction: reads-before-writes invariant ──────────────────────────────
    const txResult = await runTransaction(db, async (tx) => {
      // ═══════════════ READ PHASE (todos los tx.get aquí — ningún write antes) ═══════════════

      // R1: OT
      const otRef = doc(db, 'reportes', otNumber);
      const otSnap = await tx.get(otRef);
      if (!otSnap.exists()) throw new Error(`OT ${otNumber} no encontrada (tx)`);

      // R2+: leer doc de cada presupuesto para conocer otsListasParaFacturar actual
      const pptoSnaps = new Map<string, { ref: ReturnType<typeof doc>; current: string[] }>();
      for (const pid of presupuestoIds) {
        const pRef = doc(db, 'presupuestos', pid);
        const pSnap = await tx.get(pRef);
        const existing: string[] = pSnap.exists()
          ? (pSnap.data()?.otsListasParaFacturar ?? [])
          : [];
        pptoSnaps.set(pid, { ref: pRef, current: existing });
      }

      // ═══════════════ WRITE PHASE (todos los tx.set/update después de los reads) ═══════════════

      // Write 1: update OT a CIERRE_ADMINISTRATIVO
      tx.update(otRef, deepCleanForFirestore({
        estadoAdmin: 'CIERRE_ADMINISTRATIVO' as OTEstadoAdmin,
        fechaCierre: cierreData.fechaCierre ?? nowIso,
        updatedAt: nowIso,
        updatedBy: actor?.uid ?? null,
        updatedByName: actor?.name ?? null,
      }));

      // Write 2: ticket admin nuevo (area='administracion') — notificación de que la OT cerró
      const adminTicketPayload: Omit<Lead, 'id'> & { createdAt: string; updatedAt: string } = {
        clienteId: ot.clienteId ?? null,
        contactoId: null,
        razonSocial: ot.razonSocial || '',
        contactos: [],
        contacto: ot.contacto || '',
        email: ot.emailPrincipal || '',
        telefono: '',
        motivoLlamado: 'administracion',
        motivoContacto: `Aviso facturación — OT ${otNumber}`,
        descripcion: `OT ${otNumber} cerrada administrativamente. ${presupuestoNumeros.length ? `Presupuesto(s): ${presupuestoNumeros.join(', ')}.` : 'Sin presupuesto vinculado.'} Generar aviso de facturación desde el presupuesto.`,
        sistemaId: ot.sistemaId ?? null,
        moduloId: ot.moduloId ?? null,
        estado: 'nuevo' as TicketEstado,
        postas: [],
        asignadoA: null,
        asignadoNombre: null,
        derivadoPor: actor?.uid ?? null,
        areaActual: 'administracion' as TicketArea,
        accionPendiente: 'Generar aviso de facturación desde el presupuesto',
        adjuntos: [],
        presupuestosIds: presupuestoIds,
        otIds: [otNumber],
        finalizadoAt: null,
        prioridad: 'normal',
        proximoContacto: null,
        valorEstimado: null,
        createdAt: nowIso,
        updatedAt: nowIso,
        createdBy: actor?.uid ?? undefined,
      };
      tx.set(newAdminTicketRef, deepCleanForFirestore(adminTicketPayload));

      // Write 3: mailQueue doc (type='cierre_admin_ot', status='pending')
      tx.set(newMailQueueRef, deepCleanForFirestore({
        type: 'cierre_admin_ot',
        status: 'pending',
        data: {
          to: mailTo,
          subject,
          body: bodyWithCTA,
          otNumber,
          presupuestoIds,
          presupuestoNumeros,
          ocIds,
          attachments: [
            ...presupuestoIds.map(pid => ({ type: 'pdf_presupuesto', presupuestoId: pid })),
          ],
          razonSocial: ot.razonSocial || '',
          clienteId: ot.clienteId ?? null,
        },
        createdAt: nowIso,
        createdBy: actor?.uid ?? null,
      }));

      // Write 4+: registrar otNumber en otsListasParaFacturar[] de cada presupuesto vinculado.
      // Se usa manual merge (no arrayUnion — sentinel prohibido en tx).
      for (const [pid, { ref: pRef, current }] of pptoSnaps) {
        if (!current.includes(otNumber)) {
          tx.update(pRef, deepCleanForFirestore({
            otsListasParaFacturar: [...current, otNumber],
            updatedAt: nowIso,
          }));
        } else {
          console.log(`[cerrarAdministrativamente] OT ${otNumber} ya está en otsListasParaFacturar de ppto ${pid}, skip`);
        }
      }

      return { adminTicketId: newAdminTicketRef.id, mailQueueId: newMailQueueRef.id };
    });

    // ── Post-commit side-effects (best-effort, NO bloquea) ────────
    try {
      if (ot.leadId) {
        await leadsService.syncFromOT(ot.leadId, otNumber, 'CIERRE_ADMINISTRATIVO');
      }
    } catch (err) {
      console.error('[cerrarAdministrativamente] syncFromOT failed (non-blocking):', err);
    }

    return {
      adminTicketId: txResult.adminTicketId,
      mailQueueId: txResult.mailQueueId,
      pptosNotificados: presupuestoIds,
    };
  },

  /**
   * @deprecated Usar `cerrarAdministrativamente` — esta función NO es transaccional
   * (solo encola el mail; no crea ticket admin ni actualiza OT). Queda para retry manual
   * desde el dashboard `/admin/acciones-pendientes` cuando el mailQueue consumer ya procesó
   * el doc pero falló el envío real.
   *
   * Mantener para backward compatibility y fallback.
   */
  async enviarAvisoCierreAdmin(otNumber: string, data: {
    razonSocial: string;
    tipoServicio: string;
    horasLab: string;
    horasViaje: string;
    cierreAdmin: CierreAdministrativo;
    partesCount: number;
    ingenieroNombre: string | null;
  }): Promise<void> {
    const user = getCurrentUserTrace();
    const hsLab = data.cierreAdmin.horasLabAjustadas || data.horasLab || '0';
    const hsViaje = data.cierreAdmin.horasViajeAjustadas || data.horasViaje || '0';

    await addDoc(collection(db, 'mailQueue'), {
      type: 'cierre_admin_ot',
      status: 'pending',
      createdAt: Timestamp.now(),
      createdBy: user?.uid ?? null,
      createdByName: user?.name ?? null,
      data: {
        otNumber,
        razonSocial: data.razonSocial,
        tipoServicio: data.tipoServicio,
        horasLaboratorio: hsLab,
        horasViaje: hsViaje,
        horasTotal: (Number(hsLab) + Number(hsViaje)).toFixed(1),
        partesUsadas: data.partesCount,
        stockDeducido: data.cierreAdmin.stockDeducido,
        notas: data.cierreAdmin.notasCierre || null,
        ingeniero: data.ingenieroNombre,
      },
    });
  },
};
