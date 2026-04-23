import { collection, getDocs, doc, getDoc, updateDoc, query, where, orderBy, Timestamp, runTransaction } from 'firebase/firestore';
import type { Presupuesto, PresupuestoEstado, OrdenCompra, CategoriaPresupuesto, CondicionPago, ConceptoServicio, Posta, Lead, PendingAction, TicketEstado, TicketArea, RequerimientoCompra } from '@ags/shared';
import { PRESUPUESTO_ESTADO_MIGRATION } from '@ags/shared';
import { db, cleanFirestoreData, deepCleanForFirestore, getCreateTrace, getUpdateTrace, createBatch, newDocRef, docRef, batchAudit, onSnapshot } from './firebase';
import { leadsService } from './leadsService';
import { adminConfigService } from './adminConfigService';
import { usuariosService } from './personalService';
import { articulosService, unidadesService, reservasService } from './stockService';
import { requerimientosService } from './importacionesService';
import { computeStockAmplio } from './stockAmplioService';

// Helper: recover ISO string from Timestamp, broken {seconds,nanoseconds} map, or string
function toISO(val: any, fallback: string | null = null): string | null {
  if (!val) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val?.toDate === 'function') return val.toDate().toISOString();
  if (typeof val?.seconds === 'number') return new Date(val.seconds * 1000).toISOString();
  return fallback;
}

/** Migrate legacy presupuesto estado to simplified states */
function migrateEstado(estado: string): PresupuestoEstado {
  return PRESUPUESTO_ESTADO_MIGRATION[estado] || 'borrador';
}

