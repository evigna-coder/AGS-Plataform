import { collection, getDocs, doc, getDoc, query, where, Timestamp } from 'firebase/firestore';
import type { SolicitudFacturacion, SolicitudFacturacionEstado } from '@ags/shared';
import { db, cleanFirestoreData, getCreateTrace, getUpdateTrace, createBatch, newDocRef, docRef, inTransition, onSnapshot } from './firebase';

function toISO(val: any, fallback: string | null = null): string | null {
  if (!val) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val?.toDate === 'function') return val.toDate().toISOString();
  if (typeof val?.seconds === 'number') return new Date(val.seconds * 1000).toISOString();
  return fallback;
}

function parseSolicitud(d: any, id: string): SolicitudFacturacion {
  return {
    id,
    ...d,
    createdAt: toISO(d.createdAt, '') as string,
    updatedAt: toISO(d.updatedAt, '') as string,
    fechaFactura: toISO(d.fechaFactura),
    fechaCobro: toISO(d.fechaCobro),
    fechaVencimientoCae: toISO(d.fechaVencimientoCae),
  };
}

export const facturacionService = {
  async getAll(filters?: { estado?: SolicitudFacturacionEstado; clienteId?: string }) {
    let q = query(collection(db, 'solicitudesFacturacion'));
    if (filters?.estado) q = query(q, where('estado', '==', filters.estado));
    if (filters?.clienteId) q = query(q, where('clienteId', '==', filters.clienteId));

    const snap = await getDocs(q);
    const items = snap.docs.map(d => parseSolicitud(d.data(), d.id));
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return items;
  },

  subscribe(
    filters: { estado?: SolicitudFacturacionEstado; clienteId?: string } | undefined,
    callback: (items: SolicitudFacturacion[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    let q = query(collection(db, 'solicitudesFacturacion'));
    if (filters?.estado) q = query(q, where('estado', '==', filters.estado));
    if (filters?.clienteId) q = query(q, where('clienteId', '==', filters.clienteId));

    return onSnapshot(q, snap => {
      const items = snap.docs.map(d => parseSolicitud(d.data(), d.id));
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      inTransition(callback)(items);
    }, err => {
      console.error('SolicitudesFacturacion subscription error:', err);
      onError?.(err);
    });
  },

  async getById(id: string): Promise<SolicitudFacturacion | null> {
    const snap = await getDoc(doc(db, 'solicitudesFacturacion', id));
    if (!snap.exists()) return null;
    return parseSolicitud(snap.data(), snap.id);
  },

  async getByPresupuesto(presupuestoId: string): Promise<SolicitudFacturacion[]> {
    const q = query(collection(db, 'solicitudesFacturacion'), where('presupuestoId', '==', presupuestoId));
    const snap = await getDocs(q);
    const items = snap.docs.map(d => parseSolicitud(d.data(), d.id));
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return items;
  },

  async create(data: Omit<SolicitudFacturacion, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const ref = newDocRef('solicitudesFacturacion');
    const batch = createBatch();
    const cleaned = cleanFirestoreData({
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      ...getCreateTrace(),
    });
    batch.set(ref, cleaned);
    await batch.commit();
    return ref.id;
  },

  async update(id: string, data: Partial<SolicitudFacturacion>): Promise<void> {
    const ref = docRef('solicitudesFacturacion', id);
    const batch = createBatch();
    const { id: _, createdAt: __, ...rest } = data;
    const cleaned = cleanFirestoreData({
      ...rest,
      updatedAt: Timestamp.now(),
      ...getUpdateTrace(),
    });
    batch.update(ref, cleaned);
    await batch.commit();
  },

  async registrarFactura(id: string, datos: {
    numeroFactura: string;
    fechaFactura: string;
    tipoComprobante?: string;
    puntoVenta?: string;
    cae?: string;
    fechaVencimientoCae?: string;
  }): Promise<void> {
    await this.update(id, {
      ...datos,
      estado: 'facturada',
    });
  },

  async registrarCobro(id: string, fechaCobro: string): Promise<void> {
    await this.update(id, {
      estado: 'cobrada',
      fechaCobro,
    });
  },
};
