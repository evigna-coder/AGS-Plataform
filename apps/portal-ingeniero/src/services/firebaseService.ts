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
  onSnapshot,
  arrayUnion,
  type QueryConstraint,
} from 'firebase/firestore';
import { app } from './firebase';
import type { UsuarioAGS, Sistema, Lead, LeadEstado, Posta, MotivoLlamado, AgendaEntry, UserRole, WorkOrder, TableCatalogEntry, ProtocolSelection } from '@ags/shared';
import { getCreateTrace, getUpdateTrace } from './currentUser';

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
  async getIngenieros(): Promise<{ id: string; displayName: string }[]> {
    const q = query(collection(db, 'usuarios'), where('status', '==', 'activo'));
    const snap = await getDocs(q);
    return snap.docs
      .map(d => ({ id: d.id, displayName: (d.data().displayName as string) ?? '' }))
      .filter(u => u.displayName)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  },

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

function parseLead(id: string, data: Record<string, unknown>): Lead {
  return {
    id,
    clienteId: (data.clienteId as string) ?? null,
    contactoId: (data.contactoId as string) ?? null,
    razonSocial: (data.razonSocial as string) ?? '',
    contacto: (data.contacto as string) ?? '',
    email: (data.email as string) ?? '',
    telefono: (data.telefono as string) ?? '',
    motivoLlamado: (data.motivoLlamado as MotivoLlamado) ?? 'otros',
    motivoContacto: (data.motivoContacto as string) ?? '',
    descripcion: (data.descripcion as string) ?? null,
    sistemaId: (data.sistemaId as string) ?? null,
    estado: (data.estado as LeadEstado) ?? 'nuevo',
    postas: (data.postas as Posta[]) ?? [],
    asignadoA: (data.asignadoA as string) ?? null,
    derivadoPor: (data.derivadoPor as string) ?? null,
    presupuestosIds: (data.presupuestosIds as string[]) ?? [],
    otIds: (data.otIds as string[]) ?? [],
    createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? '',
    updatedAt: (data.updatedAt as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? '',
    createdBy: (data.createdBy as string) ?? null,
    finalizadoAt: (data.finalizadoAt as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? null,
  };
}

export const leadsService = {
  async create(data: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const payload = {
      ...cleanFirestoreData(data as Record<string, unknown>),
      ...getCreateTrace(),
      estado: data.estado || 'nuevo',
      postas: data.postas || [],
      presupuestosIds: data.presupuestosIds || [],
      otIds: data.otIds || [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    const ref = await addDoc(collection(db, 'leads'), payload);
    return ref.id;
  },

  async getAll(filters?: { estado?: LeadEstado; asignadoA?: string }): Promise<Lead[]> {
    const constraints: QueryConstraint[] = [];
    if (filters?.estado) constraints.push(where('estado', '==', filters.estado));
    if (filters?.asignadoA) constraints.push(where('asignadoA', '==', filters.asignadoA));
    constraints.push(orderBy('createdAt', 'desc'));
    const q = query(collection(db, 'leads'), ...constraints);
    const snap = await getDocs(q);
    return snap.docs.map(d => parseLead(d.id, d.data() as Record<string, unknown>));
  },

  async getById(id: string): Promise<Lead | null> {
    const snap = await getDoc(doc(db, 'leads', id));
    if (!snap.exists()) return null;
    return parseLead(snap.id, snap.data() as Record<string, unknown>);
  },

  async update(id: string, data: Partial<Omit<Lead, 'id' | 'createdAt'>>): Promise<void> {
    await updateDoc(doc(db, 'leads', id), {
      ...cleanFirestoreData(data as Record<string, unknown>),
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
  },

  async derivar(id: string, posta: Posta, nuevoAsignadoA: string): Promise<void> {
    await updateDoc(doc(db, 'leads', id), {
      postas: arrayUnion(cleanFirestoreData(posta as unknown as Record<string, unknown>)),
      asignadoA: nuevoAsignadoA,
      derivadoPor: posta.deUsuarioId,
      estado: posta.estadoNuevo,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
  },

  async finalizar(id: string, posta: Posta): Promise<void> {
    await updateDoc(doc(db, 'leads', id), {
      postas: arrayUnion(cleanFirestoreData(posta as unknown as Record<string, unknown>)),
      estado: posta.estadoNuevo,
      finalizadoAt: Timestamp.now(),
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
  },

  async agregarComentario(id: string, posta: Posta): Promise<void> {
    await updateDoc(doc(db, 'leads', id), {
      postas: arrayUnion(cleanFirestoreData(posta as unknown as Record<string, unknown>)),
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
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

// =============================================
// --- Agenda (read-only) ---
// =============================================

function parseAgendaEntry(id: string, data: Record<string, unknown>): AgendaEntry {
  return {
    id,
    fechaInicio: (data.fechaInicio as string) ?? '',
    fechaFin: (data.fechaFin as string) ?? '',
    quarterStart: (data.quarterStart as 1 | 2 | 3 | 4) ?? 1,
    quarterEnd: (data.quarterEnd as 1 | 2 | 3 | 4) ?? 4,
    ingenieroId: (data.ingenieroId as string) ?? '',
    ingenieroNombre: (data.ingenieroNombre as string) ?? '',
    otNumber: (data.otNumber as string) ?? '',
    clienteNombre: (data.clienteNombre as string) ?? '',
    tipoServicio: (data.tipoServicio as string) ?? '',
    sistemaNombre: (data.sistemaNombre as string) ?? null,
    establecimientoNombre: (data.establecimientoNombre as string) ?? null,
    estadoAgenda: (data.estadoAgenda as AgendaEntry['estadoAgenda']) ?? 'pendiente',
    notas: (data.notas as string) ?? null,
    createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? '',
    updatedAt: (data.updatedAt as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? '',
  };
}

export const agendaService = {
  /** Real-time subscription for entries in a date range for a specific engineer. Returns unsubscribe fn. */
  subscribeToRange(
    rangeStart: string,
    rangeEnd: string,
    ingenieroId: string,
    callback: (entries: AgendaEntry[]) => void,
  ): () => void {
    const q = query(
      collection(db, 'agendaEntries'),
      where('ingenieroId', '==', ingenieroId),
      where('fechaInicio', '<=', rangeEnd),
      orderBy('fechaInicio', 'asc'),
    );
    return onSnapshot(q, (snap) => {
      const entries = snap.docs
        .map(d => parseAgendaEntry(d.id, d.data() as Record<string, unknown>))
        .filter(e => e.fechaFin >= rangeStart);
      callback(entries);
    });
  },
};