// Servicio para Presupuestos
export const presupuestosService = {
  // Extraer parte base de un número: PRE-0001.02 → 1, PRE-0001 (legacy) → 1
  _extractBase(numero: string): number {
    const match = numero.match(/PRE-(\d+)/);
    return match ? parseInt(match[1]) : 0;
  },

  // Extraer sufijo de revisión: PRE-0001.02 → 2, PRE-0001 (legacy) → null
  _extractRevision(numero: string): number | null {
    const match = numero.match(/PRE-\d+\.(\d+)/);
    return match ? parseInt(match[1]) : null;
  },

  // Generar siguiente número de presupuesto (PRE-XXXX.01)
  async getNextPresupuestoNumber(): Promise<string> {
    console.log('🔢 Generando siguiente número de presupuesto...');
    const q = query(collection(db, 'presupuestos'), orderBy('numero', 'desc'));
    const querySnapshot = await getDocs(q);

    let maxBase = 0;
    querySnapshot.docs.forEach(d => {
      const base = this._extractBase(d.data().numero);
      if (base > maxBase) maxBase = base;
    });

    const nextNumber = `PRE-${String(maxBase + 1).padStart(4, '0')}.01`;
    console.log(`✅ Siguiente presupuesto: ${nextNumber}`);
    return nextNumber;
  },

  // Obtener todos los presupuestos
  async getAll(filters?: { clienteId?: string; estado?: Presupuesto['estado'] }) {
    console.log('📥 Cargando presupuestos desde Firestore...');
    let q = query(collection(db, 'presupuestos'));

    // Aplicar filtros primero
    if (filters?.clienteId) {
      q = query(q, where('clienteId', '==', filters.clienteId));
    }
    if (filters?.estado) {
      q = query(q, where('estado', '==', filters.estado));
    }

    // Ordenar solo si no hay filtros que requieran índice compuesto
    // Por ahora, ordenar en memoria para evitar problemas de índices
    const querySnapshot = await getDocs(q);
    const presupuestos = querySnapshot.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        ...d,
        estado: migrateEstado(d.estado),
        createdAt: toISO(d.createdAt, ''),
        updatedAt: toISO(d.updatedAt, ''),
        validUntil: toISO(d.validUntil),
        fechaEnvio: toISO(d.fechaEnvio),
        proximoContacto: d.proximoContacto ?? null,
        responsableId: d.responsableId ?? null,
        responsableNombre: d.responsableNombre ?? null,
      };
    }) as Presupuesto[];

    // Ordenar en memoria por fecha de creación (más recientes primero)
    presupuestos.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    console.log(`✅ ${presupuestos.length} presupuestos cargados`);
    return presupuestos;
  },

  /** Real-time subscription for presupuestos. Returns unsubscribe function. */
  subscribe(
    filters: { clienteId?: string; estado?: Presupuesto['estado'] } | undefined,
    callback: (presupuestos: Presupuesto[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    let q = query(collection(db, 'presupuestos'));
    if (filters?.clienteId) q = query(q, where('clienteId', '==', filters.clienteId));
    if (filters?.estado) q = query(q, where('estado', '==', filters.estado));

    return onSnapshot(q, snap => {
      const presupuestos = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          estado: migrateEstado(data.estado),
          createdAt: toISO(data.createdAt, ''),
          updatedAt: toISO(data.updatedAt, ''),
          validUntil: toISO(data.validUntil),
          fechaEnvio: toISO(data.fechaEnvio),
          proximoContacto: data.proximoContacto ?? null,
          responsableId: data.responsableId ?? null,
          responsableNombre: data.responsableNombre ?? null,
        };
      }) as Presupuesto[];
      presupuestos.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      callback(presupuestos);
    }, err => {
      console.error('Presupuestos subscription error:', err);
      onError?.(err);
    });
  },

  // Obtener presupuesto por ID
  async getById(id: string) {
    const docRef = doc(db, 'presupuestos', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const d = docSnap.data();
      return {
        id: docSnap.id,
        ...d,
        estado: migrateEstado(d.estado),
        createdAt: toISO(d.createdAt, ''),
        updatedAt: toISO(d.updatedAt, ''),
        validUntil: toISO(d.validUntil),
        fechaEnvio: toISO(d.fechaEnvio),
        proximoContacto: d.proximoContacto ?? null,
        responsableId: d.responsableId ?? null,
        responsableNombre: d.responsableNombre ?? null,
      } as Presupuesto;
    }
    return null;
  },

  /** Real-time subscription to a single presupuesto by ID. Returns unsubscribe function. */
  subscribeById(
    id: string,
    callback: (presupuesto: Presupuesto | null) => void,
    onError?: (err: Error) => void,
  ): () => void {
    return onSnapshot(doc(db, 'presupuestos', id), snap => {
      if (!snap.exists()) { callback(null); return; }
      const d = snap.data();
      callback({
        id: snap.id,
        ...d,
        estado: migrateEstado(d.estado),
        createdAt: toISO(d.createdAt, ''),
        updatedAt: toISO(d.updatedAt, ''),
        validUntil: toISO(d.validUntil),
        fechaEnvio: toISO(d.fechaEnvio),
        proximoContacto: d.proximoContacto ?? null,
        responsableId: d.responsableId ?? null,
        responsableNombre: d.responsableNombre ?? null,
      } as Presupuesto);
    }, err => {
      console.error('Presupuesto subscription error:', err);
      onError?.(err);
    });
  },

  // Crear presupuesto
  async create(presupuestoData: Omit<Presupuesto, 'id' | 'createdAt' | 'updatedAt'> & { numero?: string }) {
    console.log('📝 Creando presupuesto...');

    // Generar número si no se proporciona
    const numero = presupuestoData.numero || await this.getNextPresupuestoNumber();

    // Convert date strings to Firestore Timestamps, then deep-clean
    const raw = {
      ...presupuestoData,
      ...getCreateTrace(),
      numero,
      tipo: presupuestoData.tipo || 'servicio',
      moneda: presupuestoData.moneda || 'USD',
      items: presupuestoData.items || [],
      ordenesCompraIds: presupuestoData.ordenesCompraIds || [],
      adjuntos: presupuestoData.adjuntos || [],
      validezDias: presupuestoData.validezDias ?? 15,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      ...(presupuestoData.fechaEnvio ? { fechaEnvio: Timestamp.fromDate(new Date(presupuestoData.fechaEnvio as any)) } : {}),
      ...(presupuestoData.validUntil ? { validUntil: Timestamp.fromDate(new Date(presupuestoData.validUntil as any)) } : {}),
    };
    const payload = deepCleanForFirestore(raw);
    const presRef = newDocRef('presupuestos');
    const batch = createBatch();
    batch.set(presRef, payload);
    batchAudit(batch, { action: 'create', collection: 'presupuestos', documentId: presRef.id, after: payload as any });
    await batch.commit();

    console.log('✅ Presupuesto creado exitosamente con ID:', presRef.id);

    // Auto-generate requerimientos for items linked to stock articles
    const itemsConStock = (presupuestoData.items || []).filter(i => i.stockArticuloId);
    if (itemsConStock.length > 0) {
      this._generarRequerimientosAutomaticos(presRef.id, numero, itemsConStock).catch(err =>
        console.error('[presupuestosService] Error auto-generando requerimientos:', err)
      );
    }

    return { id: presRef.id, numero };
  },

  async _generarRequerimientosAutomaticos(
    presupuestoId: string,
    presupuestoNumero: string,
    items: Array<{ stockArticuloId?: string | null; descripcion: string; cantidad: number }>,
  ) {
    // Phase 9 (STKP-05 fix): replaced buggy inline formula (qtyDisponible - qtyReservado + qtyEnTransito)
    // with computeStockAmplio() which correctly sums the 4 buckets without double-counting.
    // The old formula counted OC pending items from a separate preloaded map, missing units.en_transito
    // contribution. computeStockAmplio() is the single source of truth for ATP math.
    let count = 0;
    for (const item of items) {
      if (!item.stockArticuloId) continue;
      const [articulo, sa] = await Promise.all([
        articulosService.getById(item.stockArticuloId).catch(() => null),
        computeStockAmplio(item.stockArticuloId).catch(() => null),
      ]);

      if (!sa) continue;  // computeStockAmplio failed — skip, don't create bad requerimiento

      // stockProyectado uses the correct 4-bucket formula: disponible + enTransito - reservado - comprometido
      const stockProyectado = sa.disponible + sa.enTransito - sa.reservado - sa.comprometido;
      const stockMinimo = articulo?.stockMinimo ?? 0;
      const qtyResultante = stockProyectado - item.cantidad;

      if (qtyResultante < stockMinimo || stockProyectado < item.cantidad) {
        const qtyReq = Math.max(stockMinimo - qtyResultante, item.cantidad - stockProyectado, 1);
        await requerimientosService.create({
          articuloId: item.stockArticuloId,
          articuloCodigo: articulo?.codigo ?? null,
          articuloDescripcion: articulo?.descripcion ?? item.descripcion,
          cantidad: qtyReq,
          unidadMedida: articulo?.unidadMedida ?? 'unidad',
          motivo: `Auto — presupuesto ${presupuestoNumero} | disp: ${sa.disponible}, tráns: ${sa.enTransito}, res: ${sa.reservado}, comp: ${sa.comprometido}, necesario: ${item.cantidad}`,
          origen: 'presupuesto',
          origenRef: presupuestoId,
          estado: 'pendiente',
          presupuestoId,
          presupuestoNumero,
          proveedorSugeridoId: articulo?.proveedorIds?.[0] ?? null,
          proveedorSugeridoNombre: null,
          ordenCompraId: null,
          ordenCompraNumero: null,
          solicitadoPor: 'Automático',
          fechaSolicitud: new Date().toISOString(),
          fechaAprobacion: null,
          urgencia: 'media',
          notas: null,
        });
        count++;
      }
    }
    if (count > 0) console.log(`✅ ${count} requerimiento(s) generados automáticamente para ${presupuestoNumero}`);
  },

  // Actualizar presupuesto
  async update(id: string, data: Partial<Presupuesto>) {
    // ── FLOW-01 branching: si la transición es borrador → enviado, delegar a
    // markEnviado para que corra sus side-effects (auto-ticket de seguimiento
    // FLOW-01, sync a lead origen si existe, fechaEnvio proper). Sin esto, un
    // cambio manual de estado via dropdown salteaba la creación del ticket.
    if (data.estado === 'enviado') {
      const current = await this.getById(id);
      // Solo delegar si viene desde `borrador` — estados posteriores (aceptado,
      // en_ejecucion, finalizado, anulado) no deberían "volver" a enviado.
      if (current && current.estado === 'borrador') {
        await this.markEnviado(id, {
          origenTipo: current.origenTipo ?? null,
          origenId: current.origenId ?? null,
          numero: current.numero ?? '',
        });
        const { estado: _estado, fechaEnvio: _fechaEnvio, ...otherFields } = data;
        if (Object.keys(otherFields).length > 0) {
          const raw2 = {
            ...otherFields,
            ...getUpdateTrace(),
            updatedAt: Timestamp.now(),
            ...((otherFields as any).validUntil ? { validUntil: Timestamp.fromDate(new Date((otherFields as any).validUntil)) } : {}),
          };
          const cleaned2 = deepCleanForFirestore(raw2);
          const batch2 = createBatch();
          batch2.update(docRef('presupuestos', id), cleaned2);
          batchAudit(batch2, { action: 'update', collection: 'presupuestos', documentId: id, after: cleaned2 as any });
          await batch2.commit();
        }
        return;
      }
    }

    // ── FLOW-03 branching: si la transición es → 'aceptado' y el presupuesto tiene
    // ítems con `itemRequiereImportacion: true`, delegar a aceptarConRequerimientos
    // para usar runTransaction atómico (update presupuesto + crear requerimientos condicionales).
    // Short-circuit returns antes de que el batch normal corra — el método delegado ya escribe.
    if (data.estado === 'aceptado') {
      const current = await this.getById(id);
      if (current && current.estado !== 'aceptado') {
        // Transición → aceptado: SIEMPRE delegar a aceptarConRequerimientos.
        // Esto garantiza que las side-effects de aceptación (requerimientos
        // condicionales para items de import, auto-OT ventas Phase 10 PTYP-04,
        // derivación Comex) corran uniformemente sin importar el tipo ni si
        // tiene items de import. El método es idempotente y maneja el caso
        // sin import items retornando requerimientosIds:[].
        await this.aceptarConRequerimientos(id);
        // Si el caller pasó otros campos junto con el estado, escribirlos después
        const { estado: _estado, ...otherFields } = data;
        if (Object.keys(otherFields).length > 0) {
          const raw2 = {
            ...otherFields,
            ...getUpdateTrace(),
            updatedAt: Timestamp.now(),
            ...((otherFields as any).fechaEnvio ? { fechaEnvio: Timestamp.fromDate(new Date((otherFields as any).fechaEnvio)) } : {}),
            ...((otherFields as any).validUntil ? { validUntil: Timestamp.fromDate(new Date((otherFields as any).validUntil)) } : {}),
          };
          const cleaned2 = deepCleanForFirestore(raw2);
          const batch2 = createBatch();
          batch2.update(docRef('presupuestos', id), cleaned2);
          batchAudit(batch2, { action: 'update', collection: 'presupuestos', documentId: id, after: cleaned2 as any });
          await batch2.commit();
        }
        return;
      }
    }

    // Convert date strings to Firestore Timestamps, then deep-clean
    const raw = {
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
      ...((data as any).fechaEnvio ? { fechaEnvio: Timestamp.fromDate(new Date((data as any).fechaEnvio)) } : {}),
      ...((data as any).validUntil ? { validUntil: Timestamp.fromDate(new Date((data as any).validUntil)) } : {}),
    };
    const cleanedData = deepCleanForFirestore(raw);
    const batch = createBatch();
    batch.update(docRef('presupuestos', id), cleanedData);
    batchAudit(batch, { action: 'update', collection: 'presupuestos', documentId: id, after: cleanedData as any });
    await batch.commit();

    // ── FLOW-03 cleanup: al anular un presupuesto aceptado, cancelar requerimientos
    // condicionales ligados (solo los `pendiente` / `aprobado` — los `comprado`/`en_compra`
    // quedan intactos porque ya son gasto comprometido — Regla G del RESEARCH). Side-effect
    // best-effort; si falla, log y sigue (admin puede limpiar manualmente).
    if (data.estado === 'anulado') {
      try {
        const pres = await this.getById(id);
        if (pres) {
          await this._cancelarRequerimientosCondicionales(id).catch(err =>
            console.error('[update anular] _cancelarRequerimientosCondicionales failed:', err),
          );
        }
      } catch (err) {
        console.error('[update anular] getById falló antes del cleanup:', err);
      }
    }

    // ── Auto-sync lead when presupuesto estado changes ──
    if (data.estado) {
      try {
        const pres = await this.getById(id);
        if (pres?.origenTipo === 'lead' && pres.origenId) {
          await leadsService.syncFromPresupuesto(pres.origenId, pres.numero, data.estado);
        }
        // ── Auto-generate requerimientos AND reserve stock when presupuesto is accepted ──
        if (data.estado === 'aceptado') {
          const itemsConStock = pres?.items?.filter(i => i.stockArticuloId) ?? [];
          for (const item of itemsConStock) {
            try {
              const articulo = await articulosService.getById(item.stockArticuloId!).catch(() => null);
              const unidades = await unidadesService.getAll({ articuloId: item.stockArticuloId!, estado: 'disponible' }).catch(() => []);
              const qtyDisponible = unidades.length;
              const stockMinimo = articulo?.stockMinimo ?? 0;
              const qtyResultante = qtyDisponible - item.cantidad;

              // --- Auto-req: create requirement if stock will fall below minimum ---
              const existingReqs = await requerimientosService.getAll({
                presupuestoId: id,
                articuloId: item.stockArticuloId!,
              }).catch(() => []);

              if (existingReqs.length === 0 && qtyResultante < stockMinimo) {
                const qtyReq = Math.max(stockMinimo - qtyResultante, item.cantidad - qtyDisponible);
                await requerimientosService.create({
                  articuloId: item.stockArticuloId ?? null,
                  articuloCodigo: articulo?.codigo ?? null,
                  articuloDescripcion: articulo?.descripcion ?? item.descripcion,
                  cantidad: qtyReq,
                  unidadMedida: articulo?.unidadMedida ?? 'unidad',
                  motivo: `Auto-generado por presupuesto ${pres!.numero} (aceptado)`,
                  origen: 'presupuesto',
                  origenRef: id,
                  estado: 'pendiente',
                  presupuestoId: id,
                  presupuestoNumero: pres!.numero ?? null,
                  proveedorSugeridoId: articulo?.proveedorIds?.[0] ?? null,
                  proveedorSugeridoNombre: null,
                  ordenCompraId: null,
                  ordenCompraNumero: null,
                  solicitadoPor: 'Sistema',
                  fechaSolicitud: new Date().toISOString(),
                  fechaAprobacion: null,
                  urgencia: 'media',
                  notas: null,
                });
              }

              // --- Auto-reserva: reserve available units up to item.cantidad ---
              const unidadesAReservar = unidades.slice(0, item.cantidad);
              for (const unidad of unidadesAReservar) {
                try {
                  await reservasService.reservar({
                    unidadId: unidad.id,
                    unidad,
                    presupuestoId: id,
                    presupuestoNumero: pres!.numero ?? '',
                    clienteId: pres!.clienteId ?? '',
                    clienteNombre: null,
                    solicitadoPorNombre: 'Sistema',
                  });
                } catch (reservaErr) {
                  console.error(`[presupuestosService] Error auto-reserva for unidad ${unidad.id}:`, reservaErr);
                  // Don't throw — continue; don't block the estado update
                }
              }
            } catch (itemErr) {
              console.error(`[presupuestosService] Error processing item ${item.stockArticuloId}:`, itemErr);
              // Don't throw — continue with other items; don't block the estado update
            }
          }
        }
      } catch (err) {
        console.error('[presupuestosService] Error syncing lead from presupuesto:', err);
      }
    }
  },

  /**
   * Atomic state transition to `enviado` — called from EnviarPresupuestoModal after the email has
   * been successfully sent (FMT-02 token-first order). A single updateDoc sets `estado + fechaEnvio`
   * without re-serializing the full form state.
   *
   * The optional `hint` lets the caller (modal / hook) pass origenTipo/origenId/numero it already
   * has in scope — avoids a wasted getById read. `numero` is required for the lead posta log to
   * render legible entries ("Presupuesto PRE-0001.01 → Enviado"); if absent we fall back to getById.
   *
   * The lead-sync side effect is replicated from update() but wrapped in its own try/catch:
   * post-send we must not throw back to the UI — the email already went out and estado is already
   * committed. Sync failure is a soft error (logged + swallowed).
   */
  async markEnviado(
    id: string,
    hint?: { origenTipo?: string | null; origenId?: string | null; numero?: string }
  ): Promise<void> {
    // YYYY-MM-DD — consistent with usePresupuestoEdit.handleEstadoChange + existing fechaEnvio reads.
    const today = new Date().toISOString().split('T')[0];
    const raw = {
      estado: 'enviado' as PresupuestoEstado,
      fechaEnvio: Timestamp.fromDate(new Date(today)),
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    };
    const cleaned = deepCleanForFirestore(raw);
    const batch = createBatch();
    batch.update(docRef('presupuestos', id), cleaned);
    batchAudit(batch, { action: 'update', collection: 'presupuestos', documentId: id, after: cleaned as any });
    await batch.commit();

    // Lead sync: prefer the hint; if any piece is missing, fall back to getById once.
    let origenTipo = hint?.origenTipo ?? undefined;
    let origenId = hint?.origenId ?? undefined;
    let numero = hint?.numero;
    if (!origenTipo || !origenId || !numero) {
      try {
        const pres = await this.getById(id);
        origenTipo = origenTipo || pres?.origenTipo || undefined;
        origenId = origenId || pres?.origenId || undefined;
        numero = numero || pres?.numero || '';
      } catch (err) {
        console.error('[presupuestosService.markEnviado] getById fallback failed:', err);
      }
    }
    // ── Sincronizar ticket origen si aplica (FLOW-01: skip auto-ticket) ──
    // N1: pass numero so the lead posta entry shows "Presupuesto ${numero} → Enviado" instead of blank.
    if (origenTipo === 'lead' && origenId) {
      try {
        await leadsService.syncFromPresupuesto(origenId, numero || '', 'enviado');
      } catch (err: any) {
        console.error('[markEnviado] leadsService.syncFromPresupuesto failed:', err);
        // FLOW-06: registrar pendingAction para retry manual desde /admin/acciones-pendientes
        await this._appendPendingAction(id, {
          type: 'crear_ticket_seguimiento',
          reason: `sync lead existente falló: ${err?.message || 'unknown'}`,
        }).catch(appendErr => console.error('[markEnviado] _appendPendingAction failed:', appendErr));
      }
    }

    // ── FLOW-01: auto-ticket de seguimiento si el presupuesto no vino de un ticket ──
    if (origenTipo !== 'lead' || !origenId) {
      try {
        const pres = await this.getById(id);
        if (pres) {
          await this._crearAutoTicketSeguimiento(pres);
        }
      } catch (err: any) {
        console.error('[markEnviado] _crearAutoTicketSeguimiento failed:', err);
        await this._appendPendingAction(id, {
          type: 'crear_ticket_seguimiento',
          reason: err?.message || 'auto-ticket fallido — causa desconocida',
        }).catch(appendErr => console.error('[markEnviado] _appendPendingAction failed:', appendErr));
      }
    }
  },

  /**
   * FLOW-01: crea el ticket de seguimiento auto-generado cuando un presupuesto pasa a
   * `enviado` sin un ticket origen. El caller (`markEnviado`) envuelve esta llamada en
   * try/catch y registra pendingAction si cualquiera de las precondiciones falla.
   *
   * Precondiciones:
   * - Presupuesto NO debe tener origen `lead` (ese ticket ya existe → no se duplica)
   * - `pres.clienteId` debe estar resuelto (si null, admin debe resolverlo en
   *   /admin/revision-clienteid y el retry dispara desde `resolverClienteIdPendiente`)
   * - `adminConfig/flujos.usuarioSeguimientoId` configurado
   * - Usuario destino debe tener `status === 'activo'`
   */
  async _crearAutoTicketSeguimiento(pres: Presupuesto): Promise<{ leadId: string }> {
    // Precondición: si ya tiene origen lead, skip — ese ticket hace las veces de seguimiento
    if (pres.origenTipo === 'lead' && pres.origenId) {
      throw new Error('Presupuesto ya tiene ticket origen — no se crea auto-ticket');
    }
    // Precondición: clienteId válido (shape del tipo dice string, pero runtime puede ser null/empty)
    const clienteId = (pres.clienteId ?? '').toString().trim();
    if (!clienteId) {
      throw new Error('clienteId null — pendiente revisión manual en /admin/revision-clienteid');
    }
    // Read adminConfig/flujos
    const cfg = await adminConfigService.getWithDefaults();
    if (!cfg.usuarioSeguimientoId) {
      throw new Error('adminConfig/flujos.usuarioSeguimientoId no configurado');
    }
    // Validar usuario activo (UserStatus union: 'pendiente' | 'activo' | 'deshabilitado')
    const usuario = await usuariosService.getById(cfg.usuarioSeguimientoId);
    if (!usuario || usuario.status !== 'activo') {
      throw new Error(`usuario fijo seguimiento no activo: ${cfg.usuarioSeguimientoId}`);
    }

    // Crear lead (Ticket). Firma real: leadsService.create(data) → Promise<string>.
    // El lead arranca en 'esperando_oc' — el presupuesto ya está enviado, paso siguiente es OC del cliente.
    const leadPayload: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'> = {
      clienteId,
      contactoId: pres.contactoId ?? null,
      razonSocial: '', // leadsService refresca si se pasa; el hidratador usa contactos/campos planos
      contactos: [],
      contacto: '',
      email: '',
      telefono: '',
      motivoLlamado: 'ventas_equipos',
      motivoContacto: `Presupuesto ${pres.numero} enviado — pendiente OC`,
      descripcion: `Auto-generado por FLOW-01 al enviar ${pres.numero}.`,
      sistemaId: pres.sistemaId ?? null,
      moduloId: null,
      estado: 'esperando_oc' as TicketEstado,
      postas: [],
      asignadoA: cfg.usuarioSeguimientoId,
      asignadoNombre: usuario.displayName ?? null,
      derivadoPor: null,
      areaActual: 'ventas' as TicketArea,
      accionPendiente: 'Esperar OC del cliente',
      adjuntos: [],
      presupuestosIds: [pres.id],
      otIds: [],
      finalizadoAt: null,
      prioridad: 'normal',
      proximoContacto: null,
      valorEstimado: pres.total ?? null,
    };
    const leadId = await leadsService.create(leadPayload);
    return { leadId };
  },

  /**
   * FLOW-06: append una pendingAction al presupuesto. Usado por `markEnviado` cuando la
   * creación del auto-ticket o el sync del lead origen falla, y por otros triggers
   * (FLOW-02/03/04) en planes posteriores.
   *
   * Write simple con deepClean — NO transaccional (el caller ya committeó el estado principal).
   * Idempotencia: cada action tiene un id único por `crypto.randomUUID()` — duplicados posibles
   * si el caller reintenta, pero son visualmente distintos en el dashboard.
   */
  async _appendPendingAction(
    presupuestoId: string,
    action: Omit<PendingAction, 'id' | 'createdAt' | 'attempts'>,
  ): Promise<void> {
    const pres = await this.getById(presupuestoId);
    if (!pres) return;
    const newAction: PendingAction = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      attempts: 0,
      ...action,
    };
    const updated = [...(pres.pendingActions || []), newAction];
    await updateDoc(
      doc(db, 'presupuestos', presupuestoId),
      deepCleanForFirestore({
        pendingActions: updated,
        ...getUpdateTrace(),
        updatedAt: Timestamp.now(),
      }),
    );
  },

  /**
   * FLOW-06: retry de una `PendingAction` específica de un presupuesto.
   *
   * - Siempre incrementa `attempts` (éxito o falla).
   * - Setea `resolvedAt` solo si el handler corrió sin lanzar.
   * - Handler switcheado por `action.type`:
   *   - `crear_ticket_seguimiento` → reintenta `_crearAutoTicketSeguimiento(pres)`.
   *   - `derivar_comex` → v2.0 no-op success (el requerimiento condicional ya debería existir
   *     por FLOW-03; si existe una action de este tipo es por versiones legacy).
   *   - `notificar_coordinador_ot` → v2.0 no-op success (el posting al coordinador es best-effort;
   *     la UI del dashboard marca "OK" al ejecutar).
   *   - `enviar_mail_facturacion` → retorna error pidiendo retry desde el botón específico
   *     del dashboard (implementado por plan 08-05 con OAuth del admin).
   *   - default → retorna error 'tipo no soportado'.
   *
   * Usado por el dashboard `/admin/acciones-pendientes` (plan 08-05) y por
   * `retryPendingActionsForCliente` (trigger retroactivo desde resolverClienteIdPendiente).
   */
  async retryPendingAction(
    presupuestoId: string,
    actionId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const pres = await this.getById(presupuestoId);
    if (!pres) return { success: false, error: 'Presupuesto no encontrado' };
    const action = (pres.pendingActions || []).find(a => a.id === actionId);
    if (!action) return { success: false, error: 'Action no encontrada' };
    if (action.resolvedAt) return { success: true };

    let success = false;
    let error: string | undefined;
    try {
      switch (action.type) {
        case 'crear_ticket_seguimiento':
          await this._crearAutoTicketSeguimiento(pres);
          success = true;
          break;
        case 'derivar_comex':
          // v2.0: no-op success. El requerimiento condicional ya se crea en FLOW-03 al `aceptado`.
          // Este tipo de action solo quedaría registrado por un bug o una versión legacy —
          // marcar resuelto sin side-effect. Plan 08-04 puede extender si detecta casos reales.
          success = true;
          break;
        case 'notificar_coordinador_ot':
          // v2.0: no-op success. El posting al coordinador es best-effort en el dashboard.
          success = true;
          break;
        case 'enviar_mail_facturacion':
          // Plan 08-05 implementa retry con OAuth del admin desde el dashboard específico.
          return { success: false, error: 'retry desde /admin/acciones-pendientes botón específico (plan 08-05)' };
        default:
          return { success: false, error: `tipo no soportado: ${(action as PendingAction).type}` };
      }
    } catch (err: any) {
      error = err?.message || 'Error desconocido';
    }

    // Update: attempts++ siempre; resolvedAt solo si success
    const updatedActions = (pres.pendingActions || []).map(a => {
      if (a.id !== actionId) return a;
      return {
        ...a,
        attempts: (a.attempts || 0) + 1,
        ...(success ? { resolvedAt: new Date().toISOString() } : {}),
      };
    });
    await updateDoc(
      doc(db, 'presupuestos', presupuestoId),
      deepCleanForFirestore({
        pendingActions: updatedActions,
        ...getUpdateTrace(),
        updatedAt: Timestamp.now(),
      }),
    );

    if (!success) console.error(`[retryPendingAction] ${action.type} failed:`, error);
    return success ? { success: true } : { success: false, error };
  },

  /**
   * FLOW-06: retry retroactivo de todas las pendingActions no resueltas de los presupuestos
   * asociados a un cliente. Disparado desde `leadsService.resolverClienteIdPendiente` cuando
   * el admin resuelve un clienteId desde `/admin/revision-clienteid`.
   *
   * Nota: solo matchea presupuestos cuyo `clienteId === clienteId` (query where). Los
   * presupuestos con `clienteId === null/empty` no aparecen aquí — esos requieren resolver
   * el clienteId del presupuesto antes (scope fuera de 08-03).
   */
  async retryPendingActionsForCliente(
    clienteId: string,
  ): Promise<{ retried: number; successful: number; failed: number }> {
    const presupuestos = await this.getByCliente(clienteId);
    let retried = 0;
    let successful = 0;
    let failed = 0;
    for (const pres of presupuestos) {
      const pendientes = (pres.pendingActions || []).filter(a => !a.resolvedAt);
      for (const action of pendientes) {
        retried++;
        const result = await this.retryPendingAction(pres.id, action.id);
        if (result.success) successful++;
        else failed++;
      }
    }
    return { retried, successful, failed };
  },

  /**
   * FLOW-06: marca una pendingAction como resuelta manualmente sin ejecutar la acción real.
   * Uso: el admin ya hizo el trabajo afuera del sistema (ej: mandó el mail manualmente)
   * y solo quiere cerrar la fila en el dashboard.
   *
   * Setea `resolvedAt` al timestamp actual — NO incrementa `attempts`.
   */
  async markPendingActionResolved(
    presupuestoId: string,
    actionId: string,
  ): Promise<void> {
    const pres = await this.getById(presupuestoId);
    if (!pres) return;
    const updatedActions = (pres.pendingActions || []).map(a =>
      a.id === actionId ? { ...a, resolvedAt: new Date().toISOString() } : a,
    );
    await updateDoc(
      doc(db, 'presupuestos', presupuestoId),
      deepCleanForFirestore({
        pendingActions: updatedActions,
        ...getUpdateTrace(),
        updatedAt: Timestamp.now(),
      }),
    );
  },

  /**
   * Lista los presupuestos de un cliente. Usado por `retryPendingActionsForCliente` para
   * iterar pendingActions. `getAll({ clienteId })` ya existe — este helper es un alias con
   * shape más directo para callers que solo necesitan los presupuestos crudos.
   */
  async getByCliente(clienteId: string): Promise<Presupuesto[]> {
    const q = query(collection(db, 'presupuestos'), where('clienteId', '==', clienteId));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        estado: migrateEstado(data.estado),
        createdAt: toISO(data.createdAt, ''),
        updatedAt: toISO(data.updatedAt, ''),
        validUntil: toISO(data.validUntil),
        fechaEnvio: toISO(data.fechaEnvio),
      } as Presupuesto;
    });
  },

  /**
   * FLOW-03: Acepta un presupuesto y, si tiene ítems con `itemRequiereImportacion === true`,
   * crea requerimientos condicionales atómicamente en una sola `runTransaction`:
   *   - `tx.set` de 1 requerimiento por ítem con `condicional: true`
   *   - `tx.update` del presupuesto a `estado: 'aceptado'`
   *
   * Invariantes:
   *  - Numeros de requerimiento se pre-reservan FUERA de la tx (porque getNextNumber hace
   *    un getDocs sequential read que NO se puede anidar en tx). Computamos el max base
   *    una vez y generamos N+1, N+2, ..., N+k locally.
   *  - NO `arrayUnion` / `increment` dentro de la tx (Firestore tx constraint — sentinel values
   *    no son transaccionales).
   *  - Idempotente: si el presupuesto ya está `aceptado`, la tx es no-op para el estado
   *    y no se crean nuevos requerimientos.
   *  - Post-commit side-effects (sync lead + intento de derivación a materiales_comex) se
   *    ejecutan FUERA de la tx; fallos se registran como `pendingAction` via
   *    `_appendPendingAction` (definido en plan 08-03).
   *
   * @returns `{ requerimientosIds }` — ids creados (puede ser [] si no hay items de import).
   */
  async aceptarConRequerimientos(
    presupuestoId: string,
    actor?: { uid: string; name?: string },
  ): Promise<{ requerimientosIds: string[] }> {
    // ── Paso 1: leer presupuesto + identificar ítems de importación ──
    const pres = await this.getById(presupuestoId);
    if (!pres) throw new Error('Presupuesto no encontrado');
    if (pres.estado === 'aceptado') return { requerimientosIds: [] };

    const itemsImport = (pres.items || []).filter(
      (it: any) => it?.itemRequiereImportacion === true && it?.stockArticuloId,
    );

    // ── Paso 2: pre-reservar números de requerimiento (FUERA de tx) ──
    // requerimientosService.getNextNumber hace getDocs sequential — no es seguro dentro de
    // runTransaction (no se pueden anidar reads con writes de otras colecciones de forma
    // arbitraria). Computamos el max una vez y generamos N numeros consecutivos.
    const numerosReservados: string[] = [];
    if (itemsImport.length > 0) {
      const qReq = query(collection(db, 'requerimientos_compra'), orderBy('numero', 'desc'));
      const snapReq = await getDocs(qReq);
      let maxNum = 0;
      snapReq.docs.forEach(d => {
        const m = d.data().numero?.match(/REQ-(\d+)/);
        if (m) { const n = parseInt(m[1]); if (n > maxNum) maxNum = n; }
      });
      for (let i = 1; i <= itemsImport.length; i++) {
        numerosReservados.push(`REQ-${String(maxNum + i).padStart(4, '0')}`);
      }
    }

    // ── Paso 3: pre-cargar datos de artículos para payload (FUERA de tx) ──
    // Evita reads-during-writes conflict dentro de tx (reads primero, writes después es hard rule).
    const articulosData = new Map<string, any>();
    for (const item of itemsImport) {
      const art = await articulosService.getById((item as any).stockArticuloId!).catch(() => null);
      if (art) articulosData.set((item as any).stockArticuloId!, art);
    }

    // ── Paso 4: runTransaction atómico ──
    const newReqIds: string[] = [];

    await runTransaction(db, async (tx) => {
      const presRef = doc(db, 'presupuestos', presupuestoId);
      // Read-before-write (hard rule runTransaction)
      const presSnap = await tx.get(presRef);
      if (!presSnap.exists()) throw new Error('Presupuesto no encontrado');
      const pp = presSnap.data() as Presupuesto;
      // Idempotencia: si otra tx ya aceptó, salir
      if (pp.estado === 'aceptado') return;

      // Crear requerimientos condicionales (tx.set)
      itemsImport.forEach((item: any, idx: number) => {
        const reqRef = doc(collection(db, 'requerimientos_compra'));
        newReqIds.push(reqRef.id);
        const articulo = articulosData.get(item.stockArticuloId) || null;
        const payload = deepCleanForFirestore({
          numero: numerosReservados[idx],
          articuloId: item.stockArticuloId,
          articuloCodigo: item.codigoProducto || articulo?.codigo || null,
          articuloDescripcion: item.descripcion || articulo?.descripcion || '',
          cantidad: item.cantidad,
          unidadMedida: item.unidad || articulo?.unidadMedida || 'unidad',
          motivo: 'Auto — items sin stock en presupuesto aceptado',
          origen: 'presupuesto',
          origenRef: presupuestoId,
          estado: 'pendiente',
          condicional: true,
          presupuestoId,
          presupuestoNumero: pp.numero,
          proveedorSugeridoId: articulo?.proveedorIds?.[0] ?? null,
          proveedorSugeridoNombre: null,
          ordenCompraId: null,
          ordenCompraNumero: null,
          solicitadoPor: actor?.name || 'Sistema',
          fechaSolicitud: Timestamp.fromDate(new Date()),
          fechaAprobacion: null,
          urgencia: 'media',
          notas: null,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          createdBy: actor?.uid ?? null,
          createdByName: actor?.name ?? null,
        });
        tx.set(reqRef, payload);
      });

      // Update del presupuesto a 'aceptado'
      tx.update(presRef, deepCleanForFirestore({
        estado: 'aceptado',
        updatedAt: Timestamp.now(),
        updatedBy: actor?.uid ?? null,
        updatedByName: actor?.name ?? null,
      }));
    });

    // ── Paso 5: post-commit side-effects (best-effort, fuera de tx) ──
    // Sync lead si aplica
    if (pres.origenTipo === 'lead' && pres.origenId) {
      try {
        await leadsService.syncFromPresupuesto(pres.origenId, pres.numero, 'aceptado');
      } catch (err) {
        console.error('[aceptarConRequerimientos] syncFromPresupuesto failed:', err);
      }
    }

    // Intento de derivación a materiales_comex — area NO está en TicketArea v2.0,
    // así que no podemos invocar derivar() con tipo estricto. Por pragmatismo, registramos
    // pendingAction directamente (best-effort derivation es un no-op en v2.0 hasta que
    // TicketArea incluya 'materiales_comex' — deferred para v2.1 o cuando se extienda shared).
    if (itemsImport.length > 0) {
      try {
        await this._appendPendingAction(presupuestoId, {
          type: 'derivar_comex',
          reason: `Auto — ${itemsImport.length} items requieren importación; derivación a área materiales_comex pendiente (requiere extender TicketArea — v2.1).`,
        });
      } catch (err) {
        console.error('[aceptarConRequerimientos] _appendPendingAction failed:', err);
      }
    }

    // ── Paso 6: Phase 10 — si tipo === 'ventas', auto-crear ticket en_coordinacion
    // para el coordinador OT. Reemplaza la auto-OT genérica (decisión 2026-04-22):
    // un ppto ventas puede requerir 5-6 OTs (bench / entrega / instalación / QI / QO);
    // crear 1 OT genérica confundía a la coordinadora. Ahora el ticket informa la
    // aceptación y la coordinadora arma manualmente las OTs que correspondan
    // (0, 1 o muchas). La cosecha Items→OT queda como refinamiento futuro.
    if (pres.tipo === 'ventas') {
      try {
        const clienteIdStr = (pres.clienteId ?? '').toString().trim();
        if (!clienteIdStr) {
          throw new Error('clienteId null — resolver en /admin/revision-clienteid');
        }
        const cfg = await adminConfigService.getWithDefaults();
        const coordId = cfg.usuarioCoordinadorOTId;
        if (!coordId) {
          await this._appendPendingAction(presupuestoId, {
            type: 'notificar_coordinador_ot',
            reason: `Auto ventas — ppto ${pres.numero} aceptado; falta adminConfig.usuarioCoordinadorOTId. Configurar en /admin/config-flujos y reintentar desde /admin/acciones-pendientes.`,
          });
        } else {
          const coordinador = await usuariosService.getById(coordId);
          if (!coordinador || coordinador.status !== 'activo') {
            throw new Error(`coordinador OT ${coordId} no existe o no está activo`);
          }
          const fechaEntrega = pres.ventasMetadata?.fechaEstimadaEntrega ?? null;
          // Circuito unificado: un solo ticket por oportunidad comercial que va
          // cambiando de estado. Buscar ticket existente linkeado al ppto en
          // estado no-terminal y TRANSICIONARLO a `en_coordinacion`. Si no hay
          // ticket (user saltó `enviado` y fue directo a aceptado) → crear uno.
          const existingSnap = await getDocs(
            query(collection(db, 'leads'), where('presupuestosIds', 'array-contains', presupuestoId)),
          );
          const TERMINAL: TicketEstado[] = ['finalizado', 'no_concretado'];
          const reusable = existingSnap.docs
            .map(d => ({ ...(d.data() as Lead), id: d.id }))
            .filter(t => !TERMINAL.includes(t.estado));
          // Excluir tickets ya en `en_coordinacion` o estados posteriores
          // (ot_creada/ot_coordinada/ot_realizada/pendiente_facturacion) — significa
          // que el ticket ya pasó por este gate. Idempotency.
          const POST_COORD: TicketEstado[] = ['en_coordinacion', 'ot_creada', 'ot_coordinada', 'ot_realizada', 'pendiente_facturacion'];
          const needsTransition = reusable.filter(t => !POST_COORD.includes(t.estado));
          const alreadyCoord = reusable.filter(t => POST_COORD.includes(t.estado));

          if (alreadyCoord.length > 0) {
            console.log(`[aceptarConRequerimientos] ticket ya en coordinación+ para ppto ${pres.numero} (${alreadyCoord[0].id}), skip`);
          } else if (needsTransition.length > 0) {
            // Transicionar el primer ticket reusable (normalmente hay 1 solo).
            const existing = needsTransition[0];
            const posta: Posta = {
              id: crypto.randomUUID(),
              fecha: new Date().toISOString(),
              deUsuarioId: actor?.uid ?? 'system',
              deUsuarioNombre: actor?.name ?? 'Sistema',
              aUsuarioId: coordId,
              aUsuarioNombre: coordinador.displayName ?? '',
              comentario: `Ppto ${pres.numero} aceptado — derivado a coordinación OT`,
              estadoAnterior: existing.estado,
              estadoNuevo: 'en_coordinacion' as TicketEstado,
            };
            await leadsService.update(existing.id, {
              estado: 'en_coordinacion' as TicketEstado,
              asignadoA: coordId,
              asignadoNombre: coordinador.displayName ?? null,
              areaActual: 'ing_soporte' as TicketArea,
              accionPendiente: 'Crear OT(s) necesarias para el presupuesto aceptado',
              proximoContacto: fechaEntrega,
              valorEstimado: pres.total ?? null,
              postas: [...(existing.postas || []), posta],
            });
            console.log(`[aceptarConRequerimientos] ticket ${existing.id} transicionado a en_coordinacion para ppto ${pres.numero}`);
          } else {
            // No existe ticket — crear uno (user saltó envío y fue directo a aceptado).
            const ticketPayload: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'> = {
              clienteId: clienteIdStr,
              contactoId: pres.contactoId ?? null,
              razonSocial: '',
              contactos: [],
              contacto: '',
              email: '',
              telefono: '',
              motivoLlamado: 'ventas_equipos',
              motivoContacto: `Ppto ventas ${pres.numero} aceptado — coordinar OTs`,
              descripcion: `Ppto ${pres.numero} (tipo: ventas) aceptado. Coordinar las OTs que correspondan (bench / entrega / instalación / QI / QO) según los items del presupuesto. Puede requerir 0, 1 o múltiples OTs — criterio operativo del coordinador.`,
              sistemaId: pres.sistemaId ?? null,
              moduloId: null,
              estado: 'en_coordinacion' as TicketEstado,
              postas: [],
              asignadoA: coordId,
              asignadoNombre: coordinador.displayName ?? null,
              derivadoPor: null,
              areaActual: 'ing_soporte' as TicketArea,
              accionPendiente: 'Crear OT(s) necesarias para el presupuesto aceptado',
              adjuntos: [],
              presupuestosIds: [presupuestoId],
              otIds: [],
              finalizadoAt: null,
              prioridad: 'normal',
              proximoContacto: fechaEntrega,
              valorEstimado: pres.total ?? null,
            };
            const ticketId = await leadsService.create(ticketPayload);
            console.log(`[aceptarConRequerimientos] auto-ticket coordinación creado (sin predecesor): ${ticketId} para ppto ${pres.numero}`);
          }
        }
      } catch (err) {
        console.error('[aceptarConRequerimientos] auto-ticket coordinación falló:', err);
        await this._appendPendingAction(presupuestoId, {
          type: 'notificar_coordinador_ot',
          reason: `Auto ventas — ppto ${pres.numero} aceptado; ticket coordinación falló: ${err instanceof Error ? err.message : String(err)}. Reintentar desde /admin/acciones-pendientes.`,
        }).catch(() => {});
      }
    }

    return { requerimientosIds: newReqIds };
  },

  /**
   * Intenta transicionar un presupuesto a `finalizado` verificando que TODAS las
   * OTs work-unit (children, o parents standalone sin children) estén FINALIZADO
   * AND todas las solicitudesFacturacion vinculadas estén en estado `facturada`.
   *
   * Se llama desde:
   * - `otService.update` cuando una OT transiciona a FINALIZADO (replaces the
   *   old `_syncPresupuestoOnFinalize` que solo miraba parents — bug: parents
   *   son contenedores que nunca llegan a FINALIZADO).
   * - `facturacionService.marcarFacturada` después de actualizar la solicitud.
   *
   * Idempotente — no-op si el ppto ya está `finalizado` o `anulado`.
   * Si no hay solicitudesFacturacion vinculadas (caso: ppto que nunca pasó por
   * cierre admin ni facturación anticipada), el check de facturación se skipea
   * y solo se exige que las OTs estén FINALIZADO.
   */
  async trySyncFinalizacion(presupuestoId: string): Promise<void> {
    const pres = await this.getById(presupuestoId);
    if (!pres) return;
    if (pres.estado === 'finalizado' || pres.estado === 'anulado') return;

    // Lazy import para romper circular dep (otService ↔ presupuestosService).
    const { ordenesTrabajoService } = await import('./otService');
    const { facturacionService } = await import('./facturacionService');

    // ── Check 1: todas las work-unit OTs vinculadas en FINALIZADO ─────────
    const allOTs = await ordenesTrabajoService.getAll();
    const otsForPres = allOTs.filter(o => (o.budgets || []).includes(pres.numero));
    if (otsForPres.length === 0) return; // sin OTs aún, nada que finalizar

    // Work-unit = (tiene punto → child) OR (sin punto AND sin children entre los OTs).
    const parentsWithChildren = new Set<string>();
    for (const o of otsForPres) {
      if (o.otNumber.includes('.')) {
        parentsWithChildren.add(o.otNumber.split('.')[0]);
      }
    }
    const workUnitOTs = otsForPres.filter(o => {
      if (o.otNumber.includes('.')) return true; // child siempre es work-unit
      return !parentsWithChildren.has(o.otNumber); // parent sin children = standalone
    });
    if (workUnitOTs.length === 0) return; // solo parents con children que quedaron afuera — raro, skip
    const allOTsFinalized = workUnitOTs.every(o => o.estadoAdmin === 'FINALIZADO');
    if (!allOTsFinalized) return;

    // ── Check 2: todas las solicitudesFacturacion vinculadas en `facturada` ──
    const solicitudes = await facturacionService.getByPresupuesto(presupuestoId).catch(() => []);
    if (solicitudes.length > 0) {
      const allFacturadas = solicitudes.every(s => s.estado === 'facturada');
      if (!allFacturadas) return;
    }
    // (si solicitudes.length === 0, asumir que no hay facturación requerida y avanzar)

    // ── Transicionar ppto a finalizado ────────────────────────────────────
    await this.update(presupuestoId, { estado: 'finalizado' } as any);
    console.log(`[trySyncFinalizacion] presupuesto ${pres.numero} → finalizado`);
  },

  /**
   * FLOW-03 cleanup: al anular un presupuesto aceptado, cancelar los requerimientos
   * condicionales (`condicional: true`) ligados a él.
   *
   * Regla G (RESEARCH): solo cancelar los que están en `pendiente` o `aprobado`. Los que
   * están en `comprado` o `en_compra` ya son gasto comprometido y se dejan intactos —
   * el admin puede manejarlos manualmente si procede devolver / cancelar con proveedor.
   *
   * Usa `createBatch()` (no runTransaction) — el volumen esperado es bajo (<10 reqs) y
   * no hay constraints de atomicidad multi-doc: cada requerimiento es independiente.
   *
   * @returns `{ cancelled, skipped }` — ambos counts para logging / UI.
   */
  async _cancelarRequerimientosCondicionales(
    presupuestoId: string,
    actor?: { uid: string; name?: string },
  ): Promise<{ cancelled: number; skipped: number }> {
    // Leer requerimientos asociados al presupuesto
    const allReqs = await requerimientosService.getAll({ presupuestoId }).catch(() => [] as RequerimientoCompra[]);
    const condicionales = allReqs.filter(r => (r as any).condicional === true);
    const cancellables = condicionales.filter(r => r.estado === 'pendiente' || r.estado === 'aprobado');
    const skipped = condicionales.length - cancellables.length;

    if (cancellables.length === 0) return { cancelled: 0, skipped };

    const batch = createBatch();
    for (const r of cancellables) {
      const payload = deepCleanForFirestore({
        estado: 'cancelado',
        canceladoPor: 'presupuesto_anulado',
        ...getUpdateTrace(),
        updatedAt: Timestamp.now(),
        updatedBy: actor?.uid ?? null,
        updatedByName: actor?.name ?? null,
      });
      batch.update(docRef('requerimientos_compra', r.id), payload);
      batchAudit(batch, { action: 'update', collection: 'requerimientos_compra', documentId: r.id, after: payload as any });
    }
    await batch.commit();
    console.log(`[_cancelarRequerimientosCondicionales] cancelled=${cancellables.length} skipped=${skipped} pres=${presupuestoId}`);
    return { cancelled: cancellables.length, skipped };
  },

  // Crear revisión de un presupuesto (anula el original)
  async createRevision(id: string, motivo: string): Promise<{ id: string; numero: string }> {
    const original = await this.getById(id);
    if (!original) throw new Error('Presupuesto no encontrado');

    // Extraer base y calcular siguiente revisión
    const base = this._extractBase(original.numero);
    const baseStr = `PRE-${String(base).padStart(4, '0')}`;

    // Buscar todas las revisiones de la misma familia
    const allSnap = await getDocs(collection(db, 'presupuestos'));
    let maxRev = 0;
    allSnap.docs.forEach(d => {
      const num = d.data().numero as string;
      if (this._extractBase(num) === base) {
        const rev = this._extractRevision(num);
        if (rev && rev > maxRev) maxRev = rev;
        // Legacy sin sufijo cuenta como revisión 0
        if (!rev && num === baseStr) maxRev = Math.max(maxRev, 0);
      }
    });

    const nextRev = maxRev + 1;
    const newNumero = `${baseStr}.${String(nextRev).padStart(2, '0')}`;
    const newVersion = nextRev;

    // Crear nuevo presupuesto (revisión)
    const { id: _id, createdAt: _ca, updatedAt: _ua, motivoAnulacion: _ma, anuladoPorId: _ap, ...rest } = original;
    const result = await this.create({
      ...rest,
      numero: newNumero,
      version: newVersion,
      presupuestoOrigenId: id,
      estado: 'borrador',
      items: original.items.map(i => ({ ...i, id: crypto.randomUUID() })),
      fechaEnvio: undefined,
      validUntil: undefined,
      adjuntos: [],
      ordenesCompraIds: [],
      motivoAnulacion: null,
      anuladoPorId: null,
    });

    // Anular el presupuesto original
    await this.update(id, {
      estado: 'anulado',
      motivoAnulacion: motivo,
      anuladoPorId: result.id,
    });

    // Si hay lead vinculado, linkear nuevo presupuesto y agregar posta
    if (original.origenTipo === 'lead' && original.origenId) {
      try {
        await leadsService.linkPresupuesto(original.origenId, result.id);
        const lead = await leadsService.getById(original.origenId);
        if (lead) {
          const posta: Posta = {
            id: crypto.randomUUID(),
            fecha: new Date().toISOString(),
            deUsuarioId: 'sistema',
            deUsuarioNombre: 'Sistema',
            aUsuarioId: lead.asignadoA || '',
            aUsuarioNombre: lead.asignadoNombre || '',
            comentario: `Presupuesto ${original.numero} anulado → revisión ${newNumero} creada. Motivo: ${motivo}`,
            estadoAnterior: lead.estado,
            estadoNuevo: lead.estado,
          };
          await leadsService.agregarComentario(original.origenId, posta);
        }
      } catch (e) {
        console.error('Error actualizando lead:', e);
      }
    }

    console.log(`✅ Revisión creada: ${newNumero} (anulado: ${original.numero})`);
    return result;
  },

  // Obtener historial de revisiones de una familia de presupuestos
  async getRevisionHistory(numero: string): Promise<Presupuesto[]> {
    const base = this._extractBase(numero);
    const allSnap = await getDocs(collection(db, 'presupuestos'));
    const family: Presupuesto[] = [];

    allSnap.docs.forEach(d => {
      const data = d.data();
      if (this._extractBase(data.numero) === base) {
        family.push({
          id: d.id,
          ...data,
          estado: migrateEstado(data.estado),
          createdAt: toISO(data.createdAt, ''),
          updatedAt: toISO(data.updatedAt, ''),
          validUntil: toISO(data.validUntil),
          fechaEnvio: toISO(data.fechaEnvio),
          proximoContacto: data.proximoContacto ?? null,
          responsableId: data.responsableId ?? null,
          responsableNombre: data.responsableNombre ?? null,
        } as Presupuesto);
      }
    });

    // Ordenar por número ascendente
    family.sort((a, b) => a.numero.localeCompare(b.numero));
    return family;
  },

  // Eliminar presupuesto (baja lógica)
  async delete(id: string) {
    const batch = createBatch();
    batch.update(docRef('presupuestos', id), {
      estado: 'borrador' as PresupuestoEstado,
      updatedAt: Timestamp.now(),
    });
    batchAudit(batch, { action: 'delete', collection: 'presupuestos', documentId: id });
    await batch.commit();
  },

  async hardDelete(id: string) {
    const batch = createBatch();
    batch.delete(docRef('presupuestos', id));
    batchAudit(batch, { action: 'delete', collection: 'presupuestos', documentId: id });
    await batch.commit();
  },
};

