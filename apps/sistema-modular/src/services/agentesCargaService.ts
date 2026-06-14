import { collection, getDocs, doc, query, orderBy, type QueryDocumentSnapshot } from 'firebase/firestore';
import { db, addDoc, deleteDoc, getCreateTrace } from './firebase';

export interface AgenteCarga {
  id: string;
  nombre: string;
}

const COL = 'agentesCarga';

/** Catálogo simple de agentes de carga / forwarders (DHL, FedEx, etc.). */
export const agentesCargaService = {
  async getAll(): Promise<AgenteCarga[]> {
    const snap = await getDocs(query(collection(db, COL), orderBy('nombre')));
    return snap.docs.map((d: QueryDocumentSnapshot) => ({ id: d.id, nombre: (d.data().nombre as string) ?? '' }));
  },
  async create(nombre: string): Promise<string> {
    const ref = await addDoc(collection(db, COL), { nombre: nombre.trim(), ...getCreateTrace() });
    return ref.id;
  },
  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, COL, id));
  },
};
