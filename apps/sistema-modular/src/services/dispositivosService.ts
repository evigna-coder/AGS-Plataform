import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import type { Dispositivo } from '@ags/shared';
import { db, logAudit, getCreateTrace, getUpdateTrace } from './firebase';

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
    const ref = await addDoc(collection(db, 'dispositivos'), payload);
    logAudit({ action: 'create', collection: 'dispositivos', documentId: ref.id, after: payload as any });
    return ref.id;
  },

  async getAll(activosOnly = false): Promise<Dispositivo[]> {
    const snap = await getDocs(collection(db, 'dispositivos'));
    let items = snap.docs.map(docToDispositivo);
    if (activosOnly) items = items.filter(d => d.activo);
    items.sort((a, b) => `${a.marca} ${a.modelo}`.localeCompare(`${b.marca} ${b.modelo}`));
    return items;
  },

  async getById(id: string): Promise<Dispositivo | null> {
    const snap = await getDoc(doc(db, 'dispositivos', id));
    return snap.exists() ? docToDispositivo(snap) : null;
  },

  async update(id: string, data: Partial<Omit<Dispositivo, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    const payload = { ...data, ...getUpdateTrace(), updatedAt: Timestamp.now() };
    await updateDoc(doc(db, 'dispositivos', id), payload);
    logAudit({ action: 'update', collection: 'dispositivos', documentId: id, after: payload as any });
  },

  async delete(id: string): Promise<void> {
    logAudit({ action: 'delete', collection: 'dispositivos', documentId: id });
    await deleteDoc(doc(db, 'dispositivos', id));
  },
};