// Servicio para Ordenes de Compra
export const ordenesCompraService = {
  async getNextOCNumber(): Promise<string> {
    const q = query(collection(db, 'ordenes_compra'), orderBy('numero', 'desc'));
    const snap = await getDocs(q);
    let maxNum = 0;
    snap.docs.forEach(d => {
      const match = d.data().numero?.match(/OC-(\d+)/);
      if (match) { const n = parseInt(match[1]); if (n > maxNum) maxNum = n; }
    });
    return `OC-${String(maxNum + 1).padStart(4, '0')}`;
  },

  async getAll(filters?: { estado?: string; tipo?: string; proveedorId?: string }): Promise<OrdenCompra[]> {
    const constraints: any[] = [orderBy('createdAt', 'desc')];
    if (filters?.estado) constraints.unshift(where('estado', '==', filters.estado));
    if (filters?.tipo) constraints.unshift(where('tipo', '==', filters.tipo));
    if (filters?.proveedorId) constraints.unshift(where('proveedorId', '==', filters.proveedorId));
    const q = query(collection(db, 'ordenes_compra'), ...constraints);
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      fechaRecepcion: d.data().fechaRecepcion?.toDate?.()?.toISOString() ?? null,
      fechaProforma: d.data().fechaProforma?.toDate?.()?.toISOString() ?? null,
      fechaEntregaEstimada: d.data().fechaEntregaEstimada?.toDate?.()?.toISOString() ?? null,
      createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    })) as OrdenCompra[];
  },

  async getById(id: string): Promise<OrdenCompra | null> {
    const snap = await getDoc(doc(db, 'ordenes_compra', id));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      id: snap.id,
      ...d,
      fechaRecepcion: d.fechaRecepcion?.toDate?.()?.toISOString() ?? null,
      fechaProforma: d.fechaProforma?.toDate?.()?.toISOString() ?? null,
      fechaEntregaEstimada: d.fechaEntregaEstimada?.toDate?.()?.toISOString() ?? null,
      createdAt: d.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      updatedAt: d.updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    } as OrdenCompra;
  },

  async create(data: Omit<OrdenCompra, 'id' | 'createdAt' | 'updatedAt' | 'numero'> & { numero?: string }): Promise<string> {
    const numero = data.numero || await this.getNextOCNumber();
    const id = crypto.randomUUID();
    const payload: any = {
      ...cleanFirestoreData(data as any),
      ...getCreateTrace(),
      numero,
      items: data.items || [],
      presupuestoIds: data.presupuestoIds || [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    if (data.fechaRecepcion) payload.fechaRecepcion = Timestamp.fromDate(new Date(data.fechaRecepcion));
    if (data.fechaProforma) payload.fechaProforma = Timestamp.fromDate(new Date(data.fechaProforma));
    if (data.fechaEntregaEstimada) payload.fechaEntregaEstimada = Timestamp.fromDate(new Date(data.fechaEntregaEstimada));
    const batch = createBatch();
    batch.set(doc(db, 'ordenes_compra', id), payload);
    batchAudit(batch, { action: 'create', collection: 'ordenes_compra', documentId: id, after: payload as any });
    await batch.commit();
    return id;
  },

  async update(id: string, data: Partial<OrdenCompra>): Promise<void> {
    const payload: any = { ...cleanFirestoreData(data as any), ...getUpdateTrace(), updatedAt: Timestamp.now() };
    if (data.fechaRecepcion) payload.fechaRecepcion = Timestamp.fromDate(new Date(data.fechaRecepcion));
    if (data.fechaProforma) payload.fechaProforma = Timestamp.fromDate(new Date(data.fechaProforma));
    if (data.fechaEntregaEstimada) payload.fechaEntregaEstimada = Timestamp.fromDate(new Date(data.fechaEntregaEstimada));
    const batch = createBatch();
    batch.update(docRef('ordenes_compra', id), payload);
    batchAudit(batch, { action: 'update', collection: 'ordenes_compra', documentId: id, after: payload as any });
    await batch.commit();
  },

  async delete(id: string): Promise<void> {
    const batch = createBatch();
    batch.delete(docRef('ordenes_compra', id));
    batchAudit(batch, { action: 'delete', collection: 'ordenes_compra', documentId: id });
    await batch.commit();
  },

  subscribe(
    filters: { estado?: string; tipo?: string; proveedorId?: string } | undefined,
    callback: (items: OrdenCompra[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    const constraints: any[] = [orderBy('createdAt', 'desc')];
    if (filters?.estado) constraints.unshift(where('estado', '==', filters.estado));
    if (filters?.tipo) constraints.unshift(where('tipo', '==', filters.tipo));
    if (filters?.proveedorId) constraints.unshift(where('proveedorId', '==', filters.proveedorId));
    const q = query(collection(db, 'ordenes_compra'), ...constraints);
    return onSnapshot(q, snap => {
      callback(snap.docs.map(d => ({
        id: d.id, ...d.data(),
        fechaRecepcion: d.data().fechaRecepcion?.toDate?.()?.toISOString() ?? null,
        fechaProforma: d.data().fechaProforma?.toDate?.()?.toISOString() ?? null,
        fechaEntregaEstimada: d.data().fechaEntregaEstimada?.toDate?.()?.toISOString() ?? null,
        createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
        updatedAt: d.data().updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      })) as OrdenCompra[]);
    }, err => { console.error('OC subscription error:', err); onError?.(err); });
  },
};

// Servicio para Categorías de Presupuesto
export const categoriasPresupuestoService = {
  // Obtener todas las categorías
  async getAll() {
    console.log('📥 Cargando categorías de presupuesto...');
    const querySnapshot = await getDocs(collection(db, 'categorias_presupuesto'));
    const categorias = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() ?? '',
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() ?? '',
    })) as CategoriaPresupuesto[];

    categorias.sort((a, b) => a.nombre.localeCompare(b.nombre));
    console.log(`✅ ${categorias.length} categorías de presupuesto cargadas`);
    return categorias;
  },

  // Obtener categoría por ID
  async getById(id: string) {
    const docRef = doc(db, 'categorias_presupuesto', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate?.()?.toISOString() ?? '',
        updatedAt: docSnap.data().updatedAt?.toDate?.()?.toISOString() ?? '',
      } as CategoriaPresupuesto;
    }
    return null;
  },

  // Crear categoría
  async create(categoriaData: Omit<CategoriaPresupuesto, 'id' | 'createdAt' | 'updatedAt'>) {
    const payload = {
      ...categoriaData,
      ...getCreateTrace(),
      activo: categoriaData.activo !== undefined ? categoriaData.activo : true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    const ref = newDocRef('categorias_presupuesto');
    const batch = createBatch();
    batch.set(ref, payload);
    batchAudit(batch, { action: 'create', collection: 'categorias_presupuesto', documentId: ref.id, after: payload as any });
    await batch.commit();
    return ref.id;
  },

  // Actualizar categoría
  async update(id: string, data: Partial<Omit<CategoriaPresupuesto, 'id' | 'createdAt' | 'updatedAt'>>) {
    const payload = {
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    };
    const batch = createBatch();
    batch.update(docRef('categorias_presupuesto', id), payload);
    batchAudit(batch, { action: 'update', collection: 'categorias_presupuesto', documentId: id, after: payload as any });
    await batch.commit();
  },

  // Eliminar categoría
  async delete(id: string) {
    const batch = createBatch();
    batch.delete(docRef('categorias_presupuesto', id));
    batchAudit(batch, { action: 'delete', collection: 'categorias_presupuesto', documentId: id });
    await batch.commit();
  },
};

