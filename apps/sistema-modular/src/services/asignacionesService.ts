import { collection, getDocs, doc, getDoc, query, where, orderBy, Timestamp, onSnapshot } from 'firebase/firestore';
import type { Asignacion } from '@ags/shared';
import { db, createBatch, docRef, batchAudit, deepCleanForFirestore, getCreateTrace, getUpdateTrace } from './firebase';

export const asignacionesService = {
  async getNextNumero(): Promise<string> {
    const q = query(collection(db, 'asignaciones'), orderBy('numero', 'desc'));
    const snap = await getDocs(q);
    let maxNum = 0;
    snap.docs.forEach(d => {
      const numero = d.data().numero;
      const match = numero?.match(/ASG-(\d+)/);
      if (match) {
        const num = parseInt(match[1]);
        if (num > maxNum) maxNum = num;
      }
    });
    return `ASG-${String(maxNum + 1).padStart(4, '0')}`;
  },

  async getAll(filters?: {
    ingenieroId?: string;
    estado?: string;
    clienteId?: string;
  }): Promise<Asignacion[]> {
    let q = query(collection(db, 'asignaciones'));
    if (filters?.ingenieroId) q = query(q, where('ingenieroId', '==', filters.ingenieroId));
    if (filters?.estado) q = query(q, where('estado', '==', filters.estado));
    if (filters?.clienteId) q = query(q, where('clienteId', '==', filters.clienteId));
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    })) as Asignacion[];
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return items;
  },

  async getByIngeniero(ingenieroId: string): Promise<Asignacion[]> {
    return this.getAll({ ingenieroId, estado: 'activa' });
  },

  async getById(id: string): Promise<Asignacion | null> {
    const snap = await getDoc(doc(db, 'asignaciones', id));
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...snap.data(),
      createdAt: snap.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: snap.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    } as Asignacion;
  },

  async create(data: Omit<Asignacion, 'id' | 'numero' | 'createdAt' | 'updatedAt'> & { numero?: string }): Promise<string> {
    const id = crypto.randomUUID();
    const numero = data.numero || await this.getNextNumero();
    const { numero: _num, ...rest } = data;
    const payload = deepCleanForFirestore({
      ...rest,
      ...getCreateTrace(),
      numero,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const ref = docRef('asignaciones', id);
    const batch = createBatch();
    batch.set(ref, payload);
    batchAudit(batch, { action: 'create', collection: 'asignaciones', documentId: id, after: payload as any });
    await batch.commit();
    return id;
  },

  async update(id: string, data: Partial<Omit<Asignacion, 'id' | 'createdAt'>>): Promise<void> {
    const payload = deepCleanForFirestore({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.update(docRef('asignaciones', id), payload);
    batchAudit(batch, { action: 'update', collection: 'asignaciones', documentId: id, after: payload as any });
    await batch.commit();
  },

  async devolverItems(asignacionId: string, devoluciones: { itemId: string; cantidad: number }[]): Promise<void> {
    const asg = await this.getById(asignacionId);
    if (!asg) throw new Error('Asignación no encontrada');

    const updatedItems = asg.items.map(item => {
      const dev = devoluciones.find(d => d.itemId === item.id);
      if (!dev) return item;
      const cantDev = Math.min(dev.cantidad, item.cantidad - item.cantidadDevuelta - item.cantidadConsumida);
      const newDevuelta = item.cantidadDevuelta + cantDev;
      const remaining = item.cantidad - newDevuelta - item.cantidadConsumida;
      return {
        ...item,
        cantidadDevuelta: newDevuelta,
        estado: remaining <= 0 ? 'devuelto' as const : item.estado,
        fechaDevolucion: remaining <= 0 ? new Date().toISOString() : item.fechaDevolucion,
      };
    });

    const allDone = updatedItems.every(i => i.permanente || i.estado === 'devuelto' || i.estado === 'consumido');
    await this.update(asignacionId, {
      items: updatedItems,
      estado: allDone ? 'completada' : 'activa',
    });
  },

  async consumirItems(asignacionId: string, consumos: { itemId: string; cantidad: number; otNumber?: string }[]): Promise<void> {
    const asg = await this.getById(asignacionId);
    if (!asg) throw new Error('Asignación no encontrada');

    const updatedItems = asg.items.map(item => {
      const con = consumos.find(c => c.itemId === item.id);
      if (!con) return item;
      const cantCon = Math.min(con.cantidad, item.cantidad - item.cantidadDevuelta - item.cantidadConsumida);
      const newConsumida = item.cantidadConsumida + cantCon;
      const remaining = item.cantidad - item.cantidadDevuelta - newConsumida;
      return {
        ...item,
        cantidadConsumida: newConsumida,
        otNumber: con.otNumber || item.otNumber,
        estado: remaining <= 0 ? 'consumido' as const : item.estado,
      };
    });

    const allDone = updatedItems.every(i => i.permanente || i.estado === 'devuelto' || i.estado === 'consumido');
    await this.update(asignacionId, {
      items: updatedItems,
      estado: allDone ? 'completada' : 'activa',
    });
  },

  async reasignarCliente(asignacionId: string, itemIds: string[], nuevoClienteId: string, nuevoClienteNombre: string): Promise<void> {
    const asg = await this.getById(asignacionId);
    if (!asg) throw new Error('Asignación no encontrada');

    const updatedItems = asg.items.map(item =>
      itemIds.includes(item.id) ? { ...item, clienteId: nuevoClienteId, clienteNombre: nuevoClienteNombre } : item
    );
    await this.update(asignacionId, { items: updatedItems });
  },

  async delete(id: string): Promise<void> {
    const batch = createBatch();
    batch.delete(docRef('asignaciones', id));
    batchAudit(batch, { action: 'delete', collection: 'asignaciones', documentId: id });
    await batch.commit();
  },

  /** Real-time subscription. Returns unsubscribe function. */
  subscribe(
    filters: { ingenieroId?: string; estado?: string; clienteId?: string } | undefined,
    callback: (asignaciones: Asignacion[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    const constraints: any[] = [];
    if (filters?.ingenieroId) constraints.push(where('ingenieroId', '==', filters.ingenieroId));
    if (filters?.estado) constraints.push(where('estado', '==', filters.estado));
    if (filters?.clienteId) constraints.push(where('clienteId', '==', filters.clienteId));
    constraints.push(orderBy('createdAt', 'desc'));
    const q = query(collection(db, 'asignaciones'), ...constraints);
    return onSnapshot(q, snap => {
      const items = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
        updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      })) as Asignacion[];
      callback(items);
    }, err => {
      console.error('Asignaciones subscription error:', err);
      onError?.(err);
    });
  },
};
