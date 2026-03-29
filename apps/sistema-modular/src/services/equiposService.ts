import { collection, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where, Timestamp, onSnapshot, addDoc } from 'firebase/firestore';
import type { CategoriaEquipo, CategoriaModulo, Sistema, ModuloSistema } from '@ags/shared';
import { db, getCreateTrace, getUpdateTrace, deepCleanForFirestore, createBatch, newDocRef, docRef, batchAudit } from './firebase';
import { establecimientosService } from './establecimientosService';

// Servicio para Categorias Equipo
export const categoriasEquipoService = {
  // Crear categoria
  async create(categoriaData: Omit<CategoriaEquipo, 'id'>) {
    console.log('Creando categoria:', categoriaData.nombre);
    const payload = {
      ...categoriaData,
      ...getCreateTrace(),
      modelos: categoriaData.modelos || [],
    };
    const ref = newDocRef('categorias_equipo');
    const batch = createBatch();
    batch.set(ref, payload);
    batchAudit(batch, { action: 'create', collection: 'categorias_equipo', documentId: ref.id, after: payload as any });
    await batch.commit();
    console.log('Categoria creada exitosamente con ID:', ref.id);
    return ref.id;
  },

  // Obtener todas las categorias
  async getAll() {
    console.log('Cargando categorias desde Firestore...');
    const q = query(collection(db, 'categorias_equipo'));
    const querySnapshot = await getDocs(q);
    const categorias = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as CategoriaEquipo[];

    // Normalizar modelos para categorias viejas
    for (const c of categorias) {
      if (!Array.isArray(c.modelos)) c.modelos = [];
    }

    // Ordenar en memoria mientras se construyen los indices
    categorias.sort((a, b) => a.nombre.localeCompare(b.nombre));

    console.log(`${categorias.length} categorias cargadas`);
    return categorias;
  },

  // Obtener categoria por ID
  async getById(id: string) {
    const ref = doc(db, 'categorias_equipo', id);
    const docSnap = await getDoc(ref);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as CategoriaEquipo;
    }
    return null;
  },

  // Actualizar categoria
  async update(id: string, data: Partial<Omit<CategoriaEquipo, 'id'>>) {
    const payload = {
      ...data,
      ...getUpdateTrace(),
      ...(data.modelos ? { modelos: data.modelos } : {}),
    };
    const batch = createBatch();
    batch.update(docRef('categorias_equipo', id), payload);
    batchAudit(batch, { action: 'update', collection: 'categorias_equipo', documentId: id, after: payload as any });
    await batch.commit();
  },

  // Eliminar categoria
  async delete(id: string) {
    const batch = createBatch();
    batch.delete(docRef('categorias_equipo', id));
    batchAudit(batch, { action: 'delete', collection: 'categorias_equipo', documentId: id });
    await batch.commit();
  },

  /** Real-time subscription. Returns unsubscribe function. */
  subscribe(
    callback: (categorias: CategoriaEquipo[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    const q = query(collection(db, 'categorias_equipo'));
    return onSnapshot(q, snap => {
      const categorias = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
      })) as CategoriaEquipo[];
      for (const c of categorias) {
        if (!Array.isArray(c.modelos)) c.modelos = [];
      }
      categorias.sort((a, b) => a.nombre.localeCompare(b.nombre));
      callback(categorias);
    }, err => {
      console.error('categorias_equipo subscription error:', err);
      onError?.(err);
    });
  },
};