// Servicio para Condiciones de Pago
export const condicionesPagoService = {
  // Obtener todas las condiciones
  async getAll() {
    console.log('📥 Cargando condiciones de pago...');
    const querySnapshot = await getDocs(collection(db, 'condiciones_pago'));
    const condiciones = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as CondicionPago[];

    condiciones.sort((a, b) => a.nombre.localeCompare(b.nombre));
    console.log(`✅ ${condiciones.length} condiciones de pago cargadas`);
    return condiciones;
  },

  // Obtener condición por ID
  async getById(id: string) {
    const docRef = doc(db, 'condiciones_pago', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as CondicionPago;
    }
    return null;
  },

  // Crear condición
  async create(condicionData: Omit<CondicionPago, 'id'>) {
    const payload = {
      ...condicionData,
      ...getCreateTrace(),
      activo: condicionData.activo !== undefined ? condicionData.activo : true,
    };
    const ref = newDocRef('condiciones_pago');
    const batch = createBatch();
    batch.set(ref, payload);
    batchAudit(batch, { action: 'create', collection: 'condiciones_pago', documentId: ref.id, after: payload as any });
    await batch.commit();
    return ref.id;
  },

  // Actualizar condición
  async update(id: string, data: Partial<Omit<CondicionPago, 'id'>>) {
    const payload = { ...data, ...getUpdateTrace() };
    const batch = createBatch();
    batch.update(docRef('condiciones_pago', id), payload);
    batchAudit(batch, { action: 'update', collection: 'condiciones_pago', documentId: id, after: payload as any });
    await batch.commit();
  },

  // Eliminar condición
  async delete(id: string) {
    const batch = createBatch();
    batch.delete(docRef('condiciones_pago', id));
    batchAudit(batch, { action: 'delete', collection: 'condiciones_pago', documentId: id });
    await batch.commit();
  },
};

