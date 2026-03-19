import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where, Timestamp } from 'firebase/firestore';
import type { CategoriaEquipo, CategoriaModulo, Sistema, ModuloSistema } from '@ags/shared';
import { db, logAudit, getCreateTrace, getUpdateTrace } from './firebase';
import { establecimientosService } from './establecimientosService';

// Servicio para Categorías Equipo
export const categoriasEquipoService = {
  // Crear categoría
  async create(categoriaData: Omit<CategoriaEquipo, 'id'>) {
    console.log('📝 Creando categoría:', categoriaData.nombre);
    const payload = {
      ...categoriaData,
      ...getCreateTrace(),
      modelos: categoriaData.modelos || [],
    };
    const docRef = await addDoc(collection(db, 'categorias_equipo'), payload);
    logAudit({ action: 'create', collection: 'categorias_equipo', documentId: docRef.id, after: payload as any });
    console.log('✅ Categoría creada exitosamente con ID:', docRef.id);
    return docRef.id;
  },

  // Obtener todas las categorías
  async getAll() {
    console.log('📥 Cargando categorías desde Firestore...');
    const q = query(collection(db, 'categorias_equipo'));
    const querySnapshot = await getDocs(q);
    const categorias = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as CategoriaEquipo[];

    // Normalizar modelos para categorías viejas
    for (const c of categorias) {
      if (!Array.isArray(c.modelos)) c.modelos = [];
    }

    // Ordenar en memoria mientras se construyen los índices
    categorias.sort((a, b) => a.nombre.localeCompare(b.nombre));

    console.log(`✅ ${categorias.length} categorías cargadas`);
    return categorias;
  },

  // Obtener categoría por ID
  async getById(id: string) {
    const docRef = doc(db, 'categorias_equipo', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as CategoriaEquipo;
    }
    return null;
  },

  // Actualizar categoría
  async update(id: string, data: Partial<Omit<CategoriaEquipo, 'id'>>) {
    const docRef = doc(db, 'categorias_equipo', id);
    const payload = {
      ...data,
      ...getUpdateTrace(),
      ...(data.modelos ? { modelos: data.modelos } : {}),
    };
    await updateDoc(docRef, payload);
    logAudit({ action: 'update', collection: 'categorias_equipo', documentId: id, after: payload as any });
  },

  // Eliminar categoría
  async delete(id: string) {
    logAudit({ action: 'delete', collection: 'categorias_equipo', documentId: id });
    await deleteDoc(doc(db, 'categorias_equipo', id));
  },
};

// Servicio para Categorías de Módulos
export const categoriasModuloService = {
  // Crear categoría de módulo
  async create(categoriaData: Omit<CategoriaModulo, 'id'>) {
    console.log('📝 Creando categoría de módulo:', categoriaData.nombre);
    const payload = {
      ...categoriaData,
      ...getCreateTrace(),
      modelos: categoriaData.modelos || [],
    };
    const docRef = await addDoc(collection(db, 'categorias_modulo'), payload);
    logAudit({ action: 'create', collection: 'categorias_modulo', documentId: docRef.id, after: payload as any });
    console.log('✅ Categoría de módulo creada exitosamente con ID:', docRef.id);
    return docRef.id;
  },

  // Obtener todas las categorías de módulos
  async getAll() {
    console.log('📥 Cargando categorías de módulos desde Firestore...');
    const q = query(collection(db, 'categorias_modulo'));
    const querySnapshot = await getDocs(q);
    const categorias = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as CategoriaModulo[];

    // Normalizar modelos para categorías viejas
    for (const c of categorias) {
      if (!Array.isArray(c.modelos)) c.modelos = [];
    }

    // Ordenar en memoria
    categorias.sort((a, b) => a.nombre.localeCompare(b.nombre));

    console.log(`✅ ${categorias.length} categorías de módulos cargadas`);
    return categorias;
  },

  // Obtener categoría de módulo por ID
  async getById(id: string) {
    const docRef = doc(db, 'categorias_modulo', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as CategoriaModulo;
    }
    return null;
  },

  // Actualizar categoría de módulo
  async update(id: string, data: Partial<Omit<CategoriaModulo, 'id'>>) {
    const docRef = doc(db, 'categorias_modulo', id);
    const payload = {
      ...data,
      ...getUpdateTrace(),
      ...(data.modelos ? { modelos: data.modelos } : {}),
    };
    await updateDoc(docRef, payload);
    logAudit({ action: 'update', collection: 'categorias_modulo', documentId: id, after: payload as any });
  },

  // Eliminar categoría de módulo
  async delete(id: string) {
    logAudit({ action: 'delete', collection: 'categorias_modulo', documentId: id });
    await deleteDoc(doc(db, 'categorias_modulo', id));
  },
};

