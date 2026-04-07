import { collection, getDocs, doc, getDoc, query, where, orderBy, Timestamp, onSnapshot } from 'firebase/firestore';
import type { CalificacionProveedor } from '@ags/shared';
import { db, createBatch, docRef, batchAudit, deepCleanForFirestore, getCreateTrace, getUpdateTrace, inTransition } from './firebase';

export const calificacionesService = {
  async getAll(filters?: {
    proveedorId?: string;
    estado?: string;
  }): Promise<CalificacionProveedor[]> {
    let q = query(collection(db, 'calificaciones_proveedor'), orderBy('fechaRecepcion', 'desc'));
    if (filters?.proveedorId) {
      q = query(collection(db, 'calificaciones_proveedor'), where('proveedorId', '==', filters.proveedorId), orderBy('fechaRecepcion', 'desc'));
    }
    const snap = await getDocs(q);
    let items = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    })) as CalificacionProveedor[];
    if (filters?.estado) {
      items = items.filter(c => c.estado === filters.estado);
    }
    return items;
  },

  subscribe(
    filters: { proveedorId?: string } | undefined,
    callback: (items: CalificacionProveedor[]) => void,
    onError?: (error: Error) => void,
  ) {
    let q = query(collection(db, 'calificaciones_proveedor'), orderBy('fechaRecepcion', 'desc'));
    if (filters?.proveedorId) {
      q = query(collection(db, 'calificaciones_proveedor'), where('proveedorId', '==', filters.proveedorId), orderBy('fechaRecepcion', 'desc'));
    }
    const safeCallback = inTransition(callback);
    return onSnapshot(q, snap => {
      const items = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
        updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      })) as CalificacionProveedor[];
      safeCallback(items);
    }, onError);
  },

  async getById(id: string): Promise<CalificacionProveedor | null> {
    const snap = await getDoc(doc(db, 'calificaciones_proveedor', id));
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...snap.data(),
      createdAt: snap.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: snap.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    } as CalificacionProveedor;
  },

  async create(data: Omit<CalificacionProveedor, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const payload = deepCleanForFirestore({
      ...data,
      ...getCreateTrace(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.set(docRef('calificaciones_proveedor', id), payload);
    batchAudit(batch, { action: 'create', collection: 'calificaciones_proveedor', documentId: id, after: payload as any });
    await batch.commit();
    return id;
  },

  async update(id: string, data: Partial<Omit<CalificacionProveedor, 'id' | 'createdAt'>>): Promise<void> {
    const payload = deepCleanForFirestore({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.update(docRef('calificaciones_proveedor', id), payload);
    batchAudit(batch, { action: 'update', collection: 'calificaciones_proveedor', documentId: id, after: payload as any });
    await batch.commit();
  },

  async delete(id: string): Promise<void> {
    const batch = createBatch();
    batch.delete(docRef('calificaciones_proveedor', id));
    batchAudit(batch, { action: 'delete', collection: 'calificaciones_proveedor', documentId: id });
    await batch.commit();
  },

  /** Promedio histórico de un proveedor */
  async getPromedioProveedor(proveedorId: string): Promise<{ promedio: number; count: number; estado: string }> {
    const items = await this.getAll({ proveedorId });
    if (items.length === 0) return { promedio: 0, count: 0, estado: 'sin_datos' };
    const sum = items.reduce((acc, c) => acc + c.puntajeTotal, 0);
    const promedio = Math.round(sum / items.length);
    const estado = promedio >= 80 ? 'aprobado' : promedio >= 60 ? 'condicional' : 'no_aprobado';
    return { promedio, count: items.length, estado };
  },
};
