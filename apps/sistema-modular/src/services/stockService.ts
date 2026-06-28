import { collection, getDocs, doc, getDoc, query, where, Timestamp } from 'firebase/firestore';
import { runTransaction } from './firebase';
import type { PosicionStock, Articulo, UnidadStock, Minikit, MovimientoStock, Remito, RemitoItem, EstadoUnidad, TipoMovimiento, TipoOrigenDestino, HistorialFicha, ItemFicha, FichaPropiedad, DerivacionProveedor, StockSelection } from '@ags/shared';
import { computeFichaEstado } from '@ags/shared';
import { db, createBatch, docRef, batchAudit, cleanFirestoreData, deepCleanForFirestore, getCreateTrace, getUpdateTrace, logAudit, logBusinessEvent, onSnapshot } from './firebase';

// ========== POSICIONES DE STOCK ==========

export const posicionesStockService = {
  async getAll(activoOnly: boolean = true): Promise<PosicionStock[]> {
    let q;
    if (activoOnly) {
      q = query(collection(db, 'posicionesStock'), where('activo', '==', true));
    } else {
      q = query(collection(db, 'posicionesStock'));
    }
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    })) as PosicionStock[];
    items.sort((a, b) => a.codigo.localeCompare(b.codigo));
    return items;
  },

  async getById(id: string): Promise<PosicionStock | null> {
    const snap = await getDoc(doc(db, 'posicionesStock', id));
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...snap.data(),
      createdAt: snap.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: snap.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    } as PosicionStock;
  },

  async create(data: Omit<PosicionStock, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const payload = cleanFirestoreData({
      ...data,
      ...getCreateTrace(),
      activo: data.activo !== undefined ? data.activo : true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.set(doc(db, 'posicionesStock', id), payload);
    batchAudit(batch, { action: 'create', collection: 'posiciones_stock', documentId: id, after: payload });
    await batch.commit();
    return id;
  },

  async update(id: string, data: Partial<Omit<PosicionStock, 'id' | 'createdAt'>>): Promise<void> {
    const payload = cleanFirestoreData({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.update(docRef('posicionesStock', id), payload);
    batchAudit(batch, { action: 'update', collection: 'posiciones_stock', documentId: id, after: payload });
    await batch.commit();
  },

  async getByParent(parentId: string | null): Promise<PosicionStock[]> {
    let q;
    if (parentId) {
      q = query(collection(db, 'posicionesStock'), where('parentId', '==', parentId), where('activo', '==', true));
    } else {
      q = query(collection(db, 'posicionesStock'), where('activo', '==', true));
      const snap = await getDocs(q);
      const items = snap.docs
        .filter(d => !d.data().parentId)
        .map(d => ({
          id: d.id,
          ...d.data(),
          createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
          updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
        })) as PosicionStock[];
      items.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.codigo.localeCompare(b.codigo));
      return items;
    }
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    })) as PosicionStock[];
    items.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.codigo.localeCompare(b.codigo));
    return items;
  },

  async delete(id: string): Promise<void> {
    const batch = createBatch();
    batch.delete(docRef('posicionesStock', id));
    batchAudit(batch, { action: 'delete', collection: 'posiciones_stock', documentId: id });
    await batch.commit();
  },

  subscribe(
    activoOnly: boolean,
    callback: (items: PosicionStock[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    let q;
    if (activoOnly) {
      q = query(collection(db, 'posicionesStock'), where('activo', '==', true));
    } else {
      q = query(collection(db, 'posicionesStock'));
    }
    return onSnapshot(q, snap => {
      const items = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
        updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      })) as PosicionStock[];
      items.sort((a, b) => a.codigo.localeCompare(b.codigo));
      callback(items);
    }, err => {
      console.error('posicionesStock subscribe error:', err);
      onError?.(err);
    });
  },
};

/**
 * Returns the "RESERVAS" PosicionStock document, creating it if it doesn't exist.
 * The Reservas position has a well-known code 'RESERVAS' so it can be found reliably.
 */
export async function getOrCreateReservasPosition(): Promise<PosicionStock> {
  const all = await posicionesStockService.getAll(false); // include inactive
  const existing = all.find(p => p.codigo === 'RESERVAS');
  if (existing) return existing;
  // Create it if missing — safe to run multiple times (idempotent by code lookup)
  const id = await posicionesStockService.create({
    codigo: 'RESERVAS',
    nombre: 'Reservas',
    descripcion: 'Posición de reserva para unidades asignadas a presupuestos',
    tipo: 'deposito',
    parentId: null,
    activo: true,
  });
  const created = await posicionesStockService.getById(id);
  if (!created) throw new Error('Failed to create Reservas position');
  return created;
}

// ========== ARTICULOS (catalogo de partes) ==========

