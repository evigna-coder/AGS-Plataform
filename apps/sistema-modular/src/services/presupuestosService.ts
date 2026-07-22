import { collection, getDocs, doc, getDoc, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { updateDoc, runTransaction } from './firebase';
import type { Presupuesto, PresupuestoEstado, TipoPresupuesto, OrdenCompra, CategoriaPresupuesto, CondicionPago, ConceptoServicio, Posta, Lead, PendingAction, TicketEstado, TicketArea, MotivoLlamado, RequerimientoCompra, UnidadStock, MonedaCuota, PresupuestoCuotaFacturacion, PlantillaTextoPresupuesto } from '@ags/shared';
import { PRESUPUESTO_ESTADO_MIGRATION, ESTADO_OC_LEGACY } from '@ags/shared';

/** Mapping del tipo de presupuesto al motivoLlamado del ticket de seguimiento. */
const TIPO_PPTO_TO_MOTIVO: Record<TipoPresupuesto, MotivoLlamado> = {
  servicio: 'soporte',
  partes: 'ventas_insumos',
  consumibles: 'ventas_insumos',
  mixto: 'ventas_insumos',
  ventas: 'ventas_equipos',
  contrato: 'administracion',
};
import { db, cleanFirestoreData, deepCleanForFirestore, getCreateTrace, getUpdateTrace, getCurrentUserTrace, createBatch, newDocRef, docRef, batchAudit, logBusinessEvent, onSnapshot } from './firebase';
import { leadsService } from './leadsService';
import { adminConfigService } from './adminConfigService';
import { usuariosService, getAdminSoporteAssignee } from './personalService';
import { articulosService, unidadesService, reservasService } from './stockService';
import { requerimientosService } from './importacionesService';
import { computeStockAmplio } from './stockAmplioService';
import { atpNetoFromStockAmplio } from './atpHelpers';
import { computeTotalsByCurrency, recomputeCuotaEstados, cuotasEqual } from '../utils/cuotasFacturacion';
import { hoyLocalISODate } from '../utils/formatFecha';

// Helper: recover ISO string from Timestamp, broken {seconds,nanoseconds} map, or string
function toISO(val: any, fallback: string | null = null): string | null {
  if (!val) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val?.toDate === 'function') return val.toDate().toISOString();
  if (typeof val?.seconds === 'number') return new Date(val.seconds * 1000).toISOString();
  return fallback;
}

