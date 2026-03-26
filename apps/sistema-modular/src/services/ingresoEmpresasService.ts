import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import type { IngresoEmpresa } from '@ags/shared';
import { DEFAULT_DOCUMENTACION } from '@ags/shared';
import { db, logAudit, getCreateTrace, getUpdateTrace } from './firebase';

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
    const docRef = await addDoc(collection(db, 'ingresosEmpresas'), payload);
    logAudit({ action: 'create', collection: 'ingresosEmpresas', documentId: docRef.id, after: payload as any });
    return docRef.id;
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
    await updateDoc(doc(db, 'ingresosEmpresas', id), payload);
    logAudit({ action: 'update', collection: 'ingresosEmpresas', documentId: id, after: payload as any });
  },

  async delete(id: string): Promise<void> {
    logAudit({ action: 'delete', collection: 'ingresosEmpresas', documentId: id });
    await deleteDoc(doc(db, 'ingresosEmpresas', id));
  },

  async deactivate(id: string): Promise<void> {
    await this.update(id, { activo: false });
  },
};