// Servicio para Categorias de Modulos
export const categoriasModuloService = {
  // Crear categoria de modulo
  async create(categoriaData: Omit<CategoriaModulo, 'id'>) {
    console.log('Creando categoria de modulo:', categoriaData.nombre);
    const payload = {
      ...categoriaData,
      ...getCreateTrace(),
      modelos: categoriaData.modelos || [],
    };
    const ref = newDocRef('categorias_modulo');
    const batch = createBatch();
    batch.set(ref, payload);
    batchAudit(batch, { action: 'create', collection: 'categorias_modulo', documentId: ref.id, after: payload as any });
    await batch.commit();
    console.log('Categoria de modulo creada exitosamente con ID:', ref.id);
    return ref.id;
  },

  // Obtener todas las categorias de modulos
  async getAll() {
    console.log('Cargando categorias de modulos desde Firestore...');
    const q = query(collection(db, 'categorias_modulo'));
    const querySnapshot = await getDocs(q);
    const categorias = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as CategoriaModulo[];

    // Normalizar modelos para categorias viejas
    for (const c of categorias) {
      if (!Array.isArray(c.modelos)) c.modelos = [];
    }

    // Ordenar en memoria
    categorias.sort((a, b) => a.nombre.localeCompare(b.nombre));

    console.log(`${categorias.length} categorias de modulos cargadas`);
    return categorias;
  },

  // Obtener categoria de modulo por ID
  async getById(id: string) {
    const ref = doc(db, 'categorias_modulo', id);
    const docSnap = await getDoc(ref);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as CategoriaModulo;
    }
    return null;
  },

  // Actualizar categoria de modulo
  async update(id: string, data: Partial<Omit<CategoriaModulo, 'id'>>) {
    const payload = {
      ...data,
      ...getUpdateTrace(),
      ...(data.modelos ? { modelos: data.modelos } : {}),
    };
    const batch = createBatch();
    batch.update(docRef('categorias_modulo', id), payload);
    batchAudit(batch, { action: 'update', collection: 'categorias_modulo', documentId: id, after: payload as any });
    await batch.commit();
  },

  // Eliminar categoria de modulo
  async delete(id: string) {
    const batch = createBatch();
    batch.delete(docRef('categorias_modulo', id));
    batchAudit(batch, { action: 'delete', collection: 'categorias_modulo', documentId: id });
    await batch.commit();
  },

  /** Real-time subscription. Returns unsubscribe function. */
  subscribe(
    callback: (categorias: CategoriaModulo[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    const q = query(collection(db, 'categorias_modulo'));
    return onSnapshot(q, snap => {
      const categorias = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
      })) as CategoriaModulo[];
      for (const c of categorias) {
        if (!Array.isArray(c.modelos)) c.modelos = [];
      }
      categorias.sort((a, b) => a.nombre.localeCompare(b.nombre));
      callback(categorias);
    }, err => {
      console.error('categorias_modulo subscription error:', err);
      onError?.(err);
    });
  },
};

