import { collection, getDocs, getDocsFromServer, doc, getDoc, query, where, orderBy, Timestamp, runTransaction } from 'firebase/firestore';
import type { TipoServicio, PosicionArancelaria, RequerimientoCompra, Importacion, EstadoImportacion, EstadoOC } from '@ags/shared';
import { derivarEstadoImportacion } from '@ags/shared';
import { db, cleanFirestoreData, getCreateTrace, getUpdateTrace, createBatch, newDocRef, docRef, batchAudit, onSnapshot } from './firebase';
import { getCached, setCache, invalidateCache } from './serviceCache';

// Servicio para Tipos de Servicio (lista simple)
export const tiposServicioService = {
  // Obtener todos los tipos de servicio
  async getAll() {
    // Cache (TTL 2 min): catálogo casi estático, alto reuso en selects; invalidateCache en las mutaciones.
    const cacheKey = 'tipos_servicio:all';
    const cached = getCached<TipoServicio[]>(cacheKey);
    if (cached) return cached;

    const querySnapshot = await getDocs(collection(db, 'tipos_servicio'));
    const tipos = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate().toISOString(),
      updatedAt: doc.data().updatedAt?.toDate().toISOString(),
    })) as TipoServicio[];

    tipos.sort((a, b) => a.nombre.localeCompare(b.nombre));
    setCache(cacheKey, tipos);
    return tipos;
  },

  // Obtener tipo por ID
  async getById(id: string) {
    const docRef = doc(db, 'tipos_servicio', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate().toISOString(),
        updatedAt: docSnap.data().updatedAt?.toDate().toISOString(),
      } as TipoServicio;
    }
    return null;
  },

  // Crear tipo de servicio
  async create(tipoData: Omit<TipoServicio, 'id' | 'createdAt' | 'updatedAt'>) {
    const payload = {
      ...tipoData,
      ...getCreateTrace(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    const ref = newDocRef('tipos_servicio');
    const batch = createBatch();
    batch.set(ref, payload);
    batchAudit(batch, { action: 'create', collection: 'tipos_servicio', documentId: ref.id, after: payload });
    await batch.commit();
    invalidateCache('tipos_servicio');
    return ref.id;
  },

  // Actualizar tipo de servicio
  async update(id: string, data: Partial<Omit<TipoServicio, 'id' | 'createdAt' | 'updatedAt'>>) {
    const payload = {
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    };
    const batch = createBatch();
    batch.update(docRef('tipos_servicio', id), payload);
    batchAudit(batch, { action: 'update', collection: 'tipos_servicio', documentId: id, after: payload });
    await batch.commit();
    invalidateCache('tipos_servicio');
  },

  // Eliminar tipo de servicio
  async delete(id: string) {
    const batch = createBatch();
    batch.delete(docRef('tipos_servicio', id));
    batchAudit(batch, { action: 'delete', collection: 'tipos_servicio', documentId: id });
    await batch.commit();
    invalidateCache('tipos_servicio');
  },

  subscribe(callback: (items: TipoServicio[]) => void, onError?: (err: Error) => void): () => void {
    const q = query(collection(db, 'tipos_servicio'));
    return onSnapshot(q, snap => {
      const tipos = snap.docs.map(d => ({
        id: d.id, ...d.data(),
        createdAt: d.data().createdAt?.toDate().toISOString(),
        updatedAt: d.data().updatedAt?.toDate().toISOString(),
      })) as TipoServicio[];
      tipos.sort((a, b) => a.nombre.localeCompare(b.nombre));
      callback(tipos);
    }, err => { console.error('TiposServicio subscription error:', err); onError?.(err); });
  },
};

// ========== POSICIONES ARANCELARIAS ==========

export const posicionesArancelariasService = {
  async getAll(activoOnly: boolean = true): Promise<PosicionArancelaria[]> {
    // Cache (TTL 2 min): catálogo casi estático, alto reuso en selects; invalidateCache en las mutaciones.
    const cacheKey = `posiciones_arancelarias:${activoOnly}`;
    const cached = getCached<PosicionArancelaria[]>(cacheKey);
    if (cached) return cached;

    let q;
    if (activoOnly) {
      q = query(collection(db, 'posiciones_arancelarias'), where('activo', '==', true));
    } else {
      q = query(collection(db, 'posiciones_arancelarias'));
    }
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({
      id: d.id, ...d.data(),
      createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    })) as PosicionArancelaria[];
    items.sort((a, b) => a.codigo.localeCompare(b.codigo));
    setCache(cacheKey, items);
    return items;
  },

  async getById(id: string): Promise<PosicionArancelaria | null> {
    const snap = await getDoc(doc(db, 'posiciones_arancelarias', id));
    if (!snap.exists()) return null;
    return {
      id: snap.id, ...snap.data(),
      createdAt: snap.data().createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      updatedAt: snap.data().updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    } as PosicionArancelaria;
  },

  async create(data: Omit<PosicionArancelaria, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const payload = cleanFirestoreData({
      ...data,
      ...getCreateTrace(),
      activo: data.activo !== undefined ? data.activo : true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.set(doc(db, 'posiciones_arancelarias', id), payload);
    batchAudit(batch, { action: 'create', collection: 'posiciones_arancelarias', documentId: id, after: payload });
    await batch.commit();
    invalidateCache('posiciones_arancelarias');
    return id;
  },

  async update(id: string, data: Partial<Omit<PosicionArancelaria, 'id' | 'createdAt'>>): Promise<void> {
    const payload = cleanFirestoreData({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.update(docRef('posiciones_arancelarias', id), payload);
    batchAudit(batch, { action: 'update', collection: 'posiciones_arancelarias', documentId: id, after: payload });
    await batch.commit();
    invalidateCache('posiciones_arancelarias');
  },

  async delete(id: string): Promise<void> {
    const batch = createBatch();
    batch.delete(docRef('posiciones_arancelarias', id));
    batchAudit(batch, { action: 'delete', collection: 'posiciones_arancelarias', documentId: id });
    await batch.commit();
    invalidateCache('posiciones_arancelarias');
  },

  async getByCodigo(codigo: string): Promise<PosicionArancelaria | null> {
    const q = query(collection(db, 'posiciones_arancelarias'), where('codigo', '==', codigo));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return {
      id: d.id, ...d.data(),
      createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    } as PosicionArancelaria;
  },

  subscribe(
    activoOnly: boolean,
    callback: (items: PosicionArancelaria[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    let q;
    if (activoOnly) {
      q = query(collection(db, 'posiciones_arancelarias'), where('activo', '==', true));
    } else {
      q = query(collection(db, 'posiciones_arancelarias'));
    }
    return onSnapshot(q, snap => {
      const items = snap.docs.map(d => ({
        id: d.id, ...d.data(),
        createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
        updatedAt: d.data().updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      })) as PosicionArancelaria[];
      items.sort((a, b) => a.codigo.localeCompare(b.codigo));
      callback(items);
    }, err => { console.error('PosicionesArancelarias subscription error:', err); onError?.(err); });
  },
};

// ========== REQUERIMIENTOS DE COMPRA ==========

export const requerimientosService = {
  /**
   * Próximo REQ-NNNN — atómico vía `_counters/requerimientoNumber` (2026-08-28,
   * caso REQ-0041/REQ-0050 duplicados): el scan-and-max leía la colección con
   * getDocs y una respuesta servida por la caché offline devolvió un
   * subconjunto viejo — dos requerimientos nuevos nacieron con números ya
   * tomados. Mismo patrón que presupuestos / tickets / remitos: counter con
   * bootstrap scan-and-max la primera vez.
   */
  async getNextNumber(): Promise<string> {
    const counterRef = doc(db, '_counters', 'requerimientoNumber');
    const next = await runTransaction(db, async (tx) => {
      const counterSnap = await tx.get(counterRef);
      let current: number;
      if (counterSnap.exists()) {
        current = counterSnap.data().value as number;
      } else {
        // Primera vez: escanear la colección para inicializar el counter.
        const qs = await getDocs(query(collection(db, 'requerimientos_compra'), orderBy('numero', 'desc')));
        let maxNum = 0;
        qs.docs.forEach(d => {
          const match = d.data().numero?.match(/REQ-(\d+)/);
          if (match) { const n = parseInt(match[1]); if (n > maxNum) maxNum = n; }
        });
        current = maxNum;
      }
      const value = current + 1;
      tx.set(counterRef, { value, updatedAt: Timestamp.now() });
      return value;
    });
    return `REQ-${String(next).padStart(4, '0')}`;
  },

  async getAll(filters?: { estado?: string; origen?: string; presupuestoId?: string; articuloId?: string }): Promise<RequerimientoCompra[]> {
    const constraints: any[] = [orderBy('createdAt', 'desc')];
    if (filters?.estado) constraints.unshift(where('estado', '==', filters.estado));
    if (filters?.origen) constraints.unshift(where('origen', '==', filters.origen));
    if (filters?.presupuestoId) constraints.unshift(where('presupuestoId', '==', filters.presupuestoId));
    if (filters?.articuloId) constraints.unshift(where('articuloId', '==', filters.articuloId));
    const q = query(collection(db, 'requerimientos_compra'), ...constraints);
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      id: d.id, ...d.data(),
      fechaSolicitud: d.data().fechaSolicitud?.toDate?.()?.toISOString() ?? d.data().fechaSolicitud,
      fechaAprobacion: d.data().fechaAprobacion?.toDate?.()?.toISOString() ?? null,
      createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    })) as RequerimientoCompra[];
  },

  /**
   * TODOS los requerimientos, leídos DEL SERVIDOR (2026-08-28, caso REQ-0040/0043):
   * los chequeos anti-duplicado (sweep de stock mínimo, consolidación al aceptar)
   * no pueden decidir sobre una respuesta de la caché offline — una lectura vieja
   * ya generó números repetidos y reqs redundantes que la consolidación no vio.
   * Offline directo: getDocsFromServer TIRA — el caller aborta en vez de decidir
   * a ciegas (mejor no crear que duplicar).
   */
  async getAllFromServer(): Promise<RequerimientoCompra[]> {
    const snap = await getDocsFromServer(query(collection(db, 'requerimientos_compra'), orderBy('createdAt', 'desc')));
    return snap.docs.map(d => ({
      id: d.id, ...d.data(),
      fechaSolicitud: d.data().fechaSolicitud?.toDate?.()?.toISOString() ?? d.data().fechaSolicitud,
      fechaAprobacion: d.data().fechaAprobacion?.toDate?.()?.toISOString() ?? null,
      createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    })) as RequerimientoCompra[];
  },

  /**
   * Requerimientos de un artículo, SIN orderBy: una sola igualdad no requiere
   * índice compuesto (getAll con filtros + orderBy sí, y si el índice falta el
   * error se traga fácil — ver duplicados UAT 2026-07-16). Orden no garantizado.
   * DEL SERVIDOR (2026-08-28): lo consumen los chequeos de dedupe/consolidación.
   */
  async getByArticulo(articuloId: string): Promise<RequerimientoCompra[]> {
    const snap = await getDocsFromServer(query(
      collection(db, 'requerimientos_compra'),
      where('articuloId', '==', articuloId),
    ));
    return snap.docs.map(d => ({ id: d.id, ...d.data() })) as RequerimientoCompra[];
  },

  /** Requerimientos de un presupuesto, SIN orderBy (sin índice compuesto — ver getByArticulo). */
  async getByPresupuesto(presupuestoId: string): Promise<RequerimientoCompra[]> {
    const snap = await getDocs(query(
      collection(db, 'requerimientos_compra'),
      where('presupuestoId', '==', presupuestoId),
    ));
    return snap.docs.map(d => ({ id: d.id, ...d.data() })) as RequerimientoCompra[];
  },

  /**
   * Requerimientos por estado, SIN orderBy → una sola igualdad no requiere índice
   * compuesto (getAll({estado}) sí, porque suma orderBy('createdAt')). Usar cuando
   * solo importa el conjunto, no el orden (ej. dedup de Alertas de Stock).
   */
  async getByEstado(estado: string): Promise<RequerimientoCompra[]> {
    const snap = await getDocs(query(
      collection(db, 'requerimientos_compra'),
      where('estado', '==', estado),
    ));
    return snap.docs.map(d => ({ id: d.id, ...d.data() })) as RequerimientoCompra[];
  },

  async getById(id: string): Promise<RequerimientoCompra | null> {
    const snap = await getDoc(doc(db, 'requerimientos_compra', id));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      id: snap.id, ...d,
      fechaSolicitud: d.fechaSolicitud?.toDate?.()?.toISOString() ?? d.fechaSolicitud,
      fechaAprobacion: d.fechaAprobacion?.toDate?.()?.toISOString() ?? null,
      createdAt: d.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      updatedAt: d.updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    } as RequerimientoCompra;
  },

  async create(data: Omit<RequerimientoCompra, 'id' | 'numero' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const numero = await this.getNextNumber();
    const payload: any = {
      ...cleanFirestoreData(data as any),
      ...getCreateTrace(),
      numero,
      fechaSolicitud: Timestamp.fromDate(new Date(data.fechaSolicitud)),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    if (data.fechaAprobacion) payload.fechaAprobacion = Timestamp.fromDate(new Date(data.fechaAprobacion));
    const batch = createBatch();
    batch.set(doc(db, 'requerimientos_compra', id), payload);
    batchAudit(batch, { action: 'create', collection: 'requerimientos_compra', documentId: id, after: payload });
    await batch.commit();
    return id;
  },

  async update(id: string, data: Partial<RequerimientoCompra>): Promise<void> {
    const payload: any = { ...cleanFirestoreData(data as any), ...getUpdateTrace(), updatedAt: Timestamp.now() };
    if (data.fechaAprobacion) payload.fechaAprobacion = Timestamp.fromDate(new Date(data.fechaAprobacion));
    const batch = createBatch();
    batch.update(docRef('requerimientos_compra', id), payload);
    batchAudit(batch, { action: 'update', collection: 'requerimientos_compra', documentId: id, after: payload });
    await batch.commit();
  },

  async delete(id: string): Promise<void> {
    const batch = createBatch();
    batch.delete(docRef('requerimientos_compra', id));
    batchAudit(batch, { action: 'delete', collection: 'requerimientos_compra', documentId: id });
    await batch.commit();
  },

  subscribe(
    filters: { estado?: string; origen?: string } | undefined,
    callback: (items: RequerimientoCompra[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    const constraints: any[] = [orderBy('createdAt', 'desc')];
    if (filters?.estado) constraints.unshift(where('estado', '==', filters.estado));
    if (filters?.origen) constraints.unshift(where('origen', '==', filters.origen));
    const q = query(collection(db, 'requerimientos_compra'), ...constraints);
    return onSnapshot(q, snap => {
      callback(snap.docs.map(d => ({
        id: d.id, ...d.data(),
        fechaSolicitud: d.data().fechaSolicitud?.toDate?.()?.toISOString() ?? d.data().fechaSolicitud,
        fechaAprobacion: d.data().fechaAprobacion?.toDate?.()?.toISOString() ?? null,
        createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
        updatedAt: d.data().updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      })) as RequerimientoCompra[]);
    }, err => { console.error('Requerimientos subscription error:', err); onError?.(err); });
  },
};

// ========== IMPORTACIONES ==========

/**
 * Estado de OC que corresponde a cada estado de importación (2026-08-25).
 *
 * Antes crear la importación pasaba la OC directo a 'embarcada', pero las impos
 * se crean en 'preparación' para ir costeando — la OC mentía que la mercadería
 * ya viajaba. La OC ahora REPLICA el estado de la impo: en preparación/en origen
 * sigue 'enviada'; embarcado en adelante → 'embarcada'; recibido → 'recibida'.
 * 'cancelado' no mapea: cancelar la impo no dice nada sobre la OC.
 */
const ESTADO_IMPO_A_OC: Partial<Record<EstadoImportacion, EstadoOC>> = {
  preparacion: 'enviada_proveedor',
  en_origen: 'enviada_proveedor',
  embarcado: 'embarcada',
  en_transito: 'embarcada',
  en_aduana: 'embarcada',
  despachado: 'embarcada',
  recibido: 'recibida',
};

/**
 * Sincroniza el estado de la OC con el de la importación. Best-effort: un fallo
 * acá no debe frenar el guardado de la impo. Nunca toca OCs recibidas o
 * canceladas (estados terminales).
 */
async function syncOCConImportacion(ordenCompraId: string | null | undefined, estadoImpo: EstadoImportacion): Promise<void> {
  if (!ordenCompraId) return;
  const objetivo = ESTADO_IMPO_A_OC[estadoImpo];
  if (!objetivo) return;
  try {
    // Import dinámico: ordenesCompraService vive en presupuestosService y un
    // import estático armaría un ciclo entre servicios.
    const { ordenesCompraService } = await import('./presupuestosService');
    const oc = await ordenesCompraService.getById(ordenCompraId);
    if (!oc || oc.estado === 'recibida' || oc.estado === 'cancelada') return;
    if (oc.estado === objetivo) return;
    await ordenesCompraService.update(ordenCompraId, { estado: objetivo });
  } catch (err) {
    console.warn('[syncOCConImportacion] no se pudo sincronizar la OC:', err);
  }
}

/**
 * Ancla una fecha a Timestamp sin corrimiento de día (2026-08-25). Los inputs
 * date entregan 'YYYY-MM-DD' y `new Date('YYYY-MM-DD')` lo interpreta como
 * medianoche UTC — en Argentina (UTC-3) eso es las 21:00 del día ANTERIOR, y
 * toda vista que formatee con toLocaleDateString mostraba la fecha corrida un
 * día ("la fecha no se actualiza"). Solo-fecha se ancla a medianoche LOCAL.
 */
function tsDesdeFecha(v: string): Timestamp {
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00` : v;
  return Timestamp.fromDate(new Date(iso));
}

export const importacionesService = {
  async getNextNumber(): Promise<string> {
    const q = query(collection(db, 'importaciones'), orderBy('numero', 'desc'));
    const snap = await getDocs(q);
    let maxNum = 0;
    snap.docs.forEach(d => {
      const match = d.data().numero?.match(/IMP-(\d+)/);
      if (match) { const n = parseInt(match[1]); if (n > maxNum) maxNum = n; }
    });
    return `IMP-${String(maxNum + 1).padStart(4, '0')}`;
  },

  async getAll(filters?: { estado?: string; ordenCompraId?: string }): Promise<Importacion[]> {
    const constraints: any[] = [orderBy('createdAt', 'desc')];
    if (filters?.estado) constraints.unshift(where('estado', '==', filters.estado));
    if (filters?.ordenCompraId) constraints.unshift(where('ordenCompraId', '==', filters.ordenCompraId));
    const q = query(collection(db, 'importaciones'), ...constraints);
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id, ...data,
        fechaEmbarque: data.fechaEmbarque?.toDate?.()?.toISOString() ?? null,
        fechaEstimadaArribo: data.fechaEstimadaArribo?.toDate?.()?.toISOString() ?? null,
        fechaArriboReal: data.fechaArriboReal?.toDate?.()?.toISOString() ?? null,
        fechaDespacho: data.fechaDespacho?.toDate?.()?.toISOString() ?? null,
        vepFechaPago: data.vepFechaPago?.toDate?.()?.toISOString() ?? null,
        vepFechaPagado: data.vepFechaPagado?.toDate?.()?.toISOString() ?? null,
        giroFechaPagado: data.giroFechaPagado?.toDate?.()?.toISOString() ?? null,
        fechaRecepcion: data.fechaRecepcion?.toDate?.()?.toISOString() ?? null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      };
    }) as Importacion[];
  },

  async getById(id: string): Promise<Importacion | null> {
    const snap = await getDoc(doc(db, 'importaciones', id));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      id: snap.id, ...data,
      fechaEmbarque: data.fechaEmbarque?.toDate?.()?.toISOString() ?? null,
      fechaEstimadaArribo: data.fechaEstimadaArribo?.toDate?.()?.toISOString() ?? null,
      fechaArriboReal: data.fechaArriboReal?.toDate?.()?.toISOString() ?? null,
      fechaDespacho: data.fechaDespacho?.toDate?.()?.toISOString() ?? null,
      vepFechaPago: data.vepFechaPago?.toDate?.()?.toISOString() ?? null,
      vepFechaPagado: data.vepFechaPagado?.toDate?.()?.toISOString() ?? null,
      giroFechaPagado: data.giroFechaPagado?.toDate?.()?.toISOString() ?? null,
      fechaRecepcion: data.fechaRecepcion?.toDate?.()?.toISOString() ?? null,
      createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    } as Importacion;
  },

  async create(data: Omit<Importacion, 'id' | 'numero' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const numero = await this.getNextNumber();
    const payload: any = {
      ...cleanFirestoreData(data as any),
      ...getCreateTrace(),
      numero,
      gastos: data.gastos || [],
      documentos: data.documentos || [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    const dateFields = ['fechaEmbarque', 'fechaEstimadaArribo', 'fechaArriboReal', 'fechaDespacho', 'vepFechaPago', 'vepFechaPagado', 'giroFechaPagado', 'fechaRecepcion'] as const;
    for (const f of dateFields) {
      if (data[f as keyof typeof data]) payload[f] = tsDesdeFecha((data as any)[f]!);
    }
    const batch = createBatch();
    batch.set(doc(db, 'importaciones', id), payload);
    batchAudit(batch, { action: 'create', collection: 'importaciones', documentId: id, after: payload });
    await batch.commit();
    // La OC replica el estado de la impo (en preparación NO queda embarcada).
    await syncOCConImportacion(data.ordenCompraId, (data.estado ?? 'preparacion') as EstadoImportacion);
    return id;
  },

  async update(id: string, data: Partial<Importacion>): Promise<void> {
    const payload: any = { ...cleanFirestoreData(data as any), ...getUpdateTrace(), updatedAt: Timestamp.now() };
    const dateFields = ['fechaEmbarque', 'fechaEstimadaArribo', 'fechaArriboReal', 'fechaDespacho', 'vepFechaPago', 'vepFechaPagado', 'giroFechaPagado', 'fechaRecepcion'] as const;
    for (const f of dateFields) {
      if ((data as any)[f]) payload[f] = tsDesdeFecha((data as any)[f]);
    }

    /**
     * El estado se deriva ACÁ y no en cada pantalla (2026-09-01).
     *
     * La derivación vivía solo en el guardado del modal, así que cargar la
     * fecha de embarque desde la sección Embarque y la guía desde la sección
     * Aduana —los dos caminos naturales de la página de detalle— dejaba la
     * importación en "Preparación" para siempre, y con ella la OC en "Enviada".
     * Puesta en el servicio, la regla vale para todos los caminos.
     *
     * Un `estado` explícito del caller (cancelar, transición manual) manda.
     * `derivarEstadoImportacion` es forward-only: nunca retrocede.
     */
    let estadoParaOC = data.estado as EstadoImportacion | undefined;
    let ocIdParaSync = data.ordenCompraId ?? null;
    if (!estadoParaOC) {
      const actual = await this.getById(id).catch(() => null);
      if (actual) {
        ocIdParaSync = ocIdParaSync ?? actual.ordenCompraId ?? null;
        // El patch pisa al documento campo por campo: `k in data` distingue
        // "lo están borrando" (null explícito) de "no lo tocaron".
        const v = (k: keyof Importacion) => (k in data ? (data as any)[k] : (actual as any)[k]);
        const derivado = derivarEstadoImportacion({
          fechaEmbarque: v('fechaEmbarque'),
          numeroGuia: v('numeroGuia'),
          despachoNumero: v('despachoNumero'),
          fechaRecepcion: v('fechaRecepcion'),
          stockIngresado: v('stockIngresado'),
        }, actual.estado);
        if (derivado !== actual.estado) {
          payload.estado = derivado;
          estadoParaOC = derivado;
        }
      }
    }

    const batch = createBatch();
    batch.update(docRef('importaciones', id), payload);
    batchAudit(batch, { action: 'update', collection: 'importaciones', documentId: id, after: payload });
    await batch.commit();
    // Si cambió el estado, la OC lo replica (embarcado→embarcada, recibido→recibida).
    if (estadoParaOC) {
      const ocId = ocIdParaSync ?? (await this.getById(id))?.ordenCompraId;
      await syncOCConImportacion(ocId, estadoParaOC);
    }
  },

  async delete(id: string): Promise<void> {
    const batch = createBatch();
    batch.delete(docRef('importaciones', id));
    batchAudit(batch, { action: 'delete', collection: 'importaciones', documentId: id });
    await batch.commit();
  },

  subscribe(
    filters: { estado?: string } | undefined,
    callback: (items: Importacion[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    const constraints: any[] = [orderBy('createdAt', 'desc')];
    if (filters?.estado) constraints.unshift(where('estado', '==', filters.estado));
    const q = query(collection(db, 'importaciones'), ...constraints);
    return onSnapshot(q, snap => {
      callback(snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id, ...data,
          fechaEmbarque: data.fechaEmbarque?.toDate?.()?.toISOString() ?? null,
          fechaEstimadaArribo: data.fechaEstimadaArribo?.toDate?.()?.toISOString() ?? null,
          fechaArriboReal: data.fechaArriboReal?.toDate?.()?.toISOString() ?? null,
          fechaDespacho: data.fechaDespacho?.toDate?.()?.toISOString() ?? null,
          vepFechaPago: data.vepFechaPago?.toDate?.()?.toISOString() ?? null,
          vepFechaPagado: data.vepFechaPagado?.toDate?.()?.toISOString() ?? null,
          giroFechaPagado: data.giroFechaPagado?.toDate?.()?.toISOString() ?? null,
          fechaRecepcion: data.fechaRecepcion?.toDate?.()?.toISOString() ?? null,
          createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
        };
      }) as Importacion[]);
    }, err => { console.error('Importaciones subscription error:', err); onError?.(err); });
  },
};
