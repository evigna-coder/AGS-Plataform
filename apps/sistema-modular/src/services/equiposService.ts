import { collection, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where, Timestamp, addDoc } from 'firebase/firestore';
import type { CategoriaEquipo, CategoriaModulo, Sistema, ModuloSistema } from '@ags/shared';
import { db, getCreateTrace, getUpdateTrace, deepCleanForFirestore, createBatch, newDocRef, docRef, batchAudit, onSnapshot } from './firebase';
import { establecimientosService } from './establecimientosService';
import { getCached, setCache, invalidateCache } from './serviceCache';

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
    batchAudit(batch, { action: 'create', collection: 'categorias_equipo', documentId: ref.id, after: payload });
    await batch.commit();
    invalidateCache("categorias_equipo");
    console.log('Categoria creada exitosamente con ID:', ref.id);
    return ref.id;
  },

  // Obtener todas las categorias
  async getAll() {
    const cached = getCached<CategoriaEquipo[]>('categorias_equipo');
    if (cached) return cached;

    const q = query(collection(db, 'categorias_equipo'));
    const querySnapshot = await getDocs(q);
    const categorias = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as CategoriaEquipo[];

    for (const c of categorias) {
      if (!Array.isArray(c.modelos)) c.modelos = [];
    }

    categorias.sort((a, b) => a.nombre.localeCompare(b.nombre));
    setCache('categorias_equipo', categorias);
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
    batchAudit(batch, { action: 'update', collection: 'categorias_equipo', documentId: id, after: payload });
    await batch.commit();
    invalidateCache("categorias_equipo");
  },

  // Eliminar categoria
  async delete(id: string) {
    const batch = createBatch();
    batch.delete(docRef('categorias_equipo', id));
    batchAudit(batch, { action: 'delete', collection: 'categorias_equipo', documentId: id });
    await batch.commit();
    invalidateCache("categorias_equipo");
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
    batchAudit(batch, { action: 'create', collection: 'categorias_modulo', documentId: ref.id, after: payload });
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
    batchAudit(batch, { action: 'update', collection: 'categorias_modulo', documentId: id, after: payload });
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
    batchAudit(batch, { action: 'create', collection: 'sistemas', documentId: ref.id, after: payload });
    await batch.commit();
    invalidateCache('sistemas');
    return ref.id;
  },

  // Obtener todos los sistemas. Filtros: establecimientoId, clienteCuit (resuelve a establecimientos del cliente), activosOnly.
  async getAll(filters?: { establecimientoId?: string; clienteCuit?: string; clienteId?: string; activosOnly?: boolean }) {
    const cacheKey = `sistemas:${JSON.stringify(filters || {})}`;
    const cached = getCached<Sistema[]>(cacheKey);
    if (cached) return cached;

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
    setCache(cacheKey, sistemas);
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

  /** Real-time subscription to a single sistema. Returns unsubscribe function. */
  subscribeById(id: string, callback: (sistema: Sistema | null) => void, onError?: (err: Error) => void): () => void {
    return onSnapshot(doc(db, 'sistemas', id), snap => {
      if (!snap.exists()) { callback(null); return; }
      const data = snap.data();
      callback({
        id: snap.id,
        ...data,
        ubicaciones: data.ubicaciones || [],
        otIds: data.otIds || [],
        createdAt: data.createdAt?.toDate().toISOString(),
        updatedAt: data.updatedAt?.toDate().toISOString(),
      } as Sistema);
    }, err => { console.error('Sistema subscription error:', err); onError?.(err); });
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
    batchAudit(batch, { action: 'update', collection: 'sistemas', documentId: id, after: payload });
    await batch.commit();
    invalidateCache('sistemas');
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

  /**
   * Eliminar sistema (elimina también todos sus módulos).
   *
   * Pre-valida referencias activas en otras colecciones — si hay OTs activas
   * (no FINALIZADO), presupuestos no anulados o contratos activos vinculados,
   * rechaza la eliminación. Sin esto, sus referencias quedaban con sistemaId
   * apuntando a un sistema borrado y los reportes técnicos se rompían.
   */
  async delete(id: string) {
    console.log('Eliminando sistema:', id);

    // Pre-validación de referencias activas
    const [otsSnap, ppsSnap] = await Promise.all([
      getDocs(query(collection(db, 'reportes'), where('sistemaId', '==', id))),
      getDocs(query(collection(db, 'presupuestos'), where('sistemaId', '==', id))),
    ]);
    const otsActivas = otsSnap.docs.filter(d => d.data().estadoAdmin && d.data().estadoAdmin !== 'FINALIZADO');
    const ppsActivos = ppsSnap.docs.filter(d => d.data().estado && d.data().estado !== 'anulado');

    if (otsActivas.length > 0 || ppsActivos.length > 0) {
      const detalles: string[] = [];
      if (otsActivas.length > 0) detalles.push(`${otsActivas.length} OT(s) activa(s)`);
      if (ppsActivos.length > 0) detalles.push(`${ppsActivos.length} presupuesto(s) no anulado(s)`);
      throw new Error(
        `No se puede eliminar el sistema: tiene ${detalles.join(' y ')} vinculadas. Finalizar/anular primero o usar baja lógica (activo: false).`,
      );
    }

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

  /**
   * Busca grupos de sistemas duplicados (mismo nombre + clienteId + codigoInternoCliente)
   * y carga sus módulos. El sistema con más módulos queda como `masterId` por default
   * (desempate: ID más corto, suele ser el original); el caller puede override.
   */
  async findDuplicateGroups(opts?: {
    onProgress?: (msg: string) => void;
    isCancelled?: () => boolean;
  }): Promise<{
    key: string;
    nombre: string;
    clienteId: string;
    clienteNombre: string;
    sistemas: {
      id: string;
      nombre: string;
      codigoInterno: string;
      establecimientoId: string;
      moduloCount: number;
      modulos: { id: string; nombre: string; serie: string; data: Record<string, unknown> }[];
    }[];
    masterId: string;
  }[]> {
    const onProgress = opts?.onProgress ?? (() => {});
    const isCancelled = opts?.isCancelled ?? (() => false);

    onProgress('Cargando sistemas...');
    const sistemasSnap = await getDocs(collection(db, 'sistemas'));
    const allSistemas = sistemasSnap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        nombre: (data.nombre || '') as string,
        clienteId: (data.clienteId || data.clienteCuit || '') as string,
        establecimientoId: (data.establecimientoId || '') as string,
        codigoInterno: (data.codigoInternoCliente || '') as string,
      };
    });
    onProgress(`${allSistemas.length} sistemas encontrados.`);

    onProgress('Cargando clientes...');
    const clientesSnap = await getDocs(collection(db, 'clientes'));
    const clienteNames = new Map<string, string>();
    clientesSnap.docs.forEach(d => {
      const data = d.data();
      clienteNames.set(d.id, (data.razonSocial || d.id) as string);
    });

    // Agrupar por nombre + clienteId + codigoInterno (distinto código = equipos diferentes)
    const byKey = new Map<string, typeof allSistemas>();
    for (const s of allSistemas) {
      if (!s.nombre || !s.clienteId) continue;
      const code = s.codigoInterno.trim().toLowerCase();
      const key = `${s.nombre.trim().toLowerCase()}|${s.clienteId}|${code}`;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key)!.push(s);
    }

    const dupGroups = [...byKey.entries()].filter(([, arr]) => arr.length > 1);
    onProgress(`${dupGroups.length} grupos de sistemas duplicados encontrados.`);

    if (dupGroups.length === 0) return [];

    onProgress('Cargando módulos de sistemas duplicados...');
    const resultGroups: Awaited<ReturnType<typeof sistemasService.findDuplicateGroups>> = [];
    let processed = 0;

    for (const [key, sistemas] of dupGroups) {
      if (isCancelled()) break;

      const parts = key.split('|');
      const clienteId = parts[1];
      const sistemasWithModulos = [];

      for (const s of sistemas) {
        const modulosSnap = await getDocs(collection(db, 'sistemas', s.id, 'modulos'));
        const modulos = modulosSnap.docs.map(d => ({
          id: d.id,
          nombre: (d.data().nombre || '') as string,
          serie: (d.data().serie || '') as string,
          data: d.data() as Record<string, unknown>,
        }));
        sistemasWithModulos.push({ ...s, moduloCount: modulos.length, modulos });
      }

      // Master = el que tiene más módulos, desempate por ID más corto
      sistemasWithModulos.sort((a, b) => b.moduloCount - a.moduloCount || a.id.length - b.id.length);

      resultGroups.push({
        key,
        nombre: sistemas[0].nombre,
        clienteId,
        clienteNombre: clienteNames.get(clienteId) || clienteId,
        sistemas: sistemasWithModulos,
        masterId: sistemasWithModulos[0].id,
      });

      processed++;
      if (processed % 10 === 0) onProgress(`${processed}/${dupGroups.length} grupos procesados...`);
    }

    return resultGroups;
  },

  /**
   * Unifica un grupo de sistemas duplicados moviendo los módulos del/los duplicado(s)
   * al maestro y eliminando los sistemas vacíos. Skipea módulos con serie ya presente
   * en el maestro (los borra del duplicado para no perderlos en limbo).
   */
  async mergeDuplicateGroup(
    group: {
      sistemas: { id: string; codigoInterno: string; modulos: { id: string; nombre: string; serie: string; data: Record<string, unknown> }[] }[];
    },
    masterId: string,
    opts?: { onProgress?: (msg: string) => void },
  ): Promise<{ moved: number; deletedSistemas: number }> {
    const onProgress = opts?.onProgress ?? (() => {});
    const master = group.sistemas.find(s => s.id === masterId);
    if (!master) throw new Error(`Master sistemaId ${masterId} no encontrado en el grupo`);
    const duplicates = group.sistemas.filter(s => s.id !== masterId);

    const masterSeries = new Set(master.modulos.map(m => m.serie?.trim().toLowerCase()).filter(Boolean));
    let moved = 0;
    let deletedSistemas = 0;

    for (const dup of duplicates) {
      for (const mod of dup.modulos) {
        const serieKey = mod.serie?.trim().toLowerCase();
        if (serieKey && masterSeries.has(serieKey)) {
          onProgress(`  SKIP módulo "${mod.nombre}" S/N:${mod.serie} (ya existe en maestro)`);
          try {
            await deleteDoc(doc(db, 'sistemas', dup.id, 'modulos', mod.id));
          } catch { /* ignore */ }
          continue;
        }

        try {
          const modData = { ...mod.data, sistemaId: masterId };
          await addDoc(collection(db, 'sistemas', masterId, 'modulos'), modData);
          await deleteDoc(doc(db, 'sistemas', dup.id, 'modulos', mod.id));
          moved++;
          if (serieKey) masterSeries.add(serieKey);
        } catch (e) {
          onProgress(`  ERROR moviendo módulo ${mod.id}: ${e}`);
        }
      }

      // Verificar que el duplicado quedó vacío antes de eliminarlo
      const remainingSnap = await getDocs(collection(db, 'sistemas', dup.id, 'modulos'));
      if (remainingSnap.empty) {
        try {
          await deleteDoc(doc(db, 'sistemas', dup.id));
          deletedSistemas++;
          onProgress(`  Eliminado sistema duplicado ${dup.codigoInterno || dup.id}`);
        } catch (e) {
          onProgress(`  ERROR eliminando sistema ${dup.id}: ${e}`);
        }
      } else {
        onProgress(`  WARN: sistema ${dup.id} aún tiene ${remainingSnap.size} módulos, no se eliminó`);
      }
    }

    return { moved, deletedSistemas };
  },

  /**
   * Escanea sistemas con `establecimientoId` faltante o inválido y propone fixes
   * automáticos cuando el cliente tiene un único establecimiento. Sistemas de
   * clientes con múltiples establecimientos se loguean para resolución manual.
   */
  async scanOrphanedEstablecimientos(opts?: {
    onProgress?: (msg: string) => void;
    isCancelled?: () => boolean;
  }): Promise<{
    pendingFixes: { sistemaId: string; sistemaNombre: string; clienteId: string; oldEstId: string; newEstId: string; newEstNombre: string }[];
    summary: { totalSistemas: number; sinEstablecimiento: number; invalidos: number };
  }> {
    const onProgress = opts?.onProgress ?? (() => {});
    const isCancelled = opts?.isCancelled ?? (() => false);

    onProgress('Cargando sistemas y establecimientos...');
    const sistemasSnap = await getDocs(collection(db, 'sistemas'));
    const sistemas = sistemasSnap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        nombre: (data.nombre || '') as string,
        establecimientoId: (data.establecimientoId || '') as string,
        clienteId: (data.clienteId || data.clienteCuit || '') as string,
      };
    });
    onProgress(`${sistemas.length} sistemas cargados.`);

    const sinEstablecimiento = sistemas.filter(s => !s.establecimientoId);
    onProgress(`${sinEstablecimiento.length} sistemas sin establecimiento asignado.`);

    const estSnap = await getDocs(collection(db, 'establecimientos'));
    const establecimientos = estSnap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        nombre: (data.nombre || '') as string,
        clienteCuit: (data.clienteCuit || data.clienteId || '') as string,
      };
    });
    const estIds = new Set(establecimientos.map(e => e.id));
    const invalidos = sistemas.filter(s => s.establecimientoId && !estIds.has(s.establecimientoId));
    onProgress(`${establecimientos.length} establecimientos cargados.`);

    if (sinEstablecimiento.length === 0 && invalidos.length === 0) {
      onProgress('Todos los sistemas tienen establecimiento válido.');
      return { pendingFixes: [], summary: { totalSistemas: sistemas.length, sinEstablecimiento: 0, invalidos: 0 } };
    }

    const estByCliente = new Map<string, typeof establecimientos>();
    for (const e of establecimientos) {
      if (!e.clienteCuit) continue;
      if (!estByCliente.has(e.clienteCuit)) estByCliente.set(e.clienteCuit, []);
      estByCliente.get(e.clienteCuit)!.push(e);
    }

    const pendingFixes: { sistemaId: string; sistemaNombre: string; clienteId: string; oldEstId: string; newEstId: string; newEstNombre: string }[] = [];
    const problemSistemas = sistemas.filter(s => !s.establecimientoId);

    for (const s of problemSistemas) {
      if (isCancelled()) break;
      if (!s.clienteId) {
        onProgress(`SKIP: Sistema "${s.nombre}" (${s.id}) sin clienteId`);
        continue;
      }
      const clienteEstabs = estByCliente.get(s.clienteId) || [];
      if (clienteEstabs.length === 0) {
        onProgress(`SKIP: Sistema "${s.nombre}" - cliente ${s.clienteId} sin establecimientos`);
        continue;
      }
      if (clienteEstabs.length === 1) {
        pendingFixes.push({
          sistemaId: s.id,
          sistemaNombre: s.nombre,
          clienteId: s.clienteId,
          oldEstId: s.establecimientoId,
          newEstId: clienteEstabs[0].id,
          newEstNombre: clienteEstabs[0].nombre,
        });
      } else {
        onProgress(`MANUAL: Sistema "${s.nombre}" - cliente tiene ${clienteEstabs.length} establecimientos: ${clienteEstabs.map(e => e.nombre).join(', ')}`);
      }
    }

    return {
      pendingFixes,
      summary: { totalSistemas: sistemas.length, sinEstablecimiento: sinEstablecimiento.length, invalidos: invalidos.length },
    };
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
    batchAudit(batch, { action: 'update', collection: 'modulos', documentId: moduloId, after: { movedFrom: sourceSistemaId, movedTo: targetSistemaId, newId } });
    await batch.commit();
    console.log(`Modulo movido exitosamente. Nuevo ID: ${newId}`);
    return newId;
  },

  /**
   * Escanea todos los sistemas buscando módulos con número de serie duplicado dentro
   * del mismo sistema. Conserva el más antiguo (por createdAt) y devuelve los demás
   * para que el caller decida qué hacer.
   *
   * Acepta callbacks opcionales (onProgress, isCancelled) porque corre en background
   * task con UI de progreso. Sin callbacks funciona como scan one-shot.
   */
  async findDuplicatesBySerie(opts?: {
    onProgress?: (msg: string) => void;
    isCancelled?: () => boolean;
  }): Promise<{
    totalModulos: number;
    duplicates: { sistemaId: string; moduloId: string; serie: string; sistemaNombre: string }[];
  }> {
    const onProgress = opts?.onProgress ?? (() => {});
    const isCancelled = opts?.isCancelled ?? (() => false);

    onProgress('Cargando todos los sistemas...');
    const sistemasSnap = await getDocs(collection(db, 'sistemas'));
    const sistemas = sistemasSnap.docs.map(d => ({ id: d.id, nombre: (d.data().nombre || d.id) as string }));
    onProgress(`${sistemas.length} sistemas encontrados. Escaneando modulos...`);

    const duplicates: { sistemaId: string; moduloId: string; serie: string; sistemaNombre: string }[] = [];
    let totalModulos = 0;

    for (const sistema of sistemas) {
      if (isCancelled()) break;

      const modulosSnap = await getDocs(collection(db, 'sistemas', sistema.id, 'modulos'));
      const modulos = modulosSnap.docs.map(d => ({
        id: d.id,
        serie: (d.data().serie || '') as string,
        createdAt: d.data().createdAt as { seconds?: number } | undefined,
      }));
      totalModulos += modulos.length;

      const bySerie = new Map<string, typeof modulos>();
      for (const m of modulos) {
        if (!m.serie) continue;
        const key = m.serie.trim().toLowerCase();
        if (!key) continue;
        if (!bySerie.has(key)) bySerie.set(key, []);
        bySerie.get(key)!.push(m);
      }

      for (const [serie, group] of bySerie) {
        if (group.length <= 1) continue;
        group.sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0));
        for (let i = 1; i < group.length; i++) {
          duplicates.push({ sistemaId: sistema.id, moduloId: group[i].id, serie, sistemaNombre: sistema.nombre });
        }
      }
    }

    return { totalModulos, duplicates };
  },
};
