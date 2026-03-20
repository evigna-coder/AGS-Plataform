import { collection, getDocs, doc, getDoc, updateDoc, deleteDoc, deleteField, query, where, orderBy, Timestamp, setDoc } from 'firebase/firestore';
import type { Ingeniero, Proveedor, UsuarioAGS, UserRole, UserStatus, UserPermissionsOverride } from '@ags/shared';
import { db, logAudit, cleanFirestoreData, getCreateTrace, getUpdateTrace } from './firebase';

// ========== INGENIEROS ==========

export const ingenierosService = {
  async getAll(activoOnly: boolean = true): Promise<Ingeniero[]> {
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
    await setDoc(doc(db, 'ingenieros', id), payload);
    logAudit({ action: 'create', collection: 'ingenieros', documentId: id, after: payload as any });
    return id;
  },

  async update(id: string, data: Partial<Omit<Ingeniero, 'id' | 'createdAt'>>): Promise<void> {
    const payload = cleanFirestoreData({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    await updateDoc(doc(db, 'ingenieros', id), payload);
    logAudit({ action: 'update', collection: 'ingenieros', documentId: id, after: payload as any });
  },

  async delete(id: string): Promise<void> {
    logAudit({ action: 'delete', collection: 'ingenieros', documentId: id });
    await deleteDoc(doc(db, 'ingenieros', id));
  },
};

// ========== PROVEEDORES ==========

export const proveedoresService = {
  async getAll(activoOnly: boolean = true): Promise<Proveedor[]> {
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
    await setDoc(doc(db, 'proveedores', id), payload);
    logAudit({ action: 'create', collection: 'proveedores', documentId: id, after: payload as any });
    return id;
  },

  async update(id: string, data: Partial<Omit<Proveedor, 'id' | 'createdAt'>>): Promise<void> {
    const payload = cleanFirestoreData({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    await updateDoc(doc(db, 'proveedores', id), payload);
    logAudit({ action: 'update', collection: 'proveedores', documentId: id, after: payload as any });
  },

  async delete(id: string): Promise<void> {
    logAudit({ action: 'delete', collection: 'proveedores', documentId: id });
    await deleteDoc(doc(db, 'proveedores', id));
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
};

// =============================================
// --- Usuarios (Auth & RBAC) ---
// =============================================

export const usuariosService = {
  async upsertOnLogin(user: { uid: string; email: string; displayName: string; photoURL: string | null }): Promise<UsuarioAGS> {
    const docRef = doc(db, 'usuarios', user.uid);
    const existing = await getDoc(docRef);
    if (existing.exists()) {
      await updateDoc(docRef, { lastLoginAt: Timestamp.now() });
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
    await setDoc(docRef, newUser);
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
    const q = query(collection(db, 'usuarios'), orderBy('displayName', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      id: d.id, ...d.data(),
      role: d.data().role ?? null, photoURL: d.data().photoURL ?? null,
      permisos: d.data().permisos ?? null,
      createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? '',
      updatedAt: d.data().updatedAt?.toDate?.()?.toISOString() ?? '',
      lastLoginAt: d.data().lastLoginAt?.toDate?.()?.toISOString() ?? '',
    })) as UsuarioAGS[];
  },

  async updateRole(uid: string, role: UserRole): Promise<void> {
    await updateDoc(doc(db, 'usuarios', uid), { role, updatedAt: Timestamp.now() });
  },

  async updateStatus(uid: string, status: UserStatus): Promise<void> {
    await updateDoc(doc(db, 'usuarios', uid), { status, updatedAt: Timestamp.now() });
  },

  async approveUser(uid: string, role: UserRole): Promise<void> {
    await updateDoc(doc(db, 'usuarios', uid), { status: 'activo', role, updatedAt: Timestamp.now() });
  },

  async updatePermissions(uid: string, permisos: UserPermissionsOverride | null): Promise<void> {
    await updateDoc(doc(db, 'usuarios', uid), { permisos: permisos ?? deleteField(), updatedAt: Timestamp.now() });
  },
};
