import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, Timestamp, query, orderBy } from 'firebase/firestore';
import type { Vehiculo, ServicioVehiculo, VisitaTaller, RegistroKm } from '@ags/shared';
import { db, createBatch, newDocRef, docRef, batchAudit, logAudit, getCreateTrace, getUpdateTrace, onSnapshot } from './firebase';

// ── Helpers ─────────────────────────────────────────────────────────────

function tsToIso(ts: any): string {
  return ts?.toDate?.().toISOString() ?? '';
}

function docToVehiculo(d: any): Vehiculo {
  const data = d.data();
  return {
    id: d.id, ...data,
    criteriosServicio: data.criteriosServicio ?? [],
    vencimientos: data.vencimientos ?? [],
    activo: data.activo !== false,
    createdAt: tsToIso(data.createdAt),
    updatedAt: tsToIso(data.updatedAt),
  } as Vehiculo;
}

// ── Vehículos ───────────────────────────────────────────────────────────

export const vehiculosService = {
  async create(data: Omit<Vehiculo, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const payload = { ...data, ...getCreateTrace(), activo: true, createdAt: Timestamp.now(), updatedAt: Timestamp.now() };
    const ref = newDocRef('vehiculos');
    const batch = createBatch();
    batch.set(ref, payload);
    batchAudit(batch, { action: 'create', collection: 'vehiculos', documentId: ref.id, after: payload as any });
    await batch.commit();
    return ref.id;
  },

  async getAll(activosOnly = false): Promise<Vehiculo[]> {
    const snap = await getDocs(collection(db, 'vehiculos'));
    let items = snap.docs.map(docToVehiculo);
    if (activosOnly) items = items.filter(v => v.activo);
    items.sort((a, b) => a.patente.localeCompare(b.patente));
    return items;
  },

  async getById(id: string): Promise<Vehiculo | null> {
    const snap = await getDoc(doc(db, 'vehiculos', id));
    return snap.exists() ? docToVehiculo(snap) : null;
  },

  subscribeById(
    id: string,
    callback: (item: Vehiculo | null) => void,
    onError?: (err: Error) => void,
  ): () => void {
    return onSnapshot(doc(db, 'vehiculos', id), snap => {
      if (!snap.exists()) { callback(null); return; }
      callback(docToVehiculo(snap));
    }, err => {
      console.error('vehiculos subscription error:', err);
      onError?.(err);
    });
  },

  async update(id: string, data: Partial<Omit<Vehiculo, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    const payload = { ...data, ...getUpdateTrace(), updatedAt: Timestamp.now() };
    const batch = createBatch();
    batch.update(docRef('vehiculos', id), payload);
    batchAudit(batch, { action: 'update', collection: 'vehiculos', documentId: id, after: payload as any });
    await batch.commit();
  },

  async delete(id: string): Promise<void> {
    const batch = createBatch();
    batch.delete(docRef('vehiculos', id));
    batchAudit(batch, { action: 'delete', collection: 'vehiculos', documentId: id });
    await batch.commit();
  },

  /** Real-time subscription. Returns unsubscribe function. */
  subscribe(
    activosOnly: boolean,
    callback: (vehiculos: Vehiculo[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    const q = query(collection(db, 'vehiculos'), orderBy('patente', 'asc'));
    return onSnapshot(q, snap => {
      let items = snap.docs.map(docToVehiculo);
      if (activosOnly) items = items.filter(v => v.activo);
      callback(items);
    }, err => {
      console.error('Vehiculos subscription error:', err);
      onError?.(err);
    });
  },
};

// ── Servicios (sub-colección vehiculos/{id}/servicios) ──────────────────

export const serviciosVehiculoService = {
  async getAll(vehiculoId: string): Promise<ServicioVehiculo[]> {
    const snap = await getDocs(collection(db, 'vehiculos', vehiculoId, 'servicios'));
    return snap.docs.map(d => ({
      id: d.id, ...d.data(),
      createdAt: tsToIso(d.data().createdAt),
      updatedAt: tsToIso(d.data().updatedAt),
    } as ServicioVehiculo)).sort((a, b) => a.servicio.localeCompare(b.servicio));
  },

  async create(vehiculoId: string, data: Omit<ServicioVehiculo, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const payload = { ...data, createdAt: Timestamp.now(), updatedAt: Timestamp.now() };
    const ref = await addDoc(collection(db, 'vehiculos', vehiculoId, 'servicios'), payload);
    logAudit({ action: 'create', collection: `vehiculos/${vehiculoId}/servicios`, documentId: ref.id, after: payload as Record<string, unknown> });
    return ref.id;
  },

  async update(vehiculoId: string, id: string, data: Partial<Omit<ServicioVehiculo, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    const payload = { ...data, updatedAt: Timestamp.now() };
    await updateDoc(doc(db, 'vehiculos', vehiculoId, 'servicios', id), payload);
    logAudit({ action: 'update', collection: `vehiculos/${vehiculoId}/servicios`, documentId: id, after: payload as Record<string, unknown> });
  },

  async delete(vehiculoId: string, id: string): Promise<void> {
    await deleteDoc(doc(db, 'vehiculos', vehiculoId, 'servicios', id));
    logAudit({ action: 'delete', collection: `vehiculos/${vehiculoId}/servicios`, documentId: id });
  },
};

// ── Historial de taller (sub-colección vehiculos/{id}/historial) ────────

export const historialTallerService = {
  async getAll(vehiculoId: string): Promise<VisitaTaller[]> {
    const snap = await getDocs(collection(db, 'vehiculos', vehiculoId, 'historial'));
    return snap.docs.map(d => ({
      id: d.id, ...d.data(),
      createdAt: tsToIso(d.data().createdAt),
      updatedAt: tsToIso(d.data().updatedAt),
    } as VisitaTaller)).sort((a, b) => b.fecha.localeCompare(a.fecha));
  },

  async create(vehiculoId: string, data: Omit<VisitaTaller, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const payload = { ...data, createdAt: Timestamp.now(), updatedAt: Timestamp.now() };
    const ref = await addDoc(collection(db, 'vehiculos', vehiculoId, 'historial'), payload);
    logAudit({ action: 'create', collection: `vehiculos/${vehiculoId}/historial`, documentId: ref.id, after: payload as Record<string, unknown> });
    return ref.id;
  },

  async update(vehiculoId: string, id: string, data: Partial<Omit<VisitaTaller, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    const payload = { ...data, updatedAt: Timestamp.now() };
    await updateDoc(doc(db, 'vehiculos', vehiculoId, 'historial', id), payload);
    logAudit({ action: 'update', collection: `vehiculos/${vehiculoId}/historial`, documentId: id, after: payload as Record<string, unknown> });
  },

  async delete(vehiculoId: string, id: string): Promise<void> {
    await deleteDoc(doc(db, 'vehiculos', vehiculoId, 'historial', id));
    logAudit({ action: 'delete', collection: `vehiculos/${vehiculoId}/historial`, documentId: id });
  },
};

// ── Registros KM (sub-colección vehiculos/{id}/registrosKm) ─────────────

export const registrosKmService = {
  async getAll(vehiculoId: string): Promise<RegistroKm[]> {
    const snap = await getDocs(collection(db, 'vehiculos', vehiculoId, 'registrosKm'));
    return snap.docs.map(d => ({
      id: d.id, ...d.data(),
      createdAt: tsToIso(d.data().createdAt),
    } as RegistroKm)).sort((a, b) => b.fecha.localeCompare(a.fecha));
  },

  async create(vehiculoId: string, data: Omit<RegistroKm, 'id' | 'createdAt'>): Promise<string> {
    const payload = { ...data, createdAt: Timestamp.now() };
    const ref = await addDoc(collection(db, 'vehiculos', vehiculoId, 'registrosKm'), payload);
    logAudit({ action: 'create', collection: `vehiculos/${vehiculoId}/registrosKm`, documentId: ref.id, after: payload as Record<string, unknown> });
    return ref.id;
  },

  async delete(vehiculoId: string, id: string): Promise<void> {
    await deleteDoc(doc(db, 'vehiculos', vehiculoId, 'registrosKm', id));
    logAudit({ action: 'delete', collection: `vehiculos/${vehiculoId}/registrosKm`, documentId: id });
  },
};
