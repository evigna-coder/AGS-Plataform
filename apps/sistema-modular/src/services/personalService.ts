import { collection, getDocs, doc, getDoc, updateDoc, deleteDoc, deleteField, query, where, orderBy, Timestamp, setDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import type { Ingeniero, Proveedor, UsuarioAGS, UserRole, UserStatus, UserPermissionsOverride, CertificadoIngeniero } from '@ags/shared';
import { getCached, setCache, invalidateCache } from './serviceCache';
import { db, storage, createBatch, docRef, batchAudit, cleanFirestoreData, getCreateTrace, getUpdateTrace, onSnapshot } from './firebase';

// ========== INGENIEROS ==========

export const ingenierosService = {
  async getAll(activoOnly: boolean = true): Promise<Ingeniero[]> {
    const cacheKey = `ingenieros:${activoOnly}`;
    const cached = getCached<Ingeniero[]>(cacheKey);
    if (cached) return cached;

    let q;
    if (activoOnly) {
      q = query(collection(db, 'ingenieros'), where('activo', '==', true));
    } else {
      q = query(collection(db, 'ingenieros'));
    }
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    })) as Ingeniero[];
    items.sort((a, b) => a.nombre.localeCompare(b.nombre));
    setCache(cacheKey, items);
    return items;
  },

  async getById(id: string): Promise<Ingeniero | null> {
    const snap = await getDoc(doc(db, 'ingenieros', id));
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...snap.data(),
      createdAt: snap.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: snap.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    } as Ingeniero;
  },

  async create(data: Omit<Ingeniero, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const payload = cleanFirestoreData({
      ...data,
      ...getCreateTrace(),
      activo: data.activo !== undefined ? data.activo : true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.set(docRef('ingenieros', id), payload);
    batchAudit(batch, { action: 'create', collection: 'ingenieros', documentId: id, after: payload as any });
    await batch.commit();
    invalidateCache('ingenieros');
    return id;
  },

  async update(id: string, data: Partial<Omit<Ingeniero, 'id' | 'createdAt'>>): Promise<void> {
    const payload = cleanFirestoreData({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.update(docRef('ingenieros', id), payload);
    batchAudit(batch, { action: 'update', collection: 'ingenieros', documentId: id, after: payload as any });
    await batch.commit();
    invalidateCache('ingenieros');
  },

  async delete(id: string): Promise<void> {
    const batch = createBatch();
    batch.delete(docRef('ingenieros', id));
    batchAudit(batch, { action: 'delete', collection: 'ingenieros', documentId: id });
    await batch.commit();
    invalidateCache('ingenieros');
  },

  subscribe(
    activoOnly: boolean,
    callback: (items: Ingeniero[]) => void,
    onError?: (error: Error) => void,
  ) {
    let q;
    if (activoOnly) {
      q = query(collection(db, 'ingenieros'), where('activo', '==', true));
    } else {
      q = query(collection(db, 'ingenieros'));
    }
    return onSnapshot(q, snap => {
      const items = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
        updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      })) as Ingeniero[];
      items.sort((a, b) => a.nombre.localeCompare(b.nombre));
      callback(items);
    }, onError);
  },
};

// ========== PROVEEDORES ==========