// fechaEnvio es un DÍA DE CALENDARIO. Lo anclamos al MEDIODÍA LOCAL para que el offset
// de zona (Argentina UTC-3) no lo corra al día anterior al mostrarlo ni al re-leerlo en
// el form de edición. Antes se guardaba `new Date('YYYY-MM-DD')` = medianoche UTC, que en
// local mostraba el día previo (bug "envié el 19, dice 18").
function fechaEnvioToTimestamp(val: any): Timestamp {
  const datePart = String(val).slice(0, 10);
  const m = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return Timestamp.fromDate(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0));
  const d = new Date(val);
  return isNaN(d.getTime()) ? Timestamp.now() : Timestamp.fromDate(d);
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

  // Generar siguiente número de presupuesto (PRE-XXXX.01) — atómico vía counter doc.
  async getNextPresupuestoNumber(): Promise<string> {
    const counterRef = doc(db, '_counters', 'presupuestoNumber');
    const nextBase = await runTransaction(db, async (tx) => {
      const counterSnap = await tx.get(counterRef);
      let current: number;
      if (counterSnap.exists()) {
        current = counterSnap.data().value as number;
      } else {
        // Primera vez: escanear colección para inicializar el counter
        const querySnapshot = await getDocs(collection(db, 'presupuestos'));
        let maxBase = 0;
        querySnapshot.docs.forEach(d => {
          const base = this._extractBase(d.data().numero);
          if (base > maxBase) maxBase = base;
        });
        current = maxBase;
      }
      const next = current + 1;
      tx.set(counterRef, { value: next, updatedAt: Timestamp.now() });
      return next;
    });
    return `PRE-${String(nextBase).padStart(4, '0')}.01`;
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
      ...(presupuestoData.fechaEnvio ? { fechaEnvio: fechaEnvioToTimestamp(presupuestoData.fechaEnvio) } : {}),
      ...(presupuestoData.validUntil ? { validUntil: Timestamp.fromDate(new Date(presupuestoData.validUntil as any)) } : {}),
    };
    const payload = deepCleanForFirestore(raw);
    const presRef = newDocRef('presupuestos');
    const batch = createBatch();
    batch.set(presRef, payload);
    batchAudit(batch, { action: 'create', collection: 'presupuestos', documentId: presRef.id, after: payload });
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
    items: Array<{ id?: string | null; stockArticuloId?: string | null; descripcion: string; cantidad: number }>,
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

      // stockProyectado = ATP neto canónico (reservado NO se resta: ya salió de disponible
      // por el flip de estado al reservar — restarlo de nuevo inflaba los requerimientos).
      const stockProyectado = atpNetoFromStockAmplio(sa);
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
          presupuestoItemId: item.id ?? null, // join key del visor de entregas (UAT 2026-07-16: sin esto la fila no muestra la OC)
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
    // ── Phase 12 BILL-02: recompute hook ──────────────────────────────────
    // Recompute MUST be invoked on all 3 branches of update(); missing any one breaks
    // BILL-02 because borrador→enviado and borrador→aceptado are the very transitions
    // that flip cuota.estado for hito='ppto_aceptado'.
    // Guard: skip recompute when caller is explicitly setting esquemaFacturacion (avoid double-write loop).
    const fieldsThatTriggerRecompute = ['estado', 'ordenesCompraIds', 'preEmbarque', 'esquemaFacturacion'];
    const triggers = Object.keys(data as Record<string, unknown>);
    const shouldRecompute = triggers.some(k => fieldsThatTriggerRecompute.includes(k))
      && !('esquemaFacturacion' in data); // Avoid infinite loop: authoritative esquema write does not need a round-trip.

    const runRecompute = async () => {
      if (!shouldRecompute) return;
      try {
        await this._recomputeAndPersistEsquema(id);
      } catch (err) {
        console.warn('[update.recomputeEsquema] non-blocking error:', err);
      }
    };

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
          batchAudit(batch2, { action: 'update', collection: 'presupuestos', documentId: id, after: cleaned2 });
          await batch2.commit();
        }
        await runRecompute(); // W3: FLOW-01 branch recompute
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
            ...((otherFields as any).fechaEnvio ? { fechaEnvio: fechaEnvioToTimestamp((otherFields as any).fechaEnvio) } : {}),
            ...((otherFields as any).validUntil ? { validUntil: Timestamp.fromDate(new Date((otherFields as any).validUntil)) } : {}),
          };
          const cleaned2 = deepCleanForFirestore(raw2);
          const batch2 = createBatch();
          batch2.update(docRef('presupuestos', id), cleaned2);
          batchAudit(batch2, { action: 'update', collection: 'presupuestos', documentId: id, after: cleaned2 });
          await batch2.commit();
        }
        await runRecompute(); // W3: FLOW-03 branch recompute
        return;
      }
    }

    // Convert date strings to Firestore Timestamps, then deep-clean
    const raw = {
      ...data,
      // Anulación: registrar la fecha del evento (analítica de rechazos por período,
      // decisión 2026-07-17). Solo si el caller no la pasó explícita. Todos los caminos
      // que anulan (quick-estado, edit modal, createRevision) pasan por este update().
      ...(data.estado === 'anulado' && !data.fechaAnulacion
        ? { fechaAnulacion: new Date().toISOString() }
        : {}),
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
      ...((data as any).fechaEnvio ? { fechaEnvio: fechaEnvioToTimestamp((data as any).fechaEnvio) } : {}),
      ...((data as any).validUntil ? { validUntil: Timestamp.fromDate(new Date((data as any).validUntil)) } : {}),
    };
    const cleanedData = deepCleanForFirestore(raw);
    const batch = createBatch();
    batch.update(docRef('presupuestos', id), cleanedData);
    batchAudit(batch, { action: 'update', collection: 'presupuestos', documentId: id, after: cleanedData });
    await batch.commit();

    // ── Post-commit: si se setea ordenCompraNumero (truthy), transicionar el
    // ticket linkeado a `oc_recibida` con posta de audit, y si hay coord en
    // config, derivar a `en_coordinacion`. Best-effort — no bloquea el update.
    if (data.ordenCompraNumero && typeof data.ordenCompraNumero === 'string' && data.ordenCompraNumero.trim()) {
      const ocNum = data.ordenCompraNumero.trim();
      try {
        await this._transicionarTicketOCRecibida(id, ocNum).catch(err =>
          console.error('[update ocNumero] _transicionarTicketOCRecibida failed:', err),
        );
      } catch (err) {
        console.error('[update ocNumero] ticket transition post-commit failed:', err);
      }
      // Propagar el N° de OC a las OTs vinculadas (la OT debe mostrar la OC del ppto).
      // Solo si la OT no tiene una OC ya cargada (no pisar una entrada manual). Best-effort.
      try {
        const pres = await this.getById(id);
        const ots = pres?.otsVinculadasNumbers ?? [];
        if (ots.length > 0) {
          const { ordenesTrabajoService } = await import('./otService');
          for (const otNum of ots) {
            // agregarOrdenCompra propaga al padre y a sus items (.01, ...) sin duplicar.
            await ordenesTrabajoService.agregarOrdenCompra(otNum, ocNum)
              .catch(err => console.error(`[update ocNumero] propagar OC a OT ${otNum} falló:`, err));
          }
        }
      } catch (err) {
        console.error('[update ocNumero] propagación de OC a OTs falló:', err);
      }
    }

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

          // Liberar las reservas de stock que generó la aceptación: reservado → disponible.
          // Sin esto, las unidades quedaban trabadas en 'reservado' al anular (stock fantasma).
          await this._liberarReservasDePresupuesto(id, `Presupuesto ${pres.numero ?? id} anulado`).catch(err =>
            console.error('[update anular] _liberarReservasDePresupuesto failed:', err),
          );

          // D9: si hay OTs vinculadas no-finalizadas, registrar pendingAction.
          // No las cancelamos automáticamente porque puede haber trabajo en
          // curso o cierre técnico hecho — la coordinadora decide qué hacer.
          // Sin esto, el técnico quedaba ejecutando OT "fantasma" cargada a un
          // ppto anulado y el cobro quedaba en el aire.
          const otsVinc = pres.otsVinculadasNumbers ?? [];
          if (otsVinc.length > 0) {
            try {
              const otsSnap = await getDocs(
                query(collection(db, 'reportes'), where('otNumber', 'in', otsVinc.slice(0, 30))),
              );
              const otsActivas = otsSnap.docs
                .map(d => d.data() as { otNumber?: string; estadoAdmin?: string })
                .filter(o => o.estadoAdmin && o.estadoAdmin !== 'FINALIZADO');
              if (otsActivas.length > 0) {
                const otNumbers = otsActivas.map(o => o.otNumber).filter(Boolean).join(', ');
                await this._appendPendingAction(id, {
                  type: 'notificar_coordinador_ot',
                  reason: `Ppto ${pres.numero} ANULADO pero tiene ${otsActivas.length} OT(s) no-FINALIZADO: ${otNumbers}. Coordinador OT: decidir si cancelarlas, re-vincular a otro ppto o seguir como cortesía.`,
                }).catch(err => console.error('[update anular] _appendPendingAction OTs failed:', err));
              }
            } catch (err) {
              console.error('[update anular] check OTs activas falló:', err);
            }
          }
        }
      } catch (err) {
        console.error('[update anular] getById falló antes del cleanup:', err);
      }
    }

    // ── Auto-sync lead when presupuesto estado changes ──
    // Nota: cuando data.estado === 'aceptado', el short-circuit anterior delega
    // en aceptarConRequerimientos y retorna antes de llegar acá. Por eso este
    // bloque cubre el resto de transiciones (enviado, anulado, en_ejecucion,
    // finalizado). La auto-reserva de stock + requerimientos por stockMinimo
    // vive dentro de aceptarConRequerimientos (Paso 5b).
    if (data.estado) {
      try {
        const pres = await this.getById(id);
        if (pres?.origenTipo === 'lead' && pres.origenId) {
          await leadsService.syncFromPresupuesto(pres.origenId, pres.numero, data.estado);
        }
      } catch (err) {
        console.error('[presupuestosService] Error syncing lead from presupuesto:', err);
      }
    }

    await runRecompute(); // W3: normal path recompute (estado, ordenesCompraIds, preEmbarque changes)
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
    // YYYY-MM-DD en zona LOCAL (no UTC) + anclado a mediodía local al guardar, para que
    // la fecha de envío no aparezca un día antes (bug timezone UTC-3).
    const today = hoyLocalISODate();
    const raw = {
      estado: 'enviado' as PresupuestoEstado,
      fechaEnvio: fechaEnvioToTimestamp(today),
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    };
    const cleaned = deepCleanForFirestore(raw);
    const batch = createBatch();
    batch.update(docRef('presupuestos', id), cleaned);
    batchAudit(batch, { action: 'update', collection: 'presupuestos', documentId: id, after: cleaned });
    await batch.commit();

    // Evento de negocio: presupuesto enviado al cliente.
    logBusinessEvent({
      eventName: 'presupuesto.enviado',
      collection: 'presupuestos',
      documentId: id,
      entityLabel: hint?.numero ? `Pres. ${hint.numero}` : `Pres. ${id}`,
      details: { fechaEnvio: today },
    });

    // Cerrar el ticket-recordatorio de envío si existía (la obligación quedó cumplida).
    try {
      const presActual = await this.getById(id);
      const recordatorioId = presActual?.recordatorioEnvioTicketId;
      if (recordatorioId) {
        const actorTrace = getCurrentUserTrace();
        await leadsService.finalizar(recordatorioId, {
          id: crypto.randomUUID(),
          fecha: new Date().toISOString(),
          deUsuarioId: actorTrace?.uid ?? '',
          deUsuarioNombre: actorTrace?.name ?? 'Sistema',
          aUsuarioId: actorTrace?.uid ?? '',
          aUsuarioNombre: actorTrace?.name ?? 'Sistema',
          comentario: `Presupuesto ${hint?.numero ?? id} enviado al cliente.`,
          estadoAnterior: 'nuevo',
          estadoNuevo: 'finalizado',
        }).catch(err => console.error('[markEnviado] cerrar recordatorio falló:', err));
        await this.update(id, { recordatorioEnvioTicketId: null }).catch(() => {});
      }
    } catch (err) {
      console.error('[markEnviado] cierre de recordatorio de envío falló:', err);
    }

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
    // ── Sincronizar ticket origen + spawn T_n si el order guard lo skippea ──
    // Caso (a) ppto sin origen lead: spawn directo (FLOW-01 original).
    // Caso (b) ppto con origen lead, ticket en estado pre-OT: sync mueve estado del ticket,
    //         no se spawnea T_n (caso clásico, sin cambios).
    // Caso (c) ppto con origen lead, ticket ya pasó por OT: sync skip por order →
    //         spawn T_n nuevo para que el seguimiento administrativo viva por separado
    //         del ticket origen, que sigue su flow operativo.
    let needSpawn = false;
    if (origenTipo === 'lead' && origenId) {
      try {
        const result = await leadsService.syncFromPresupuesto(origenId, numero || '', 'enviado');
        if (result.skipped && result.reason === 'order') needSpawn = true;
      } catch (err: any) {
        console.error('[markEnviado] leadsService.syncFromPresupuesto failed:', err);
        // FLOW-06: registrar pendingAction para retry manual desde /admin/acciones-pendientes
        await this._appendPendingAction(id, {
          type: 'crear_ticket_seguimiento',
          reason: `sync lead existente falló: ${err?.message || 'unknown'}`,
        }).catch(appendErr => console.error('[markEnviado] _appendPendingAction failed:', appendErr));
      }
    } else {
      needSpawn = true;
    }

    // ── FLOW-01 + spawn-T_n: crear ticket de seguimiento ──
    if (needSpawn) {
      try {
        const pres = await this.getById(id);
        if (pres) {
          // Heurística para otsRelacionadas: preferir las OTs ya vinculadas al ppto;
          // si el ppto recién se envía y no tiene OTs propias, usar las del ticket origen
          // (caso típico: spawn por order guard cuando el ticket origen ya generó OTs).
          let otsRelacionadas: string[] = pres.otsVinculadasNumbers ?? [];
          if (otsRelacionadas.length === 0 && origenId) {
            try {
              const origenTicket = await leadsService.getById(origenId);
              otsRelacionadas = origenTicket?.otIds ?? [];
            } catch (err) {
              console.warn('[markEnviado] no se pudo leer otIds del ticket origen:', err);
            }
          }
          await this._crearAutoTicketSeguimiento(pres, { otsRelacionadas });
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
   * FLOW-01 + spawn-T_n: crea un ticket de seguimiento para el presupuesto.
   *
   * Casos de uso:
   * - Presupuesto sin ticket origen (`origenTipo !== 'lead'`): es el caso original FLOW-01.
   * - Presupuesto con ticket origen pero el origen ya está más adelante en el flow
   *   operativo (`ot_creada`/`ot_realizada`/etc.): spawn-T_n para que el seguimiento
   *   administrativo del ppto no pise el estado del ticket origen. En este caso el
   *   caller pasa `opts.otsRelacionadas` con el(los) número(s) de OT que motivaron
   *   el ppto, para mantener la trazabilidad cruzada.
   *
   * Precondiciones (técnicas, no de negocio — la decisión de invocar la hace el caller):
   * - `pres.clienteId` debe estar resuelto
   * - Debe resolverse un asignatario activo: `responsablePorArea[areaDestino]` o, como
   *   fallback, `adminConfig/flujos.usuarioSeguimientoId`
   */
  async _crearAutoTicketSeguimiento(
    pres: Presupuesto,
    opts?: { otsRelacionadas?: string[] },
  ): Promise<{ leadId: string }> {
    // Precondición: clienteId válido (shape del tipo dice string, pero runtime puede ser null/empty)
    const clienteId = (pres.clienteId ?? '').toString().trim();
    if (!clienteId) {
      throw new Error('clienteId null — pendiente revisión manual en /admin/revision-clienteid');
    }
    // Read adminConfig/flujos
    const cfg = await adminConfigService.getWithDefaults();

    // ── Área destino según el SECTOR DEL EMISOR (UAT 2026-07-19) ─────────────
    // Dos sectores emiten presupuestos: ventas (solo equipos) y administración
    // de soporte (servicios/partes/consumibles). El ticket de seguimiento va al
    // área del emisor — antes iba hardcodeado a 'ventas' y se asignaba al
    // usuario fijo, que ni pertenece a esa área. Si el emisor no es de ninguno
    // de los dos sectores (ej. admin), decide el tipo del presupuesto.
    const trace = getCurrentUserTrace();
    const emisor = trace?.uid ? await usuariosService.getById(trace.uid).catch(() => null) : null;
    const areaDestino: TicketArea =
      emisor?.role === 'ventas' ? 'ventas'
        : emisor?.role === 'admin_soporte' ? 'admin_soporte'
          : (pres.tipo === 'ventas' ? 'ventas' : 'admin_soporte');

    // Asignatario: responsable configurado del área destino; fallback al usuario
    // fijo de seguimiento (config legacy FLOW-01). Debe estar activo.
    const candidatos = [cfg.responsablePorArea?.[areaDestino], cfg.usuarioSeguimientoId]
      .filter((x): x is string => !!x);
    let asignadoId: string | null = null;
    let asignado: Awaited<ReturnType<typeof usuariosService.getById>> = null;
    for (const cid of candidatos) {
      const u = await usuariosService.getById(cid).catch(() => null);
      if (u && u.status === 'activo') { asignadoId = cid; asignado = u; break; }
    }
    if (!asignadoId || !asignado) {
      throw new Error(`sin responsable activo para el área ${areaDestino} (revisar responsablePorArea / usuarioSeguimientoId en config de flujos)`);
    }

    // Hidratar razonSocial + contacto desde clienteId/contactoId. syncFlatFromContactos
    // solo rellena desde el array `contactos`, no desde los IDs. Sin esto el ticket
    // quedaba con razonSocial/contacto/email vacíos y aparecía incompleto en la lista.
    let razonSocialHidrated = '';
    let contactoNombre = '';
    let contactoEmail = '';
    let contactoTelefono = '';
    try {
      const { clientesService } = await import('./clientesService');
      const cliente = await clientesService.getById(clienteId);
      razonSocialHidrated = cliente?.razonSocial ?? '';
    } catch (err) {
      console.warn('[_crearAutoTicketSeguimiento] clientesService.getById failed:', err);
    }
    if (pres.contactoId && pres.establecimientoId) {
      try {
        const { contactosEstablecimientoService } = await import('./establecimientosService');
        const contactos = await contactosEstablecimientoService.getByEstablecimiento(pres.establecimientoId);
        const c = contactos.find(x => x.id === pres.contactoId);
        if (c) {
          contactoNombre = c.nombre ?? '';
          contactoEmail = c.email ?? '';
          contactoTelefono = c.telefono ?? '';
        }
      } catch (err) {
        console.warn('[_crearAutoTicketSeguimiento] contactos read failed:', err);
      }
    }
    // Construcción del comentario/descripcion: si se pasa otsRelacionadas, mencionar
    // las OT(s) origen para que el ticket nuevo cuente la historia ("ppto post-servicio").
    const otsRel = opts?.otsRelacionadas?.filter(Boolean) ?? [];
    const otsLabel = otsRel.length > 0
      ? otsRel.map(n => `OT-${n}`).join(', ')
      : null;
    const comentarioBase = `Presupuesto ${pres.numero} enviado — pendiente OC`;
    const comentarioPosta = otsLabel
      ? `${comentarioBase} (vinculado a ${otsLabel})`
      : comentarioBase;
    const descripcionTicket = otsLabel
      ? `Seguimiento administrativo de ${pres.numero} (post-servicio para ${otsLabel}).`
      : `Auto-generado por FLOW-01 al enviar ${pres.numero} (tipo: ${pres.tipo}).`;

    // Audit posta inicial — registra QUIÉN envió el ppto con fecha/hora.
    const postaInicial: Posta = {
      id: crypto.randomUUID(),
      fecha: new Date().toISOString(),
      deUsuarioId: trace?.uid ?? 'system',
      deUsuarioNombre: trace?.name ?? 'Sistema',
      aUsuarioId: asignadoId,
      aUsuarioNombre: asignado.displayName ?? '',
      comentario: comentarioPosta,
      estadoAnterior: 'nuevo' as TicketEstado,
      estadoNuevo: 'esperando_oc' as TicketEstado,
    };
    // Crear lead (Ticket). Firma real: leadsService.create(data) → Promise<string>.
    // El lead arranca en 'esperando_oc' — el presupuesto ya está enviado, paso siguiente es OC del cliente.
    const leadPayload: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'> = {
      clienteId,
      contactoId: pres.contactoId ?? null,
      razonSocial: razonSocialHidrated,
      contactos: [],
      contacto: contactoNombre,
      email: contactoEmail,
      telefono: contactoTelefono,
      motivoLlamado: TIPO_PPTO_TO_MOTIVO[pres.tipo] ?? 'otros',
      motivoContacto: comentarioBase,
      descripcion: descripcionTicket,
      sistemaId: pres.sistemaId ?? null,
      moduloId: null,
      estado: 'esperando_oc' as TicketEstado,
      postas: [postaInicial],
      asignadoA: asignadoId,
      asignadoNombre: asignado.displayName ?? null,
      derivadoPor: null,
      areaActual: areaDestino,
      accionPendiente: 'Esperar OC del cliente',
      adjuntos: [],
      presupuestosIds: [pres.id],
      otIds: [],
      otsRelacionadas: otsRel.length > 0 ? otsRel : undefined,
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

    // Dedupe contra requerimientos YA existentes del ppto (los crea
    // _generarRequerimientosAutomaticos al CREAR el presupuesto): sin este filtro,
    // aceptar duplicaba el req de cada item de importación (UAT 2026-07-16).
    // Fail-safe: si el check falla, no crear (mejor un req de menos que duplicados).
    let itemsImportSinReq: any[] = itemsImport;
    try {
      const previos = await requerimientosService.getByPresupuesto(presupuestoId);
      const articulosConReq = new Set(
        previos.filter(r => r.estado !== 'cancelado').map(r => r.articuloId),
      );
      itemsImportSinReq = itemsImport.filter((it: any) => !articulosConReq.has(it.stockArticuloId));
    } catch (err) {
      console.error('[aceptarConRequerimientos] check reqs previos (import) falló — se omite crear:', err);
      itemsImportSinReq = [];
    }

    // ── Paso 2: pre-reservar números de requerimiento (FUERA de tx) ──
    // requerimientosService.getNextNumber hace getDocs sequential — no es seguro dentro de
    // runTransaction (no se pueden anidar reads con writes de otras colecciones de forma
    // arbitraria). Computamos el max una vez y generamos N numeros consecutivos.
    const numerosReservados: string[] = [];
    if (itemsImportSinReq.length > 0) {
      const qReq = query(collection(db, 'requerimientos_compra'), orderBy('numero', 'desc'));
      const snapReq = await getDocs(qReq);
      let maxNum = 0;
      snapReq.docs.forEach(d => {
        const m = d.data().numero?.match(/REQ-(\d+)/);
        if (m) { const n = parseInt(m[1]); if (n > maxNum) maxNum = n; }
      });
      for (let i = 1; i <= itemsImportSinReq.length; i++) {
        numerosReservados.push(`REQ-${String(maxNum + i).padStart(4, '0')}`);
      }
    }

    // ── Paso 3: pre-cargar datos de artículos para payload (FUERA de tx) ──
    // Evita reads-during-writes conflict dentro de tx (reads primero, writes después es hard rule).
    const articulosData = new Map<string, any>();
    for (const item of itemsImportSinReq) {
      const art = await articulosService.getById((item as any).stockArticuloId!).catch(() => null);
      if (art) articulosData.set((item as any).stockArticuloId!, art);
    }

    // ── Paso 4: runTransaction atómico ──
    const newReqIds: string[] = [];
    // (Phase 16) Capturar fechaAceptacion ISO antes del tx para que quede consistente
    // entre el update del presupuesto y los reqs que se crean en la misma tx.
    const nowIso = new Date().toISOString();

    await runTransaction(db, async (tx) => {
      const presRef = doc(db, 'presupuestos', presupuestoId);
      // Read-before-write (hard rule runTransaction)
      const presSnap = await tx.get(presRef);
      if (!presSnap.exists()) throw new Error('Presupuesto no encontrado');
      const pp = presSnap.data() as Presupuesto;
      // Idempotencia: si otra tx ya aceptó, salir
      if (pp.estado === 'aceptado') return;

      // Crear requerimientos condicionales (tx.set) — solo items sin req previo.
      itemsImportSinReq.forEach((item: any, idx: number) => {
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
          presupuestoItemId: item.id ?? null,    // (Phase 16) join key para visor de entregas
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
        fechaAceptacion: nowIso,                  // (Phase 16) base para computar ETA por item
        updatedAt: Timestamp.now(),
        updatedBy: actor?.uid ?? null,
        updatedByName: actor?.name ?? null,
      }));
    });

    // ── Paso 5: post-commit side-effects (best-effort, fuera de tx) ──
    // Sync lead si aplica + spawn-T_n si el order guard skippea (mismo patrón que markEnviado).
    if (pres.origenTipo === 'lead' && pres.origenId) {
      try {
        const result = await leadsService.syncFromPresupuesto(pres.origenId, pres.numero, 'aceptado');
        if (result.skipped && result.reason === 'order') {
          // El ticket origen ya pasó por OT — spawn T_n para el seguimiento administrativo
          // de este ppto. Heurística para otsRelacionadas: mismas reglas que markEnviado.
          let otsRelacionadas: string[] = pres.otsVinculadasNumbers ?? [];
          if (otsRelacionadas.length === 0) {
            try {
              const origenTicket = await leadsService.getById(pres.origenId);
              otsRelacionadas = origenTicket?.otIds ?? [];
            } catch (err) {
              console.warn('[aceptarConRequerimientos] lectura otIds del ticket origen falló:', err);
            }
          }
          await this._crearAutoTicketSeguimiento(pres, { otsRelacionadas })
            .catch(err => console.error('[aceptarConRequerimientos] spawn-T_n falló:', err));
        }
      } catch (err) {
        console.error('[aceptarConRequerimientos] syncFromPresupuesto failed:', err);
      }
    }

    // ── Paso 5b: auto-reservar stock disponible + auto-generar requerimientos ──
    // Para cada item con stockArticuloId: reservar unidades disponibles hasta
    // item.cantidad; si la cantidad post-reserva queda bajo articulo.stockMinimo,
    // emitir un requerimiento de compra. Best-effort — failures por item no
    // bloquean ni la aceptación ni los siguientes items. Antes este bloque vivía
    // en update() pero quedaba muerto por el short-circuit que delega acá.
    // Regla: si alguna OT vinculada ya tuvo CIERRE ADMINISTRATIVO, NO reservar stock — la
    // baja real ya ocurrió en el cierre (técnico/administrativo). Esto cubre el caso de la
    // ingeniera que descargó la parte de su minikit y se cerró la OT antes de aceptar/enviar
    // el presupuesto: reservar a esta altura crearía stock fantasma.
    let omitirReserva = false;
    try {
      const { ordenesTrabajoService } = await import('./otService');
      omitirReserva = await ordenesTrabajoService.algunaConCierreAdmin(pres.otsVinculadasNumbers ?? []);
    } catch (err) {
      console.warn('[aceptarConRequerimientos] check cierre admin falló:', err);
    }
    if (omitirReserva) {
      console.log(`[aceptarConRequerimientos] OT vinculada con cierre admin → se omite la reserva de stock (ppto ${pres.numero})`);
    }

    // Faltante total de reserva (unidades pedidas que NO se pudieron reservar):
    // decide si el ticket comercial va a Compras (hay que comprar/importar) o
    // directo a Coordinación (todo reservado).
    let faltanteReservaTotal = 0;

    const itemsConStock = (pres.items ?? []).filter(i => i.stockArticuloId);
    if (itemsConStock.length > 0 && !omitirReserva) {
      // Resolver cliente nombre una vez (reservar() lo guarda en cada unidad).
      let clienteNombre = '';
      try {
        const { clientesService } = await import('./clientesService');
        const cliente = await clientesService.getById(pres.clienteId);
        clienteNombre = cliente?.razonSocial ?? '';
      } catch (err) {
        console.warn('[aceptarConRequerimientos] cliente lookup falló — clienteNombre vacío:', err);
      }

      // Resumen de lo efectivamente reservado, para el aviso a Materiales (1 ticket al final).
      const reservasResumen: string[] = [];

      for (const item of itemsConStock) {
        try {
          const articulo = await articulosService.getById(item.stockArticuloId!).catch(() => null);
          const unidadesRaw = await unidadesService
            .getAll({ articuloId: item.stockArticuloId!, estado: 'disponible' })
            .catch(() => []);
          // Excluir las unidades en poder de ingenieros (minikits en campo): ese stock se
          // consume en terreno y no debe reservarse centralmente (moverlo a RESERVAS lo
          // sacaría del minikit). La baja real de esas partes se da en el cierre de la OT.
          const unidades = unidadesRaw.filter(u => u.ubicacion?.tipo !== 'ingeniero');
          // Cantidad FÍSICA disponible: sumar u.cantidad (un doc puede ser un lote
          // con cantidad > 1). Contar docs (.length) sobre-contaba/sobre-reservaba.
          const qtyDisponible = unidades.reduce((acc, u) => acc + (u.cantidad ?? 1), 0);
          const stockMinimo = articulo?.stockMinimo ?? 0;
          const qtyResultante = qtyDisponible - item.cantidad;

          // Auto-req: si el stock cae bajo el mínimo y no hay requerimiento previo
          // para este (presupuesto, articulo), crear uno.
          // OJO (UAT 2026-07-16, duplicados REQ): el getAll con filtros + orderBy
          // necesitaba un índice compuesto inexistente → tiraba, el catch devolvía []
          // y se creaba un req duplicado del ya generado al CREAR el ppto. Query
          // directa con 2 igualdades (sin orderBy, sin índice) y FAIL-SAFE: si el
          // chequeo falla, NO crear (mejor un req de menos que duplicados).
          let hayReqPrevio = true;
          try {
            const reqSnap = await getDocs(query(
              collection(db, 'requerimientos_compra'),
              where('presupuestoId', '==', presupuestoId),
              where('articuloId', '==', item.stockArticuloId!),
            ));
            hayReqPrevio = !reqSnap.empty;
          } catch (err) {
            console.error('[aceptarConRequerimientos] check de reqs previos falló — se omite crear para no duplicar:', err);
          }

          if (!hayReqPrevio && qtyResultante < stockMinimo) {
            const qtyReq = Math.max(stockMinimo - qtyResultante, item.cantidad - qtyDisponible);
            await requerimientosService.create({
              articuloId: item.stockArticuloId ?? null,
              articuloCodigo: articulo?.codigo ?? null,
              articuloDescripcion: articulo?.descripcion ?? item.descripcion,
              cantidad: qtyReq,
              unidadMedida: articulo?.unidadMedida ?? 'unidad',
              motivo: `Auto-generado por presupuesto ${pres.numero} (aceptado)`,
              origen: 'presupuesto',
              origenRef: presupuestoId,
              estado: 'pendiente',
              presupuestoId,
              presupuestoNumero: pres.numero ?? null,
              presupuestoItemId: item.id ?? null, // join key del visor de entregas
              proveedorSugeridoId: articulo?.proveedorIds?.[0] ?? null,
              proveedorSugeridoNombre: null,
              ordenCompraId: null,
              ordenCompraNumero: null,
              solicitadoPor: actor?.name || 'Sistema',
              fechaSolicitud: new Date().toISOString(),
              fechaAprobacion: null,
              urgencia: 'media',
              notas: null,
            });
          }

          // Auto-reserva: acumular unidades por cantidad FÍSICA hasta cubrir item.cantidad.
          // En la última unidad, si es un lote con más de lo necesario, reservar() splitea
          // y reserva solo la porción pedida (evita la sobre-reserva 1→2 de los lotes).
          let restante = item.cantidad;
          for (const unidad of unidades) {
            if (restante <= 0) break;
            const aReservar = Math.min(unidad.cantidad ?? 1, restante);
            try {
              await reservasService.reservar({
                unidadId: unidad.id,
                unidad,
                presupuestoId,
                presupuestoNumero: pres.numero ?? '',
                clienteId: pres.clienteId ?? '',
                clienteNombre,
                solicitadoPorNombre: actor?.name || 'Sistema',
                cantidad: aReservar,
              });
              restante -= aReservar;
            } catch (reservaErr) {
              console.error(`[aceptarConRequerimientos] reservar unidad ${unidad.id} falló:`, reservaErr);
            }
          }

          const reservado = item.cantidad - restante;
          faltanteReservaTotal += restante;
          if (reservado > 0) {
            const codigo = articulo?.codigo ?? '—';
            const desc = articulo?.descripcion ?? item.descripcion ?? '';
            const faltante = item.cantidad - reservado;
            reservasResumen.push(
              `• ${codigo} ${desc} — ${reservado}/${item.cantidad} u.${faltante > 0 ? ` (faltan ${faltante}, en compra)` : ''}`,
            );
          }
        } catch (itemErr) {
          console.error(`[aceptarConRequerimientos] item ${item.stockArticuloId} falló:`, itemErr);
        }
      }

      // ── Aviso a Materiales: ticket para reservar FÍSICAMENTE lo ya reservado en sistema ──
      // La reserva de arriba es lógica (marca unidades, las mueve a RESERVAS). El acto físico
      // lo hace Materiales — este ticket es ese aviso. Auto-asignado al responsable del área
      // 'materiales' (leadsService.create resuelve responsablePorArea). Best-effort.
      if (reservasResumen.length > 0) {
        try {
          await leadsService.create({
            clienteId: pres.clienteId ?? null,
            contactoId: null,
            razonSocial: clienteNombre || '',
            contactos: [],
            contacto: '',
            email: '',
            telefono: '',
            motivoLlamado: 'administracion',
            motivoContacto: `Reservar stock — Ppto ${pres.numero}`,
            descripcion: `Reservar físicamente para el presupuesto ${pres.numero}${clienteNombre ? ` (${clienteNombre})` : ''}:\n${reservasResumen.join('\n')}`,
            sistemaId: null,
            moduloId: null,
            estado: 'nuevo',
            postas: [],
            asignadoA: null,
            asignadoNombre: null,
            derivadoPor: actor?.uid ?? null,
            areaActual: 'materiales',
            accionPendiente: 'Reservar stock físicamente',
            adjuntos: [],
            presupuestosIds: [presupuestoId],
            otIds: [],
            finalizadoAt: null,
            prioridad: 'normal',
            proximoContacto: null,
            valorEstimado: null,
          });
        } catch (avisoErr) {
          console.error('[aceptarConRequerimientos] aviso a Materiales falló:', avisoErr);
        }
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

    // ── Paso 6: auto-crear/transicionar ticket de coordinación al aceptar.
    // Originalmente (Phase 10, 2026-04-22) solo aplicaba a tipo === 'ventas'.
    // Decisión 2026-05-25: aplicar a TODOS los tipos. Caso real: el operario
    // puede saltarse 'enviado' cuando recibe la OC en mano y va directo de
    // borrador a aceptado; sin ticket en ese path se pierde la trazabilidad
    // y la coordinadora no sabe que tiene que armar OT(s). El lookup
    // (presupuestosIds array-contains) sigue siendo idempotente: si el
    // ── Ticket del circuito comercial: ¿a dónde va después de aceptar? ────────
    // Con faltantes de stock (items de importación o reserva incompleta), el paso
    // siguiente es COMPRAR → área Compras. La coordinación de OTs llega cuando el
    // ingreso de mercadería deja el ppto totalmente reservado
    // (reservarPendientesParaPresupuesto → derivarTicketACoordinacion).
    // Sin faltantes → coordinación directa (comportamiento original).
    // UAT 2026-07-16: la derivación a compras/comex estaba deferred de v2.0 y el
    // gate mandaba TODO a coordinación aunque no hubiera nada que coordinar aún.
    {
      const hayFaltantes = itemsImport.length > 0 || faltanteReservaTotal > 0;
      if (hayFaltantes) {
        await this._derivarTicketACompras(presupuestoId, actor).catch(err =>
          console.error('[aceptarConRequerimientos] derivación a Compras falló:', err));
      } else {
        await this.derivarTicketACoordinacion(presupuestoId, actor);
      }
    }

    // Evento de negocio: presupuesto aceptado.
    logBusinessEvent({
      eventName: 'presupuesto.aceptado',
      collection: 'presupuestos',
      documentId: presupuestoId,
      entityLabel: pres.numero ? `Pres. ${pres.numero}` : `Pres. ${presupuestoId}`,
      details: {
        requerimientosCreados: newReqIds.length,
        requerimientosIds: newReqIds,
      },
    });

    return { requerimientosIds: newReqIds };
  },

  /**
   * Deriva el ticket comercial del presupuesto al área COMPRAS (hay faltantes que
   * comprar/importar antes de coordinar OTs). Auto-asigna al responsable del área
   * (adminConfig/flujos). Si no existe ticket comercial, crea uno en compras.
   * El estado del circuito no cambia — solo área + responsable + posta de traza.
   */
  async _derivarTicketACompras(presupuestoId: string, actor?: { uid: string; name?: string }): Promise<void> {
    const pres = await this.getById(presupuestoId);
    if (!pres) return;
    const existingSnap = await getDocs(
      query(collection(db, 'leads'), where('presupuestosIds', 'array-contains', presupuestoId)),
    );
    const TERMINAL: TicketEstado[] = ['finalizado', 'no_concretado'];
    const OPERATIVAS: TicketArea[] = ['materiales', 'compras'];
    const comercial = existingSnap.docs
      .map(d => ({ ...(d.data() as Lead), id: d.id }))
      .filter(t => !TERMINAL.includes(t.estado))
      .find(t => !OPERATIVAS.includes(t.areaActual as TicketArea));

    const accion = 'Comprar/importar los materiales del presupuesto aceptado';
    if (comercial) {
      const posta: Posta = {
        id: crypto.randomUUID(),
        fecha: new Date().toISOString(),
        deUsuarioId: actor?.uid ?? 'system',
        deUsuarioNombre: actor?.name ?? 'Sistema',
        aUsuarioId: '',
        aUsuarioNombre: '',
        comentario: `Ppto ${pres.numero} aceptado con faltantes de stock — a Compras (comprar/importar antes de coordinar OTs)`,
        estadoAnterior: comercial.estado,
        estadoNuevo: comercial.estado,
      };
      // derivar() auto-asigna al responsable del área compras y registra la posta.
      await leadsService.derivar(comercial.id, posta, '', null, 'compras', accion);
      console.log(`[_derivarTicketACompras] ticket ${comercial.id} → compras (ppto ${pres.numero})`);
      return;
    }

    // Sin ticket comercial (aceptado directo sin envío) → crear uno en compras.
    let razonSocial = '';
    try {
      const { clientesService } = await import('./clientesService');
      razonSocial = (await clientesService.getById((pres.clienteId ?? '').toString()))?.razonSocial ?? '';
    } catch { /* razón social vacía */ }
    const ticketId = await leadsService.create({
      clienteId: pres.clienteId ?? null,
      contactoId: pres.contactoId ?? null,
      razonSocial,
      contactos: [],
      contacto: '',
      email: '',
      telefono: '',
      motivoLlamado: TIPO_PPTO_TO_MOTIVO[pres.tipo] ?? 'otros',
      motivoContacto: `Ppto ${pres.numero} aceptado — comprar/importar materiales`,
      descripcion: `Ppto ${pres.numero} aceptado con faltantes de stock. Comprar/importar los materiales; al ingresar la mercadería el ticket pasa a coordinación.`,
      sistemaId: pres.sistemaId ?? null,
      moduloId: null,
      estado: 'nuevo',
      postas: [],
      asignadoA: null,
      asignadoNombre: null,
      derivadoPor: actor?.uid ?? null,
      areaActual: 'compras',
      accionPendiente: accion,
      adjuntos: [],
      presupuestosIds: [presupuestoId],
      otIds: [],
      finalizadoAt: null,
      prioridad: 'normal',
      proximoContacto: null,
      valorEstimado: pres.total ?? null,
    });
    console.log(`[_derivarTicketACompras] ticket compras creado (sin predecesor): ${ticketId} para ppto ${pres.numero}`);
  },

  /**
   * Deriva el ticket comercial del presupuesto a COORDINACIÓN de OTs (estado
   * `en_coordinacion`, asignado al coordinador de adminConfig). Idempotente:
   * si el ticket ya está en coordinación o un estado posterior, no hace nada.
   * Llamado desde la aceptación (sin faltantes) y desde la auto-reserva
   * post-ingreso cuando el ppto queda totalmente cubierto.
   */
  async derivarTicketACoordinacion(presupuestoId: string, actor?: { uid: string; name?: string }): Promise<void> {
    const pres = await this.getById(presupuestoId);
    if (!pres) return;
    {
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
            reason: `Ppto ${pres.numero} aceptado; falta adminConfig.usuarioCoordinadorOTId. Configurar en /admin/config-flujos y reintentar desde /admin/acciones-pendientes.`,
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
          // Los tickets OPERATIVOS (aviso "Reservar físicamente" a materiales, compras por
          // requerimientos) linkean el mismo ppto pero NO son la oportunidad comercial:
          // sin este filtro, el gate agarraba el ticket de materiales recién creado y lo
          // derivaba al coordinador de OTs (UAT 2026-07-16 — Cynthia recibió "reservar stock").
          const AREAS_OPERATIVAS: TicketArea[] = ['materiales', 'compras'];
          const reusable = existingSnap.docs
            .map(d => ({ ...(d.data() as Lead), id: d.id }))
            .filter(t => !TERMINAL.includes(t.estado))
            .filter(t => !AREAS_OPERATIVAS.includes(t.areaActual as TicketArea));
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
            let razonSocialCoord = '';
            let contactoNombreCoord = '';
            let contactoEmailCoord = '';
            let contactoTelCoord = '';
            try {
              const { clientesService } = await import('./clientesService');
              const cliente = await clientesService.getById(clienteIdStr);
              razonSocialCoord = cliente?.razonSocial ?? '';
            } catch (err) {
              console.warn('[aceptarConRequerimientos] clientesService.getById failed:', err);
            }
            if (pres.contactoId && pres.establecimientoId) {
              try {
                const { contactosEstablecimientoService } = await import('./establecimientosService');
                const contactos = await contactosEstablecimientoService.getByEstablecimiento(pres.establecimientoId);
                const c = contactos.find(x => x.id === pres.contactoId);
                if (c) {
                  contactoNombreCoord = c.nombre ?? '';
                  contactoEmailCoord = c.email ?? '';
                  contactoTelCoord = c.telefono ?? '';
                }
              } catch (err) {
                console.warn('[aceptarConRequerimientos] contactos read failed:', err);
              }
            }
            const postaCreacion: Posta = {
              id: crypto.randomUUID(),
              fecha: new Date().toISOString(),
              deUsuarioId: actor?.uid ?? 'system',
              deUsuarioNombre: actor?.name ?? 'Sistema',
              aUsuarioId: coordId,
              aUsuarioNombre: coordinador.displayName ?? '',
              comentario: `Ppto ${pres.numero} aceptado — derivado a coordinación OT`,
              estadoAnterior: 'nuevo' as TicketEstado,
              estadoNuevo: 'en_coordinacion' as TicketEstado,
            };
            const ticketPayload: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'> = {
              clienteId: clienteIdStr,
              contactoId: pres.contactoId ?? null,
              razonSocial: razonSocialCoord,
              contactos: [],
              contacto: contactoNombreCoord,
              email: contactoEmailCoord,
              telefono: contactoTelCoord,
              motivoLlamado: TIPO_PPTO_TO_MOTIVO[pres.tipo] ?? 'otros',
              motivoContacto: `Ppto ${pres.numero} aceptado — coordinar OTs`,
              descripcion: `Ppto ${pres.numero} (tipo: ${pres.tipo}) aceptado. Coordinar las OTs que correspondan según los items del presupuesto.`,
              sistemaId: pres.sistemaId ?? null,
              moduloId: null,
              estado: 'en_coordinacion' as TicketEstado,
              postas: [postaCreacion],
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
        console.error('[derivarTicketACoordinacion] auto-ticket coordinación falló:', err);
        await this._appendPendingAction(presupuestoId, {
          type: 'notificar_coordinador_ot',
          reason: `Ppto ${pres.numero} aceptado; auto-creación de ticket coordinación falló: ${err instanceof Error ? err.message : String(err)}. Reintentar desde /admin/acciones-pendientes.`,
        }).catch(() => {});
      }
    }
  },

  /**
   * Post-commit al adjuntar OC: transiciona el ticket linkeado al ppto a
   * `oc_recibida` + registra posta con QUIÉN cargó la OC y cuándo. Si hay
   * `adminConfig.usuarioCoordinadorOTId` configurado, también deriva el ticket
   * a `en_coordinacion` reasignado al coordinador. Idempotente — no-op si el
   * ticket ya pasó por `oc_recibida` o estado posterior.
   */
  async _transicionarTicketOCRecibida(presupuestoId: string, ocNumero: string): Promise<void> {
    const existingSnap = await getDocs(
      query(collection(db, 'leads'), where('presupuestosIds', 'array-contains', presupuestoId)),
    );
    const TERMINAL: TicketEstado[] = ['finalizado', 'no_concretado'];
    const POST_OC: TicketEstado[] = ['oc_recibida', 'espera_importacion', 'pendiente_entrega', 'en_coordinacion', 'ot_creada', 'ot_coordinada', 'ot_realizada', 'pendiente_facturacion'];
    const reusable = existingSnap.docs
      .map(d => ({ ...(d.data() as Lead), id: d.id }))
      .filter(t => !TERMINAL.includes(t.estado) && !POST_OC.includes(t.estado));
    if (reusable.length === 0) return; // sin ticket reusable (nuevo o ya post-OC)
    const ticket = reusable[0];
    const user = getCurrentUserTrace();

    // Lookup coord (best-effort) para derivación automática a coordinación.
    let coordId: string | null = null;
    let coordNombre: string | null = null;
    try {
      const cfg = await adminConfigService.getWithDefaults();
      if (cfg.usuarioCoordinadorOTId) {
        const coord = await usuariosService.getById(cfg.usuarioCoordinadorOTId);
        if (coord && coord.status === 'activo') {
          coordId = coord.id;
          coordNombre = coord.displayName ?? null;
        }
      }
    } catch (err) {
      console.warn('[_transicionarTicketOCRecibida] coord lookup failed:', err);
    }

    const nuevoEstado: TicketEstado = coordId ? 'en_coordinacion' : 'oc_recibida';
    const postaOC: Posta = {
      id: crypto.randomUUID(),
      fecha: new Date().toISOString(),
      deUsuarioId: user?.uid ?? 'system',
      deUsuarioNombre: user?.name ?? 'Sistema',
      aUsuarioId: coordId ?? ticket.asignadoA ?? '',
      aUsuarioNombre: coordNombre ?? ticket.asignadoNombre ?? '',
      comentario: coordId
        ? `OC ${ocNumero} cargada — derivado a coordinación`
        : `OC ${ocNumero} cargada — a la espera del coordinador`,
      estadoAnterior: ticket.estado,
      estadoNuevo: nuevoEstado,
    };
    const updates: Partial<Lead> = {
      estado: nuevoEstado,
      postas: [...(ticket.postas || []), postaOC],
    };
    if (coordId) {
      updates.asignadoA = coordId;
      updates.asignadoNombre = coordNombre;
      updates.areaActual = 'ing_soporte' as TicketArea;
      updates.accionPendiente = `OC ${ocNumero} recibida — coordinar OTs`;
    }
    await leadsService.update(ticket.id, updates as any);
    console.log(`[_transicionarTicketOCRecibida] ticket ${ticket.id} ${ticket.estado} → ${nuevoEstado} (ppto ${presupuestoId})`);
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

    // ── Phase 12 BILL-06: esquema mode branch ────────────────────────────
    // When ppto has an esquema, finalizacion requires canFinalizeFromEsquema
    // (all cuotas in terminal estado per finalizarConSoloFacturado setting).
    // Legacy mode (no esquema) falls through to existing Tier-1 logic below.
    if ((pres.esquemaFacturacion?.length ?? 0) > 0) {
      const { canFinalizeFromEsquema } = await import('../utils/cuotasFacturacion');
      // Re-read pres after recompute (caller may have just run _recomputeAndPersistEsquema)
      const presFresh = await this.getById(presupuestoId);
      if (!presFresh) return;
      if (!canFinalizeFromEsquema(presFresh.esquemaFacturacion, presFresh.finalizarConSoloFacturado)) {
        return;
      }
      await this.update(presupuestoId, { estado: 'finalizado' } as any);
      console.log(`[trySyncFinalizacion] presupuesto ${pres.numero} → finalizado (esquema mode)`);
      return;
    }

    // ── Existing legacy path (unchanged) ─────────────────────────────────
    // Check 2: otsListasParaFacturar debe estar vacío (Tier-1)
    // Si quedan OTs sin incluir en una solicitud, el ppto no puede finalizar.
    // Campo opcional — si no existe (pptos viejos), tratar como vacío.
    const pendientesParaFacturar: string[] = pres.otsListasParaFacturar ?? [];
    if (pendientesParaFacturar.length > 0) {
      console.log(`[trySyncFinalizacion] ppto ${pres.numero} tiene ${pendientesParaFacturar.length} OT(s) pendientes de facturar — skip`);
      return;
    }

    // ── Check 3: todas las solicitudesFacturacion vinculadas en `facturada` ──
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
   * Crea una solicitudFacturacion agrupando 1+ OTs del array
   * `otsListasParaFacturar` del presupuesto. Las OTs incluidas se quitan
   * del array `otsListasParaFacturar` (ya están en una solicitud).
   *
   * Post-commit: transiciona el ticket vinculado de
   * `pendiente_aviso_facturacion` → `pendiente_facturacion` (si aplica).
   *
   * Si después de quitar las OTs el array queda vacío Y todas las solicitudes
   * del ppto se facturan, trySyncFinalizacion puede finalizar el ppto.
   *
   * @returns id de la nueva solicitud creada
   */
  async generarAvisoFacturacion(
    presupuestoId: string,
    otNumbers: string[],
    extras?: {
      monto?: number;                                                // legacy single-moneda
      montoPorMoneda?: Partial<Record<MonedaCuota, number>>;         // Phase 12 MIXTA
      observaciones?: string;
      cuotaId?: string;                                              // Phase 12 anticipo back-ref
    },
    actor?: { uid: string; name?: string },
  ): Promise<{ solicitudId: string }> {
    // ── Pre-read del ppto ─────────────────────────────────────────────────
    const pres = await this.getById(presupuestoId);
    if (!pres) throw new Error('Presupuesto no encontrado');
    if (pres.estado === 'anulado') throw new Error('No se puede facturar un presupuesto anulado');

    // ── NEW: cuotaId path (anticipo) ──────────────────────────────────────
    // When cuotaId is present, the OT-listas guard is SKIPPED (BILL-03).
    // The cuota must be 'habilitada' server-side before we proceed.
    let cuotaTarget: PresupuestoCuotaFacturacion | undefined;
    if (extras?.cuotaId) {
      cuotaTarget = (pres.esquemaFacturacion ?? []).find(c => c.id === extras.cuotaId);
      if (!cuotaTarget) {
        throw new Error(`Cuota ${extras.cuotaId} no encontrada en el esquema del presupuesto`);
      }
      if (cuotaTarget.estado !== 'habilitada') {
        throw new Error(`Cuota ${cuotaTarget.numero} no está habilitada (estado=${cuotaTarget.estado})`);
      }
      // OTs OPTIONAL for anticipo path — otNumbers accepted as reference only (Pitfall 8)
    } else {
      // ── EXISTING legacy guard — only enforced when cuotaId absent ────────
      if (!otNumbers || otNumbers.length === 0) {
        throw new Error('Debe seleccionar al menos una OT para generar el aviso');
      }
      const otsListas: string[] = pres.otsListasParaFacturar ?? [];
      for (const otNum of otNumbers) {
        if (!otsListas.includes(otNum)) {
          throw new Error(`OT ${otNum} no está lista para facturar en este presupuesto`);
        }
      }
    }

    // ── Compute totals per moneda (I3 helper) ─────────────────────────────
    // Used to derive porcentajeCoberturaPorMoneda for BILL-04.
    const totalsByCurrency = computeTotalsByCurrency(pres.items ?? [], pres.moneda as any);

    // ── Resolve montoPorMoneda for solicitud payload ───────────────────────
    let resolvedMontoPorMoneda: Partial<Record<MonedaCuota, number>>;
    if (extras?.montoPorMoneda) {
      // Caller provided explicit per-moneda amounts (Phase 12 mini-modal)
      resolvedMontoPorMoneda = extras.montoPorMoneda;
    } else if (cuotaTarget) {
      // Default from cuota % applied to totals
      resolvedMontoPorMoneda = Object.fromEntries(
        Object.entries(cuotaTarget.porcentajePorMoneda)
          .filter(([, pct]) => (pct ?? 0) > 0)
          .map(([m, pct]) => {
            const total = totalsByCurrency[m as MonedaCuota] ?? 0;
            return [m, Math.round(((pct ?? 0) / 100) * total * 100) / 100];
          }),
      ) as Partial<Record<MonedaCuota, number>>;
    } else if (extras?.monto !== undefined) {
      // Legacy single-moneda path
      const monedaActiva = (pres.moneda === 'MIXTA' ? 'ARS' : pres.moneda) as MonedaCuota;
      resolvedMontoPorMoneda = { [monedaActiva]: extras.monto };
    } else {
      resolvedMontoPorMoneda = {};
    }

    // ── Compute porcentajeCoberturaPorMoneda (BILL-04) ────────────────────
    // Pitfall 1: filter out zero/undefined values before building the record.
    const porcentajeCoberturaPorMoneda: Partial<Record<MonedaCuota, number>> = Object.fromEntries(
      Object.entries(resolvedMontoPorMoneda)
        .filter(([, v]) => (v ?? 0) > 0)
        .map(([m, v]) => {
          const total = totalsByCurrency[m as MonedaCuota] ?? 0;
          const pct = total > 0 ? Math.round(((v ?? 0) / total) * 10000) / 100 : 0;
          return [m, pct];
        }),
    ) as Partial<Record<MonedaCuota, number>>;

    const nowIso = new Date().toISOString();
    const newSolRef = newDocRef('solicitudesFacturacion');

    // ── Transaction atómica: crea solicitud + patcha ppto ─────────────────
    await runTransaction(db, async (tx) => {
      // READ PHASE
      const pRef = doc(db, 'presupuestos', presupuestoId);
      const pSnap = await tx.get(pRef);
      if (!pSnap.exists()) throw new Error('Presupuesto no encontrado (tx)');
      const freshData = pSnap.data();
      const freshOtsListas: string[] = freshData?.otsListasParaFacturar ?? [];
      const freshEsquema: PresupuestoCuotaFacturacion[] = freshData?.esquemaFacturacion ?? [];

      if (!cuotaTarget) {
        // Legacy: re-validate inside tx for atomicidad (Pitfall 2-D race check)
        for (const otNum of otNumbers) {
          if (!freshOtsListas.includes(otNum)) {
            throw new Error(`OT ${otNum} no está lista para facturar (concurrency check)`);
          }
        }
      } else {
        // cuotaId path: verify cuota still habilitada inside tx (atomic double-billing guard)
        const freshCuota = freshEsquema.find(c => c.id === cuotaTarget!.id);
        if (!freshCuota) throw new Error(`Cuota ${cuotaTarget.id} no encontrada en la tx`);
        if (freshCuota.estado !== 'habilitada') {
          throw new Error(`Cuota ${freshCuota.numero} ya fue procesada (estado=${freshCuota.estado})`);
        }
      }

      // WRITE PHASE
      // Write 1: nueva solicitudFacturacion
      const solPayload = deepCleanForFirestore({
        presupuestoId,
        presupuestoNumero: pres.numero,
        clienteId: pres.clienteId,
        clienteNombre: '',           // se puede hidratar del caller si se necesita
        condicionPago: '',
        items: (pres.items || []).map(it => ({
          id: (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          presupuestoItemId: it.id,
          descripcion: it.descripcion,
          cantidad: it.cantidad,
          cantidadTotal: it.cantidad,
          precioUnitario: it.precioUnitario,
          subtotal: it.subtotal,
        })),
        montoTotal: extras?.monto ?? pres.total,
        moneda: pres.moneda,
        estado: 'pendiente' as const,
        otNumbers,
        cuotaId: cuotaTarget?.id ?? null,                            // BILL-03 back-ref
        montoPorMoneda: resolvedMontoPorMoneda,                       // BILL-04
        porcentajeCoberturaPorMoneda,                                 // BILL-04 derived
        ordenesCompraIds: pres.ordenesCompraIds || [],
        observaciones: extras?.observaciones ?? null,
        solicitadoPor: actor?.uid ?? null,
        solicitadoPorNombre: actor?.name ?? null,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      tx.set(newSolRef, solPayload);

      // Write 2: patch the presupuesto
      const presPatch: Record<string, unknown> = { updatedAt: nowIso };

      if (cuotaTarget) {
        // Anticipo path: patch ONLY the target cuota in-place (Pitfall 8 — do NOT touch otsListasParaFacturar)
        const patchedEsquema = freshEsquema.map(c =>
          c.id === cuotaTarget!.id
            ? ({
                ...c,
                solicitudFacturacionId: newSolRef.id,
                montoFacturadoPorMoneda: resolvedMontoPorMoneda,
                estado: 'solicitada' as const,
              } as PresupuestoCuotaFacturacion)
            : c,
        );
        presPatch.esquemaFacturacion = patchedEsquema;
      } else {
        // Legacy path: remove otNumbers from otsListasParaFacturar
        presPatch.otsListasParaFacturar = freshOtsListas.filter(ot => !otNumbers.includes(ot));
      }

      tx.update(pRef, deepCleanForFirestore(presPatch));
    });

    // ── Post-commit: transicionar ticket vinculado ────────────────────────
    // Buscar ticket con presupuestosIds array-contains que esté en pendiente_aviso_facturacion
    try {
      const tksSnap = await getDocs(
        query(collection(db, 'leads'), where('presupuestosIds', 'array-contains', presupuestoId)),
      );
      for (const d of tksSnap.docs) {
        const t = d.data() as any;
        if (t.estado === 'pendiente_aviso_facturacion') {
          await leadsService.update(d.id, {
            estado: 'pendiente_facturacion' as TicketEstado,
          } as any).catch(err =>
            console.error(`[generarAvisoFacturacion] transición ticket ${d.id} falló:`, err),
          );
        }
      }
    } catch (err) {
      console.error('[generarAvisoFacturacion] ticket sync failed (non-blocking):', err);
    }

    // ── Item 4 (UAT 2026-07-17): ticket operativo a Administración ────────
    // La solicitud quedó creada; la encargada de administración necesita un
    // ticket en su cola para cargar la factura. Auto-asignado al responsable
    // del área 'administracion' (leadsService.create resuelve responsablePorArea).
    // Dedupe: si ya hay un aviso abierto del ppto, se anexa la línea a su
    // descripción en vez de crear otro. Best-effort — nunca rompe la solicitud.
    try {
      let clienteNombre = '';
      if (pres.clienteId) {
        try {
          const { clientesService } = await import('./clientesService');
          clienteNombre = (await clientesService.getById(String(pres.clienteId)))?.razonSocial ?? '';
        } catch { /* nombre vacío — el ticket vale igual */ }
      }
      const montos = Object.keys(resolvedMontoPorMoneda).length > 0 ? resolvedMontoPorMoneda : totalsByCurrency;
      const montoLabel = Object.entries(montos)
        .filter(([, v]) => (v ?? 0) > 0)
        .map(([m, v]) => `${m} ${(v as number).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`)
        .join(' · ') || '—';
      const otsLabel = otNumbers.length > 0
        ? otNumbers.join(', ')
        : (cuotaTarget ? `anticipo cuota ${cuotaTarget.numero}` : '—');
      const linea = `• Aviso ${nowIso.slice(0, 10)} — OTs: ${otsLabel} — Monto: ${montoLabel}`;

      const vinculados = (await getDocs(query(
        collection(db, 'leads'),
        where('presupuestosIds', 'array-contains', presupuestoId),
      ))).docs.map(d => ({ id: d.id, data: d.data() as Record<string, unknown> }));
      const previo = vinculados.find(t =>
        t.data.areaActual === 'administracion' &&
        t.data.accionPendiente === 'Cargar factura del aviso' &&
        !['finalizado', 'no_concretado'].includes(t.data.estado as string));
      if (previo) {
        await leadsService.update(previo.id, {
          descripcion: `${(previo.data.descripcion as string) ?? ''}\n${linea}`,
        });
      } else {
        await leadsService.create({
          clienteId: pres.clienteId ?? null,
          contactoId: null,
          razonSocial: clienteNombre || '',
          contactos: [],
          contacto: '',
          email: '',
          telefono: '',
          motivoLlamado: 'administracion',
          motivoContacto: `Facturar — Ppto ${pres.numero}`,
          descripcion: `Cargar la factura del aviso a facturación del presupuesto ${pres.numero}${clienteNombre ? ` (${clienteNombre})` : ''}:\n${linea}`,
          sistemaId: null,
          moduloId: null,
          estado: 'nuevo',
          postas: [],
          asignadoA: null,
          asignadoNombre: null,
          derivadoPor: actor?.uid ?? null,
          areaActual: 'administracion',
          accionPendiente: 'Cargar factura del aviso',
          adjuntos: [],
          presupuestosIds: [presupuestoId],
          otIds: [...otNumbers],
          finalizadoAt: null,
          prioridad: 'normal',
          proximoContacto: null,
          valorEstimado: null,
        });
      }
    } catch (avisoErr) {
      console.warn('[generarAvisoFacturacion] ticket a Administración falló (non-blocking):', avisoErr);
    }

    // ── Phase 12 BILL-02: recompute remaining cuotas post-tx ─────────────
    // The patched cuota is already in 'solicitada' (done atomically in-tx above).
    // Other cuotas may need recompute (e.g., hito='oc_recibida' just became habilitada
    // because the same ppto now has ordenesCompraIds). Best-effort — non-blocking.
    // Pitfall 2: this call is POST-tx, never inside runTransaction.
    try {
      await this._recomputeAndPersistEsquema(presupuestoId);
    } catch (err) {
      console.warn('[generarAvisoFacturacion.recomputeEsquema] non-blocking:', err);
    }

    return { solicitudId: newSolRef.id };
  },

  /**
   * Phase 12 BILL-02: recompute cuota estados based on current ppto + linked OTs + solicitudes,
   * persist if changed. Idempotent (no-op when nothing changed via cuotasEqual).
   *
   * MUST be called only AFTER any write to ppto/OT/solicitud has settled — never inside a runTransaction.
   * Pitfall 2: not for use inside cross-doc tx.
   * W4 fix: uses scoped queryByBudget (not getAll) for OTs.
   * W2 fix: uses cuotasEqual (not JSON.stringify) for idempotency check.
   */
  async _recomputeAndPersistEsquema(presupuestoId: string): Promise<void> {
    const pres = await this.getById(presupuestoId);
    if (!pres) return;
    if ((pres.esquemaFacturacion?.length ?? 0) === 0) return; // legacy — nothing to do

    // Lazy imports to break circular deps (existing pattern in this service)
    const [{ ordenesTrabajoService }, { facturacionService }] = await Promise.all([
      import('./otService'),
      import('./facturacionService'),
    ]);

    // W4 fix: scoped Firestore query — array-contains on budgets — instead of getAll().
    // array-contains works on single fields without a composite index.
    const otsForPres = await ordenesTrabajoService.queryByBudget(String(pres.numero));
    const solicitudes = await facturacionService.getByPresupuesto(presupuestoId);

    const recomputed = recomputeCuotaEstados(
      {
        estado: pres.estado,
        ordenesCompraIds: pres.ordenesCompraIds,
        preEmbarque: pres.preEmbarque,
        esquemaFacturacion: pres.esquemaFacturacion,
      },
      otsForPres.map(o => ({ otNumber: o.otNumber, estadoAdmin: o.estadoAdmin, budgets: o.budgets })),
      solicitudes.map(s => ({ id: s.id, cuotaId: s.cuotaId ?? null, estado: s.estado })),
    );

    // W2 fix: structural-equality check via cuotasEqual (key-order independent after Firestore round-trip).
    if (cuotasEqual(recomputed, pres.esquemaFacturacion ?? [])) return;

    const presRef = doc(db, 'presupuestos', presupuestoId);
    await updateDoc(presRef, deepCleanForFirestore({
      esquemaFacturacion: recomputed,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    }) as any);
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
    // Leer requerimientos asociados al presupuesto.
    // getByPresupuesto (sin orderBy): el getAll con filtro + orderBy necesitaba un
    // índice compuesto inexistente → catch devolvía [] y los reqs quedaban huérfanos
    // al anular/eliminar (UAT 2026-07-16). Además se cancelan TODOS los reqs
    // pendiente/aprobado del ppto, tengan o no el flag `condicional` — los que se
    // crean al CREAR el ppto (_generarRequerimientosAutomaticos) no lo llevan.
    const allReqs = await requerimientosService.getByPresupuesto(presupuestoId).catch(() => [] as RequerimientoCompra[]);
    const cancellables = allReqs.filter(r => r.estado === 'pendiente' || r.estado === 'aprobado');
    const skipped = allReqs.length - cancellables.length;

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
      batchAudit(batch, { action: 'update', collection: 'requerimientos_compra', documentId: r.id, after: payload });
    }
    await batch.commit();
    console.log(`[_cancelarRequerimientosCondicionales] cancelled=${cancellables.length} skipped=${skipped} pres=${presupuestoId}`);
    return { cancelled: cancellables.length, skipped };
  },

  /**
   * Recordatorio de "enviar este presupuesto al cliente". Se llama al vincular una OT a
   * un presupuesto que TODAVÍA no fue enviado (caso: se adelanta la OT porque el cliente
   * va a aceptar, pero el ppto quedó sin mandar). Crea un ticket asignado al responsable
   * del presupuesto (fallback: responsable del área). Idempotente y no-op si ya se envió.
   * El ticket se cierra solo cuando el ppto se marca enviado (ver markEnviado).
   */
  async crearRecordatorioEnvio(
    presupuestoId: string,
    actor?: { uid: string; name?: string },
  ): Promise<string | null> {
    try {
      const pres = await this.getById(presupuestoId);
      if (!pres) return null;
      if (pres.fechaEnvio) return null;                 // ya se envió → no hace falta recordatorio
      if (pres.recordatorioEnvioTicketId) return pres.recordatorioEnvioTicketId; // idempotente

      let clienteNombre = '';
      try {
        const { clientesService } = await import('./clientesService');
        clienteNombre = (await clientesService.getById(pres.clienteId))?.razonSocial ?? '';
      } catch { /* nombre opcional */ }

      // El recordatorio va a Administración Soporte (Miguel Barrios). Si no se resuelve,
      // queda null y leadsService auto-asigna por el responsable del área 'admin_soporte'.
      const miguel = await getAdminSoporteAssignee();
      const asignadoA = miguel?.id ?? null;
      const asignadoNombre = miguel?.nombre ?? null;

      const ticketId = await leadsService.create({
        clienteId: pres.clienteId ?? null,
        contactoId: null,
        razonSocial: clienteNombre || '',
        contactos: [],
        contacto: '',
        email: '',
        telefono: '',
        motivoLlamado: 'administracion',
        motivoContacto: `Enviar presupuesto ${pres.numero}`,
        descripcion: `El presupuesto ${pres.numero}${clienteNombre ? ` (${clienteNombre})` : ''} tiene una OT vinculada pero AÚN NO fue enviado al cliente. Enviarlo.`,
        sistemaId: null,
        moduloId: null,
        estado: 'nuevo',
        postas: [],
        asignadoA,                                      // Miguel Barrios (o null → auto por área)
        asignadoNombre,
        derivadoPor: actor?.uid ?? null,
        areaActual: 'admin_soporte',
        accionPendiente: 'Enviar presupuesto al cliente',
        adjuntos: [],
        presupuestosIds: [presupuestoId],
        otIds: [],
        finalizadoAt: null,
        prioridad: 'urgente', // prioridad más alta: presupuesto adelantado por una OT, no debe esperar
        proximoContacto: null,
        valorEstimado: null,
      });
      await this.update(presupuestoId, { recordatorioEnvioTicketId: ticketId }).catch(err =>
        console.error('[crearRecordatorioEnvio] no se pudo marcar el ticket en el ppto:', err),
      );
      return ticketId;
    } catch (err) {
      console.error('[crearRecordatorioEnvio] falló:', err);
      return null;
    }
  },

  /**
   * Libera las reservas de stock generadas al aceptar este presupuesto
   * (unidades en estado 'reservado' atadas al ppto → vuelven a 'disponible').
   *
   * Se llama al ANULAR un presupuesto y también desde hardDelete. Sin esto, las
   * unidades reservadas al aceptar quedaban colgadas en 'reservado' para siempre
   * (stock fantasma fuera del ATP). Best-effort por unidad.
   */
  async _liberarReservasDePresupuesto(
    presupuestoId: string,
    motivo: string,
  ): Promise<{ liberadas: number }> {
    let liberadas = 0;
    try {
      const resSnap = await getDocs(query(
        collection(db, 'unidades'),
        where('reservadoParaPresupuestoId', '==', presupuestoId),
        where('estado', '==', 'reservado'),
      ));
      for (const d of resSnap.docs) {
        const unidad = { id: d.id, ...d.data() } as UnidadStock;
        try {
          await reservasService.liberar({ unidadId: d.id, unidad, motivo, solicitadoPorNombre: 'Sistema' });
          liberadas++;
        } catch (err) {
          console.error(`[_liberarReservasDePresupuesto] liberar unidad ${d.id}:`, err);
        }
      }
    } catch (err) {
      console.error(`[_liberarReservasDePresupuesto] pres ${presupuestoId}:`, err);
    }
    if (liberadas > 0) console.log(`[_liberarReservasDePresupuesto] liberadas=${liberadas} pres=${presupuestoId}`);
    return { liberadas };
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

    // Evento de negocio: revisión de presupuesto creada (anula el anterior).
    logBusinessEvent({
      eventName: 'presupuesto.revision_creada',
      collection: 'presupuestos',
      documentId: result.id,
      entityLabel: `Pres. ${newNumero}`,
      details: {
        anuladoNumero: original.numero,
        anuladoId: id,
        nuevoNumero: newNumero,
        motivo,
      },
    });

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
    // Volver a borrador es des-aceptar: las reservas de stock de la aceptación
    // deben liberarse igual que en anular/hardDelete (auditoría I9, 2026-07-20).
    await this._liberarReservasDePresupuesto(id, 'Presupuesto vuelto a borrador').catch(err =>
      console.error('[delete] liberar reservas:', err),
    );
  },

  async hardDelete(id: string) {
    // Pre-delete: finalizar tickets linkeados. La oportunidad comercial se
    // cierra cuando el ppto es eliminado. Best-effort — no bloquea el delete.
    try {
      const existingSnap = await getDocs(
        query(collection(db, 'leads'), where('presupuestosIds', 'array-contains', id)),
      );
      const TERMINAL: TicketEstado[] = ['finalizado', 'no_concretado'];
      const pres = await this.getById(id).catch(() => null);
      const numero = pres?.numero ?? id;
      const user = getCurrentUserTrace();
      for (const d of existingSnap.docs) {
        const ticket = { ...(d.data() as Lead), id: d.id };
        if (TERMINAL.includes(ticket.estado)) continue;
        const posta: Posta = {
          id: crypto.randomUUID(),
          fecha: new Date().toISOString(),
          deUsuarioId: user?.uid ?? 'system',
          deUsuarioNombre: user?.name ?? 'Sistema',
          aUsuarioId: ticket.asignadoA ?? '',
          aUsuarioNombre: ticket.asignadoNombre ?? '',
          comentario: `Presupuesto ${numero} eliminado por ${user?.name ?? 'Sistema'}`,
          estadoAnterior: ticket.estado,
          estadoNuevo: 'finalizado' as TicketEstado,
        };
        await leadsService.update(ticket.id, {
          estado: 'finalizado' as TicketEstado,
          finalizadoAt: new Date().toISOString(),
          postas: [...(ticket.postas || []), posta],
        } as any).catch(err => console.error(`[hardDelete] finalizar ticket ${ticket.id} failed:`, err));
      }
    } catch (err) {
      console.error('[hardDelete] error finalizando tickets linkeados:', err);
    }

    // Cascada: eliminar los requerimientos SIN compromiso (pendiente/aprobado)
    // generados por este presupuesto — con o sin flag `condicional` (los del alta
    // del ppto no lo llevan). Los en_compra/comprado (ya con OC) se dejan
    // intactos — son gasto comprometido, el admin los maneja desde la OC.
    // getByPresupuesto (sin orderBy): el getAll con filtro tiraba por índice
    // compuesto inexistente y dejaba reqs huérfanos (UAT 2026-07-16).
    try {
      const reqs = await requerimientosService.getByPresupuesto(id).catch(() => [] as RequerimientoCompra[]);
      const eliminables = reqs.filter(r => r.estado === 'pendiente' || r.estado === 'aprobado');
      for (const r of eliminables) {
        await requerimientosService.delete(r.id).catch(err => console.error(`[hardDelete] eliminar req ${r.id}:`, err));
      }
    } catch (err) {
      console.error('[hardDelete] eliminar requerimientos:', err);
    }

    // Cascada: liberar las reservas de stock que generó la aceptación del presupuesto.
    await this._liberarReservasDePresupuesto(id, 'Presupuesto eliminado').catch(err =>
      console.error('[hardDelete] liberar reservas:', err),
    );

    // Cascada: anular las solicitudes de facturación PENDIENTES del ppto — si no,
    // quedan huérfanas y siguen contando en el KPI "Enviadas a facturación" y en
    // el módulo Facturación (UAT 2026-07-18). Las 'facturada' se dejan intactas
    // (hay factura real emitida): solo se loguea el caso.
    try {
      const solSnap = await getDocs(
        query(collection(db, 'solicitudesFacturacion'), where('presupuestoId', '==', id)),
      );
      for (const d of solSnap.docs) {
        const estado = (d.data().estado as string) ?? '';
        if (estado === 'pendiente') {
          await updateDoc(d.ref, cleanFirestoreData({
            estado: 'anulada',
            observaciones: `${(d.data().observaciones as string) || ''}\nAnulada: presupuesto eliminado.`.trim(),
            updatedAt: Timestamp.now(),
            ...getUpdateTrace(),
          }));
        } else if (estado === 'facturada') {
          console.warn(`[hardDelete] solicitud ${d.id} está FACTURADA; queda huérfana a resolver manualmente en Facturación.`);
        }
      }
    } catch (err) {
      console.error('[hardDelete] anular solicitudes de facturación:', err);
    }

    const batch = createBatch();
    batch.delete(docRef('presupuestos', id));
    batchAudit(batch, { action: 'delete', collection: 'presupuestos', documentId: id });
    await batch.commit();
  },

  /**
   * Toggle preEmbarque on a presupuesto and fire an audit posta on the linked ticket.
   * Phase 12 BILL-07 — full implementation (plan 12-03).
   *
   * - Idempotent: no-op if ppto.preEmbarque already matches `next`.
   * - Guarded: throws if ppto is finalizado/anulado.
   * - Audit posta: written to linked ticket's postas[] as best-effort (BILL-07).
   *   Failure in posta write must NOT block the toggle itself.
   * - Lazy import of leadsService: avoids circular dependency (08-03 pattern from STATE.md).
   */
  async togglePreEmbarque(
    presupuestoId: string,
    next: boolean,
    actor?: { uid: string; name?: string },
  ): Promise<void> {
    const pres = await this.getById(presupuestoId);
    if (!pres) throw new Error('Presupuesto no encontrado');
    if (pres.estado === 'finalizado' || pres.estado === 'anulado') {
      throw new Error('No se puede modificar pre-embarque en un presupuesto cerrado');
    }

    // Idempotent — no-op if state already matches
    if ((pres.preEmbarque ?? false) === next) return;

    // Write preEmbarque field (via this.update so recompute hook in plan 12-05 fires)
    await this.update(presupuestoId, deepCleanForFirestore({
      preEmbarque: next,
    }) as any);

    // Audit posta on linked ticket (best-effort — MUST NOT fail the toggle on posta error).
    // Pattern: query leads by presupuestosIds array-contains, then append posta.
    // Lazy import to break circular dep (Phase 08-03 decision in STATE.md).
    try {
      const { leadsService: ls } = await import('./leadsService');
      const tksSnap = await getDocs(
        query(collection(db, 'leads'), where('presupuestosIds', 'array-contains', presupuestoId)),
      );
      for (const d of tksSnap.docs) {
        const lead = { ...(d.data() as any), id: d.id };
        const posta = deepCleanForFirestore({
          fecha: new Date().toISOString(),
          usuarioId: actor?.uid ?? null,
          usuarioNombre: actor?.name ?? null,
          accion: next ? 'pre_embarque_marcada' : 'pre_embarque_desmarcada',
          detalle: `Presupuesto N° ${pres.numero}: pre-embarque ${next ? 'marcado' : 'desmarcado'}`,
        });
        await ls.update(lead.id, {
          postas: [...(lead.postas || []), posta],
        } as any);
      }
    } catch (err) {
      console.warn('[togglePreEmbarque] audit posta failed (non-blocking):', err);
    }
  },
};

// Servicio para Ordenes de Compra
export const ordenesCompraService = {
  // Número correlativo POR PREFIJO de proveedor (3 letras + 3 dígitos: JAS027).
  // Counter atómico por prefijo. Si no existe, siembra desde el máximo de OCs ya
  // cargadas con ese prefijo. El prefijo viene de Proveedor.codigoOC (fallback 'OC').
  async getNextOCNumber(prefijo: string): Promise<string> {
    const pref = (prefijo || 'OC').toUpperCase();
    const counterRef = doc(db, '_counters', `ocNumber_${pref}`);
    const next = await runTransaction(db, async (tx) => {
      const counterSnap = await tx.get(counterRef);
      let current: number;
      if (counterSnap.exists()) {
        current = counterSnap.data().value as number;
      } else {
        const snap = await getDocs(collection(db, 'ordenes_compra'));
        let maxNum = 0;
        const re = new RegExp(`^${pref}-?(\\d+)$`);
        snap.docs.forEach(d => {
          const match = d.data().numero?.match(re);
          if (match) { const n = parseInt(match[1]); if (n > maxNum) maxNum = n; }
        });
        current = maxNum;
      }
      const nextVal = current + 1;
      tx.set(counterRef, { value: nextVal, updatedAt: Timestamp.now() });
      return nextVal;
    });
    return `${pref}${String(next).padStart(3, '0')}`;
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
      estado: ESTADO_OC_LEGACY[d.data().estado] ?? d.data().estado,
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
      estado: ESTADO_OC_LEGACY[d.estado] ?? d.estado,
      fechaRecepcion: d.fechaRecepcion?.toDate?.()?.toISOString() ?? null,
      fechaProforma: d.fechaProforma?.toDate?.()?.toISOString() ?? null,
      fechaEntregaEstimada: d.fechaEntregaEstimada?.toDate?.()?.toISOString() ?? null,
      createdAt: d.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      updatedAt: d.updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    } as OrdenCompra;
  },

  async create(data: Omit<OrdenCompra, 'id' | 'createdAt' | 'updatedAt' | 'numero'> & { numero?: string }): Promise<string> {
    // Prefijo de numeración derivado del proveedor (codigoOC). Fallback 'OC'.
    let prefijoOC = 'OC';
    if (!data.numero && data.proveedorId) {
      try {
        const provSnap = await getDoc(doc(db, 'proveedores', data.proveedorId));
        const codigo = provSnap.exists() ? (provSnap.data().codigoOC as string | undefined) : undefined;
        if (codigo) prefijoOC = codigo;
      } catch { /* fallback 'OC' */ }
    }
    const numero = data.numero || await this.getNextOCNumber(prefijoOC);
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
    batchAudit(batch, { action: 'create', collection: 'ordenes_compra', documentId: id, after: payload });
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
    batchAudit(batch, { action: 'update', collection: 'ordenes_compra', documentId: id, after: payload });
    await batch.commit();
  },

  // Marca la OC como enviada al proveedor (tras mandar el mail). Solo avanza
  // desde estados previos al envío; nunca retrocede una OC ya en curso/recibida.
  async markEnviada(id: string): Promise<void> {
    const oc = await this.getById(id);
    if (!oc) throw new Error('Orden de compra no encontrada');
    // Registra siempre la fecha del envío; avanza el estado solo si está en borrador.
    const patch: Partial<OrdenCompra> = { fechaEnvio: new Date().toISOString() };
    if (oc.estado === 'borrador') patch.estado = 'enviada_proveedor';
    await this.update(id, patch);
  },

  async delete(id: string): Promise<void> {
    // No permitir eliminar una OC con importaciones asociadas (quedarían huérfanas).
    const impSnap = await getDocs(query(collection(db, 'importaciones'), where('ordenCompraId', '==', id)));
    if (!impSnap.empty) {
      throw new Error('La OC tiene una importación asociada. Eliminá primero la importación.');
    }
    // Revertir los requerimientos que esta OC había puesto 'en_compra': vuelven a
    // 'aprobado' y se desvinculan, para que puedan re-generar otra OC.
    const reqSnap = await getDocs(query(collection(db, 'requerimientos_compra'), where('ordenCompraId', '==', id)));
    const batch = createBatch();
    reqSnap.docs.forEach(d => {
      batch.update(d.ref, cleanFirestoreData({
        estado: 'aprobado',
        ordenCompraId: null,
        ordenCompraNumero: null,
        ...getUpdateTrace(),
        updatedAt: Timestamp.now(),
      }));
    });
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
    batchAudit(batch, { action: 'create', collection: 'categorias_presupuesto', documentId: ref.id, after: payload });
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
    batchAudit(batch, { action: 'update', collection: 'categorias_presupuesto', documentId: id, after: payload });
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
    batchAudit(batch, { action: 'create', collection: 'condiciones_pago', documentId: ref.id, after: payload });
    await batch.commit();
    return ref.id;
  },

  // Actualizar condición
  async update(id: string, data: Partial<Omit<CondicionPago, 'id'>>) {
    const payload = { ...data, ...getUpdateTrace() };
    const batch = createBatch();
    batch.update(docRef('condiciones_pago', id), payload);
    batchAudit(batch, { action: 'update', collection: 'condiciones_pago', documentId: id, after: payload });
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

// ==============================
// PLANTILLAS DE TEXTOS PRESUPUESTO (Phase 03)
// ==============================
// Rich HTML text templates para las 6 secciones de un presupuesto.
// Una plantilla puede aplicar a múltiples tipos de presupuesto.
// No hay cache — se lee en cada llamada (ver Pitfall 4 en 03-RESEARCH.md).

export const plantillasTextoPresupuestoService = {
  async getAll(): Promise<PlantillaTextoPresupuesto[]> {
    const snap = await getDocs(collection(db, 'plantillas_texto_presupuesto'));
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() })) as PlantillaTextoPresupuesto[];
    items.sort((a, b) => a.nombre.localeCompare(b.nombre));
    return items;
  },

  async getById(id: string): Promise<PlantillaTextoPresupuesto | null> {
    const snap = await getDoc(doc(db, 'plantillas_texto_presupuesto', id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as PlantillaTextoPresupuesto;
  },

  /**
   * Devuelve plantillas activas con esDefault=true cuyo tipoPresupuestoAplica incluye el tipo dado.
   * Consumer puede agrupar por .tipo (sección) para saber qué sección tiene conflicto (length > 1).
   */
  async getDefaultsForTipo(tipo: TipoPresupuesto): Promise<PlantillaTextoPresupuesto[]> {
    const all = await this.getAll();
    return all.filter(p => p.activo && p.esDefault && p.tipoPresupuestoAplica.includes(tipo));
  },

  async create(data: Omit<PlantillaTextoPresupuesto, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const payload = cleanFirestoreData({
      ...data,
      ...getCreateTrace(),
      activo: data.activo ?? true,
      esDefault: data.esDefault ?? false,
      tipoPresupuestoAplica: data.tipoPresupuestoAplica ?? [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const ref = newDocRef('plantillas_texto_presupuesto');
    const batch = createBatch();
    batch.set(ref, payload);
    batchAudit(batch, {
      action: 'create',
      collection: 'plantillas_texto_presupuesto',
      documentId: ref.id,
      after: payload as any,
    });
    await batch.commit();
    return ref.id;
  },

  async update(id: string, data: Partial<Omit<PlantillaTextoPresupuesto, 'id' | 'createdAt'>>): Promise<void> {
    const payload = cleanFirestoreData({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    const ref = doc(db, 'plantillas_texto_presupuesto', id);
    const batch = createBatch();
    batch.update(ref, payload);
    batchAudit(batch, {
      action: 'update',
      collection: 'plantillas_texto_presupuesto',
      documentId: id,
      after: payload as any,
    });
    await batch.commit();
  },

  async delete(id: string): Promise<void> {
    const ref = doc(db, 'plantillas_texto_presupuesto', id);
    const batch = createBatch();
    batch.delete(ref);
    batchAudit(batch, {
      action: 'delete',
      collection: 'plantillas_texto_presupuesto',
      documentId: id,
    });
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
    batchAudit(batch, { action: 'create', collection: 'conceptos_servicio', documentId: ref.id, after: cleaned });
    await batch.commit();
    return ref.id;
  },

  async update(id: string, data: Partial<Omit<ConceptoServicio, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    const cleaned = cleanFirestoreData({ ...data, ...getUpdateTrace(), updatedAt: Timestamp.now() });
    const batch = createBatch();
    batch.update(docRef('conceptos_servicio', id), cleaned);
    batchAudit(batch, { action: 'update', collection: 'conceptos_servicio', documentId: id, after: cleaned });
    await batch.commit();
  },

  async delete(id: string): Promise<void> {
    const batch = createBatch();
    batch.delete(docRef('conceptos_servicio', id));
    batchAudit(batch, { action: 'delete', collection: 'conceptos_servicio', documentId: id });
    await batch.commit();
  },
};
