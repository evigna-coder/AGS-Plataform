import { collection, getDocs, doc, getDoc, query, where, orderBy, Timestamp, onSnapshot } from 'firebase/firestore';
import type { FichaPropiedad, HistorialFicha, DerivacionProveedor } from '@ags/shared';
import { db, createBatch, docRef, batchAudit, deepCleanForFirestore, getCreateTrace, getUpdateTrace } from './firebase';

// --- Fichas Propiedad del Cliente ---

export const fichasService = {
  async getNextFichaNumber(): Promise<string> {
    const q = query(collection(db, 'fichasPropiedad'), orderBy('numero', 'desc'));
    const snap = await getDocs(q);
    let maxNum = 0;
    snap.docs.forEach(d => {
      const numero = d.data().numero;
      const match = numero?.match(/FPC-(\d+)/);
      if (match) {
        const num = parseInt(match[1]);
        if (num > maxNum) maxNum = num;
      }
    });
    return `FPC-${String(maxNum + 1).padStart(4, '0')}`;
  },

  async getAll(filters?: {
    clienteId?: string;
    estado?: string;
    activasOnly?: boolean;
  }): Promise<FichaPropiedad[]> {
    let q = query(collection(db, 'fichasPropiedad'));
    if (filters?.clienteId) {
      q = query(q, where('clienteId', '==', filters.clienteId));
    }
    if (filters?.estado) {
      q = query(q, where('estado', '==', filters.estado));
    }
    const snap = await getDocs(q);
    let items = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    })) as FichaPropiedad[];
    if (filters?.activasOnly) {
      items = items.filter(f => f.estado !== 'entregado');
    }
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return items;
  },

  subscribe(
    filters: { clienteId?: string; estado?: string; activasOnly?: boolean } | undefined,
    callback: (items: FichaPropiedad[]) => void,
    onError?: (error: Error) => void,
  ) {
    let q = query(collection(db, 'fichasPropiedad'));
    if (filters?.clienteId) {
      q = query(q, where('clienteId', '==', filters.clienteId));
    }
    if (filters?.estado) {
      q = query(q, where('estado', '==', filters.estado));
    }
    return onSnapshot(q, snap => {
      let items = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
        updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      })) as FichaPropiedad[];
      if (filters?.activasOnly) {
        items = items.filter(f => f.estado !== 'entregado');
      }
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(items);
    }, onError);
  },

  async getById(id: string): Promise<FichaPropiedad | null> {
    const snap = await getDoc(doc(db, 'fichasPropiedad', id));
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...snap.data(),
      createdAt: snap.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: snap.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    } as FichaPropiedad;
  },

  subscribeById(
    id: string,
    callback: (item: FichaPropiedad | null) => void,
    onError?: (err: Error) => void,
  ): () => void {
    return onSnapshot(doc(db, 'fichasPropiedad', id), snap => {
      if (!snap.exists()) { callback(null); return; }
      callback({
        id: snap.id,
        ...snap.data(),
        createdAt: snap.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
        updatedAt: snap.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      } as FichaPropiedad);
    }, err => {
      console.error('fichasPropiedad subscription error:', err);
      onError?.(err);
    });
  },

  async create(data: Omit<FichaPropiedad, 'id' | 'numero' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const numero = await this.getNextFichaNumber();
    const payload = deepCleanForFirestore({
      ...data,
      ...getCreateTrace(),
      numero,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.set(docRef('fichasPropiedad', id), payload);
    batchAudit(batch, { action: 'create', collection: 'fichas_propiedad', documentId: id, after: payload as any });
    await batch.commit();
    return id;
  },

  async update(id: string, data: Partial<Omit<FichaPropiedad, 'id' | 'createdAt'>>): Promise<void> {
    const payload = deepCleanForFirestore({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.update(docRef('fichasPropiedad', id), payload);
    batchAudit(batch, { action: 'update', collection: 'fichas_propiedad', documentId: id, after: payload as any });
    await batch.commit();
  },

  async delete(id: string): Promise<void> {
    const batch = createBatch();
    batch.delete(docRef('fichasPropiedad', id));
    batchAudit(batch, { action: 'delete', collection: 'fichas_propiedad', documentId: id });
    await batch.commit();
  },

  async addHistorial(id: string, entry: Omit<HistorialFicha, 'id'>): Promise<void> {
    const ficha = await this.getById(id);
    if (!ficha) throw new Error('Ficha no encontrada');
    const newEntry: HistorialFicha = { ...entry, id: crypto.randomUUID() };
    await this.update(id, {
      estado: entry.estadoNuevo,
      historial: [...ficha.historial, newEntry],
    });
  },

  async addDerivacion(id: string, derivacion: Omit<DerivacionProveedor, 'id'>): Promise<void> {
    const ficha = await this.getById(id);
    if (!ficha) throw new Error('Ficha no encontrada');
    const newDeriv: DerivacionProveedor = { ...derivacion, id: crypto.randomUUID() };
    await this.update(id, {
      estado: 'derivado_proveedor',
      derivaciones: [...ficha.derivaciones, newDeriv],
    });
  },

  async getByOtNumber(otNumber: string): Promise<FichaPropiedad[]> {
    const q = query(
      collection(db, 'fichasPropiedad'),
      where('otIds', 'array-contains', otNumber)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    })) as FichaPropiedad[];
  },
};
