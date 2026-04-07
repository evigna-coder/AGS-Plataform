import { collection, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where, orderBy, Timestamp, setDoc, addDoc } from 'firebase/firestore';
import { deleteObject, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { TableCatalogEntry, InstrumentoPatron, CategoriaInstrumento, Marca } from '@ags/shared';
import { db, storage, createBatch, newDocRef, docRef, batchAudit, deepCleanForFirestore, getCreateTrace, getUpdateTrace, inTransition, onSnapshot } from './firebase';
import { getCached, setCache, invalidateCache } from './serviceCache';

// --- Biblioteca de Tablas (/tableCatalog) ---

function toTableCatalogEntry(id: string, data: any): TableCatalogEntry {
  return {
    id,
    ...data,
    createdAt: data.createdAt?.toDate().toISOString() ?? new Date().toISOString(),
    updatedAt: data.updatedAt?.toDate().toISOString() ?? new Date().toISOString(),
  } as TableCatalogEntry;
}

export const tableCatalogService = {
  async getAll(filters?: { sysType?: string; status?: string; projectId?: string | null }): Promise<TableCatalogEntry[]> {
    const q = query(collection(db, 'tableCatalog'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    let entries = snap.docs.map(d => toTableCatalogEntry(d.id, d.data()));
    if (filters?.sysType) entries = entries.filter(e => e.sysType === filters.sysType);
    if (filters?.status) entries = entries.filter(e => e.status === filters.status);
    if (filters?.projectId !== undefined) {
      entries = filters.projectId === null
        ? entries.filter(e => !e.projectId)
        : entries.filter(e => e.projectId === filters.projectId);
    }
    return entries;
  },

  async getById(id: string): Promise<TableCatalogEntry | null> {
    const snap = await getDoc(doc(db, 'tableCatalog', id));
    if (!snap.exists()) return null;
    return toTableCatalogEntry(snap.id, snap.data());
  },

  async save(entry: TableCatalogEntry): Promise<string> {
    const { id, createdAt: _ca, updatedAt: _ua, ...rest } = entry;
    const payload = {
      ...deepCleanForFirestore(rest),
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    };
    if (id) {
      const batch = createBatch();
      batch.set(docRef('tableCatalog', id), payload, { merge: true });
      batchAudit(batch, { action: 'update', collection: 'tableCatalog', documentId: id, after: payload as any });
      await batch.commit();
      return id;
    }
    const newId = crypto.randomUUID();
    const createPayload = { ...payload, ...getCreateTrace(), createdAt: Timestamp.now() };
    const batch = createBatch();
    batch.set(docRef('tableCatalog', newId), createPayload);
    batchAudit(batch, { action: 'create', collection: 'tableCatalog', documentId: newId, after: createPayload as any });
    await batch.commit();
    return newId;
  },

  async publish(id: string): Promise<void> {
    await updateDoc(doc(db, 'tableCatalog', id), { status: 'published', updatedAt: Timestamp.now() });
  },

  async archive(id: string): Promise<void> {
    await updateDoc(doc(db, 'tableCatalog', id), { status: 'archived', updatedAt: Timestamp.now() });
  },

  async clone(id: string, overrides?: { name?: string; sysType?: string; projectId?: string | null }): Promise<string> {
    const original = await this.getById(id);
    if (!original) throw new Error('Tabla no encontrada');
    const newId = crypto.randomUUID();
    const { createdAt: _ca, updatedAt: _ua, ...rest } = original;
    await setDoc(doc(db, 'tableCatalog', newId), {
      ...deepCleanForFirestore(rest),
      id: newId,
      name: overrides?.name || `${original.name} (copia)`,
      ...(overrides?.sysType ? { sysType: overrides.sysType } : {}),
      ...(overrides?.projectId !== undefined ? { projectId: overrides.projectId } : {}),
      status: 'draft',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return newId;
  },

  async saveMany(entries: TableCatalogEntry[]): Promise<string[]> {
    return Promise.all(entries.map(e => this.save(e)));
  },

  async delete(id: string): Promise<void> {
    const batch = createBatch();
    batch.delete(docRef('tableCatalog', id));
    batchAudit(batch, { action: 'delete', collection: 'tableCatalog', documentId: id });
    await batch.commit();
  },

  async assignProject(tableIds: string[], projectId: string | null): Promise<void> {
    await Promise.all(tableIds.map(id =>
      updateDoc(doc(db, 'tableCatalog', id), { projectId: projectId ?? null, updatedAt: Timestamp.now() })
    ));
  },

  subscribe(
    filters: { sysType?: string; status?: string; projectId?: string | null } | undefined,
    callback: (entries: TableCatalogEntry[]) => void,
    onError?: (error: Error) => void,
  ) {
    const q = query(collection(db, 'tableCatalog'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      let entries = snap.docs.map(d => toTableCatalogEntry(d.id, d.data()));
      if (filters?.sysType) entries = entries.filter(e => e.sysType === filters.sysType);
      if (filters?.status) entries = entries.filter(e => e.status === filters.status);
      if (filters?.projectId !== undefined) {
        entries = filters.projectId === null
          ? entries.filter(e => !e.projectId)
          : entries.filter(e => e.projectId === filters.projectId);
      }
      inTransition(callback)(entries);
    }, onError);
  },
};

// ========== PROYECTOS DE TABLAS ==========

function toTableProject(id: string, data: any): import('@ags/shared').TableProject {
  return {
    id,
    name: data.name ?? '',
    description: data.description ?? null,
    sysType: data.sysType ?? null,
    createdAt: data.createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    updatedAt: data.updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    createdBy: data.createdBy ?? 'admin',
  };
}

export const tableProjectsService = {
  async getAll(): Promise<import('@ags/shared').TableProject[]> {
    const q = query(collection(db, 'tableProjects'), orderBy('name', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => toTableProject(d.id, d.data()));
  },

  async create(data: { name: string; description?: string | null; sysType?: string | null }): Promise<string> {
    const id = crypto.randomUUID();
    const payload = deepCleanForFirestore({
      ...data,
      ...getCreateTrace(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.set(docRef('tableProjects', id), payload);
    batchAudit(batch, { action: 'create', collection: 'tableProjects', documentId: id, after: payload as any });
    await batch.commit();
    return id;
  },

  async update(id: string, data: Partial<{ name: string; description: string | null; headerTitle: string | null; footerQF: string | null }>): Promise<void> {
    const payload = deepCleanForFirestore({ ...data, ...getUpdateTrace(), updatedAt: Timestamp.now() });
    await updateDoc(doc(db, 'tableProjects', id), payload);
  },

  async delete(id: string): Promise<void> {
    // Desasignar tablas del proyecto antes de eliminarlo
    const q = query(collection(db, 'tableCatalog'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const tablesInProject = snap.docs.filter(d => d.data().projectId === id);
    await Promise.all(tablesInProject.map(d =>
      updateDoc(doc(db, 'tableCatalog', d.id), { projectId: null, updatedAt: Timestamp.now() })
    ));
    const batch = createBatch();
    batch.delete(docRef('tableProjects', id));
    batchAudit(batch, { action: 'delete', collection: 'tableProjects', documentId: id });
    await batch.commit();
  },

  subscribe(
    callback: (projects: import('@ags/shared').TableProject[]) => void,
    onError?: (error: Error) => void,
  ) {
    const q = query(collection(db, 'tableProjects'), orderBy('name', 'asc'));
    const safeCallback = inTransition(callback);
    return onSnapshot(q, snap => {
      safeCallback(snap.docs.map(d => toTableProject(d.id, d.data())));
    }, onError);
  },
};

// ========== INSTRUMENTOS Y CERTIFICADOS ==========

function toInstrumento(id: string, data: any): InstrumentoPatron {
  return {
    id,
    ...data,
    createdAt: data.createdAt?.toDate?.().toISOString() ?? data.createdAt ?? new Date().toISOString(),
    updatedAt: data.updatedAt?.toDate?.().toISOString() ?? data.updatedAt ?? new Date().toISOString(),
  } as InstrumentoPatron;
}

export const instrumentosService = {
  async getAll(filters?: {
    tipo?: 'instrumento' | 'patron';
    categoria?: CategoriaInstrumento;
    activoOnly?: boolean;
  }): Promise<InstrumentoPatron[]> {
    let q = query(collection(db, 'instrumentos'));
    if (filters?.activoOnly) {
      q = query(q, where('activo', '==', true));
    }
    if (filters?.tipo) {
      q = query(q, where('tipo', '==', filters.tipo));
    }
    const snap = await getDocs(q);
    let items = snap.docs.map(d => toInstrumento(d.id, d.data()));
    if (filters?.categoria) {
      items = items.filter(i => i.categorias.includes(filters.categoria!));
    }
    items.sort((a, b) => a.nombre.localeCompare(b.nombre));
    return items;
  },

  async getById(id: string): Promise<InstrumentoPatron | null> {
    const snap = await getDoc(doc(db, 'instrumentos', id));
    if (!snap.exists()) return null;
    return toInstrumento(snap.id, snap.data());
  },

  async create(data: Omit<InstrumentoPatron, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const payload = deepCleanForFirestore({
      ...data,
      ...getCreateTrace(),
      activo: data.activo !== undefined ? data.activo : true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.set(docRef('instrumentos', id), payload);
    batchAudit(batch, { action: 'create', collection: 'instrumentos', documentId: id, after: payload as any });
    await batch.commit();
    return id;
  },

  async update(id: string, data: Partial<Omit<InstrumentoPatron, 'id' | 'createdAt'>>): Promise<void> {
    const payload = deepCleanForFirestore({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.update(docRef('instrumentos', id), payload);
    batchAudit(batch, { action: 'update', collection: 'instrumentos', documentId: id, after: payload as any });
    await batch.commit();
  },

  async deactivate(id: string): Promise<void> {
    await this.update(id, { activo: false });
  },

  async activate(id: string): Promise<void> {
    await this.update(id, { activo: true });
  },

  async delete(id: string): Promise<void> {
    // Intentar borrar archivos de Storage antes de eliminar el documento
    const instrumento = await this.getById(id);
    if (instrumento?.certificadoStoragePath) {
      try { await deleteObject(storageRef(storage, instrumento.certificadoStoragePath)); } catch { /* ignore */ }
    }
    if (instrumento?.trazabilidadStoragePath) {
      try { await deleteObject(storageRef(storage, instrumento.trazabilidadStoragePath)); } catch { /* ignore */ }
    }
    const batch = createBatch();
    batch.delete(docRef('instrumentos', id));
    batchAudit(batch, { action: 'delete', collection: 'instrumentos', documentId: id });
    await batch.commit();
  },

  async reemplazar(idViejo: string, idNuevo: string): Promise<void> {
    await this.update(idViejo, { reemplazadoPor: idNuevo, activo: false });
    await this.update(idNuevo, { reemplazaA: idViejo });
  },

  // ── Storage: certificados y trazabilidad ──

  async uploadCertificado(instrumentoId: string, file: File): Promise<{ url: string; path: string }> {
    const path = `certificados/${instrumentoId}/${file.name}`;
    const fileRef = storageRef(storage, path);
    await uploadBytes(fileRef, file, { contentType: file.type || 'application/pdf' });
    const url = await getDownloadURL(fileRef);
    await this.update(instrumentoId, {
      certificadoUrl: url,
      certificadoNombre: file.name,
      certificadoStoragePath: path,
    });
    return { url, path };
  },

  async uploadTrazabilidad(instrumentoId: string, file: File): Promise<{ url: string; path: string }> {
    const path = `certificados/${instrumentoId}/trazabilidad/${file.name}`;
    const fileRef = storageRef(storage, path);
    await uploadBytes(fileRef, file, { contentType: file.type || 'application/pdf' });
    const url = await getDownloadURL(fileRef);
    await this.update(instrumentoId, {
      trazabilidadUrl: url,
      trazabilidadNombre: file.name,
      trazabilidadStoragePath: path,
    });
    return { url, path };
  },

  async deleteStorageFile(storagePath: string): Promise<void> {
    await deleteObject(storageRef(storage, storagePath));
  },

  subscribe(
    filters: { tipo?: 'instrumento' | 'patron'; categoria?: CategoriaInstrumento; activoOnly?: boolean } | undefined,
    callback: (items: InstrumentoPatron[]) => void,
    onError?: (error: Error) => void,
  ) {
    let q = query(collection(db, 'instrumentos'));
    if (filters?.activoOnly) {
      q = query(q, where('activo', '==', true));
    }
    if (filters?.tipo) {
      q = query(q, where('tipo', '==', filters.tipo));
    }
    return onSnapshot(q, snap => {
      let items = snap.docs.map(d => toInstrumento(d.id, d.data()));
      if (filters?.categoria) {
        items = items.filter(i => i.categorias.includes(filters.categoria!));
      }
      items.sort((a, b) => a.nombre.localeCompare(b.nombre));
      inTransition(callback)(items);
    }, onError);
  },
};

// ========== MARCAS (catalogo compartido) ==========

export const marcasService = {
  async getAll(activoOnly: boolean = true): Promise<Marca[]> {
    const cacheKey = `marcas:${activoOnly}`;
    const cached = getCached<Marca[]>(cacheKey);
    if (cached) return cached;

    let q;
    if (activoOnly) {
      q = query(collection(db, 'marcas'), where('activo', '==', true));
    } else {
      q = query(collection(db, 'marcas'));
    }
    const snap = await getDocs(q);
    const marcas = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    })) as Marca[];
    marcas.sort((a, b) => a.nombre.localeCompare(b.nombre));
    setCache(cacheKey, marcas);
    return marcas;
  },

  async create(nombre: string): Promise<string> {
    const payload = {
      nombre: nombre.trim(),
      ...getCreateTrace(),
      activo: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    const ref = newDocRef('marcas');
    const batch = createBatch();
    batch.set(ref, payload);
    batchAudit(batch, { action: 'create', collection: 'marcas', documentId: ref.id, after: payload as any });
    await batch.commit();
    return ref.id;
  },

  async update(id: string, data: Partial<Omit<Marca, 'id' | 'createdAt'>>): Promise<void> {
    const payload = {
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    };
    const batch = createBatch();
    batch.update(docRef('marcas', id), payload);
    batchAudit(batch, { action: 'update', collection: 'marcas', documentId: id, after: payload as any });
    await batch.commit();
  },

  async delete(id: string): Promise<void> {
    const batch = createBatch();
    batch.delete(docRef('marcas', id));
    batchAudit(batch, { action: 'delete', collection: 'marcas', documentId: id });
    await batch.commit();
  },

  subscribe(
    activoOnly: boolean,
    callback: (marcas: Marca[]) => void,
    onError?: (error: Error) => void,
  ) {
    let q;
    if (activoOnly) {
      q = query(collection(db, 'marcas'), where('activo', '==', true));
    } else {
      q = query(collection(db, 'marcas'));
    }
    return onSnapshot(q, snap => {
      const marcas = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
        updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      })) as Marca[];
      marcas.sort((a, b) => a.nombre.localeCompare(b.nombre));
      inTransition(callback)(marcas);
    }, onError);
  },
};

// --- Catalogo de Sectores (/catalogoSectores) ---

export interface SectorCatalog {
  id: string;
  nombre: string;
}

const DEFAULT_SECTORES = [
  'Laboratorio', 'Control de Calidad', 'Desarrollo', 'Administracion', 'Compras', 'Produccion',
];

export const sectoresCatalogService = {
  async getAll(): Promise<SectorCatalog[]> {
    const cached = getCached<SectorCatalog[]>('sectores');
    if (cached) return cached;

    const snap = await getDocs(collection(db, 'catalogoSectores'));
    const existing = snap.docs.map(d => ({ id: d.id, nombre: (d.data().nombre || '') as string }));
    // Auto-seed defaults on first access
    if (existing.length === 0) {
      const seeded: SectorCatalog[] = [];
      for (const nombre of DEFAULT_SECTORES) {
        const ref = await addDoc(collection(db, 'catalogoSectores'), { nombre });
        seeded.push({ id: ref.id, nombre });
      }
      return seeded.sort((a, b) => a.nombre.localeCompare(b.nombre));
    }
    const sorted = existing.sort((a, b) => a.nombre.localeCompare(b.nombre));
    setCache('sectores', sorted);
    return sorted;
  },

  async create(nombre: string): Promise<string> {
    const ref = await addDoc(collection(db, 'catalogoSectores'), { nombre });
    return ref.id;
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, 'catalogoSectores', id));
  },
};