// Servicio para Sistemas (establecimientoId requerido; clienteId opcional durante migración)
export const sistemasService = {
  // Crear sistema. Requiere establecimientoId.
  async create(sistemaData: Omit<Sistema, 'id' | 'createdAt' | 'updatedAt'>) {
    if (!sistemaData.establecimientoId) {
      throw new Error('sistemasService.create: establecimientoId es requerido');
    }
    console.log('📝 Creando sistema:', sistemaData.nombre);
    const payload = {
      ...sistemaData,
      ...getCreateTrace(),
      ubicaciones: sistemaData.ubicaciones || [],
      otIds: sistemaData.otIds || [],
      activo: sistemaData.activo !== undefined ? sistemaData.activo : true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    const docRef = await addDoc(collection(db, 'sistemas'), payload);
    logAudit({ action: 'create', collection: 'sistemas', documentId: docRef.id, after: payload as any });
    console.log('✅ Sistema creado exitosamente con ID:', docRef.id);
    return docRef.id;
  },

  // Obtener todos los sistemas. Filtros: establecimientoId, clienteCuit (resuelve a establecimientos del cliente), activosOnly.
  async getAll(filters?: { establecimientoId?: string; clienteCuit?: string; clienteId?: string; activosOnly?: boolean }) {
    console.log('📥 Cargando sistemas desde Firestore...');
    let q;
    if (filters?.establecimientoId) {
      q = query(collection(db, 'sistemas'), where('establecimientoId', '==', filters.establecimientoId));
    } else if (filters?.clienteId) {
      // Migración: seguir soportando filtro por clienteId si existe en documentos
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
    // Si se filtró por clienteCuit, resolver establecimientos y filtrar en memoria
    // Incluir también sistemas que tengan clienteId/clienteCuit directo (datos de migración sin establecimientoId)
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
    console.log(`✅ ${sistemas.length} sistemas cargados`);
    return sistemas;
  },

  // Obtener sistema por ID
  async getById(id: string) {
    const docRef = doc(db, 'sistemas', id);
    const docSnap = await getDoc(docRef);
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
    const docRef = doc(db, 'sistemas', id);
    const payload = {
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    };
    await updateDoc(docRef, payload);
    logAudit({ action: 'update', collection: 'sistemas', documentId: id, after: payload as any });
  },

  // Baja lógica
  async deactivate(id: string) {
    await this.update(id, { activo: false });
  },

  // Genera el próximo ID visible legible (AGS-EQ-XXXX)
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

  // Eliminar sistema (elimina también todos sus módulos)
  async delete(id: string) {
    console.log('🗑️ Eliminando sistema:', id);
    logAudit({ action: 'delete', collection: 'sistemas', documentId: id });

    // Primero eliminar todos los módulos del sistema
    try {
      const modulosSnapshot = await getDocs(collection(db, 'sistemas', id, 'modulos'));
      const deletePromises = modulosSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      console.log(`✅ ${modulosSnapshot.docs.length} módulos eliminados`);
    } catch (error) {
      console.error('Error eliminando módulos:', error);
      // Continuar con la eliminación del sistema aunque falle la eliminación de módulos
    }

    // Luego eliminar el sistema
    await deleteDoc(doc(db, 'sistemas', id));
    console.log('✅ Sistema eliminado exitosamente');
  },
};

// Servicio para Módulos (subcolección de sistemas)
export const modulosService = {
  // Crear módulo
  async create(sistemaId: string, moduloData: Omit<ModuloSistema, 'id' | 'sistemaId'>) {
    console.log('📝 Creando módulo para sistema:', sistemaId);

    // Helper para limpiar undefined (Firestore no acepta undefined)
    const cleanData = (data: any): any => {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          cleaned[key] = value === '' ? null : value;
        }
      }
      return cleaned;
    };

    const cleanedData = cleanData({
      ...moduloData,
      sistemaId,
      ubicaciones: moduloData.ubicaciones || [],
      otIds: moduloData.otIds || [],
    });

    const docRef = await addDoc(collection(db, 'sistemas', sistemaId, 'modulos'), cleanedData);
    console.log('✅ Módulo creado exitosamente con ID:', docRef.id);
    return docRef.id;
  },

  // Obtener todos los módulos de un sistema
  async getBySistema(sistemaId: string) {
    const querySnapshot = await getDocs(collection(db, 'sistemas', sistemaId, 'modulos'));
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      sistemaId,
    })) as ModuloSistema[];
  },

  // Obtener módulo por ID
  async getById(sistemaId: string, moduloId: string) {
    const docRef = doc(db, 'sistemas', sistemaId, 'modulos', moduloId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
        sistemaId,
      } as ModuloSistema;
    }
    return null;
  },

  // Actualizar módulo
  async update(sistemaId: string, moduloId: string, data: Partial<Omit<ModuloSistema, 'id' | 'sistemaId'>>) {
    // Helper para limpiar undefined (Firestore no acepta undefined)
    const cleanData = (data: any): any => {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          cleaned[key] = value === '' ? null : value;
        }
      }
      return cleaned;
    };

    const docRef = doc(db, 'sistemas', sistemaId, 'modulos', moduloId);
    await updateDoc(docRef, cleanData(data));
  },

  // Eliminar módulo
  async delete(sistemaId: string, moduloId: string) {
    await deleteDoc(doc(db, 'sistemas', sistemaId, 'modulos', moduloId));
  },

  // Mover módulo a otro sistema
  async move(sourceSistemaId: string, moduloId: string, targetSistemaId: string) {
    console.log(`📦 Moviendo módulo ${moduloId} de ${sourceSistemaId} a ${targetSistemaId}`);
    const modulo = await this.getById(sourceSistemaId, moduloId);
    if (!modulo) throw new Error('Módulo no encontrado');
    const { id: _id, sistemaId: _sid, ...data } = modulo;
    const newId = await this.create(targetSistemaId, data);
    await this.delete(sourceSistemaId, moduloId);
    logAudit({ action: 'update', collection: 'modulos', documentId: moduloId, after: { movedFrom: sourceSistemaId, movedTo: targetSistemaId, newId } as any });
    console.log(`✅ Módulo movido exitosamente. Nuevo ID: ${newId}`);
    return newId;
  },
};
