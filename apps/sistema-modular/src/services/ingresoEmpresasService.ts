import { collection, getDocs, doc, getDoc, Timestamp, query, orderBy } from 'firebase/firestore';
import type { IngresoEmpresa } from '@ags/shared';
import { DEFAULT_DOCUMENTACION } from '@ags/shared';
import { db, createBatch, newDocRef, docRef, batchAudit, getCreateTrace, getUpdateTrace, onSnapshot } from './firebase';

type CreateData = Omit<IngresoEmpresa, 'id' | 'createdAt' | 'updatedAt'>;
type UpdateData = Partial<Omit<IngresoEmpresa, 'id' | 'createdAt' | 'updatedAt'>>;

function docToIngreso(docSnap: any): IngresoEmpresa {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    documentacion: { ...DEFAULT_DOCUMENTACION, ...data.documentacion },
    activo: data.activo !== false,
    createdAt: data.createdAt?.toDate?.().toISOString() ?? '',
    updatedAt: data.updatedAt?.toDate?.().toISOString() ?? '',
  } as IngresoEmpresa;
}

export const ingresoEmpresasService = {
  async create(data: CreateData): Promise<string> {
    const payload = {
      ...data,
      ...getCreateTrace(),
      activo: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    const ref = newDocRef('ingresosEmpresas');
    const batch = createBatch();
    batch.set(ref, payload);
    batchAudit(batch, { action: 'create', collection: 'ingresosEmpresas', documentId: ref.id, after: payload });
    await batch.commit();
    return ref.id;
  },

  async getAll(activosOnly = false): Promise<IngresoEmpresa[]> {
    const snapshot = await getDocs(collection(db, 'ingresosEmpresas'));
    let items = snapshot.docs.map(docToIngreso);
    if (activosOnly) items = items.filter(i => i.activo);
    items.sort((a, b) => a.clienteNombre.localeCompare(b.clienteNombre));
    return items;
  },

  async getById(id: string): Promise<IngresoEmpresa | null> {
    const docSnap = await getDoc(doc(db, 'ingresosEmpresas', id));
    return docSnap.exists() ? docToIngreso(docSnap) : null;
  },

  async update(id: string, data: UpdateData): Promise<void> {
    const payload = {
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    };
    const batch = createBatch();
    batch.update(docRef('ingresosEmpresas', id), payload);
    batchAudit(batch, { action: 'update', collection: 'ingresosEmpresas', documentId: id, after: payload });
    await batch.commit();
  },

  async delete(id: string): Promise<void> {
    const batch = createBatch();
    batch.delete(docRef('ingresosEmpresas', id));
    batchAudit(batch, { action: 'delete', collection: 'ingresosEmpresas', documentId: id });
    await batch.commit();
  },

  /** Real-time subscription. Returns unsubscribe function. */
  subscribe(
    activosOnly: boolean,
    callback: (ingresos: IngresoEmpresa[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    const q = query(collection(db, 'ingresosEmpresas'), orderBy('clienteNombre', 'asc'));
    return onSnapshot(q, snap => {
      let items = snap.docs.map(docToIngreso);
      if (activosOnly) items = items.filter(i => i.activo);
      callback(items);
    }, err => {
      console.error('IngresosEmpresas subscription error:', err);
      onError?.(err);
    });
  },

  async deactivate(id: string): Promise<void> {
    await this.update(id, { activo: false });
  },
};
