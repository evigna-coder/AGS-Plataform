import {
  getFirestore,
  collection,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  query,
  where,
  getDocs,
  Timestamp,
  addDoc,
  orderBy,
  limit,
  type QueryConstraint,
} from 'firebase/firestore';
import { app } from './firebase';
import type { UsuarioAGS, Sistema, Lead, UserRole, WorkOrder, TableCatalogEntry, ProtocolSelection } from '@ags/shared';
import { getCreateTrace } from './currentUser';

export const db = getFirestore(app);

/** Limpia undefined de payload top-level (Firestore no acepta undefined) */
export function cleanFirestoreData<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    out[k] = v === '' ? null : v;
  }
  return out as Partial<T>;
}

// =============================================
// --- Usuarios ---
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
        email: d['email'],
        displayName: d['displayName'],
        photoURL: d['photoURL'] ?? null,
        role: d['role'] ?? null,
        status: d['status'],
        createdAt: d['createdAt']?.toDate?.()?.toISOString() ?? new Date().toISOString(),
        updatedAt: d['updatedAt']?.toDate?.()?.toISOString() ?? new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      } as UsuarioAGS;
    }
    const newUser = {
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL ?? null,
      role: null as UserRole | null,
      status: 'pendiente' as const,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      lastLoginAt: Timestamp.now(),
    };
    await setDoc(docRef, newUser);
    return {
      id: user.uid,
      ...newUser,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    } as UsuarioAGS;
  },
};

// =============================================
// --- Sistemas (equipos) — solo lectura ---
// =============================================
export const sistemasService = {
  async getByAgsVisibleId(agsId: string): Promise<Sistema | null> {
    const q = query(collection(db, 'sistemas'), where('agsVisibleId', '==', agsId));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return {
      id: d.id,
      ...d.data(),
      createdAt: d.data()['createdAt']?.toDate().toISOString(),
      updatedAt: d.data()['updatedAt']?.toDate().toISOString(),
    } as Sistema;
  },
};

// =============================================
// --- Leads ---
// =============================================
export const leadsService = {
  async create(data: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const payload = {
      ...cleanFirestoreData(data as Record<string, unknown>),
      ...getCreateTrace(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    const ref = await addDoc(collection(db, 'leads'), payload);
    return ref.id;
  },
};

function toOT(id: string, data: Record<string, unknown>): WorkOrder {
  const raw = {
    ...data,
    id,
    updatedAt: (data['updatedAt'] as { toDate?: () => Date } | null)?.toDate?.()?.toISOString?.() ?? (data['updatedAt'] as string) ?? '',
    createdAt: (data['createdAt'] as { toDate?: () => Date } | null)?.toDate?.()?.toISOString?.() ?? (data['createdAt'] as string) ?? '',
  };
  return raw as unknown as WorkOrder;
}

// =============================================
// --- OTs ---
// =============================================
export const otService = {
  async getAll(filters?: { ingenieroId?: string; status?: string }): Promise<WorkOrder[]> {
    const constraints: QueryConstraint[] = [];
    if (filters?.ingenieroId) constraints.push(where('ingenieroAsignadoId', '==', filters.ingenieroId));
    if (filters?.status) constraints.push(where('status', '==', filters.status));
    const q = query(collection(db, 'ordenes_trabajo'), ...constraints);
    const snap = await getDocs(q);
    return snap.docs
      .map(d => toOT(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  },

  async getByOtNumber(otNumber: string): Promise<WorkOrder | null> {
    const snap = await getDoc(doc(db, 'ordenes_trabajo', otNumber));
    if (!snap.exists()) return null;
    return toOT(snap.id, snap.data() as Record<string, unknown>);
  },

  async update(otNumber: string, data: Partial<WorkOrder>): Promise<void> {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      cleaned[k] = v;
    }
    await updateDoc(doc(db, 'ordenes_trabajo', otNumber), {
      ...cleaned,
      updatedAt: Timestamp.now(),
    });
  },

  async getByEquipoId(sistemaId: string, limitN = 10): Promise<WorkOrder[]> {
    const q = query(
      collection(db, 'ordenes_trabajo'),
      where('sistemaId', '==', sistemaId),
      orderBy('createdAt', 'desc'),
      limit(limitN),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => toOT(d.id, d.data() as Record<string, unknown>));
  },
};

// =============================================
// --- Catálogo de Tablas (protocolo) ---
// =============================================
export const tableCatalogService = {
  async getPublished(sysType?: string): Promise<TableCatalogEntry[]> {
    const col = collection(db, 'tableCatalog');
    const q = sysType
      ? query(col, where('status', '==', 'published'), where('sysType', '==', sysType))
      : query(col, where('status', '==', 'published'));
    const snap = await getDocs(q);
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() } as TableCatalogEntry))
      .sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999));
  },
};

// =============================================
// --- Reportes (protocolo completado por OT) ---
// =============================================
export const reportService = {
  async getByOtNumber(otNumber: string): Promise<{ protocolSelections: ProtocolSelection[] } | null> {
    const snap = await getDoc(doc(db, 'reportes', otNumber));
    if (!snap.exists()) return null;
    const data = snap.data();
    return { protocolSelections: (data['protocolSelections'] as ProtocolSelection[]) ?? [] };
  },

  async saveProtocolSelections(otNumber: string, selections: ProtocolSelection[]): Promise<void> {
    await setDoc(doc(db, 'reportes', otNumber), {
      protocolSelections: selections,
      updatedAt: Timestamp.now(),
    }, { merge: true });
  },
};