export const articulosService = {
  async getAll(filters?: {
    categoriaEquipo?: string;
    marcaId?: string;
    tipo?: string;
    activoOnly?: boolean;
  }): Promise<Articulo[]> {
    let q = query(collection(db, 'articulos'));
    if (filters?.activoOnly !== false) {
      q = query(q, where('activo', '==', true));
    }
    if (filters?.categoriaEquipo) {
      q = query(q, where('categoriaEquipo', '==', filters.categoriaEquipo));
    }
    if (filters?.marcaId) {
      q = query(q, where('marcaId', '==', filters.marcaId));
    }
    if (filters?.tipo) {
      q = query(q, where('tipo', '==', filters.tipo));
    }
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    })) as Articulo[];
    items.sort((a, b) => a.codigo.localeCompare(b.codigo));
    return items;
  },

  async getById(id: string): Promise<Articulo | null> {
    const snap = await getDoc(doc(db, 'articulos', id));
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...snap.data(),
      createdAt: snap.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: snap.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    } as Articulo;
  },

  async getByCodigo(codigo: string): Promise<Articulo | null> {
    const q = query(collection(db, 'articulos'), where('codigo', '==', codigo));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return {
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    } as Articulo;
  },

  async create(data: Omit<Articulo, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const payload = deepCleanForFirestore({
      ...data,
      ...getCreateTrace(),
      activo: data.activo !== undefined ? data.activo : true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.set(doc(db, 'articulos', id), payload);
    batchAudit(batch, { action: 'create', collection: 'articulos', documentId: id, after: payload });
    await batch.commit();
    return id;
  },

  async update(id: string, data: Partial<Omit<Articulo, 'id' | 'createdAt'>>): Promise<void> {
    const payload = deepCleanForFirestore({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.update(docRef('articulos', id), payload);
    batchAudit(batch, { action: 'update', collection: 'articulos', documentId: id, after: payload });
    await batch.commit();

    // Phase 13 STKE-02 — recompute denormalized equivalencia fields on origenes pointing to this articulo.
    // LAZY DYNAMIC IMPORT: avoids module-load cycle with equivalenciasService.ts (which also imports
    // articulosService via dynamic import for prod-path reads). By the time this function executes at
    // runtime, both modules are fully initialized; the import resolves instantly.
    const codigoChanged = data.codigo !== undefined;
    const descChanged = data.descripcion !== undefined;
    if (codigoChanged || descChanged) {
      void (async () => {
        try {
          const { recomputeEquivalenciaDenormalization } = await import('./equivalenciasService');
          await recomputeEquivalenciaDenormalization(id);
        } catch (err) {
          console.error('[articulosService.update] equivalencia denormalization recompute failed:', err);
        }
      })();
    }
  },

  subscribeById(
    id: string,
    callback: (item: Articulo | null) => void,
    onError?: (err: Error) => void,
  ): () => void {
    return onSnapshot(doc(db, 'articulos', id), snap => {
      if (!snap.exists()) { callback(null); return; }
      callback({
        id: snap.id,
        ...snap.data(),
        createdAt: snap.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
        updatedAt: snap.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      } as Articulo);
    }, err => {
      console.error('articulos subscription error:', err);
      onError?.(err);
    });
  },

  async deactivate(id: string): Promise<void> {
    await this.update(id, { activo: false });
    logBusinessEvent({
      eventName: 'articulo.dado_de_baja',
      collection: 'articulos',
      documentId: id,
    });
  },

  async delete(id: string): Promise<void> {
    const batch = createBatch();
    batch.delete(docRef('articulos', id));
    batchAudit(batch, { action: 'delete', collection: 'articulos', documentId: id });
    await batch.commit();
  },

  subscribe(
    filters: { categoriaEquipo?: string; marcaId?: string; tipo?: string; activoOnly?: boolean } | undefined,
    callback: (items: Articulo[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    let q = query(collection(db, 'articulos'));
    if (filters?.activoOnly !== false) {
      q = query(q, where('activo', '==', true));
    }
    if (filters?.categoriaEquipo) {
      q = query(q, where('categoriaEquipo', '==', filters.categoriaEquipo));
    }
    if (filters?.marcaId) {
      q = query(q, where('marcaId', '==', filters.marcaId));
    }
    if (filters?.tipo) {
      q = query(q, where('tipo', '==', filters.tipo));
    }
    return onSnapshot(q, snap => {
      const items = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
        updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      })) as Articulo[];
      items.sort((a, b) => a.codigo.localeCompare(b.codigo));
      callback(items);
    }, err => {
      console.error('articulos subscribe error:', err);
      onError?.(err);
    });
  },
};

// ========== UNIDADES DE STOCK ==========

export const unidadesService = {
  async getAll(filters?: {
    articuloId?: string;
    estado?: string;
    condicion?: string;
    activoOnly?: boolean;
  }): Promise<UnidadStock[]> {
    let q = query(collection(db, 'unidades'));
    if (filters?.activoOnly !== false) {
      q = query(q, where('activo', '==', true));
    }
    if (filters?.articuloId) {
      q = query(q, where('articuloId', '==', filters.articuloId));
    }
    if (filters?.estado) {
      q = query(q, where('estado', '==', filters.estado));
    }
    if (filters?.condicion) {
      q = query(q, where('condicion', '==', filters.condicion));
    }
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    })) as UnidadStock[];
    items.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
    return items;
  },

  async getByArticulo(articuloId: string): Promise<UnidadStock[]> {
    return this.getAll({ articuloId, activoOnly: true });
  },

  async getByUbicacion(tipo: string, referenciaId: string): Promise<UnidadStock[]> {
    const q = query(
      collection(db, 'unidades'),
      where('ubicacion.tipo', '==', tipo),
      where('ubicacion.referenciaId', '==', referenciaId),
      where('activo', '==', true),
    );
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    })) as UnidadStock[];
    items.sort((a, b) => a.articuloCodigo.localeCompare(b.articuloCodigo));
    return items;
  },

  async getById(id: string): Promise<UnidadStock | null> {
    const snap = await getDoc(doc(db, 'unidades', id));
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...snap.data(),
      createdAt: snap.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: snap.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    } as UnidadStock;
  },

  async create(data: Omit<UnidadStock, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const payload = deepCleanForFirestore({
      ...data,
      ...getCreateTrace(),
      activo: data.activo !== undefined ? data.activo : true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.set(doc(db, 'unidades', id), payload);
    batchAudit(batch, { action: 'create', collection: 'unidades_stock', documentId: id, after: payload });
    await batch.commit();
    return id;
  },

  /**
   * Crea N unidades en lote. Cada unidad = un documento. Útil para el alta masiva
   * (artículos con serie: una fila por unidad; lotes: una fila por lote+cantidad).
   * Se chunkea cada 200 documentos porque cada unidad consume 2 ops de batch (set + audit)
   * y el límite de Firestore es 500 ops por commit.
   */
  async createMany(items: Omit<UnidadStock, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<string[]> {
    const ids: string[] = [];
    const CHUNK = 200;
    for (let i = 0; i < items.length; i += CHUNK) {
      const slice = items.slice(i, i + CHUNK);
      const batch = createBatch();
      const trace = getCreateTrace();
      for (const data of slice) {
        const id = crypto.randomUUID();
        const payload = deepCleanForFirestore({
          ...data,
          ...trace,
          activo: data.activo !== undefined ? data.activo : true,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        batch.set(doc(db, 'unidades', id), payload);
        batchAudit(batch, { action: 'create', collection: 'unidades_stock', documentId: id, after: payload });
        ids.push(id);
      }
      await batch.commit();
    }
    return ids;
  },

  async update(id: string, data: Partial<Omit<UnidadStock, 'id' | 'createdAt'>>): Promise<void> {
    const payload = deepCleanForFirestore({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.update(docRef('unidades', id), payload);
    batchAudit(batch, { action: 'update', collection: 'unidades_stock', documentId: id, after: payload });
    await batch.commit();
  },

  async delete(id: string): Promise<void> {
    const batch = createBatch();
    batch.delete(docRef('unidades', id));
    batchAudit(batch, { action: 'delete', collection: 'unidades_stock', documentId: id });
    await batch.commit();
  },

  subscribe(
    filters: { articuloId?: string; estado?: string; condicion?: string; activoOnly?: boolean } | undefined,
    callback: (items: UnidadStock[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    let q = query(collection(db, 'unidades'));
    if (filters?.activoOnly !== false) {
      q = query(q, where('activo', '==', true));
    }
    if (filters?.articuloId) {
      q = query(q, where('articuloId', '==', filters.articuloId));
    }
    if (filters?.estado) {
      q = query(q, where('estado', '==', filters.estado));
    }
    if (filters?.condicion) {
      q = query(q, where('condicion', '==', filters.condicion));
    }
    return onSnapshot(q, snap => {
      const items = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
        updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      })) as UnidadStock[];
      items.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      callback(items);
    }, err => {
      console.error('unidades subscribe error:', err);
      onError?.(err);
    });
  },
};

// ========== MINIKITS ==========

export const minikitsService = {
  async getAll(activoOnly: boolean = true): Promise<Minikit[]> {
    let q;
    if (activoOnly) {
      q = query(collection(db, 'minikits'), where('activo', '==', true));
    } else {
      q = query(collection(db, 'minikits'));
    }
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    })) as Minikit[];
    items.sort((a, b) => a.codigo.localeCompare(b.codigo));
    return items;
  },

  async getById(id: string): Promise<Minikit | null> {
    const snap = await getDoc(doc(db, 'minikits', id));
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...snap.data(),
      createdAt: snap.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: snap.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    } as Minikit;
  },

  async create(data: Omit<Minikit, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const payload = deepCleanForFirestore({
      ...data,
      ...getCreateTrace(),
      activo: data.activo !== undefined ? data.activo : true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.set(doc(db, 'minikits', id), payload);
    batchAudit(batch, { action: 'create', collection: 'minikits', documentId: id, after: payload });
    await batch.commit();
    return id;
  },

  async update(id: string, data: Partial<Omit<Minikit, 'id' | 'createdAt'>>): Promise<void> {
    const payload = deepCleanForFirestore({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.update(docRef('minikits', id), payload);
    batchAudit(batch, { action: 'update', collection: 'minikits', documentId: id, after: payload });
    await batch.commit();
  },

  subscribeById(
    id: string,
    callback: (item: Minikit | null) => void,
    onError?: (err: Error) => void,
  ): () => void {
    return onSnapshot(doc(db, 'minikits', id), snap => {
      if (!snap.exists()) { callback(null); return; }
      callback({
        id: snap.id,
        ...snap.data(),
        createdAt: snap.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
        updatedAt: snap.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      } as Minikit);
    }, err => {
      console.error('minikits subscription error:', err);
      onError?.(err);
    });
  },

  async delete(id: string): Promise<void> {
    const batch = createBatch();
    batch.delete(docRef('minikits', id));
    batchAudit(batch, { action: 'delete', collection: 'minikits', documentId: id });
    await batch.commit();
  },

  subscribe(
    activoOnly: boolean,
    callback: (items: Minikit[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    let q;
    if (activoOnly) {
      q = query(collection(db, 'minikits'), where('activo', '==', true));
    } else {
      q = query(collection(db, 'minikits'));
    }
    return onSnapshot(q, snap => {
      const items = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
        updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      })) as Minikit[];
      items.sort((a, b) => a.codigo.localeCompare(b.codigo));
      callback(items);
    }, err => {
      console.error('minikits subscribe error:', err);
      onError?.(err);
    });
  },
};

// ========== MOVIMIENTOS DE STOCK (log inmutable) ==========

export const movimientosService = {
  async getAll(filters?: {
    articuloId?: string;
    unidadId?: string;
    tipo?: string;
    remitoId?: string;
    otNumber?: string;
    limitCount?: number;
  }): Promise<MovimientoStock[]> {
    let q = query(collection(db, 'movimientosStock'));
    if (filters?.articuloId) {
      q = query(q, where('articuloId', '==', filters.articuloId));
    }
    if (filters?.unidadId) {
      q = query(q, where('unidadId', '==', filters.unidadId));
    }
    if (filters?.tipo) {
      q = query(q, where('tipo', '==', filters.tipo));
    }
    if (filters?.remitoId) {
      q = query(q, where('remitoId', '==', filters.remitoId));
    }
    if (filters?.otNumber) {
      q = query(q, where('otNumber', '==', filters.otNumber));
    }
    const snap = await getDocs(q);
    let items = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    })) as MovimientoStock[];
    items.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
    if (filters?.limitCount && filters.limitCount > 0) {
      items = items.slice(0, filters.limitCount);
    }
    return items;
  },

  async getByUnidad(unidadId: string): Promise<MovimientoStock[]> {
    return this.getAll({ unidadId });
  },

  async create(data: Omit<MovimientoStock, 'id' | 'createdAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const payload = deepCleanForFirestore({
      ...data,
      ...getCreateTrace(),
      createdAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.set(doc(db, 'movimientosStock', id), payload);
    batchAudit(batch, { action: 'create', collection: 'movimientos_stock', documentId: id, after: payload });
    await batch.commit();

    // Resolver código del artículo para que la auditoría muestre algo legible
    // ("artículo 5188-5367") en lugar del ID interno. Best-effort: si la lectura
    // falla cae al ID.
    let articuloCodigo: string | null = null;
    const articuloId = (data as any).articuloId ?? null;
    if (articuloId) {
      try {
        const snap = await getDoc(doc(db, 'articulos', articuloId));
        if (snap.exists()) articuloCodigo = (snap.data().codigoArticulo ?? snap.data().codigo) ?? null;
      } catch {
        // best-effort
      }
    }
    const tipo = (data as any).tipo ?? null;
    const cantidad = (data as any).cantidad ?? null;
    logBusinessEvent({
      eventName: 'stock.movimiento_creado',
      collection: 'movimientos_stock',
      documentId: id,
      entityLabel: articuloCodigo ? `Mov. ${tipo ?? ''} — ${articuloCodigo}`.trim() : undefined,
      details: {
        tipo,
        articuloId,
        articuloCodigo,
        cantidad,
        origenTipo: (data as any).origenTipo ?? null,
        destinoTipo: (data as any).destinoTipo ?? null,
      },
    });
    return id;
  },

  subscribe(
    filters: { articuloId?: string; unidadId?: string; tipo?: string; remitoId?: string; otNumber?: string } | undefined,
    callback: (items: MovimientoStock[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    let q = query(collection(db, 'movimientosStock'));
    if (filters?.articuloId) {
      q = query(q, where('articuloId', '==', filters.articuloId));
    }
    if (filters?.unidadId) {
      q = query(q, where('unidadId', '==', filters.unidadId));
    }
    if (filters?.tipo) {
      q = query(q, where('tipo', '==', filters.tipo));
    }
    if (filters?.remitoId) {
      q = query(q, where('remitoId', '==', filters.remitoId));
    }
    if (filters?.otNumber) {
      q = query(q, where('otNumber', '==', filters.otNumber));
    }
    return onSnapshot(q, snap => {
      const items = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      })) as MovimientoStock[];
      items.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      callback(items);
    }, err => {
      console.error('movimientosStock subscribe error:', err);
      onError?.(err);
    });
  },
};

