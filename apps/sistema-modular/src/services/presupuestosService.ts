import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where, orderBy, Timestamp, setDoc } from 'firebase/firestore';
import type { Presupuesto, PresupuestoEstado, OrdenCompra, CategoriaPresupuesto, CondicionPago, ConceptoServicio } from '@ags/shared';
import { db, logAudit, cleanFirestoreData, getCreateTrace, getUpdateTrace } from './firebase';

// Servicio para Presupuestos
export const presupuestosService = {
  // Generar siguiente número de presupuesto (PRE-0000)
  async getNextPresupuestoNumber(): Promise<string> {
    console.log('🔢 Generando siguiente número de presupuesto...');
    const q = query(collection(db, 'presupuestos'), orderBy('numero', 'desc'));
    const querySnapshot = await getDocs(q);

    let maxNum = 0;
    querySnapshot.docs.forEach(doc => {
      const numero = doc.data().numero;
      const match = numero.match(/PRE-(\d+)/);
      if (match) {
        const num = parseInt(match[1]);
        if (num > maxNum) maxNum = num;
      }
    });

    const nextNum = maxNum + 1;
    const nextNumber = `PRE-${String(nextNum).padStart(4, '0')}`;
    console.log(`✅ Siguiente presupuesto: ${nextNumber}`);
    return nextNumber;
  },

  // Obtener todos los presupuestos
  async getAll(filters?: { clienteId?: string; estado?: Presupuesto['estado'] }) {
    console.log('📥 Cargando presupuestos desde Firestore...');
    let q = query(collection(db, 'presupuestos'));

    // Aplicar filtros primero
    if (filters?.clienteId) {
      q = query(q, where('clienteId', '==', filters.clienteId));
    }
    if (filters?.estado) {
      q = query(q, where('estado', '==', filters.estado));
    }

    // Ordenar solo si no hay filtros que requieran índice compuesto
    // Por ahora, ordenar en memoria para evitar problemas de índices
    const querySnapshot = await getDocs(q);
    const presupuestos = querySnapshot.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        ...d,
        createdAt: d.createdAt?.toDate().toISOString(),
        updatedAt: d.updatedAt?.toDate().toISOString(),
        validUntil: d.validUntil?.toDate?.()?.toISOString() ?? d.validUntil ?? null,
        fechaEnvio: d.fechaEnvio?.toDate?.()?.toISOString() ?? d.fechaEnvio ?? null,
        proximoContacto: d.proximoContacto ?? null,
        responsableId: d.responsableId ?? null,
        responsableNombre: d.responsableNombre ?? null,
      };
    }) as Presupuesto[];

    // Ordenar en memoria por fecha de creación (más recientes primero)
    presupuestos.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    console.log(`✅ ${presupuestos.length} presupuestos cargados`);
    return presupuestos;
  },

  // Obtener presupuesto por ID
  async getById(id: string) {
    const docRef = doc(db, 'presupuestos', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const d = docSnap.data();
      return {
        id: docSnap.id,
        ...d,
        createdAt: d.createdAt?.toDate().toISOString(),
        updatedAt: d.updatedAt?.toDate().toISOString(),
        validUntil: d.validUntil?.toDate?.()?.toISOString() ?? d.validUntil ?? null,
        fechaEnvio: d.fechaEnvio?.toDate?.()?.toISOString() ?? d.fechaEnvio ?? null,
        proximoContacto: d.proximoContacto ?? null,
        responsableId: d.responsableId ?? null,
        responsableNombre: d.responsableNombre ?? null,
      } as Presupuesto;
    }
    return null;
  },

  // Crear presupuesto
  async create(presupuestoData: Omit<Presupuesto, 'id' | 'createdAt' | 'updatedAt'> & { numero?: string }) {
    console.log('📝 Creando presupuesto...');

    // Generar número si no se proporciona
    const numero = presupuestoData.numero || await this.getNextPresupuestoNumber();

    // Helper para limpiar undefined y convertir fechas
    const cleanData = (data: any): any => {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          if (key === 'fechaEnvio' && value) {
            cleaned[key] = Timestamp.fromDate(new Date(value as string));
          } else if (key === 'validUntil' && value) {
            cleaned[key] = Timestamp.fromDate(new Date(value as string));
          } else {
            cleaned[key] = value === '' ? null : value;
          }
        }
      }
      return cleaned;
    };

    const payload = cleanData({
      ...presupuestoData,
      ...getCreateTrace(),
      numero,
      tipo: presupuestoData.tipo || 'servicio',
      moneda: presupuestoData.moneda || 'USD',
      items: presupuestoData.items || [],
      ordenesCompraIds: presupuestoData.ordenesCompraIds || [],
      adjuntos: presupuestoData.adjuntos || [],
      validezDias: presupuestoData.validezDias ?? 15,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const docRef = await addDoc(collection(db, 'presupuestos'), payload);
    logAudit({ action: 'create', collection: 'presupuestos', documentId: docRef.id, after: payload as any });

    console.log('✅ Presupuesto creado exitosamente con ID:', docRef.id);
    return { id: docRef.id, numero };
  },

  // Actualizar presupuesto
  async update(id: string, data: Partial<Presupuesto>) {
    // Helper para limpiar undefined
    const cleanData = (data: any): any => {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          if (key === 'fechaEnvio' && value) {
            cleaned[key] = Timestamp.fromDate(new Date(value as string));
          } else if (key === 'validUntil' && value) {
            cleaned[key] = Timestamp.fromDate(new Date(value as string));
          } else {
            cleaned[key] = value === '' ? null : value;
          }
        }
      }
      return cleaned;
    };

    const docRef = doc(db, 'presupuestos', id);
    const cleanedData = cleanData({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });

    await updateDoc(docRef, cleanedData);
    logAudit({ action: 'update', collection: 'presupuestos', documentId: id, after: cleanedData as any });
  },

  // Duplicar presupuesto (crea copia en borrador)
  async duplicate(id: string): Promise<string> {
    const original = await this.getById(id);
    if (!original) throw new Error('Presupuesto no encontrado');
    const numero = await this.getNextPresupuestoNumber();
    const { id: _id, createdAt: _ca, updatedAt: _ua, ...rest } = original;
    const result = await this.create({
      ...rest,
      numero,
      estado: 'borrador',
      items: original.items.map(i => ({ ...i, id: crypto.randomUUID() })),
      fechaEnvio: undefined,
      validUntil: undefined,
      adjuntos: [],
      ordenesCompraIds: [],
    });
    return result.id;
  },

  // Eliminar presupuesto (baja lógica)
  async delete(id: string) {
    logAudit({ action: 'delete', collection: 'presupuestos', documentId: id });
    const docRef = doc(db, 'presupuestos', id);
    await updateDoc(docRef, {
      estado: 'borrador' as PresupuestoEstado,
      updatedAt: Timestamp.now(),
    });
  },
};

