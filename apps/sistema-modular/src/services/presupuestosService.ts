import { collection, getDocs, doc, getDoc, updateDoc, query, where, orderBy, Timestamp } from 'firebase/firestore';
import type { Presupuesto, PresupuestoEstado, OrdenCompra, CategoriaPresupuesto, CondicionPago, ConceptoServicio, Posta, Lead, PendingAction, TicketEstado, TicketArea } from '@ags/shared';
import { PRESUPUESTO_ESTADO_MIGRATION } from '@ags/shared';
import { db, cleanFirestoreData, deepCleanForFirestore, getCreateTrace, getUpdateTrace, createBatch, newDocRef, docRef, batchAudit, onSnapshot } from './firebase';
import { leadsService } from './leadsService';
import { adminConfigService } from './adminConfigService';
import { usuariosService } from './personalService';
import { articulosService, unidadesService, reservasService } from './stockService';
import { requerimientosService } from './importacionesService';

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
    // Build map of qty in-transit per article from all active OCs (not cancelled/fully received)
    const allOCs = await ordenesCompraService.getAll().catch(() => []);
    const enTransitoMap = new Map<string, number>();
    for (const oc of allOCs) {
      if (oc.estado === 'cancelada' || oc.estado === 'recibida') continue;
      for (const ocItem of oc.items || []) {
        if (!ocItem.articuloId) continue;
        const pendiente = Math.max(ocItem.cantidad - (ocItem.cantidadRecibida || 0), 0);
        if (pendiente > 0) {
          enTransitoMap.set(ocItem.articuloId, (enTransitoMap.get(ocItem.articuloId) || 0) + pendiente);
        }
      }
    }

    let count = 0;
    for (const item of items) {
      if (!item.stockArticuloId) continue;
      const articulo = await articulosService.getById(item.stockArticuloId).catch(() => null);

      // All active units for this article
      const todasUnidades = await unidadesService.getAll({ articuloId: item.stockArticuloId }).catch(() => []);
      const qtyDisponible = todasUnidades.filter(u => u.estado === 'disponible').length;
      const qtyReservado = todasUnidades.filter(u => u.estado === 'reservado').length;
      const qtyEnTransito = enTransitoMap.get(item.stockArticuloId) || 0;

      // Stock proyectado = disponible - reservado + en tránsito
      const stockProyectado = qtyDisponible - qtyReservado + qtyEnTransito;
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
          motivo: `Auto — presupuesto ${presupuestoNumero} | disp: ${qtyDisponible}, res: ${qtyReservado}, tránsito: ${qtyEnTransito}, necesario: ${item.cantidad}`,
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