// Servicio para Sistemas (establecimientoId requerido; clienteId opcional durante migracion)
export const sistemasService = {
  // Crear sistema. Requiere establecimientoId.
  async create(sistemaData: Omit<Sistema, 'id' | 'createdAt' | 'updatedAt'>) {
    if (!sistemaData.establecimientoId) {
      throw new Error('sistemasService.create: establecimientoId es requerido');
    }
    console.log('Creando sistema:', sistemaData.nombre);
    const payload = {
      ...sistemaData,
      ...getCreateTrace(),
      ubicaciones: sistemaData.ubicaciones || [],
      otIds: sistemaData.otIds || [],
      activo: sistemaData.activo !== undefined ? sistemaData.activo : true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    const ref = newDocRef('sistemas');
    const batch = createBatch();
    batch.set(ref, payload);
    batchAudit(batch, { action: 'create', collection: 'sistemas', documentId: ref.id, after: payload as any });
    await batch.commit();
    console.log('Sistema creado exitosamente con ID:', ref.id);
    return ref.id;
  },

  // Obtener todos los sistemas. Filtros: establecimientoId, clienteCuit (resuelve a establecimientos del cliente), activosOnly.
  async getAll(filters?: { establecimientoId?: string; clienteCuit?: string; clienteId?: string; activosOnly?: boolean }) {
    console.log('Cargando sistemas desde Firestore...');
    let q;
    if (filters?.establecimientoId) {
      q = query(collection(db, 'sistemas'), where('establecimientoId', '==', filters.establecimientoId));
    } else if (filters?.clienteId) {
      // Migracion: seguir soportando filtro por clienteId si existe en documentos
      q = query(collection(db, 'sistemas'), where('clienteId', '==', filters.clienteId));
    } else if (filters?.activosOnly) {
      q = query(collection(db, 'sistemas'), where('activo', '==', true));
    } else {
      q = query(collection(db, 'sistemas'));
    }
    const querySnapshot = await getDocs(q);
    let sistemas = querySnapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate().toISOString(),
      updatedAt: d.data().updatedAt?.toDate().toISOString(),
    })) as Sistema[];
    // Si se filtro por clienteCuit, resolver establecimientos y filtrar en memoria
    // Incluir tambien sistemas que tengan clienteId/clienteCuit directo (datos de migracion sin establecimientoId)
    if (filters?.clienteCuit && !filters?.establecimientoId) {
      const establecimientos = await establecimientosService.getByCliente(filters.clienteCuit);
      const estIds = new Set(establecimientos.map(e => e.id));
      sistemas = sistemas.filter(s =>
        (s.establecimientoId && estIds.has(s.establecimientoId)) ||
        (s as any).clienteCuit === filters.clienteCuit ||
        (s as any).clienteId === filters.clienteCuit
      );
    }
    if (filters?.activosOnly) {
      sistemas = sistemas.filter(s => s.activo === true);
    }
    sistemas.sort((a, b) => a.nombre.localeCompare(b.nombre));
    console.log(`${sistemas.length} sistemas cargados`);
    return sistemas;
  },

  // Obtener sistema por ID
  async getById(id: string) {
    const ref = doc(db, 'sistemas', id);
    const docSnap = await getDoc(ref);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        ubicaciones: data.ubicaciones || [],
        otIds: data.otIds || [],
        createdAt: data.createdAt?.toDate().toISOString(),
        updatedAt: data.updatedAt?.toDate().toISOString(),
      } as Sistema;
    }
    return null;
  },

  // Actualizar sistema
  async update(id: string, data: Partial<Omit<Sistema, 'id' | 'createdAt' | 'updatedAt'>>) {
    const payload = {
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    };
    const batch = createBatch();
    batch.update(docRef('sistemas', id), payload);
    batchAudit(batch, { action: 'update', collection: 'sistemas', documentId: id, after: payload as any });
    await batch.commit();
  },

  // Baja logica
  async deactivate(id: string) {
    await this.update(id, { activo: false });
  },

  // Genera el proximo ID visible legible (AGS-EQ-XXXX)
  async generateNextAgsVisibleId(): Promise<string> {
    const q = query(collection(db, 'sistemas'), where('agsVisibleId', '!=', null));
    const snap = await getDocs(q);
    let max = 0;
    snap.docs.forEach(d => {
      const vid: string = d.data().agsVisibleId || '';
      const match = vid.match(/^AGS-EQ-(\d+)$/);
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `AGS-EQ-${String(max + 1).padStart(4, '0')}`;
  },

  // Eliminar sistema (elimina tambien todos sus modulos)
  async delete(id: string) {
    console.log('Eliminando sistema:', id);

    // Primero eliminar todos los modulos del sistema
    try {
      const modulosSnapshot = await getDocs(collection(db, 'sistemas', id, 'modulos'));
      const deletePromises = modulosSnapshot.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);
      console.log(`${modulosSnapshot.docs.length} modulos eliminados`);
    } catch (error) {
      console.error('Error eliminando modulos:', error);
      // Continuar con la eliminacion del sistema aunque falle la eliminacion de modulos
    }

    // Luego eliminar el sistema
    const batch = createBatch();
    batch.delete(docRef('sistemas', id));
    batchAudit(batch, { action: 'delete', collection: 'sistemas', documentId: id });
    await batch.commit();
    console.log('Sistema eliminado exitosamente');
  },

  /** Real-time subscription with optional filters. Returns unsubscribe function. */
  subscribe(
    filters: { establecimientoId?: string; clienteId?: string; activosOnly?: boolean } | undefined,
    callback: (sistemas: Sistema[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    let q;
    if (filters?.establecimientoId) {
      q = query(collection(db, 'sistemas'), where('establecimientoId', '==', filters.establecimientoId));
    } else if (filters?.clienteId) {
      q = query(collection(db, 'sistemas'), where('clienteId', '==', filters.clienteId));
    } else if (filters?.activosOnly) {
      q = query(collection(db, 'sistemas'), where('activo', '==', true));
    } else {
      q = query(collection(db, 'sistemas'));
    }
    return onSnapshot(q, snap => {
      let sistemas = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate().toISOString(),
        updatedAt: d.data().updatedAt?.toDate().toISOString(),
      })) as Sistema[];
      if (filters?.activosOnly) {
        sistemas = sistemas.filter(s => s.activo === true);
      }
      sistemas.sort((a, b) => a.nombre.localeCompare(b.nombre));
      callback(sistemas);
    }, err => {
      console.error('sistemas subscription error:', err);
      onError?.(err);
    });
  },
};

