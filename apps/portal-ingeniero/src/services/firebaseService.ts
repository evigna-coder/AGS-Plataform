import {
  getFirestore,
  collection,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  deleteDoc,
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
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { app, storage } from './firebase';
import type { UsuarioAGS, Sistema, Cliente, ContactoCliente, Lead, LeadEstado, LeadArea, Posta, MotivoLlamado, AgendaEntry, UserRole, WorkOrder, TableCatalogEntry, ProtocolSelection, ViaticoPeriodo, GastoViatico, ViaticoPeriodoEstado, AdjuntoLead } from '@ags/shared';
import { LEAD_MAX_ADJUNTOS } from '@ags/shared';
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

/** Deep-clean: removes undefined at any nesting level via JSON round-trip */
function deepCleanForFirestore<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
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

  /** Guarda la firma digital y nombre/aclaración del usuario */
  async saveFirma(uid: string, firmaBase64: string, nombreAclaracion: string): Promise<void> {
    await updateDoc(doc(db, 'usuarios', uid), {
      firmaBase64,
      nombreAclaracion,
      updatedAt: Timestamp.now(),
    });
  },

  /** Lee la firma guardada del usuario */
  async getFirma(uid: string): Promise<{ firmaBase64: string | null; nombreAclaracion: string | null }> {
    const snap = await getDoc(doc(db, 'usuarios', uid));
    if (!snap.exists()) return { firmaBase64: null, nombreAclaracion: null };
    const data = snap.data();
    return {
      firmaBase64: (data.firmaBase64 as string) ?? null,
      nombreAclaracion: (data.nombreAclaracion as string) ?? null,
    };
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
// --- Clientes — solo lectura ---
// =============================================
export const clientesService = {
  async getAll(): Promise<Pick<Cliente, 'id' | 'razonSocial'>[]> {
    const snap = await getDocs(query(collection(db, 'clientes'), orderBy('razonSocial', 'asc')));
    return snap.docs.map(d => ({ id: d.id, razonSocial: d.data().razonSocial ?? '' }));
  },
  async getContactos(clienteId: string): Promise<ContactoCliente[]> {
    const snap = await getDocs(collection(db, 'clientes', clienteId, 'contactos'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ContactoCliente));
  },
};

// =============================================
// --- Ingenieros — solo lectura ---
// =============================================
export const ingenierosService = {
  async getAll(): Promise<{ id: string; nombre: string }[]> {
    const q = query(collection(db, 'ingenieros'), where('activo', '==', true));
    const snap = await getDocs(q);
    return snap.docs
      .map(d => ({ id: d.id, nombre: (d.data().nombre as string) ?? '' }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
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

function migrateMotivoLlamado(raw: string | null | undefined): MotivoLlamado {
  if (!raw) return 'soporte';
  if (raw === 'otros') return 'soporte';
  return raw as MotivoLlamado;
}

function migrateLeadArea(raw: string | null | undefined): LeadArea | null {
  if (!raw) return null;
  const migration: Record<string, LeadArea> = {
    presupuesto: 'presupuesto_ventas',
    contrato: 'presupuesto_ventas',
    venta_insumos: 'presupuesto_ventas',
  };
  return migration[raw] || (raw as LeadArea);
}

function parseLead(id: string, data: Record<string, unknown>): Lead {
  return {
    id,
    clienteId: (data.clienteId as string) ?? null,
    contactoId: (data.contactoId as string) ?? null,
    razonSocial: (data.razonSocial as string) ?? '',
    contacto: (data.contacto as string) ?? '',
    email: (data.email as string) ?? '',
    telefono: (data.telefono as string) ?? '',
    motivoLlamado: migrateMotivoLlamado(data.motivoLlamado as string),
    motivoContacto: (data.motivoContacto as string) ?? '',
    descripcion: (data.descripcion as string) ?? null,
    sistemaId: (data.sistemaId as string) ?? null,
    estado: (data.estado as LeadEstado) ?? 'nuevo',
    postas: (data.postas as Posta[]) ?? [],
    asignadoA: (data.asignadoA as string) ?? null,
    asignadoNombre: (data.asignadoNombre as string) ?? null,
    derivadoPor: (data.derivadoPor as string) ?? null,
    areaActual: migrateLeadArea(data.areaActual as string),
    accionPendiente: (data.accionPendiente as string) ?? null,
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

  /** Real-time subscription. Returns unsubscribe function. */
  subscribe(
    filters: { estado?: LeadEstado; asignadoA?: string } | undefined,
    callback: (leads: Lead[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    const constraints: QueryConstraint[] = [];
    if (filters?.estado) constraints.push(where('estado', '==', filters.estado));
    if (filters?.asignadoA) constraints.push(where('asignadoA', '==', filters.asignadoA));
    constraints.push(orderBy('createdAt', 'desc'));
    const q = query(collection(db, 'leads'), ...constraints);
    return onSnapshot(q, snap => {
      callback(snap.docs.map(d => parseLead(d.id, d.data() as Record<string, unknown>)));
    }, err => {
      console.error('Leads subscription error:', err);
      onError?.(err);
    });
  },

  async getById(id: string): Promise<Lead | null> {
    const snap = await getDoc(doc(db, 'leads', id));
    if (!snap.exists()) return null;
    return parseLead(snap.id, snap.data() as Record<string, unknown>);
  },

  /** Real-time subscription to a single lead by ID. Returns unsubscribe function. */
  subscribeById(
    id: string,
    callback: (lead: Lead | null) => void,
    onError?: (err: Error) => void,
  ): () => void {
    return onSnapshot(doc(db, 'leads', id), snap => {
      if (!snap.exists()) { callback(null); return; }
      callback(parseLead(snap.id, snap.data() as Record<string, unknown>));
    }, err => {
      console.error('Lead subscription error:', err);
      onError?.(err);
    });
  },

  async update(id: string, data: Partial<Omit<Lead, 'id' | 'createdAt'>>): Promise<void> {
    await updateDoc(doc(db, 'leads', id), {
      ...cleanFirestoreData(data as Record<string, unknown>),
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
  },

  async derivar(id: string, posta: Posta, nuevoAsignadoA: string, nuevoAsignadoNombre?: string | null, area?: LeadArea | null, accionRequerida?: string | null): Promise<void> {
    const update: Record<string, any> = {
      postas: arrayUnion(cleanFirestoreData(posta as unknown as Record<string, unknown>)),
      asignadoA: nuevoAsignadoA || null,
      asignadoNombre: nuevoAsignadoNombre || null,
      derivadoPor: posta.deUsuarioId,
      estado: posta.estadoNuevo,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    };
    if (area !== undefined) update.areaActual = area || null;
    if (accionRequerida !== undefined) update.accionPendiente = accionRequerida || null;
    await updateDoc(doc(db, 'leads', id), update);
  },

  async completarAccion(id: string, posta: Posta): Promise<void> {
    await updateDoc(doc(db, 'leads', id), {
      postas: arrayUnion(cleanFirestoreData(posta as unknown as Record<string, unknown>)),
      accionPendiente: null,
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

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, 'leads', id));
  },

  async uploadAdjuntos(leadId: string, files: File[], existingCount: number): Promise<AdjuntoLead[]> {
    const available = LEAD_MAX_ADJUNTOS - existingCount;
    const toUpload = files.slice(0, available);
    const uploaded: AdjuntoLead[] = [];

    for (const file of toUpload) {
      const storageRef = ref(storage, `leads/${leadId}/adjuntos/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      const isImage = file.type.startsWith('image/');
      uploaded.push({
        id: `adj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nombre: file.name,
        url,
        tipo: isImage ? 'imagen' : 'archivo',
        size: file.size,
        fechaCarga: new Date().toISOString(),
      });
    }

    if (uploaded.length > 0) {
      await updateDoc(doc(db, 'leads', leadId), {
        adjuntos: arrayUnion(...uploaded.map(a => deepCleanForFirestore(a))),
        ...getUpdateTrace(),
        updatedAt: Timestamp.now(),
      });
    }

    return uploaded;
  },

  async removeAdjunto(leadId: string, adjunto: AdjuntoLead, allAdjuntos: AdjuntoLead[]): Promise<void> {
    try {
      const storageRef = ref(storage, adjunto.url);
      await deleteObject(storageRef);
    } catch {
      // File may already be deleted
    }
    const updated = allAdjuntos.filter(a => a.id !== adjunto.id);
    await updateDoc(doc(db, 'leads', leadId), {
      adjuntos: updated.map(a => deepCleanForFirestore(a)),
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
  },
};

function toOT(id: string, data: Record<string, unknown>): WorkOrderWithPdf {
  const raw = {
    ...data,
    id,
    pdfUrl: (data['pdfUrl'] as string) ?? null,
    updatedAt: (data['updatedAt'] as { toDate?: () => Date } | null)?.toDate?.()?.toISOString?.() ?? (data['updatedAt'] as string) ?? '',
    createdAt: (data['createdAt'] as { toDate?: () => Date } | null)?.toDate?.()?.toISOString?.() ?? (data['createdAt'] as string) ?? '',
  };
  return raw as unknown as WorkOrderWithPdf;
}

// =============================================
// --- OTs ---
// =============================================

/** WorkOrder extendido con pdfUrl de reportes finalizados */
export type WorkOrderWithPdf = WorkOrder & { pdfUrl?: string | null };

function reporteToWorkOrder(id: string, data: Record<string, unknown>): WorkOrderWithPdf {
  return {
    id,
    otNumber: (data.otNumber as string) ?? id,
    status: (data.status as string) ?? 'BORRADOR',
    razonSocial: (data.razonSocial as string) ?? '',
    contacto: (data.contacto as string) ?? '',
    direccion: (data.direccion as string) ?? '',
    localidad: (data.localidad as string) ?? '',
    provincia: (data.provincia as string) ?? '',
    sistema: (data.sistema as string) ?? '',
    moduloModelo: (data.moduloModelo as string) ?? '',
    moduloDescripcion: (data.moduloDescripcion as string) ?? '',
    moduloSerie: (data.moduloSerie as string) ?? '',
    codigoInternoCliente: (data.codigoInternoCliente as string) ?? '',
    tipoServicio: (data.tipoServicio as string) ?? '',
    fechaInicio: (data.fechaInicio as string) ?? '',
    fechaFin: (data.fechaFin as string) ?? '',
    budgets: (data.budgets as string[]) ?? [],
    ingenieroAsignadoNombre: (data.ingenieroAsignadoNombre as string) ?? null,
    ingenieroAsignadoId: (data.ingenieroAsignadoId as string) ?? null,
    pdfUrl: (data.pdfUrl as string) ?? null,
    updatedAt: (data.updatedAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.() ?? (data.updatedAt as string) ?? '',
    createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.() ?? (data.createdAt as string) ?? '',
  } as unknown as WorkOrderWithPdf;
}

/** Lee de colección 'reportes' (creados desde reportes-ot) y los mapea a WorkOrder */
async function getReportesAsOTs(statusFilter?: string): Promise<WorkOrderWithPdf[]> {
  try {
    const constraints: QueryConstraint[] = [];
    if (statusFilter) constraints.push(where('status', '==', statusFilter));
    const q = query(collection(db, 'reportes'), ...constraints);
    const snap = await getDocs(q);
    return snap.docs.map(d => reporteToWorkOrder(d.id, d.data() as Record<string, unknown>));
  } catch (err) {
    console.warn('No se pudo leer colección reportes (verificar Firestore rules):', err);
    return [];
  }
}

export const otService = {
  /** Trae OTs de ambas colecciones: ordenes_trabajo (sistema-modular) + reportes (reportes-ot), deduplicadas por otNumber */
  async getAll(filters?: { ingenieroId?: string; status?: string }): Promise<WorkOrderWithPdf[]> {
    // 1. OTs de ordenes_trabajo (sistema-modular)
    let fromOT: WorkOrderWithPdf[] = [];
    try {
      const constraints: QueryConstraint[] = [];
      if (filters?.ingenieroId) constraints.push(where('ingenieroAsignadoId', '==', filters.ingenieroId));
      if (filters?.status) constraints.push(where('status', '==', filters.status));
      const q = query(collection(db, 'ordenes_trabajo'), ...constraints);
      const snap = await getDocs(q);
      fromOT = snap.docs.map(d => toOT(d.id, d.data() as Record<string, unknown>));
    } catch (err) {
      console.warn('No se pudo leer colección ordenes_trabajo:', err);
    }

    // 2. Reportes de reportes-ot (sin filtro de ingeniero, ya que no lo tienen)
    const fromReportes = filters?.ingenieroId ? [] : await getReportesAsOTs(filters?.status);

    // 3. Merge: ordenes_trabajo tiene prioridad si hay duplicados por otNumber
    const seen = new Set(fromOT.map(ot => ot.otNumber));
    const merged = [...fromOT, ...fromReportes.filter(r => !seen.has(r.otNumber))];

    return merged.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  },

  async getByOtNumber(otNumber: string): Promise<WorkOrder | null> {
    // Buscar primero en ordenes_trabajo, luego en reportes
    try {
      const otSnap = await getDoc(doc(db, 'ordenes_trabajo', otNumber));
      if (otSnap.exists()) return toOT(otSnap.id, otSnap.data() as Record<string, unknown>);
    } catch (err) {
      console.warn('No se pudo leer ordenes_trabajo/' + otNumber, err);
    }
    try {
      const repSnap = await getDoc(doc(db, 'reportes', otNumber));
      if (repSnap.exists()) return reporteToWorkOrder(repSnap.id, repSnap.data() as Record<string, unknown>);
    } catch (err) {
      console.warn('No se pudo leer reportes/' + otNumber, err);
    }
    return null;
  },

  /** Real-time subscription to a single OT by otNumber.
   *  Tries ordenes_trabajo first; falls back to reportes if not found.
   *  Returns unsubscribe function. */
  subscribeByOtNumber(
    otNumber: string,
    callback: (ot: WorkOrderWithPdf | null) => void,
    onError?: (err: Error) => void,
  ): () => void {
    let active = true;
    let currentUnsub: (() => void) | null = null;

    // Try ordenes_trabajo first (primary collection)
    currentUnsub = onSnapshot(doc(db, 'ordenes_trabajo', otNumber), snap => {
      if (!active) return;
      if (snap.exists()) {
        callback(toOT(snap.id, snap.data() as Record<string, unknown>));
      } else {
        // Not in ordenes_trabajo — fall back to reportes
        if (currentUnsub) currentUnsub();
        currentUnsub = onSnapshot(doc(db, 'reportes', otNumber), repSnap => {
          if (!active) return;
          if (!repSnap.exists()) { callback(null); return; }
          callback(reporteToWorkOrder(repSnap.id, repSnap.data() as Record<string, unknown>));
        }, err => {
          console.error('OT reportes subscription error:', err);
          onError?.(err);
        });
      }
    }, err => {
      console.error('OT ordenes_trabajo subscription error:', err);
      onError?.(err);
    });

    return () => {
      active = false;
      if (currentUnsub) currentUnsub();
    };
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

  /** Real-time subscription to OTs. Subscribes to ordenes_trabajo collection. */
  subscribe(
    filters: { ingenieroId?: string; status?: string } | undefined,
    callback: (ots: WorkOrderWithPdf[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    const constraints: QueryConstraint[] = [];
    if (filters?.ingenieroId) constraints.push(where('ingenieroAsignadoId', '==', filters.ingenieroId));
    if (filters?.status) constraints.push(where('status', '==', filters.status));
    const q = query(collection(db, 'ordenes_trabajo'), ...constraints);
    return onSnapshot(q, snap => {
      const ots = snap.docs.map(d => toOT(d.id, d.data() as Record<string, unknown>));
      ots.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      callback(ots);
    }, err => {
      console.error('OT subscription error:', err);
      onError?.(err);
    });
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

// =============================================
// --- Viáticos ---
// =============================================

function parseViaticoPeriodo(id: string, data: Record<string, unknown>): ViaticoPeriodo {
  return {
    id,
    ingenieroId: (data.ingenieroId as string) ?? '',
    ingenieroNombre: (data.ingenieroNombre as string) ?? '',
    mes: (data.mes as number) ?? 1,
    anio: (data.anio as number) ?? new Date().getFullYear(),
    estado: (data.estado as ViaticoPeriodoEstado) ?? 'abierto',
    gastos: (data.gastos as GastoViatico[]) ?? [],
    totalEfectivo: (data.totalEfectivo as number) ?? 0,
    totalTarjeta: (data.totalTarjeta as number) ?? 0,
    total: (data.total as number) ?? 0,
    enviadoAt: (data.enviadoAt as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? (data.enviadoAt as string) ?? null,
    confirmadoAt: (data.confirmadoAt as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? (data.confirmadoAt as string) ?? null,
    confirmadoPor: (data.confirmadoPor as string) ?? null,
    confirmadoPorNombre: (data.confirmadoPorNombre as string) ?? null,
    createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? '',
    updatedAt: (data.updatedAt as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? '',
  };
}

function calcularTotales(gastos: GastoViatico[]) {
  const totalEfectivo = gastos.filter(g => g.medioPago === 'efectivo').reduce((s, g) => s + g.monto, 0);
  const totalTarjeta = gastos.filter(g => g.medioPago === 'tarjeta').reduce((s, g) => s + g.monto, 0);
  return { totalEfectivo, totalTarjeta, total: totalEfectivo + totalTarjeta };
}

export const viaticosService = {
  /** Obtiene o crea el período abierto actual del ingeniero */
  async getOrCreatePeriodoActual(ingenieroId: string, ingenieroNombre: string): Promise<ViaticoPeriodo> {
    // Buscar períodos del ingeniero y filtrar el abierto en cliente (evita índice compuesto)
    const q = query(
      collection(db, 'viaticos'),
      where('ingenieroId', '==', ingenieroId),
    );
    const snap = await getDocs(q);
    const abierto = snap.docs.find(d => (d.data().estado as string) === 'abierto');
    if (abierto) {
      return parseViaticoPeriodo(abierto.id, abierto.data() as Record<string, unknown>);
    }
    // Crear nuevo período para el mes actual
    const now = new Date();
    const payload = cleanFirestoreData({
      ingenieroId,
      ingenieroNombre,
      mes: now.getMonth() + 1,
      anio: now.getFullYear(),
      estado: 'abierto' as const,
      gastos: [],
      totalEfectivo: 0,
      totalTarjeta: 0,
      total: 0,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const ref = await addDoc(collection(db, 'viaticos'), payload);
    return {
      id: ref.id,
      ingenieroId,
      ingenieroNombre,
      mes: now.getMonth() + 1,
      anio: now.getFullYear(),
      estado: 'abierto',
      gastos: [],
      totalEfectivo: 0,
      totalTarjeta: 0,
      total: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },

  /** Agrega un gasto al período abierto */
  async agregarGasto(periodoId: string, gasto: GastoViatico): Promise<void> {
    const docRef = doc(db, 'viaticos', periodoId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error('Período no encontrado');
    const data = snap.data();
    const gastos = [...((data.gastos as GastoViatico[]) ?? []), gasto];
    const totales = calcularTotales(gastos);
    await updateDoc(docRef, { gastos, ...totales, updatedAt: Timestamp.now() });
  },

  /** Edita un gasto existente del período */
  async editarGasto(periodoId: string, gastoId: string, updates: Partial<Omit<GastoViatico, 'id'>>): Promise<void> {
    const docRef = doc(db, 'viaticos', periodoId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error('Período no encontrado');
    const data = snap.data();
    const gastos = ((data.gastos as GastoViatico[]) ?? []).map(g =>
      g.id === gastoId ? { ...g, ...updates } : g
    );
    const totales = calcularTotales(gastos);
    await updateDoc(docRef, { gastos, ...totales, updatedAt: Timestamp.now() });
  },

  /** Elimina un gasto del período */
  async eliminarGasto(periodoId: string, gastoId: string): Promise<void> {
    const docRef = doc(db, 'viaticos', periodoId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error('Período no encontrado');
    const data = snap.data();
    const gastos = ((data.gastos as GastoViatico[]) ?? []).filter(g => g.id !== gastoId);
    const totales = calcularTotales(gastos);
    await updateDoc(docRef, { gastos, ...totales, updatedAt: Timestamp.now() });
  },

  /** Envía el período a administración para revisión */
  async enviarPeriodo(periodoId: string): Promise<void> {
    await updateDoc(doc(db, 'viaticos', periodoId), {
      estado: 'enviado',
      enviadoAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  },

  /** Historial de períodos cerrados del ingeniero */
  async getHistorial(ingenieroId: string): Promise<ViaticoPeriodo[]> {
    const q = query(
      collection(db, 'viaticos'),
      where('ingenieroId', '==', ingenieroId),
    );
    const snap = await getDocs(q);
    return snap.docs
      .map(d => parseViaticoPeriodo(d.id, d.data() as Record<string, unknown>))
      .filter(p => p.estado === 'enviado' || p.estado === 'confirmado')
      .sort((a, b) => b.anio - a.anio || b.mes - a.mes);
  },
};
