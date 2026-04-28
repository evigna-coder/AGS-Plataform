import { collection, getDocs, doc, getDoc, query, where, orderBy, Timestamp } from 'firebase/firestore';
import type { FichaPropiedad, ItemFicha, HistorialFicha, DerivacionProveedor } from '@ags/shared';
import { computeFichaEstado } from '@ags/shared';
import { db, createBatch, docRef, batchAudit, deepCleanForFirestore, getCreateTrace, getUpdateTrace, onSnapshot } from './firebase';

// --- Fichas Propiedad del Cliente ---

/** Calcula el próximo subId para un item dentro de una ficha (FPC-XXXX-N). */
export function nextItemSubId(ficha: FichaPropiedad): string {
  const max = (ficha.items ?? []).reduce((m, it) => {
    const match = it.subId?.match(/-(\d+)$/);
    if (!match) return m;
    const n = parseInt(match[1], 10);
    return n > m ? n : m;
  }, 0);
  return `${ficha.numero}-${max + 1}`;
}

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
    // Asegurar que cada item tiene un subId asignado relativo al numero recién asignado
    const itemsWithSubIds: ItemFicha[] = (data.items ?? []).map((it, idx) => ({
      ...it,
      subId: it.subId || `${numero}-${idx + 1}`,
    }));
    const estado = computeFichaEstado(itemsWithSubIds);
    const payload = deepCleanForFirestore({
      ...data,
      items: itemsWithSubIds,
      estado,
      ...getCreateTrace(),
      numero,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.set(docRef('fichasPropiedad', id), payload);
    batchAudit(batch, { action: 'create', collection: 'fichas_propiedad', documentId: id, after: payload });
    await batch.commit();
    return id;
  },

  /** Update de campos a nivel ficha. Si se pasan `items`, recalcula el estado agregado. */
  async update(id: string, data: Partial<Omit<FichaPropiedad, 'id' | 'createdAt'>>): Promise<void> {
    const patch: Record<string, unknown> = { ...data };
    if (data.items) {
      patch.estado = computeFichaEstado(data.items);
    }
    const payload = deepCleanForFirestore({
      ...patch,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.update(docRef('fichasPropiedad', id), payload);
    batchAudit(batch, { action: 'update', collection: 'fichas_propiedad', documentId: id, after: payload });
    await batch.commit();
  },

  async delete(id: string): Promise<void> {
    const batch = createBatch();
    batch.delete(docRef('fichasPropiedad', id));
    batchAudit(batch, { action: 'delete', collection: 'fichas_propiedad', documentId: id });
    await batch.commit();
  },

  /** Agrega entrada al historial de la ficha (no de un item). */
  async addHistorial(id: string, entry: Omit<HistorialFicha, 'id'>): Promise<void> {
    const ficha = await this.getById(id);
    if (!ficha) throw new Error('Ficha no encontrada');
    const newEntry: HistorialFicha = { ...entry, id: crypto.randomUUID() };
    await this.update(id, {
      historial: [...ficha.historial, newEntry],
    });
  },

  // ============================================================
  // --- API por item ---
  // ============================================================

  async addItem(fichaId: string, item: Omit<ItemFicha, 'id' | 'subId' | 'createdAt'>): Promise<string> {
    const ficha = await this.getById(fichaId);
    if (!ficha) throw new Error('Ficha no encontrada');
    const newItem: ItemFicha = {
      ...item,
      id: crypto.randomUUID(),
      subId: nextItemSubId(ficha),
      createdAt: new Date().toISOString(),
    };
    await this.update(fichaId, { items: [...ficha.items, newItem] });
    return newItem.id;
  },

  async updateItem(fichaId: string, itemId: string, patch: Partial<Omit<ItemFicha, 'id' | 'subId' | 'createdAt'>>): Promise<void> {
    const ficha = await this.getById(fichaId);
    if (!ficha) throw new Error('Ficha no encontrada');
    const items = ficha.items.map(it => it.id === itemId ? { ...it, ...patch } : it);
    await this.update(fichaId, { items });
  },

  async removeItem(fichaId: string, itemId: string): Promise<void> {
    const ficha = await this.getById(fichaId);
    if (!ficha) throw new Error('Ficha no encontrada');
    const items = ficha.items.filter(it => it.id !== itemId);
    await this.update(fichaId, { items });
  },

  /** Cambia el estado de un item específico y registra la transición en su historial. */
  async transitionItem(
    fichaId: string,
    itemId: string,
    nuevoEstado: ItemFicha['estado'],
    nota: string,
    creadoPor = 'admin',
  ): Promise<void> {
    const ficha = await this.getById(fichaId);
    if (!ficha) throw new Error('Ficha no encontrada');
    const items = ficha.items.map(it => {
      if (it.id !== itemId) return it;
      const entry: HistorialFicha = {
        id: crypto.randomUUID(),
        fecha: new Date().toISOString(),
        estadoAnterior: it.estado,
        estadoNuevo: nuevoEstado,
        nota,
        creadoPor,
      };
      return { ...it, estado: nuevoEstado, historial: [...it.historial, entry] };
    });
    await this.update(fichaId, { items });
  },

  /** Agrega una derivación a proveedor a un item específico. */
  async addItemDerivacion(
    fichaId: string,
    itemId: string,
    derivacion: Omit<DerivacionProveedor, 'id'>,
  ): Promise<void> {
    const ficha = await this.getById(fichaId);
    if (!ficha) throw new Error('Ficha no encontrada');
    const newDeriv: DerivacionProveedor = { ...derivacion, id: crypto.randomUUID() };
    const items = ficha.items.map(it => {
      if (it.id !== itemId) return it;
      return {
        ...it,
        estado: 'derivado_proveedor' as const,
        derivaciones: [...it.derivaciones, newDeriv],
      };
    });
    await this.update(fichaId, { items });
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
