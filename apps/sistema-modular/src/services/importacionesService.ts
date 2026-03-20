import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where, orderBy, Timestamp, setDoc } from 'firebase/firestore';
import type { TipoServicio, PosicionArancelaria, RequerimientoCompra, Importacion } from '@ags/shared';
import { db, logAudit, cleanFirestoreData, getCreateTrace, getUpdateTrace } from './firebase';

// Servicio para Tipos de Servicio (lista simple)
export const tiposServicioService = {
  // Obtener todos los tipos de servicio
  async getAll() {
    console.log('📥 Cargando tipos de servicio...');
    const querySnapshot = await getDocs(collection(db, 'tipos_servicio'));
    const tipos = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate().toISOString(),
      updatedAt: doc.data().updatedAt?.toDate().toISOString(),
    })) as TipoServicio[];

    tipos.sort((a, b) => a.nombre.localeCompare(b.nombre));
    console.log(`✅ ${tipos.length} tipos de servicio cargados`);
    return tipos;
  },

  // Obtener tipo por ID
  async getById(id: string) {
    const docRef = doc(db, 'tipos_servicio', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate().toISOString(),
        updatedAt: docSnap.data().updatedAt?.toDate().toISOString(),
      } as TipoServicio;
    }
    return null;
  },

  // Crear tipo de servicio
  async create(tipoData: Omit<TipoServicio, 'id' | 'createdAt' | 'updatedAt'>) {
    const payload = {
      ...tipoData,
      ...getCreateTrace(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    const docRef = await addDoc(collection(db, 'tipos_servicio'), payload);
    logAudit({ action: 'create', collection: 'tipos_servicio', documentId: docRef.id, after: payload as any });
    return docRef.id;
  },

  // Actualizar tipo de servicio
  async update(id: string, data: Partial<Omit<TipoServicio, 'id' | 'createdAt' | 'updatedAt'>>) {
    const docRef = doc(db, 'tipos_servicio', id);
    const payload = {
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    };
    await updateDoc(docRef, payload);
    logAudit({ action: 'update', collection: 'tipos_servicio', documentId: id, after: payload as any });
  },

  // Eliminar tipo de servicio
  async delete(id: string) {
    logAudit({ action: 'delete', collection: 'tipos_servicio', documentId: id });
    await deleteDoc(doc(db, 'tipos_servicio', id));
  },
};

// ========== POSICIONES ARANCELARIAS ==========

export const posicionesArancelariasService = {
  async getAll(activoOnly: boolean = true): Promise<PosicionArancelaria[]> {
    let q;
    if (activoOnly) {
      q = query(collection(db, 'posiciones_arancelarias'), where('activo', '==', true));
    } else {
      q = query(collection(db, 'posiciones_arancelarias'));
    }
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({
      id: d.id, ...d.data(),
      createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    })) as PosicionArancelaria[];
    items.sort((a, b) => a.codigo.localeCompare(b.codigo));
    return items;
  },

  async getById(id: string): Promise<PosicionArancelaria | null> {
    const snap = await getDoc(doc(db, 'posiciones_arancelarias', id));
    if (!snap.exists()) return null;
    return {
      id: snap.id, ...snap.data(),
      createdAt: snap.data().createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      updatedAt: snap.data().updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    } as PosicionArancelaria;
  },

  async create(data: Omit<PosicionArancelaria, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const payload = cleanFirestoreData({
      ...data,
      ...getCreateTrace(),
      activo: data.activo !== undefined ? data.activo : true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    await setDoc(doc(db, 'posiciones_arancelarias', id), payload);
    logAudit({ action: 'create', collection: 'posiciones_arancelarias', documentId: id, after: payload as any });
    return id;
  },

  async update(id: string, data: Partial<Omit<PosicionArancelaria, 'id' | 'createdAt'>>): Promise<void> {
    const payload = cleanFirestoreData({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    await updateDoc(doc(db, 'posiciones_arancelarias', id), payload);
    logAudit({ action: 'update', collection: 'posiciones_arancelarias', documentId: id, after: payload as any });
  },

  async delete(id: string): Promise<void> {
    logAudit({ action: 'delete', collection: 'posiciones_arancelarias', documentId: id });
    await deleteDoc(doc(db, 'posiciones_arancelarias', id));
  },

  async getByCodigo(codigo: string): Promise<PosicionArancelaria | null> {
    const q = query(collection(db, 'posiciones_arancelarias'), where('codigo', '==', codigo));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return {
      id: d.id, ...d.data(),
      createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    } as PosicionArancelaria;
  },
};

// ========== REQUERIMIENTOS DE COMPRA ==========

export const requerimientosService = {
  async getNextNumber(): Promise<string> {
    const q = query(collection(db, 'requerimientos_compra'), orderBy('numero', 'desc'));
    const snap = await getDocs(q);
    let maxNum = 0;
    snap.docs.forEach(d => {
      const match = d.data().numero?.match(/REQ-(\d+)/);
      if (match) { const n = parseInt(match[1]); if (n > maxNum) maxNum = n; }
    });
    return `REQ-${String(maxNum + 1).padStart(4, '0')}`;
  },

  async getAll(filters?: { estado?: string; origen?: string }): Promise<RequerimientoCompra[]> {
    const constraints: any[] = [orderBy('createdAt', 'desc')];
    if (filters?.estado) constraints.unshift(where('estado', '==', filters.estado));
    if (filters?.origen) constraints.unshift(where('origen', '==', filters.origen));
    const q = query(collection(db, 'requerimientos_compra'), ...constraints);
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      id: d.id, ...d.data(),
      fechaSolicitud: d.data().fechaSolicitud?.toDate?.()?.toISOString() ?? d.data().fechaSolicitud,
      fechaAprobacion: d.data().fechaAprobacion?.toDate?.()?.toISOString() ?? null,
      createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    })) as RequerimientoCompra[];
  },

  async getById(id: string): Promise<RequerimientoCompra | null> {
    const snap = await getDoc(doc(db, 'requerimientos_compra', id));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      id: snap.id, ...d,
      fechaSolicitud: d.fechaSolicitud?.toDate?.()?.toISOString() ?? d.fechaSolicitud,
      fechaAprobacion: d.fechaAprobacion?.toDate?.()?.toISOString() ?? null,
      createdAt: d.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      updatedAt: d.updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    } as RequerimientoCompra;
  },

  async create(data: Omit<RequerimientoCompra, 'id' | 'numero' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const numero = await this.getNextNumber();
    const payload: any = {
      ...cleanFirestoreData(data as any),
      ...getCreateTrace(),
      numero,
      fechaSolicitud: Timestamp.fromDate(new Date(data.fechaSolicitud)),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    if (data.fechaAprobacion) payload.fechaAprobacion = Timestamp.fromDate(new Date(data.fechaAprobacion));
    await setDoc(doc(db, 'requerimientos_compra', id), payload);
    logAudit({ action: 'create', collection: 'requerimientos_compra', documentId: id, after: payload as any });
    return id;
  },

  async update(id: string, data: Partial<RequerimientoCompra>): Promise<void> {
    const payload: any = { ...cleanFirestoreData(data as any), ...getUpdateTrace(), updatedAt: Timestamp.now() };
    if (data.fechaAprobacion) payload.fechaAprobacion = Timestamp.fromDate(new Date(data.fechaAprobacion));
    await updateDoc(doc(db, 'requerimientos_compra', id), payload);
    logAudit({ action: 'update', collection: 'requerimientos_compra', documentId: id, after: payload as any });
  },

  async delete(id: string): Promise<void> {
    logAudit({ action: 'delete', collection: 'requerimientos_compra', documentId: id });
    await deleteDoc(doc(db, 'requerimientos_compra', id));
  },
};

// ========== IMPORTACIONES ==========

export const importacionesService = {
  async getNextNumber(): Promise<string> {
    const q = query(collection(db, 'importaciones'), orderBy('numero', 'desc'));
    const snap = await getDocs(q);
    let maxNum = 0;
    snap.docs.forEach(d => {
      const match = d.data().numero?.match(/IMP-(\d+)/);
      if (match) { const n = parseInt(match[1]); if (n > maxNum) maxNum = n; }
    });
    return `IMP-${String(maxNum + 1).padStart(4, '0')}`;
  },

  async getAll(filters?: { estado?: string }): Promise<Importacion[]> {
    const constraints: any[] = [orderBy('createdAt', 'desc')];
    if (filters?.estado) constraints.unshift(where('estado', '==', filters.estado));
    const q = query(collection(db, 'importaciones'), ...constraints);
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id, ...data,
        fechaEmbarque: data.fechaEmbarque?.toDate?.()?.toISOString() ?? null,
        fechaEstimadaArribo: data.fechaEstimadaArribo?.toDate?.()?.toISOString() ?? null,
        fechaArriboReal: data.fechaArriboReal?.toDate?.()?.toISOString() ?? null,
        fechaDespacho: data.fechaDespacho?.toDate?.()?.toISOString() ?? null,
        vepFechaPago: data.vepFechaPago?.toDate?.()?.toISOString() ?? null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      };
    }) as Importacion[];
  },

  async getById(id: string): Promise<Importacion | null> {
    const snap = await getDoc(doc(db, 'importaciones', id));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      id: snap.id, ...data,
      fechaEmbarque: data.fechaEmbarque?.toDate?.()?.toISOString() ?? null,
      fechaEstimadaArribo: data.fechaEstimadaArribo?.toDate?.()?.toISOString() ?? null,
      fechaArriboReal: data.fechaArriboReal?.toDate?.()?.toISOString() ?? null,
      fechaDespacho: data.fechaDespacho?.toDate?.()?.toISOString() ?? null,
      vepFechaPago: data.vepFechaPago?.toDate?.()?.toISOString() ?? null,
      createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    } as Importacion;
  },

  async create(data: Omit<Importacion, 'id' | 'numero' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const numero = await this.getNextNumber();
    const payload: any = {
      ...cleanFirestoreData(data as any),
      ...getCreateTrace(),
      numero,
      gastos: data.gastos || [],
      documentos: data.documentos || [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    const dateFields = ['fechaEmbarque', 'fechaEstimadaArribo', 'fechaArriboReal', 'fechaDespacho', 'vepFechaPago'] as const;
    for (const f of dateFields) {
      if (data[f]) payload[f] = Timestamp.fromDate(new Date(data[f]!));
    }
    await setDoc(doc(db, 'importaciones', id), payload);
    logAudit({ action: 'create', collection: 'importaciones', documentId: id, after: payload as any });
    return id;
  },

  async update(id: string, data: Partial<Importacion>): Promise<void> {
    const payload: any = { ...cleanFirestoreData(data as any), ...getUpdateTrace(), updatedAt: Timestamp.now() };
    const dateFields = ['fechaEmbarque', 'fechaEstimadaArribo', 'fechaArriboReal', 'fechaDespacho', 'vepFechaPago'] as const;
    for (const f of dateFields) {
      if ((data as any)[f]) payload[f] = Timestamp.fromDate(new Date((data as any)[f]));
    }
    await updateDoc(doc(db, 'importaciones', id), payload);
    logAudit({ action: 'update', collection: 'importaciones', documentId: id, after: payload as any });
  },

  async delete(id: string): Promise<void> {
    logAudit({ action: 'delete', collection: 'importaciones', documentId: id });
    await deleteDoc(doc(db, 'importaciones', id));
  },
};