export const proveedoresService = {
  async getAll(activoOnly: boolean = true): Promise<Proveedor[]> {
    const cacheKey = `proveedores:${activoOnly}`;
    const cached = getCached<Proveedor[]>(cacheKey);
    if (cached) return cached;

    let q;
    if (activoOnly) {
      q = query(collection(db, 'proveedores'), where('activo', '==', true));
    } else {
      q = query(collection(db, 'proveedores'));
    }
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    })) as Proveedor[];
    items.sort((a, b) => a.nombre.localeCompare(b.nombre));
    setCache(cacheKey, items);
    return items;
  },

  async getById(id: string): Promise<Proveedor | null> {
    const snap = await getDoc(doc(db, 'proveedores', id));
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...snap.data(),
      createdAt: snap.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: snap.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    } as Proveedor;
  },

  async create(data: Omit<Proveedor, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const payload = cleanFirestoreData({
      ...data,
      ...getCreateTrace(),
      activo: data.activo !== undefined ? data.activo : true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.set(docRef('proveedores', id), payload);
    batchAudit(batch, { action: 'create', collection: 'proveedores', documentId: id, after: payload as any });
    await batch.commit();
    invalidateCache('proveedores');
    return id;
  },

  async update(id: string, data: Partial<Omit<Proveedor, 'id' | 'createdAt'>>): Promise<void> {
    const payload = cleanFirestoreData({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.update(docRef('proveedores', id), payload);
    batchAudit(batch, { action: 'update', collection: 'proveedores', documentId: id, after: payload as any });
    await batch.commit();
    invalidateCache('proveedores');
  },

  async delete(id: string): Promise<void> {
    const batch = createBatch();
    batch.delete(docRef('proveedores', id));
    batchAudit(batch, { action: 'delete', collection: 'proveedores', documentId: id });
    await batch.commit();
    invalidateCache('proveedores');
  },

  async getInternacionales(): Promise<Proveedor[]> {
    const q = query(collection(db, 'proveedores'), where('activo', '==', true), where('tipo', '==', 'internacional'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      id: d.id, ...d.data(),
      createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    })) as Proveedor[];
  },

  subscribe(
    activoOnly: boolean,
    callback: (items: Proveedor[]) => void,
    onError?: (error: Error) => void,
  ) {
    let q;
    if (activoOnly) {
      q = query(collection(db, 'proveedores'), where('activo', '==', true));
    } else {
      q = query(collection(db, 'proveedores'));
    }
    return onSnapshot(q, snap => {
      const items = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
        updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      })) as Proveedor[];
      items.sort((a, b) => a.nombre.localeCompare(b.nombre));
      callback(items);
    }, onError);
  },
};

// =============================================
// --- Usuarios (Auth & RBAC) ---
// =============================================

export const usuariosService = {
  async upsertOnLogin(user: { uid: string; email: string; displayName: string; photoURL: string | null }): Promise<UsuarioAGS> {
    const ref = doc(db, 'usuarios', user.uid);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, { lastLoginAt: Timestamp.now() });
      const d = existing.data();
      return {
        id: existing.id,
        email: d.email,
        displayName: d.displayName,
        photoURL: d.photoURL ?? null,
        role: d.role ?? null,
        status: d.status,
        createdAt: d.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
        updatedAt: d.updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      } as UsuarioAGS;
    }
    const newUser = {
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL ?? null,
      role: null,
      status: 'pendiente' as const,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      lastLoginAt: Timestamp.now(),
    };
    await setDoc(ref, newUser);
    const now = new Date().toISOString();
    return { id: user.uid, email: user.email, displayName: user.displayName, photoURL: user.photoURL ?? null, role: null, status: 'pendiente', createdAt: now, updatedAt: now, lastLoginAt: now };
  },

  async getById(uid: string): Promise<UsuarioAGS | null> {
    const snap = await getDoc(doc(db, 'usuarios', uid));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      id: snap.id, email: d.email, displayName: d.displayName, photoURL: d.photoURL ?? null,
      role: d.role ?? null, status: d.status, permisos: d.permisos ?? null,
      createdAt: d.createdAt?.toDate?.()?.toISOString() ?? '', updatedAt: d.updatedAt?.toDate?.()?.toISOString() ?? '',
      lastLoginAt: d.lastLoginAt?.toDate?.()?.toISOString() ?? '',
    } as UsuarioAGS;
  },

  async getAll(): Promise<UsuarioAGS[]> {
    const cached = getCached<UsuarioAGS[]>('usuarios');
    if (cached) return cached;

    const q = query(collection(db, 'usuarios'), orderBy('displayName', 'asc'));
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({
      id: d.id, ...d.data(),
      role: d.data().role ?? null, roles: d.data().roles ?? [],
      photoURL: d.data().photoURL ?? null,
      permisos: d.data().permisos ?? null,
      createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? '',
      updatedAt: d.data().updatedAt?.toDate?.()?.toISOString() ?? '',
      lastLoginAt: d.data().lastLoginAt?.toDate?.()?.toISOString() ?? '',
    })) as UsuarioAGS[];
    setCache('usuarios', items);
    return items;
  },

  async updateRole(uid: string, role: UserRole): Promise<void> {
    await updateDoc(doc(db, 'usuarios', uid), { role, updatedAt: Timestamp.now() });
    invalidateCache('usuarios');
  },

  async updateRoles(uid: string, roles: UserRole[]): Promise<void> {
    await updateDoc(doc(db, 'usuarios', uid), { roles, updatedAt: Timestamp.now() });
    invalidateCache('usuarios');
  },

  async updateStatus(uid: string, status: UserStatus): Promise<void> {
    await updateDoc(doc(db, 'usuarios', uid), { status, updatedAt: Timestamp.now() });
    invalidateCache('usuarios');
  },

  async approveUser(uid: string, role: UserRole): Promise<void> {
    await updateDoc(doc(db, 'usuarios', uid), { status: 'activo', role, updatedAt: Timestamp.now() });
    invalidateCache('usuarios');
  },

  async updatePermissions(uid: string, permisos: UserPermissionsOverride | null): Promise<void> {
    await updateDoc(doc(db, 'usuarios', uid), { permisos: permisos ?? deleteField(), updatedAt: Timestamp.now() });
    invalidateCache('usuarios');
  },

  subscribe(
    callback: (users: UsuarioAGS[]) => void,
    onError?: (error: Error) => void,
  ) {
    const q = query(collection(db, 'usuarios'), orderBy('displayName', 'asc'));
    return onSnapshot(q, snap => {
      const users = snap.docs.map(d => ({
        id: d.id, ...d.data(),
        role: d.data().role ?? null, photoURL: d.data().photoURL ?? null,
        permisos: d.data().permisos ?? null,
        createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? '',
        updatedAt: d.data().updatedAt?.toDate?.()?.toISOString() ?? '',
        lastLoginAt: d.data().lastLoginAt?.toDate?.()?.toISOString() ?? '',
      })) as UsuarioAGS[];
      callback(users);
    }, onError);
  },
};