// --- Conceptos de Servicio (catálogo de precios) ---
export const conceptosServicioService = {
  async getAll(): Promise<ConceptoServicio[]> {
    const querySnapshot = await getDocs(collection(db, 'conceptos_servicio'));
    const items = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || '',
        updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt || '',
      } as ConceptoServicio;
    });
    items.sort((a, b) => a.descripcion.localeCompare(b.descripcion));
    return items;
  },

  async getById(id: string): Promise<ConceptoServicio | null> {
    const docSnap = await getDoc(doc(db, 'conceptos_servicio', id));
    if (!docSnap.exists()) return null;
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || '',
      updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt || '',
    } as ConceptoServicio;
  },

  async create(data: Omit<ConceptoServicio, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const cleaned = cleanFirestoreData({
      ...data,
      ...getCreateTrace(),
      activo: data.activo !== undefined ? data.activo : true,
      factorActualizacion: data.factorActualizacion || 1,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const ref = newDocRef('conceptos_servicio');
    const batch = createBatch();
    batch.set(ref, cleaned);
    batchAudit(batch, { action: 'create', collection: 'conceptos_servicio', documentId: ref.id, after: cleaned as any });
    await batch.commit();
    return ref.id;
  },

  async update(id: string, data: Partial<Omit<ConceptoServicio, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    const cleaned = cleanFirestoreData({ ...data, ...getUpdateTrace(), updatedAt: Timestamp.now() });
    const batch = createBatch();
    batch.update(docRef('conceptos_servicio', id), cleaned);
    batchAudit(batch, { action: 'update', collection: 'conceptos_servicio', documentId: id, after: cleaned as any });
    await batch.commit();
  },

  async delete(id: string): Promise<void> {
    const batch = createBatch();
    batch.delete(docRef('conceptos_servicio', id));
    batchAudit(batch, { action: 'delete', collection: 'conceptos_servicio', documentId: id });
    await batch.commit();
  },
};