// Servicio para Ordenes de Compra
export const ordenesCompraService = {
  async getNextOCNumber(): Promise<string> {
    const q = query(collection(db, 'ordenes_compra'), orderBy('numero', 'desc'));
    const snap = await getDocs(q);
    let maxNum = 0;
    snap.docs.forEach(d => {
      const match = d.data().numero?.match(/OC-(\d+)/);
      if (match) { const n = parseInt(match[1]); if (n > maxNum) maxNum = n; }
    });
    return `OC-${String(maxNum + 1).padStart(4, '0')}`;
  },

  async getAll(filters?: { estado?: string; tipo?: string; proveedorId?: string }): Promise<OrdenCompra[]> {
    const constraints: any[] = [orderBy('createdAt', 'desc')];
    if (filters?.estado) constraints.unshift(where('estado', '==', filters.estado));
    if (filters?.tipo) constraints.unshift(where('tipo', '==', filters.tipo));
    if (filters?.proveedorId) constraints.unshift(where('proveedorId', '==', filters.proveedorId));
    const q = query(collection(db, 'ordenes_compra'), ...constraints);
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      fechaRecepcion: d.data().fechaRecepcion?.toDate?.()?.toISOString() ?? null,
      fechaProforma: d.data().fechaProforma?.toDate?.()?.toISOString() ?? null,
      fechaEntregaEstimada: d.data().fechaEntregaEstimada?.toDate?.()?.toISOString() ?? null,
      createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    })) as OrdenCompra[];
  },

  async getById(id: string): Promise<OrdenCompra | null> {
    const snap = await getDoc(doc(db, 'ordenes_compra', id));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      id: snap.id,
      ...d,
      fechaRecepcion: d.fechaRecepcion?.toDate?.()?.toISOString() ?? null,
      fechaProforma: d.fechaProforma?.toDate?.()?.toISOString() ?? null,
      fechaEntregaEstimada: d.fechaEntregaEstimada?.toDate?.()?.toISOString() ?? null,
      createdAt: d.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      updatedAt: d.updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    } as OrdenCompra;
  },

  async create(data: Omit<OrdenCompra, 'id' | 'createdAt' | 'updatedAt' | 'numero'> & { numero?: string }): Promise<string> {
    const numero = data.numero || await this.getNextOCNumber();
    const id = crypto.randomUUID();
    const payload: any = {
      ...cleanFirestoreData(data as any),
      ...getCreateTrace(),
      numero,
      items: data.items || [],
      presupuestoIds: data.presupuestoIds || [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    if (data.fechaRecepcion) payload.fechaRecepcion = Timestamp.fromDate(new Date(data.fechaRecepcion));
    if (data.fechaProforma) payload.fechaProforma = Timestamp.fromDate(new Date(data.fechaProforma));
    if (data.fechaEntregaEstimada) payload.fechaEntregaEstimada = Timestamp.fromDate(new Date(data.fechaEntregaEstimada));
    await setDoc(doc(db, 'ordenes_compra', id), payload);
    logAudit({ action: 'create', collection: 'ordenes_compra', documentId: id, after: payload as any });
    return id;
  },

  async update(id: string, data: Partial<OrdenCompra>): Promise<void> {
    const payload: any = { ...cleanFirestoreData(data as any), ...getUpdateTrace(), updatedAt: Timestamp.now() };
    if (data.fechaRecepcion) payload.fechaRecepcion = Timestamp.fromDate(new Date(data.fechaRecepcion));
    if (data.fechaProforma) payload.fechaProforma = Timestamp.fromDate(new Date(data.fechaProforma));
    if (data.fechaEntregaEstimada) payload.fechaEntregaEstimada = Timestamp.fromDate(new Date(data.fechaEntregaEstimada));
    await updateDoc(doc(db, 'ordenes_compra', id), payload);
    logAudit({ action: 'update', collection: 'ordenes_compra', documentId: id, after: payload as any });
  },

  async delete(id: string): Promise<void> {
    logAudit({ action: 'delete', collection: 'ordenes_compra', documentId: id });
    await deleteDoc(doc(db, 'ordenes_compra', id));
  },
};

// Servicio para Categorías de Presupuesto
export const categoriasPresupuestoService = {
  // Obtener todas las categorías
  async getAll() {
    console.log('📥 Cargando categorías de presupuesto...');
    const querySnapshot = await getDocs(collection(db, 'categorias_presupuesto'));
    const categorias = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate().toISOString(),
      updatedAt: doc.data().updatedAt?.toDate().toISOString(),
    })) as CategoriaPresupuesto[];

    categorias.sort((a, b) => a.nombre.localeCompare(b.nombre));
    console.log(`✅ ${categorias.length} categorías de presupuesto cargadas`);
    return categorias;
  },

  // Obtener categoría por ID
  async getById(id: string) {
    const docRef = doc(db, 'categorias_presupuesto', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate().toISOString(),
        updatedAt: docSnap.data().updatedAt?.toDate().toISOString(),
      } as CategoriaPresupuesto;
    }
    return null;
  },

  // Crear categoría
  async create(categoriaData: Omit<CategoriaPresupuesto, 'id' | 'createdAt' | 'updatedAt'>) {
    const payload = {
      ...categoriaData,
      ...getCreateTrace(),
      activo: categoriaData.activo !== undefined ? categoriaData.activo : true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    const docRef = await addDoc(collection(db, 'categorias_presupuesto'), payload);
    logAudit({ action: 'create', collection: 'categorias_presupuesto', documentId: docRef.id, after: payload as any });
    return docRef.id;
  },

  // Actualizar categoría
  async update(id: string, data: Partial<Omit<CategoriaPresupuesto, 'id' | 'createdAt' | 'updatedAt'>>) {
    const docRef = doc(db, 'categorias_presupuesto', id);
    const payload = {
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    };
    await updateDoc(docRef, payload);
    logAudit({ action: 'update', collection: 'categorias_presupuesto', documentId: id, after: payload as any });
  },

  // Eliminar categoría
  async delete(id: string) {
    logAudit({ action: 'delete', collection: 'categorias_presupuesto', documentId: id });
    await deleteDoc(doc(db, 'categorias_presupuesto', id));
  },
};

