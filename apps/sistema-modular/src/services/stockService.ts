import { collection, getDocs, doc, getDoc, query, where, orderBy, Timestamp, onSnapshot } from 'firebase/firestore';
import type { PosicionStock, Articulo, UnidadStock, Minikit, MinikitTemplate, MovimientoStock, Remito, EstadoUnidad, TipoMovimiento, TipoOrigenDestino } from '@ags/shared';
import { db, createBatch, docRef, batchAudit, cleanFirestoreData, deepCleanForFirestore, getCreateTrace, getUpdateTrace } from './firebase';

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
    batchAudit(batch, { action: 'create', collection: 'posiciones_stock', documentId: id, after: payload as any });
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
    batchAudit(batch, { action: 'update', collection: 'posiciones_stock', documentId: id, after: payload as any });
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
    batchAudit(batch, { action: 'create', collection: 'articulos', documentId: id, after: payload as any });
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
    batchAudit(batch, { action: 'update', collection: 'articulos', documentId: id, after: payload as any });
    await batch.commit();
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
    batchAudit(batch, { action: 'create', collection: 'unidades_stock', documentId: id, after: payload as any });
    await batch.commit();
    return id;
  },

  async update(id: string, data: Partial<Omit<UnidadStock, 'id' | 'createdAt'>>): Promise<void> {
    const payload = deepCleanForFirestore({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.update(docRef('unidades', id), payload);
    batchAudit(batch, { action: 'update', collection: 'unidades_stock', documentId: id, after: payload as any });
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
    batchAudit(batch, { action: 'create', collection: 'minikits', documentId: id, after: payload as any });
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
    batchAudit(batch, { action: 'update', collection: 'minikits', documentId: id, after: payload as any });
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

// ========== PLANTILLAS DE MINIKIT ==========

export const minikitTemplatesService = {
  async getAll(activoOnly: boolean = true): Promise<MinikitTemplate[]> {
    let q;
    if (activoOnly) {
      q = query(collection(db, 'minikitTemplates'), where('activo', '==', true));
    } else {
      q = query(collection(db, 'minikitTemplates'));
    }
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    })) as MinikitTemplate[];
    items.sort((a, b) => a.nombre.localeCompare(b.nombre));
    return items;
  },

  async getById(id: string): Promise<MinikitTemplate | null> {
    const snap = await getDoc(doc(db, 'minikitTemplates', id));
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...snap.data(),
      createdAt: snap.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: snap.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    } as MinikitTemplate;
  },

  async create(data: Omit<MinikitTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const payload = deepCleanForFirestore({
      ...data,
      ...getCreateTrace(),
      activo: data.activo !== undefined ? data.activo : true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.set(doc(db, 'minikitTemplates', id), payload);
    batchAudit(batch, { action: 'create', collection: 'minikit_templates', documentId: id, after: payload as any });
    await batch.commit();
    return id;
  },

  async update(id: string, data: Partial<Omit<MinikitTemplate, 'id' | 'createdAt'>>): Promise<void> {
    const payload = deepCleanForFirestore({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.update(docRef('minikitTemplates', id), payload);
    batchAudit(batch, { action: 'update', collection: 'minikit_templates', documentId: id, after: payload as any });
    await batch.commit();
  },

  async delete(id: string): Promise<void> {
    const batch = createBatch();
    batch.delete(docRef('minikitTemplates', id));
    batchAudit(batch, { action: 'delete', collection: 'minikit_templates', documentId: id });
    await batch.commit();
  },

  subscribe(
    activoOnly: boolean,
    callback: (items: MinikitTemplate[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    let q;
    if (activoOnly) {
      q = query(collection(db, 'minikitTemplates'), where('activo', '==', true));
    } else {
      q = query(collection(db, 'minikitTemplates'));
    }
    return onSnapshot(q, snap => {
      const items = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
        updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      })) as MinikitTemplate[];
      items.sort((a, b) => a.nombre.localeCompare(b.nombre));
      callback(items);
    }, err => {
      console.error('minikitTemplates subscribe error:', err);
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
    batchAudit(batch, { action: 'create', collection: 'movimientos_stock', documentId: id, after: payload as any });
    await batch.commit();
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
  async getNextRemitoNumber(): Promise<string> {
    const q = query(collection(db, 'remitos'), orderBy('numero', 'desc'));
    const snap = await getDocs(q);

    let maxNum = 0;
    snap.docs.forEach(d => {
      const numero = d.data().numero;
      const match = numero?.match(/REM-(\d+)/);
      if (match) {
        const num = parseInt(match[1]);
        if (num > maxNum) maxNum = num;
      }
    });

    const nextNum = maxNum + 1;
    return `REM-${String(nextNum).padStart(4, '0')}`;
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
    batchAudit(batch, { action: 'create', collection: 'remitos', documentId: id, after: payload as any });
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
    batchAudit(batch, { action: 'update', collection: 'remitos', documentId: id, after: payload as any });
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
};

// ========== RESERVAS DE STOCK ==========

export const reservasService = {
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
  }): Promise<void> {
    const posReservas = await getOrCreateReservasPosition();
    const nuevaUbicacion = {
      tipo: 'posicion' as TipoOrigenDestino,
      referenciaId: posReservas.id,
      referenciaNombre: posReservas.nombre,
    };
    const now = Timestamp.now();

    const unitPayload = deepCleanForFirestore({
      estado: 'reservado' as EstadoUnidad,
      ubicacion: { tipo: 'posicion', referenciaId: posReservas.id, referenciaNombre: posReservas.nombre },
      reservadoParaPresupuestoId: params.presupuestoId,
      reservadoParaPresupuestoNumero: params.presupuestoNumero,
      reservadoParaClienteId: params.clienteId,
      reservadoParaClienteNombre: params.clienteNombre,
      ...getUpdateTrace(),
      updatedAt: now.toDate().toISOString(),
    });

    const movId = crypto.randomUUID();
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
      destinoTipo: 'posicion' as TipoOrigenDestino,
      destinoId: posReservas.id,
      destinoNombre: posReservas.nombre,
      motivo: `Reservado para presupuesto ${params.presupuestoNumero} — ${params.clienteNombre}`,
      creadoPor: params.solicitadoPorNombre,
      ...getCreateTrace(),
      createdAt: now,
    });

    const batch = createBatch();
    batch.update(docRef('unidades', params.unidadId), unitPayload);
    batch.set(doc(db, 'movimientosStock', movId), movPayload);
    batchAudit(batch, { action: 'update', collection: 'unidades_stock', documentId: params.unidadId, after: unitPayload as any });
    await batch.commit();
  },

  /**
   * Releases a reserved UnidadStock back to disponible.
   * Moves unit back to its original position (or a default depot if unknown).
   * Creates an immutable MovimientoStock of type 'transferencia'.
   */
  async liberar(params: {
    unidadId: string;
    unidad: UnidadStock;
    motivo: string;
    solicitadoPorNombre: string;
    destino?: { tipo: 'posicion' | 'minikit' | 'ingeniero'; referenciaId: string; referenciaNombre: string };
  }): Promise<void> {
    const now = Timestamp.now();
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

    const movId = crypto.randomUUID();
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

    const batch = createBatch();
    batch.update(docRef('unidades', params.unidadId), unitPayload);
    batch.set(doc(db, 'movimientosStock', movId), movPayload);
    batchAudit(batch, { action: 'update', collection: 'unidades_stock', documentId: params.unidadId, after: unitPayload as any });
    await batch.commit();
  },
};

// ========== RESERVAS ==========

export const reservasService = {
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
  }): Promise<void> {
    const posReservas = await getOrCreateReservasPosition();
    const nuevaUbicacion: UbicacionStock = {
      tipo: 'posicion',
      referenciaId: posReservas.id,
      referenciaNombre: posReservas.nombre,
    };
    const now = Timestamp.now();

    const unitPayload = deepCleanForFirestore({
      estado: 'reservado' as EstadoUnidad,
      ubicacion: nuevaUbicacion,
      reservadoParaPresupuestoId: params.presupuestoId,
      reservadoParaPresupuestoNumero: params.presupuestoNumero,
      reservadoParaClienteId: params.clienteId,
      reservadoParaClienteNombre: params.clienteNombre,
      ...getUpdateTrace(),
      updatedAt: now.toDate().toISOString(),
    });

    const movId = crypto.randomUUID();
    const movPayload = deepCleanForFirestore({
      tipo: 'transferencia' as TipoMovimiento,
      articuloId: params.unidad.articuloId,
      articuloCodigo: params.unidad.articuloCodigo,
      articuloDescripcion: params.unidad.articuloDescripcion,
      unidadId: params.unidadId,
      origenTipo: params.unidad.ubicacion.tipo as TipoOrigenDestino,
      origenId: params.unidad.ubicacion.referenciaId,
      origenNombre: params.unidad.ubicacion.referenciaNombre,
      destinoTipo: 'posicion' as TipoOrigenDestino,
      destinoId: posReservas.id,
      destinoNombre: posReservas.nombre,
      cantidad: 1,
      motivo: `Reservado para presupuesto ${params.presupuestoNumero} \u2014 ${params.clienteNombre}`,
      creadoPor: params.solicitadoPorNombre,
      ...getCreateTrace(),
      createdAt: now,
    });

    const batch = createBatch();
    batch.update(docRef('unidades_stock', params.unidadId), unitPayload);
    batch.set(doc(db, 'movimientosStock', movId), movPayload);
    batchAudit(batch, { action: 'update', collection: 'unidades_stock', documentId: params.unidadId, after: unitPayload as any });
    await batch.commit();
  },

  /**
   * Releases a reserved UnidadStock back to disponible.
   * Optionally moves unit to a specified destination; otherwise keeps current location.
   * Creates an immutable MovimientoStock of type 'transferencia'.
   */
  async liberar(params: {
    unidadId: string;
    unidad: UnidadStock;
    motivo: string;
    solicitadoPorNombre: string;
    destino?: { tipo: UbicacionStock['tipo']; referenciaId: string; referenciaNombre: string };
  }): Promise<void> {
    const now = Timestamp.now();
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

    const movId = crypto.randomUUID();
    const movPayload = deepCleanForFirestore({
      tipo: 'transferencia' as TipoMovimiento,
      articuloId: params.unidad.articuloId,
      articuloCodigo: params.unidad.articuloCodigo,
      articuloDescripcion: params.unidad.articuloDescripcion,
      unidadId: params.unidadId,
      origenTipo: params.unidad.ubicacion.tipo as TipoOrigenDestino,
      origenId: params.unidad.ubicacion.referenciaId,
      origenNombre: params.unidad.ubicacion.referenciaNombre,
      destinoTipo: (params.destino?.tipo ?? params.unidad.ubicacion.tipo) as TipoOrigenDestino,
      destinoId: params.destino?.referenciaId ?? params.unidad.ubicacion.referenciaId,
      destinoNombre: params.destino?.referenciaNombre ?? params.unidad.ubicacion.referenciaNombre,
      cantidad: 1,
      motivo: params.motivo,
      creadoPor: params.solicitadoPorNombre,
      ...getCreateTrace(),
      createdAt: now,
    });

    const batch = createBatch();
    batch.update(docRef('unidades_stock', params.unidadId), unitPayload);
    batch.set(doc(db, 'movimientosStock', movId), movPayload);
    batchAudit(batch, { action: 'update', collection: 'unidades_stock', documentId: params.unidadId, after: unitPayload as any });
    await batch.commit();
  },
};