// ========== REMITOS ==========

export const remitosService = {
  /**
   * Sugiere el próximo correlativo en formato `PPPP-NNNNNNNN` (talonario preimpreso)
   * a partir del máximo ya registrado en `remitos`. Read-only — no consume número
   * (la numeración real la define el papel físico). Permite override manual.
   */
  async getProximoNumeroPreimpreso(prefix: string = '0001'): Promise<string> {
    const snap = await getDocs(collection(db, 'remitos'));
    let max = 0;
    for (const d of snap.docs) {
      const numero = d.data().numero as string | undefined;
      if (!numero) continue;
      const m = numero.match(/^(\d{4})-(\d{8})$/);
      if (!m || m[1] !== prefix) continue;
      const n = parseInt(m[2], 10);
      if (n > max) max = n;
    }
    return `${prefix}-${String(max + 1).padStart(8, '0')}`;
  },

  // Atómico vía counter doc — antes era scan-and-max no transaccional.
  async getNextRemitoNumber(): Promise<string> {
    const counterRef = doc(db, '_counters', 'remitoNumber');
    const next = await runTransaction(db, async (tx) => {
      const counterSnap = await tx.get(counterRef);
      let current: number;
      if (counterSnap.exists()) {
        current = counterSnap.data().value as number;
      } else {
        const snap = await getDocs(collection(db, 'remitos'));
        let maxNum = 0;
        snap.docs.forEach(d => {
          const match = d.data().numero?.match(/REM-(\d+)/);
          if (match) { const n = parseInt(match[1]); if (n > maxNum) maxNum = n; }
        });
        current = maxNum;
      }
      const nextVal = current + 1;
      tx.set(counterRef, { value: nextVal, updatedAt: Timestamp.now() });
      return nextVal;
    });
    return `REM-${String(next).padStart(4, '0')}`;
  },

  async getAll(filters?: {
    ingenieroId?: string;
    estado?: string;
    tipo?: string;
  }): Promise<Remito[]> {
    let q = query(collection(db, 'remitos'));
    if (filters?.ingenieroId) {
      q = query(q, where('ingenieroId', '==', filters.ingenieroId));
    }
    if (filters?.estado) {
      q = query(q, where('estado', '==', filters.estado));
    }
    if (filters?.tipo) {
      q = query(q, where('tipo', '==', filters.tipo));
    }
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      fechaSalida: d.data().fechaSalida?.toDate?.().toISOString() ?? d.data().fechaSalida ?? null,
      fechaDevolucion: d.data().fechaDevolucion?.toDate?.().toISOString() ?? d.data().fechaDevolucion ?? null,
    })) as Remito[];
    items.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
    return items;
  },

  async getById(id: string): Promise<Remito | null> {
    const snap = await getDoc(doc(db, 'remitos', id));
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...snap.data(),
      createdAt: snap.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: snap.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      fechaSalida: snap.data().fechaSalida?.toDate?.().toISOString() ?? snap.data().fechaSalida ?? null,
      fechaDevolucion: snap.data().fechaDevolucion?.toDate?.().toISOString() ?? snap.data().fechaDevolucion ?? null,
    } as Remito;
  },

  async create(data: Omit<Remito, 'id' | 'numero' | 'createdAt' | 'updatedAt'> & { numero?: string }): Promise<string> {
    const id = crypto.randomUUID();
    const numero = data.numero || await this.getNextRemitoNumber();
    const { numero: _num, ...rest } = data;
    const payload = deepCleanForFirestore({
      ...rest,
      ...getCreateTrace(),
      numero,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.set(doc(db, 'remitos', id), payload);
    batchAudit(batch, { action: 'create', collection: 'remitos', documentId: id, after: payload });
    await batch.commit();
    return id;
  },

  async update(id: string, data: Partial<Omit<Remito, 'id' | 'createdAt'>>): Promise<void> {
    const payload = deepCleanForFirestore({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.update(docRef('remitos', id), payload);
    batchAudit(batch, { action: 'update', collection: 'remitos', documentId: id, after: payload });
    await batch.commit();
  },

  subscribeById(
    id: string,
    callback: (item: Remito | null) => void,
    onError?: (err: Error) => void,
  ): () => void {
    return onSnapshot(doc(db, 'remitos', id), snap => {
      if (!snap.exists()) { callback(null); return; }
      callback({
        id: snap.id,
        ...snap.data(),
        createdAt: snap.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
        updatedAt: snap.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
        fechaSalida: snap.data().fechaSalida?.toDate?.().toISOString() ?? snap.data().fechaSalida ?? null,
        fechaDevolucion: snap.data().fechaDevolucion?.toDate?.().toISOString() ?? snap.data().fechaDevolucion ?? null,
      } as Remito);
    }, err => {
      console.error('remitos subscription error:', err);
      onError?.(err);
    });
  },

  async delete(id: string): Promise<void> {
    const batch = createBatch();
    batch.delete(docRef('remitos', id));
    batchAudit(batch, { action: 'delete', collection: 'remitos', documentId: id });
    await batch.commit();
  },

  subscribe(
    filters: { ingenieroId?: string; estado?: string; tipo?: string } | undefined,
    callback: (items: Remito[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    let q = query(collection(db, 'remitos'));
    if (filters?.ingenieroId) {
      q = query(q, where('ingenieroId', '==', filters.ingenieroId));
    }
    if (filters?.estado) {
      q = query(q, where('estado', '==', filters.estado));
    }
    if (filters?.tipo) {
      q = query(q, where('tipo', '==', filters.tipo));
    }
    return onSnapshot(q, snap => {
      const items = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
        updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
        fechaSalida: d.data().fechaSalida?.toDate?.().toISOString() ?? d.data().fechaSalida ?? null,
        fechaDevolucion: d.data().fechaDevolucion?.toDate?.().toISOString() ?? d.data().fechaDevolucion ?? null,
      })) as Remito[];
      items.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      callback(items);
    }, err => {
      console.error('remitos subscribe error:', err);
      onError?.(err);
    });
  },

  /**
   * Crea un remito de devolución o derivación a proveedor a partir de una lista
   * de items (cada item puede pertenecer a una ficha distinta), y aplica los
   * side effects: cada item afectado pasa a `en_envio` (devolución) o
   * `derivado_proveedor` (derivación), con su entrada al historial; el estado
   * agregado de la ficha se recalcula con `computeFichaEstado`.
   *
   * Numeración manual (la del papel preimpreso) — NO usa `getNextRemitoNumber`.
   */
  async createForItems(input: CreateRemitoItemsInput): Promise<{ id: string }> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const isDevolucion = input.tipo === 'devolucion';
    const proveedorNombre = input.proveedorNombre ?? 'proveedor';

    // Una línea por parte si el item se deriva por partes; una sola línea si el
    // módulo va completo (o si es devolución al cliente, donde partes no aplica).
    const remitoLineas: RemitoItem[] = input.items.flatMap(it => {
      const tienePartes = !isDevolucion && (it.partes?.length ?? 0) > 0;
      if (tienePartes) {
        return it.partes!.map(p => ({
          id: crypto.randomUUID(),
          cantidad: 1,
          tipoItem: 'entrega' as const,
          devuelto: false,
          fichaId: it.fichaId,
          fichaNumero: it.fichaNumero,
          fichaDescripcion: `${p.descripcion}${p.serie ? ` · S/N ${p.serie}` : ''} (de ${it.itemSubId})`,
        }));
      }
      return [{
        id: crypto.randomUUID(),
        cantidad: 1,
        tipoItem: 'entrega' as const,
        devuelto: false,
        fichaId: it.fichaId,
        fichaNumero: it.fichaNumero,
        fichaDescripcion: it.descripcion,
      }];
    });

    // Agrupar items por fichaId para hacer un solo update por ficha
    const itemsByFicha = new Map<string, typeof input.items>();
    for (const it of input.items) {
      const arr = itemsByFicha.get(it.fichaId) ?? [];
      arr.push(it);
      itemsByFicha.set(it.fichaId, arr);
    }

    const fichaIds = Array.from(itemsByFicha.keys());
    const fichaNumeros = Array.from(new Set(input.items.map(it => it.fichaNumero)));
    const remitoPayload = deepCleanForFirestore({
      numero: input.numero,
      tipo: input.tipo,
      estado: 'en_transito',
      ingenieroId: '',
      ingenieroNombre: '',
      otNumbers: input.otNumbers ?? [],
      clienteId: isDevolucion ? (input.clienteId ?? null) : null,
      clienteNombre: isDevolucion ? (input.clienteNombre ?? null) : null,
      proveedorId: !isDevolucion ? (input.proveedorId ?? null) : null,
      proveedorNombre: !isDevolucion ? (input.proveedorNombre ?? null) : null,
      items: remitoLineas,
      observaciones: input.observaciones ?? null,
      fechaSalida: input.fecha,
      fechaDevolucion: null,
      fichaId: fichaIds.length === 1 ? fichaIds[0] : null,
      fichaNumero: fichaNumeros.length === 1 ? fichaNumeros[0] : null,
      loanerId: null,
      loanerCodigo: null,
      ...getCreateTrace(),
      createdAt: Timestamp.fromDate(new Date(now)),
      updatedAt: Timestamp.now(),
    });

    const batch = createBatch();
    batch.set(docRef('remitos', id), remitoPayload);
    batchAudit(batch, { action: 'create', collection: 'remitos', documentId: id, after: remitoPayload });

    const creadoPor = getCreateTrace().createdByName ?? 'Sistema';

    for (const [fichaId, itemsDeFicha] of itemsByFicha) {
      const fichaSnap = await getDoc(doc(db, 'fichasPropiedad', fichaId));
      if (!fichaSnap.exists()) continue;
      const ficha = fichaSnap.data() as FichaPropiedad;
      const inputByItemId = new Map(itemsDeFicha.map(it => [it.itemId, it]));

      const updatedItems: ItemFicha[] = (ficha.items ?? []).map(it => {
        const inputItem = inputByItemId.get(it.id);
        if (!inputItem) return it;

        const tienePartes = !isDevolucion && (inputItem.partes?.length ?? 0) > 0;
        const nuevoEstado = isDevolucion
          ? 'en_envio'
          : (tienePartes ? 'esperando_repuesto' : 'derivado_proveedor');

        const motivoBase = isDevolucion
          ? `Remito de devolución ${input.numero}`
          : (tienePartes
              ? `Derivación parcial — remito ${input.numero} a ${proveedorNombre}`
              : `Remito de derivación a ${proveedorNombre} ${input.numero}`);

        const entry: HistorialFicha = {
          id: crypto.randomUUID(),
          fecha: now,
          estadoAnterior: it.estado,
          estadoNuevo: nuevoEstado,
          nota: motivoBase,
          creadoPor,
        };

        // Para derivación a proveedor también dejamos rastro estructurado en
        // `derivaciones[]` — alimenta la vista histórica del item y permite
        // marcar "recibido" cuando vuelven las partes.
        let nuevasDerivaciones: DerivacionProveedor[] = it.derivaciones ?? [];
        if (!isDevolucion) {
          const proveedorId = input.proveedorId ?? '';
          if (tienePartes) {
            for (const p of inputItem.partes!) {
              const der: DerivacionProveedor = {
                id: crypto.randomUUID(),
                proveedorId,
                proveedorNombre,
                remitoSalidaId: id,
                remitoSalidaNumero: input.numero,
                remitoRetornoId: null,
                fechaEnvio: now,
                fechaRetorno: null,
                descripcion: `${p.descripcion}${p.serie ? ` · S/N ${p.serie}` : ''} (de ${it.subId})`,
                estado: 'enviado',
                alcance: 'parte',
                parte: {
                  articuloId: p.articuloId ?? null,
                  articuloCodigo: p.articuloCodigo ?? null,
                  descripcion: p.descripcion,
                  serie: p.serie ?? null,
                },
              };
              nuevasDerivaciones = [...nuevasDerivaciones, der];
            }
          } else {
            const der: DerivacionProveedor = {
              id: crypto.randomUUID(),
              proveedorId,
              proveedorNombre,
              remitoSalidaId: id,
              remitoSalidaNumero: input.numero,
              remitoRetornoId: null,
              fechaEnvio: now,
              fechaRetorno: null,
              descripcion: inputItem.descripcion,
              estado: 'enviado',
              alcance: 'modulo_completo',
            };
            nuevasDerivaciones = [...nuevasDerivaciones, der];
          }
        }

        return {
          ...it,
          estado: nuevoEstado,
          historial: [...(it.historial ?? []), entry],
          derivaciones: nuevasDerivaciones,
          remitoDevolucionId: isDevolucion ? id : (it.remitoDevolucionId ?? null),
        };
      });

      const fichaPatch = deepCleanForFirestore({
        items: updatedItems,
        estado: computeFichaEstado(updatedItems),
        ...getUpdateTrace(),
        updatedAt: Timestamp.now(),
      });
      batch.update(docRef('fichasPropiedad', fichaId), fichaPatch);
      batchAudit(batch, { action: 'update', collection: 'fichas_propiedad', documentId: fichaId, after: fichaPatch });
    }

    await batch.commit();
    return { id };
  },
};

/** Datos de razón social/domicilio/IVA/CUIT que van impresos en una columna. */
export interface DatosTransportista {
  razonSocial: string;
  domicilio: string;
  localidad: string;
  provincia: string;
  iva: string;
  cuit: string;
}

export interface CreateRemitoItemsInput {
  /** Número preimpreso del papel (ej. "0001-00017091"). */
  numero: string;
  tipo: 'devolucion' | 'derivacion_proveedor';
  destinatario: DatosTransportista;
  transportista?: DatosTransportista | null;
  fecha: string;
  /**
   * Items a incluir. Cada uno referencia su ficha + el item (módulo) dentro de la ficha.
   *
   * - Si `partes` está vacío/ausente: viaja el módulo completo. Una sola línea en el remito.
   *   En `derivacion_proveedor` el módulo padre transiciona a `derivado_proveedor` y se
   *   crea 1 `DerivacionProveedor` con `alcance: 'modulo_completo'`.
   * - Si `partes` tiene 1+ entradas: viajan solo esas partes (no el módulo). Una línea
   *   por parte. El módulo padre queda en planta y transiciona a `esperando_repuesto`,
   *   con N `DerivacionProveedor` (`alcance: 'parte'`) — una por parte.
   *
   * `partes` solo aplica para `tipo: 'derivacion_proveedor'`. En devoluciones al cliente
   * se ignora.
   */
  items: Array<{
    fichaId: string;
    fichaNumero: string;
    itemId: string;
    itemSubId: string;
    descripcion: string;
    partes?: Array<{
      articuloId?: string | null;
      articuloCodigo?: string | null;
      descripcion: string;
      serie?: string | null;
    }>;
  }>;
  observaciones?: string | null;
  proveedorId?: string | null;
  proveedorNombre?: string | null;
  clienteId?: string | null;
  clienteNombre?: string | null;
  otNumbers?: string[];
}

// ========== RESERVAS DE STOCK ==========

export const reservasService = {
  /** Unidades actualmente reservadas para un presupuesto (estado 'reservado'). */
  async getByPresupuesto(presupuestoId: string): Promise<UnidadStock[]> {
    if (!presupuestoId) return [];
    const q = query(
      collection(db, 'unidades'),
      where('reservadoParaPresupuestoId', '==', presupuestoId),
      where('estado', '==', 'reservado'),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as UnidadStock));
  },

  /**
   * Reserves a specific UnidadStock for a presupuesto.
   * Physically moves the unit to the RESERVAS position and sets estado='reservado'.
   * Creates an immutable MovimientoStock of type 'transferencia'.
   * NEVER writes undefined — all optional fields use null.
   */
  async reservar(params: {
    unidadId: string;
    unidad: UnidadStock;
    presupuestoId: string;
    presupuestoNumero: string;
    clienteId: string;
    clienteNombre: string;
    solicitadoPorNombre: string;
    /**
     * Cantidad física a reservar de esta unidad. Para artículos serializados (cantidad 1)
     * omitir → reserva la unidad entera. Para LOTES (cantidad > 1) pasar la cantidad
     * necesaria: si es menor a la del lote, se SPLITEA — el resto queda disponible en la
     * unidad original y se crea una nueva unidad reservada con la porción pedida. Sin esto
     * se reservaba el lote entero aunque solo se necesitara una parte (bug de sobre-reserva).
     */
    cantidad?: number;
  }): Promise<void> {
    // Fetch RESERVAS position OUTSIDE tx — stable singleton, safe to prefetch.
    // getOrCreateReservasPosition() is idempotent by 'RESERVAS' code lookup.
    const posReservas = await getOrCreateReservasPosition();
    const now = Timestamp.now();
    const movId = crypto.randomUUID();
    const unidadRef = docRef('unidades', params.unidadId);
    const movRef = doc(db, 'movimientosStock', movId);
    const splitRef = docRef('unidades', crypto.randomUUID()); // destino si hay split de lote

    const reservadoUnidadId = await runTransaction(db, async (tx) => {
      // READ FIRST (all reads before any write — Firestore tx requirement)
      const unidadSnap = await tx.get(unidadRef);
      if (!unidadSnap.exists()) {
        throw new Error(`Unidad ${params.unidadId} no encontrada`);
      }
      const data = unidadSnap.data();
      if (data.estado !== 'disponible') {
        throw new Error(
          `Unidad no disponible — estado actual '${data.estado}' (reservada por otro usuario?)`,
        );
      }

      const qtyActual = data.cantidad ?? 1;
      const aReservar = params.cantidad != null ? Math.min(params.cantidad, qtyActual) : qtyActual;
      const esSplitParcial = aReservar < qtyActual;

      const reservaFields = {
        estado: 'reservado' as EstadoUnidad,
        ubicacion: { tipo: 'posicion', referenciaId: posReservas.id, referenciaNombre: posReservas.nombre },
        reservadoParaPresupuestoId: params.presupuestoId,
        reservadoParaPresupuestoNumero: params.presupuestoNumero,
        reservadoParaClienteId: params.clienteId,
        reservadoParaClienteNombre: params.clienteNombre,
      };

      let movUnidadId = params.unidadId;
      if (esSplitParcial) {
        // Lote: descontar lo reservado de la unidad original (queda disponible) y crear
        // una unidad nueva con la porción reservada. Clonamos el doc original; deepClean
        // preserva los Timestamp (no recursa instancias), y pisamos createdAt/updatedAt.
        const { id: _id, ...rest } = data as Record<string, any>;
        tx.update(unidadRef, deepCleanForFirestore({
          cantidad: qtyActual - aReservar,
          ...getUpdateTrace(),
          updatedAt: now.toDate().toISOString(),
        }));
        tx.set(splitRef, deepCleanForFirestore({
          ...rest,
          cantidad: aReservar,
          ...reservaFields,
          ...getCreateTrace(),
          createdAt: now,
          updatedAt: now,
        }));
        movUnidadId = splitRef.id;
      } else {
        tx.update(unidadRef, deepCleanForFirestore({
          ...reservaFields,
          ...getUpdateTrace(),
          updatedAt: now.toDate().toISOString(),
        }));
      }

      tx.set(movRef, deepCleanForFirestore({
        tipo: 'transferencia' as TipoMovimiento,
        unidadId: movUnidadId,
        articuloId: params.unidad.articuloId,
        articuloCodigo: params.unidad.articuloCodigo,
        articuloDescripcion: params.unidad.articuloDescripcion,
        cantidad: aReservar,
        origenTipo: params.unidad.ubicacion.tipo as TipoOrigenDestino,
        origenId: params.unidad.ubicacion.referenciaId,
        origenNombre: params.unidad.ubicacion.referenciaNombre,
        destinoTipo: 'posicion' as TipoOrigenDestino,
        destinoId: posReservas.id,
        destinoNombre: posReservas.nombre,
        motivo: `Reservado para presupuesto ${params.presupuestoNumero} — ${params.clienteNombre}`,
        creadoPor: params.solicitadoPorNombre,
        ...getCreateTrace(),
        createdAt: now,
      }));

      return movUnidadId;
    });

    // Audit — post-tx best-effort (fire-and-forget, non-blocking).
    // Audit is observational; losing it is acceptable vs. rolling back the reservation.
    logAudit({ action: 'update', collection: 'unidades_stock', documentId: reservadoUnidadId });
  },

  /**
   * Releases a reserved UnidadStock back to disponible.
   * Moves unit back to its original position (or a default depot if unknown).
   * Creates an immutable MovimientoStock of type 'transferencia'.
   *
   * Migrado a runTransaction para evitar races con reservar() concurrente:
   * leemos el estado actual y validamos que esté 'reservado' antes de escribir,
   * todo atómico. Sin esto, una libera+reserva concurrentes podían dejar la
   * unidad en estado inconsistente con la reserva del segundo proceso perdida.
   */
  async liberar(params: {
    unidadId: string;
    unidad: UnidadStock;
    motivo: string;
    solicitadoPorNombre: string;
    destino?: { tipo: 'posicion' | 'minikit' | 'ingeniero'; referenciaId: string; referenciaNombre: string };
  }): Promise<void> {
    const now = Timestamp.now();
    const movId = crypto.randomUUID();
    const unidadRef = docRef('unidades', params.unidadId);
    const movRef = doc(db, 'movimientosStock', movId);

    await runTransaction(db, async (tx) => {
      // READ FIRST — todas las reads antes de cualquier write.
      const unidadSnap = await tx.get(unidadRef);
      if (!unidadSnap.exists()) {
        throw new Error(`Unidad ${params.unidadId} no encontrada`);
      }
      const currentEstado = unidadSnap.data().estado;
      if (currentEstado !== 'reservado') {
        throw new Error(
          `Unidad no liberable — estado actual '${currentEstado}' (esperaba 'reservado')`,
        );
      }

      const unitPayload = deepCleanForFirestore({
        estado: 'disponible' as EstadoUnidad,
        reservadoParaPresupuestoId: null,
        reservadoParaPresupuestoNumero: null,
        reservadoParaClienteId: null,
        reservadoParaClienteNombre: null,
        ...(params.destino ? { ubicacion: params.destino } : {}),
        ...getUpdateTrace(),
        updatedAt: now.toDate().toISOString(),
      });

      const movPayload = deepCleanForFirestore({
        tipo: 'transferencia' as TipoMovimiento,
        unidadId: params.unidadId,
        articuloId: params.unidad.articuloId,
        articuloCodigo: params.unidad.articuloCodigo,
        articuloDescripcion: params.unidad.articuloDescripcion,
        cantidad: 1,
        origenTipo: params.unidad.ubicacion.tipo as TipoOrigenDestino,
        origenId: params.unidad.ubicacion.referenciaId,
        origenNombre: params.unidad.ubicacion.referenciaNombre,
        destinoTipo: (params.destino?.tipo ?? params.unidad.ubicacion.tipo) as TipoOrigenDestino,
        destinoId: params.destino?.referenciaId ?? params.unidad.ubicacion.referenciaId,
        destinoNombre: params.destino?.referenciaNombre ?? params.unidad.ubicacion.referenciaNombre,
        motivo: params.motivo,
        creadoPor: params.solicitadoPorNombre,
        ...getCreateTrace(),
        createdAt: now,
      });

      tx.update(unidadRef, unitPayload);
      tx.set(movRef, movPayload);
    });

    // Audit — post-tx best-effort (fire-and-forget). Mismo patrón que reservar().
    logAudit({ action: 'update', collection: 'unidades_stock', documentId: params.unidadId });
  },

  /**
   * Entrega una unidad RESERVADA al cliente (salida definitiva del inventario).
   * reservado → entregado. Deducción real: 'entregado' está fuera del whitelist de ATP,
   * así que la unidad deja de contar como stock comprometido. Crea un MovimientoStock
   * 'egreso' con destino cliente. Conserva los campos reservadoPara* como traza histórica.
   * Validación atómica de estado: solo entrega si está 'reservado'.
   */
  async entregar(params: {
    unidadId: string;
    unidad: UnidadStock;
    otNumber: string;
    motivo: string;
    solicitadoPorNombre: string;
  }): Promise<void> {
    const now = Timestamp.now();
    const movId = crypto.randomUUID();
    const unidadRef = docRef('unidades', params.unidadId);
    const movRef = doc(db, 'movimientosStock', movId);

    await runTransaction(db, async (tx) => {
      const unidadSnap = await tx.get(unidadRef);
      if (!unidadSnap.exists()) {
        throw new Error(`Unidad ${params.unidadId} no encontrada`);
      }
      const data = unidadSnap.data();
      if (data.estado !== 'reservado') {
        throw new Error(
          `Unidad no entregable — estado actual '${data.estado}' (esperaba 'reservado')`,
        );
      }

      const unitPayload = deepCleanForFirestore({
        estado: 'entregado' as EstadoUnidad,
        ...getUpdateTrace(),
        updatedAt: now.toDate().toISOString(),
      });

      const movPayload = deepCleanForFirestore({
        tipo: 'egreso' as TipoMovimiento,
        unidadId: params.unidadId,
        articuloId: params.unidad.articuloId,
        articuloCodigo: params.unidad.articuloCodigo,
        articuloDescripcion: params.unidad.articuloDescripcion,
        cantidad: 1,
        origenTipo: params.unidad.ubicacion.tipo as TipoOrigenDestino,
        origenId: params.unidad.ubicacion.referenciaId,
        origenNombre: params.unidad.ubicacion.referenciaNombre,
        destinoTipo: 'cliente' as TipoOrigenDestino,
        destinoId: data.reservadoParaClienteId ?? params.otNumber,
        destinoNombre: data.reservadoParaClienteNombre ?? `OT ${params.otNumber}`,
        otNumber: params.otNumber,
        motivo: params.motivo,
        creadoPor: params.solicitadoPorNombre,
        ...getCreateTrace(),
        createdAt: now,
      });

      tx.update(unidadRef, unitPayload);
      tx.set(movRef, movPayload);
    });

    logAudit({ action: 'update', collection: 'unidades_stock', documentId: params.unidadId });
  },

  /**
   * Entrega todas las unidades reservadas para un presupuesto (al cerrar la OT).
   * Best-effort por unidad: si una falla (estado cambiado, race), loguea y sigue.
   * Devuelve cuántas unidades se entregaron efectivamente.
   */
  async entregarPorPresupuesto(params: {
    presupuestoId: string;
    otNumber: string;
    solicitadoPorNombre: string;
  }): Promise<{ entregadas: number }> {
    const q = query(
      collection(db, 'unidades'),
      where('reservadoParaPresupuestoId', '==', params.presupuestoId),
      where('estado', '==', 'reservado'),
    );
    const snap = await getDocs(q);
    let entregadas = 0;
    for (const d of snap.docs) {
      const data = d.data();
      if (data.activo === false) continue;
      const unidad = { id: d.id, ...data } as UnidadStock;
      try {
        await this.entregar({
          unidadId: d.id,
          unidad,
          otNumber: params.otNumber,
          motivo: `Entregado al cerrar OT ${params.otNumber}`,
          solicitadoPorNombre: params.solicitadoPorNombre,
        });
        entregadas++;
      } catch (err) {
        console.error(`[entregarPorPresupuesto] unidad ${d.id} no entregada:`, err);
      }
    }
    return { entregadas };
  },

  /**
   * Descuenta `aDeducir` unidades de un doc DISPONIBLE (salida hacia cliente al cerrar OT).
   * - aDeducir >= cantidad del doc → el doc pasa a 'entregado' (sale del ATP).
   * - aDeducir < cantidad (lote/bulk) → decrementa `cantidad` del doc.
   * Crea un MovimientoStock 'egreso'. Validación atómica: solo toca 'disponible'
   * (así no choca con el camino de presupuesto reservado→entregado).
   */
  async deducirUnidadDisponible(params: {
    unidad: UnidadStock;
    aDeducir: number;
    otNumber: string;
    clienteId?: string | null;
    clienteNombre?: string | null;
    motivo: string;
    solicitadoPorNombre: string;
  }): Promise<void> {
    const now = Timestamp.now();
    const movRef = doc(db, 'movimientosStock', crypto.randomUUID());
    const unidadRef = docRef('unidades', params.unidad.id);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(unidadRef);
      if (!snap.exists()) throw new Error(`Unidad ${params.unidad.id} no encontrada`);
      const data = snap.data();
      if (data.estado !== 'disponible') {
        throw new Error(`Unidad no descontable — estado '${data.estado}' (esperaba 'disponible')`);
      }
      const qtyActual = data.cantidad ?? 1;
      const total = params.aDeducir >= qtyActual;
      tx.update(unidadRef, deepCleanForFirestore(total
        ? { estado: 'entregado' as EstadoUnidad, ...getUpdateTrace(), updatedAt: now.toDate().toISOString() }
        : { cantidad: qtyActual - params.aDeducir, ...getUpdateTrace(), updatedAt: now.toDate().toISOString() }));

      tx.set(movRef, deepCleanForFirestore({
        tipo: 'egreso' as TipoMovimiento,
        unidadId: params.unidad.id,
        articuloId: params.unidad.articuloId,
        articuloCodigo: params.unidad.articuloCodigo,
        articuloDescripcion: params.unidad.articuloDescripcion,
        cantidad: total ? qtyActual : params.aDeducir,
        origenTipo: params.unidad.ubicacion.tipo as TipoOrigenDestino,
        origenId: params.unidad.ubicacion.referenciaId,
        origenNombre: params.unidad.ubicacion.referenciaNombre,
        destinoTipo: 'cliente' as TipoOrigenDestino,
        destinoId: params.clienteId ?? params.otNumber,
        destinoNombre: params.clienteNombre ?? `OT ${params.otNumber}`,
        otNumber: params.otNumber,
        motivo: params.motivo,
        creadoPor: params.solicitadoPorNombre,
        ...getCreateTrace(),
        createdAt: now,
      }));
    });

    logAudit({ action: 'update', collection: 'unidades_stock', documentId: params.unidad.id });
  },

  /**
   * Deducción al cierre por una StockSelection (selección MANUAL, no por reserva):
   * - con `unidadStockId` (serie/lote) → descuenta esa unidad puntual.
   * - sin unidad pero con `articuloId` (no-serializado) → descuenta `cantidad` de las
   *   unidades disponibles del artículo en la posición elegida (`origenId`), FIFO.
   * Best-effort por unidad. Devuelve cuántas se descontaron efectivamente.
   */
  async entregarSeleccionCierre(params: {
    selection: StockSelection;
    otNumber: string;
    clienteId?: string | null;
    clienteNombre?: string | null;
    solicitadoPorNombre: string;
  }): Promise<{ deducidas: number }> {
    const sel = params.selection;
    let candidatos: UnidadStock[] = [];
    if (sel.unidadStockId) {
      const snap = await getDoc(docRef('unidades', sel.unidadStockId));
      if (snap.exists()) candidatos = [{ id: snap.id, ...snap.data() } as UnidadStock];
    } else if (sel.articuloId) {
      const todas = await unidadesService.getByArticulo(sel.articuloId);
      candidatos = todas
        .filter(u => u.estado === 'disponible' && (!sel.origenId || u.ubicacion.referenciaId === sel.origenId))
        .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')); // FIFO
    }

    let restante = sel.cantidad ?? 1;
    let deducidas = 0;
    for (const u of candidatos) {
      if (restante <= 0) break;
      const aDeducir = Math.min(u.cantidad ?? 1, restante);
      try {
        await this.deducirUnidadDisponible({
          unidad: u, aDeducir, otNumber: params.otNumber,
          clienteId: params.clienteId, clienteNombre: params.clienteNombre,
          motivo: `Entregado al cerrar OT ${params.otNumber}`,
          solicitadoPorNombre: params.solicitadoPorNombre,
        });
        deducidas += aDeducir;
        restante -= aDeducir;
      } catch (err) {
        console.error(`[entregarSeleccionCierre] unidad ${u.id}:`, err);
      }
    }
    return { deducidas };
  },

  /** Orquesta la deducción de todas las selecciones de stock del cierre. Best-effort. */
  async entregarSeleccionesCierre(params: {
    selections: StockSelection[];
    otNumber: string;
    clienteId?: string | null;
    clienteNombre?: string | null;
    solicitadoPorNombre: string;
  }): Promise<{ deducidas: number }> {
    let deducidas = 0;
    for (const selection of params.selections) {
      const r = await this.entregarSeleccionCierre({ selection, ...params });
      deducidas += r.deducidas;
    }
    return { deducidas };
  },
};