// Servicio para Condiciones de Pago
export const condicionesPagoService = {
  // Obtener todas las condiciones
  async getAll() {
    console.log('📥 Cargando condiciones de pago...');
    const querySnapshot = await getDocs(collection(db, 'condiciones_pago'));
    const condiciones = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as CondicionPago[];

    condiciones.sort((a, b) => a.nombre.localeCompare(b.nombre));
    console.log(`✅ ${condiciones.length} condiciones de pago cargadas`);
    return condiciones;
  },

  // Obtener condición por ID
  async getById(id: string) {
    const docRef = doc(db, 'condiciones_pago', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as CondicionPago;
    }
    return null;
  },

  // Crear condición
  async create(condicionData: Omit<CondicionPago, 'id'>) {
    const payload = {
      ...condicionData,
      ...getCreateTrace(),
      activo: condicionData.activo !== undefined ? condicionData.activo : true,
    };
    const docRef = await addDoc(collection(db, 'condiciones_pago'), payload);
    logAudit({ action: 'create', collection: 'condiciones_pago', documentId: docRef.id, after: payload as any });
    return docRef.id;
  },

  // Actualizar condición
  async update(id: string, data: Partial<Omit<CondicionPago, 'id'>>) {
    const docRef = doc(db, 'condiciones_pago', id);
    const payload = { ...data, ...getUpdateTrace() };
    await updateDoc(docRef, payload);
    logAudit({ action: 'update', collection: 'condiciones_pago', documentId: id, after: payload as any });
  },

  // Eliminar condición
  async delete(id: string) {
    logAudit({ action: 'delete', collection: 'condiciones_pago', documentId: id });
    await deleteDoc(doc(db, 'condiciones_pago', id));
  },
};

