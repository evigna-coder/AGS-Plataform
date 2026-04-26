import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where, Timestamp } from 'firebase/firestore';
import type { Establecimiento, ContactoEstablecimiento } from '@ags/shared';
import { db, cleanFirestoreData, getCreateTrace, getUpdateTrace, createBatch, newDocRef, batchAudit, docRef as firestoreDocRef, onSnapshot } from './firebase';
import { getCached, setCache, invalidateCache } from './serviceCache';

// Servicio para Contactos de Establecimiento (subcolección establecimientos/{id}/contactos)
export const contactosEstablecimientoService = {
  async create(establecimientoId: string, data: Omit<ContactoEstablecimiento, 'id' | 'establecimientoId'>) {
    const docRef = await addDoc(collection(db, 'establecimientos', establecimientoId, 'contactos'), cleanFirestoreData({
      ...data,
      establecimientoId,
      esPrincipal: data.esPrincipal ?? false,
    }));
    return docRef.id;
  },

  async getByEstablecimiento(establecimientoId: string): Promise<ContactoEstablecimiento[]> {
    const snapshot = await getDocs(collection(db, 'establecimientos', establecimientoId, 'contactos'));
    return snapshot.docs.map(d => ({
      id: d.id,
      establecimientoId,
      ...d.data(),
    })) as ContactoEstablecimiento[];
  },

  async update(establecimientoId: string, contactoId: string, data: Partial<Omit<ContactoEstablecimiento, 'id' | 'establecimientoId'>>) {
    const docRef = doc(db, 'establecimientos', establecimientoId, 'contactos', contactoId);
    await updateDoc(docRef, cleanFirestoreData(data));
  },

  async delete(establecimientoId: string, contactoId: string) {
    await deleteDoc(doc(db, 'establecimientos', establecimientoId, 'contactos', contactoId));
  },
};

// Servicio para Establecimientos (colección global; clienteCuit = id del cliente)
export const establecimientosService = {
  async create(clienteCuit: string, data: Omit<Establecimiento, 'id' | 'clienteCuit' | 'createdAt' | 'updatedAt'>) {
    console.log('📝 Creando establecimiento:', data.nombre, 'para cliente', clienteCuit);
    const payload = cleanFirestoreData({
      clienteCuit,
      ...data,
      ...getCreateTrace(),
      ubicaciones: data.ubicaciones || [],
      activo: data.activo !== undefined ? data.activo : true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const estRef = newDocRef('establecimientos');
    const batch = createBatch();
    batch.set(estRef, payload);
    batchAudit(batch, { action: 'create', collection: 'establecimientos', documentId: estRef.id, after: payload });
    await batch.commit();
    invalidateCache('establecimientos');
    return estRef.id;
  },

  async getById(id: string): Promise<Establecimiento | null> {
    const docRef = doc(db, 'establecimientos', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const d = docSnap.data();
      return {
        id: docSnap.id,
        ...d,
        clienteCuit: d.clienteCuit || d.clienteId || null,
        ubicaciones: d.ubicaciones || [],
        createdAt: d.createdAt?.toDate().toISOString(),
        updatedAt: d.updatedAt?.toDate().toISOString(),
      } as Establecimiento;
    }
    return null;
  },

  /** Real-time subscription to a single establecimiento. Returns unsubscribe function. */
  subscribeById(id: string, callback: (est: Establecimiento | null) => void, onError?: (err: Error) => void): () => void {
    return onSnapshot(doc(db, 'establecimientos', id), snap => {
      if (!snap.exists()) { callback(null); return; }
      const d = snap.data();
      callback({
        id: snap.id,
        ...d,
        clienteCuit: d.clienteCuit || d.clienteId || null,
        ubicaciones: d.ubicaciones || [],
        createdAt: d.createdAt?.toDate().toISOString(),
        updatedAt: d.updatedAt?.toDate().toISOString(),
      } as Establecimiento);
    }, err => { console.error('Establecimiento subscription error:', err); onError?.(err); });
  },

  async getByCliente(clienteCuit: string): Promise<Establecimiento[]> {
    // Buscar por clienteCuit Y por clienteId (campo legacy de migración)
    const [snap1, snap2] = await Promise.all([
      getDocs(query(collection(db, 'establecimientos'), where('clienteCuit', '==', clienteCuit))),
      getDocs(query(collection(db, 'establecimientos'), where('clienteId', '==', clienteCuit))),
    ]);
    const seen = new Set<string>();
    const list: Establecimiento[] = [];
    for (const docSnap of [...snap1.docs, ...snap2.docs]) {
      if (seen.has(docSnap.id)) continue;
      seen.add(docSnap.id);
      const d = docSnap.data();
      list.push({
        id: docSnap.id,
        ...d,
        clienteCuit: d.clienteCuit || d.clienteId || null,
        ubicaciones: d.ubicaciones || [],
        createdAt: d.createdAt?.toDate().toISOString(),
        updatedAt: d.updatedAt?.toDate().toISOString(),
      } as Establecimiento);
    }
    list.sort((a, b) => a.nombre.localeCompare(b.nombre));
    return list;
  },

  async getAll(): Promise<Establecimiento[]> {
    const cached = getCached<Establecimiento[]>('establecimientos');
    if (cached) return cached;

    const snapshot = await getDocs(collection(db, 'establecimientos'));
    const list = snapshot.docs.map(docSnap => {
      const d = docSnap.data();
      return {
        id: docSnap.id,
        ...d,
        clienteCuit: d.clienteCuit || d.clienteId || null,
        ubicaciones: d.ubicaciones || [],
        createdAt: d.createdAt?.toDate().toISOString(),
        updatedAt: d.updatedAt?.toDate().toISOString(),
      } as Establecimiento;
    });
    list.sort((a, b) => a.nombre.localeCompare(b.nombre));
    setCache('establecimientos', list);
    return list;
  },

  /** Real-time subscription. Returns unsubscribe function. */
  subscribe(
    callback: (establecimientos: Establecimiento[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    const q = query(collection(db, 'establecimientos'));
    return onSnapshot(q, snap => {
      const list = snap.docs.map(docSnap => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          ...d,
          clienteCuit: d.clienteCuit || d.clienteId || null,
          ubicaciones: d.ubicaciones || [],
          createdAt: d.createdAt?.toDate().toISOString(),
          updatedAt: d.updatedAt?.toDate().toISOString(),
        } as Establecimiento;
      });
      list.sort((a, b) => a.nombre.localeCompare(b.nombre));
      callback(list);
    }, err => {
      console.error('Establecimientos subscription error:', err);
      onError?.(err);
    });
  },

  async update(id: string, data: Partial<Omit<Establecimiento, 'id' | 'clienteCuit' | 'createdAt' | 'updatedAt'>>) {
    const payload = cleanFirestoreData({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.update(firestoreDocRef('establecimientos', id), payload);
    batchAudit(batch, { action: 'update', collection: 'establecimientos', documentId: id, after: payload });
    await batch.commit();
    invalidateCache('establecimientos');
  },

  async delete(id: string) {
    const batch = createBatch();
    batch.delete(firestoreDocRef('establecimientos', id));
    batchAudit(batch, { action: 'delete', collection: 'establecimientos', documentId: id });
    await batch.commit();
    invalidateCache('establecimientos');
  },

  async deactivate(id: string) {
    await this.update(id, { activo: false });
  },

  async activate(id: string) {
    await this.update(id, { activo: true });
  },
};
