import { collection, getDocs, doc, getDoc, Timestamp, query, where } from 'firebase/firestore';
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

/**
 * ID interno del dispositivo (2026-10-01): libre, con un guion en el medio
 * ("AGS-B16", "NOT-12"). Se pasa a mayúsculas y sin espacios; null si no
 * tiene texto a los dos lados de un único guion.
 */
export function normalizarIdInterno(texto: string): string | null {
  const t = texto.trim().toUpperCase().replace(/\s+/g, '');
  return /^[^-]+-[^-]+$/.test(t) ? t : null;
}

export const dispositivosService = {
  /** Otro dispositivo que ya usa ese ID interno (para no repetirlo). */
  async buscarPorIdInterno(codigo: string, excluirId?: string): Promise<Dispositivo | null> {
    const snap = await getDocs(query(collection(db, 'dispositivos'), where('codigoInterno', '==', codigo)));
    const d = snap.docs.find(x => x.id !== excluirId);
    return d ? docToDispositivo(d) : null;
  },

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