// --- Conceptos de Servicio (catálogo de precios) ---
export const conceptosServicioService = {
  async getAll(): Promise<ConceptoServicio[]> {
    const querySnapshot = await getDocs(collection(db, 'conceptos_servicio'));
    const items = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || '',
        updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt || '',
      } as ConceptoServicio;
    });
    items.sort((a, b) => a.descripcion.localeCompare(b.descripcion));
    return items;
  },

  async getById(id: string): Promise<ConceptoServicio | null> {
    const docSnap = await getDoc(doc(db, 'conceptos_servicio', id));
    if (!docSnap.exists()) return null;
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || '',
      updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt || '',
    } as ConceptoServicio;
  },

  async create(data: Omit<ConceptoServicio, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const cleaned = cleanFirestoreData({
      ...data,
      ...getCreateTrace(),
      activo: data.activo !== undefined ? data.activo : true,
      factorActualizacion: data.factorActualizacion || 1,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const docRef = await addDoc(collection(db, 'conceptos_servicio'), cleaned);
    logAudit({ action: 'create', collection: 'conceptos_servicio', documentId: docRef.id, after: cleaned as any });
    return docRef.id;
  },

  async update(id: string, data: Partial<Omit<ConceptoServicio, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    const cleaned = cleanFirestoreData({ ...data, ...getUpdateTrace(), updatedAt: Timestamp.now() });
    await updateDoc(doc(db, 'conceptos_servicio', id), cleaned);
    logAudit({ action: 'update', collection: 'conceptos_servicio', documentId: id, after: cleaned as any });
  },

  async delete(id: string): Promise<void> {
    logAudit({ action: 'delete', collection: 'conceptos_servicio', documentId: id });
    await deleteDoc(doc(db, 'conceptos_servicio', id));
  },
};