// ========== CERTIFICADOS INGENIERO ==========

function parseCertificado(d: any, id: string): CertificadoIngeniero {
  return {
    id,
    ingenieroId: d.ingenieroId ?? '',
    ingenieroNombre: d.ingenieroNombre ?? '',
    categoria: d.categoria ?? 'gc',
    descripcion: d.descripcion ?? '',
    certificadoUrl: d.certificadoUrl ?? '',
    certificadoNombre: d.certificadoNombre ?? '',
    certificadoStoragePath: d.certificadoStoragePath ?? '',
    fechaEmision: d.fechaEmision ?? null,
    fechaVencimiento: d.fechaVencimiento ?? null,
    createdAt: d.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    updatedAt: d.updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
  };
}

export const certificadosIngenieroService = {
  async getByIngeniero(ingenieroId: string): Promise<CertificadoIngeniero[]> {
    const q = query(collection(db, 'certificadosIngeniero'), where('ingenieroId', '==', ingenieroId));
    const snap = await getDocs(q);
    const items = snap.docs.map(d => parseCertificado(d.data(), d.id));
    items.sort((a, b) => a.categoria.localeCompare(b.categoria) || a.descripcion.localeCompare(b.descripcion));
    return items;
  },

  subscribeByIngeniero(
    ingenieroId: string,
    callback: (items: CertificadoIngeniero[]) => void,
    onError?: (error: Error) => void,
  ) {
    const q = query(collection(db, 'certificadosIngeniero'), where('ingenieroId', '==', ingenieroId));
    return onSnapshot(q, snap => {
      const items = snap.docs.map(d => parseCertificado(d.data(), d.id));
      items.sort((a, b) => a.categoria.localeCompare(b.categoria) || a.descripcion.localeCompare(b.descripcion));
      callback(items);
    }, onError);
  },

  async create(
    data: Omit<CertificadoIngeniero, 'id' | 'certificadoUrl' | 'certificadoNombre' | 'certificadoStoragePath' | 'createdAt' | 'updatedAt'>,
    file: File,
  ): Promise<string> {
    const id = crypto.randomUUID();
    // Upload PDF to Storage
    const path = `certificados-ingeniero/${data.ingenieroId}/${Date.now()}_${file.name}`;
    const fileRef = storageRef(storage, path);
    await uploadBytes(fileRef, file, { contentType: file.type || 'application/pdf' });
    const url = await getDownloadURL(fileRef);

    const payload = cleanFirestoreData({
      ...data,
      certificadoUrl: url,
      certificadoNombre: file.name,
      certificadoStoragePath: path,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    await setDoc(doc(db, 'certificadosIngeniero', id), payload);
    return id;
  },

  async delete(certId: string, storagePath: string): Promise<void> {
    try { await deleteObject(storageRef(storage, storagePath)); } catch { /* file may not exist */ }
    await deleteDoc(doc(db, 'certificadosIngeniero', certId));
  },
};
