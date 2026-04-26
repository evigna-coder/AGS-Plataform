import { collection, getDocs, doc, getDoc, Timestamp } from 'firebase/firestore';
import type { Dispositivo } from '@ags/shared';
import { db, createBatch, newDocRef, docRef, batchAudit, getCreateTrace, getUpdateTrace, onSnapshot } from './firebase';

function tsToIso(ts: any): string {
  return ts?.toDate?.().toISOString() ?? '';
}

function docToDispositivo(d: any): Dispositivo {
  const data = d.data();
  return {
    id: d.id, ...data,
    activo: data.activo !== false,
    createdAt: tsToIso(data.createdAt),
    updatedAt: tsToIso(data.updatedAt),
  } as Dispositivo;
}

export const dispositivosService = {
  async create(data: Omit<Dispositivo, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const payload = { ...data, ...getCreateTrace(), activo: true, createdAt: Timestamp.now(), updatedAt: Timestamp.now() };
    const ref = newDocRef('dispositivos');
    const batch = createBatch();
    batch.set(ref, payload);
    batchAudit(batch, { action: 'create', collection: 'dispositivos', documentId: ref.id, after: payload });
    await batch.commit();
    return ref.id;
  },

  async getAll(activosOnly = false): Promise<Dispositivo[]> {
    const snap = await getDocs(collection(db, 'dispositivos'));
    let items = snap.docs.map(docToDispositivo);
    if (activosOnly) items = items.filter(d => d.activo);
    items.sort((a, b) => `${a.marca} ${a.modelo}`.localeCompare(`${b.marca} ${b.modelo}`));
    return items;
  },

  subscribe(
    activosOnly: boolean,
    callback: (items: Dispositivo[]) => void,
    onError?: (error: Error) => void,
  ) {
    return onSnapshot(collection(db, 'dispositivos'), snap => {
      let items = snap.docs.map(docToDispositivo);
      if (activosOnly) items = items.filter(d => d.activo);
      items.sort((a, b) => `${a.marca} ${a.modelo}`.localeCompare(`${b.marca} ${b.modelo}`));
      callback(items);
    }, onError);
  },

  async getById(id: string): Promise<Dispositivo | null> {
    const snap = await getDoc(doc(db, 'dispositivos', id));
    return snap.exists() ? docToDispositivo(snap) : null;
  },

  async update(id: string, data: Partial<Omit<Dispositivo, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    const payload = { ...data, ...getUpdateTrace(), updatedAt: Timestamp.now() };
    const batch = createBatch();
    batch.update(docRef('dispositivos', id), payload);
    batchAudit(batch, { action: 'update', collection: 'dispositivos', documentId: id, after: payload });
    await batch.commit();
  },

  async delete(id: string): Promise<void> {
    const batch = createBatch();
    batch.delete(docRef('dispositivos', id));
    batchAudit(batch, { action: 'delete', collection: 'dispositivos', documentId: id });
    await batch.commit();
  },
};