// Servicio para Modulos (subcoleccion de sistemas)
export const modulosService = {
  // Crear modulo (subcollection — uses addDoc directly)
  async create(sistemaId: string, moduloData: Omit<ModuloSistema, 'id' | 'sistemaId'>) {
    console.log('Creando modulo para sistema:', sistemaId);

    const cleanedData = deepCleanForFirestore({
      ...moduloData,
      sistemaId,
      ubicaciones: moduloData.ubicaciones || [],
      otIds: moduloData.otIds || [],
    });

    const ref = await addDoc(collection(db, 'sistemas', sistemaId, 'modulos'), cleanedData);
    console.log('Modulo creado exitosamente con ID:', ref.id);
    return ref.id;
  },

  // Obtener todos los modulos de un sistema
  async getBySistema(sistemaId: string) {
    const querySnapshot = await getDocs(collection(db, 'sistemas', sistemaId, 'modulos'));
    return querySnapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
      sistemaId,
    })) as ModuloSistema[];
  },

  // Obtener modulo por ID
  async getById(sistemaId: string, moduloId: string) {
    const ref = doc(db, 'sistemas', sistemaId, 'modulos', moduloId);
    const docSnap = await getDoc(ref);
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
        sistemaId,
      } as ModuloSistema;
    }
    return null;
  },

  // Actualizar modulo (subcollection — uses updateDoc directly)
  async update(sistemaId: string, moduloId: string, data: Partial<Omit<ModuloSistema, 'id' | 'sistemaId'>>) {
    const ref = doc(db, 'sistemas', sistemaId, 'modulos', moduloId);
    await updateDoc(ref, deepCleanForFirestore(data));
  },

  // Eliminar modulo (subcollection — uses deleteDoc directly)
  async delete(sistemaId: string, moduloId: string) {
    await deleteDoc(doc(db, 'sistemas', sistemaId, 'modulos', moduloId));
  },

  // Mover modulo a otro sistema
  async move(sourceSistemaId: string, moduloId: string, targetSistemaId: string) {
    console.log(`Moviendo modulo ${moduloId} de ${sourceSistemaId} a ${targetSistemaId}`);
    const modulo = await this.getById(sourceSistemaId, moduloId);
    if (!modulo) throw new Error('Modulo no encontrado');
    const { id: _id, sistemaId: _sid, ...data } = modulo;
    const newId = await this.create(targetSistemaId, data);
    await this.delete(sourceSistemaId, moduloId);
    const batch = createBatch();
    batchAudit(batch, { action: 'update', collection: 'modulos', documentId: moduloId, after: { movedFrom: sourceSistemaId, movedTo: targetSistemaId, newId } as any });
    await batch.commit();
    console.log(`Modulo movido exitosamente. Nuevo ID: ${newId}`);
    return newId;
  },
};
