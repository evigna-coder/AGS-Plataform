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
  runTransaction,
  deleteField,
  type QueryConstraint,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { app, storage } from './firebase';
import type { UsuarioAGS, Sistema, Cliente, ContactoCliente, Lead, TicketEstado, TicketArea, Posta, MotivoLlamado, AgendaEntry, UserRole, WorkOrder, TableCatalogEntry, ProtocolSelection, ViaticoPeriodo, GastoViatico, ViaticoPeriodoEstado, AdjuntoTicket, AdminConfigFlujos, ModuloSistema } from '@ags/shared';
import {
  TICKET_MAX_ADJUNTOS,
  parseLeadDoc, syncFlatFromContactos,
} from '@ags/shared';
import { getCreateTrace, getUpdateTrace, getCurrentUserTrace } from './currentUser';

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

/**
 * Fire-and-forget audit log — mirrors sistema-modular's logAudit. Cada mutación
 * importante deja una entrada en audit_log con quién/cuándo/qué.
 */
function logAudit(params: {
  action: 'create' | 'update' | 'delete';
  collection: string;
  documentId: string;
  before?: object | null;
  after?: object | null;
}): void {
  const user = getCurrentUserTrace();
  if (!user) return;
  addDoc(collection(db, 'audit_log'), {
    action: params.action,
    collection: params.collection,
    documentId: params.documentId,
    userId: user.uid,
    userName: user.name,
    timestamp: Timestamp.now(),
    changes: params.before || params.after
      ? { before: params.before ?? null, after: params.after ?? null }
      : null,
  }).catch(err => console.error('Audit log failed:', err));
}

// =============================================
// --- Usuarios ---
// =============================================
export const usuariosService = {
  async getIngenieros(): Promise<{ id: string; displayName: string; role: string | null; roles?: string[] }[]> {
    const q = query(collection(db, 'usuarios'), where('status', '==', 'activo'));
    const snap = await getDocs(q);
    return snap.docs
      .map(d => {
        const data = d.data();
        return {
          id: d.id,
          displayName: (data.displayName as string) ?? '',
          role: (data.role as string) ?? null,
          roles: (data.roles as string[]) ?? undefined,
        };
      })
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
    // 1. Contactos legacy en subcolección del cliente
    const legacySnap = await getDocs(collection(db, 'clientes', clienteId, 'contactos'));
    const legacyContactos = legacySnap.docs.map(d => ({ id: d.id, ...d.data() } as ContactoCliente));

    // 2. Contactos en establecimientos del cliente (modelo actual)
    // Buscar por clienteCuit Y por clienteId (campo legacy de migración)
    const [estByCuit, estByLegacy] = await Promise.all([
      getDocs(query(collection(db, 'establecimientos'), where('clienteCuit', '==', clienteId))),
      getDocs(query(collection(db, 'establecimientos'), where('clienteId', '==', clienteId))),
    ]);
    const estIds = new Set<string>();
    const estDocs = [...estByCuit.docs, ...estByLegacy.docs].filter(d => {
      if (estIds.has(d.id)) return false;
      estIds.add(d.id);
      return true;
    });
    const estContactos: ContactoCliente[] = [];
    for (const estDoc of estDocs) {
      const estNombre = (estDoc.data().nombre as string) || '';
      const contactosSnap = await getDocs(collection(db, 'establecimientos', estDoc.id, 'contactos'));
      for (const cDoc of contactosSnap.docs) {
        const data = cDoc.data();
        estContactos.push({
          id: cDoc.id,
          nombre: (data.nombre as string) || '',
          email: (data.email as string) || '',
          telefono: (data.telefono as string) || '',
          cargo: (data.cargo as string) || (estNombre ? `(${estNombre})` : ''),
          esPrincipal: (data.esPrincipal as boolean) || false,
        });
      }
    }

    return [...legacyContactos, ...estContactos];
  },
};

// =============================================
// --- Ingenieros — solo lectura ---
// =============================================
export const ingenierosService = {
  async getAll(): Promise<{ id: string; nombre: string; usuarioId: string | null; email: string | null }[]> {
    const q = query(collection(db, 'ingenieros'), where('activo', '==', true));
    const snap = await getDocs(q);
    return snap.docs
      .map(d => ({
        id: d.id,
        nombre: (d.data().nombre as string) ?? '',
        usuarioId: (d.data().usuarioId as string) ?? null,
        email: (d.data().email as string) ?? null,
      }))
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
  async getById(id: string): Promise<Sistema | null> {
    const snap = await getDoc(doc(db, 'sistemas', id));
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...snap.data(),
      createdAt: snap.data()['createdAt']?.toDate().toISOString(),
      updatedAt: snap.data()['updatedAt']?.toDate().toISOString(),
    } as Sistema;
  },
  async getModulos(sistemaId: string): Promise<ModuloSistema[]> {
    const snap = await getDocs(collection(db, 'sistemas', sistemaId, 'modulos'));
    return snap.docs.map(d => ({ id: d.id, ...d.data(), sistemaId })) as ModuloSistema[];
  },
  async getByCliente(clienteId: string): Promise<Pick<Sistema, 'id' | 'nombre' | 'codigoInternoCliente' | 'agsVisibleId' | 'activo'>[]> {
    const q = query(collection(db, 'sistemas'), where('clienteId', '==', clienteId), where('activo', '==', true));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      id: d.id,
      nombre: (d.data().nombre as string) ?? '',
      codigoInternoCliente: (d.data().codigoInternoCliente as string) ?? '',
      agsVisibleId: (d.data().agsVisibleId as string) ?? null,
      activo: true,
    }));
  },
};

// =============================================
// --- Admin Config (read-only desde portal-ingeniero) ---
// =============================================
// La escritura vive en sistema-modular (/admin/config-flujos). Acá solo leemos
// el doc para resolver responsables por defecto al derivar/crear tickets.

const ADMIN_CONFIG_COLLECTION = 'adminConfig';
const ADMIN_CONFIG_DOC_ID = 'flujos';

export const adminConfigService = {
  async get(): Promise<AdminConfigFlujos | null> {
    const snap = await getDoc(doc(db, ADMIN_CONFIG_COLLECTION, ADMIN_CONFIG_DOC_ID));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      mailFacturacion: 'mbarrios@agsanalitica.com',
      ...data,
      updatedAt: typeof data?.updatedAt === 'string'
        ? data.updatedAt
        : (data?.updatedAt?.toDate?.().toISOString?.() ?? new Date().toISOString()),
    } as AdminConfigFlujos;
  },
};

/**
 * Lee el responsable por defecto configurado para un área. Devuelve null si no
 * hay área, no hay default, o el usuario no está activo. Falla soft.
 */
async function resolveDefaultResponsableForArea(
  area: TicketArea | null | undefined,
): Promise<{ id: string; displayName: string } | null> {
  if (!area || area === 'sistema') return null;
  try {
    const cfg = await adminConfigService.get();
    if (!cfg) return null;
    const defaultId = cfg.responsablePorArea?.[area as Exclude<TicketArea, 'sistema'>];
    if (!defaultId) return null;
    const userSnap = await getDoc(doc(db, 'usuarios', defaultId));
    if (!userSnap.exists()) return null;
    const data = userSnap.data();
    if (data.status !== 'activo') return null;
    return { id: userSnap.id, displayName: (data.displayName as string) ?? '' };
  } catch (err) {
    console.warn('[resolveDefaultResponsableForArea] failed:', err);
    return null;
  }
}

// =============================================
// --- Leads ---
// =============================================
// Helpers de parsing/migration extraídos a @ags/shared/services/leads.
// Antes vivían acá duplicados (con drift confirmado vs sistema-modular).
// Adapter para llamar parseLeadDoc con la signature legacy (id + data) que
// usan los call sites de este file:
const parseLead = (id: string, data: Record<string, unknown>) =>
  parseLeadDoc({ id, data: () => data });
// Alias de compat para el código existente:
const syncFlatFromContactosData = syncFlatFromContactos;

/** Extrae la parte numérica de "TKT-00042" → 42. 0 si no matchea. */
function extractTicketNumber(numero: unknown): number {
  if (typeof numero !== 'string') return 0;
  const match = numero.match(/TKT-(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Genera el siguiente numero correlativo de ticket: TKT-00001, TKT-00002, ...
 * Atómico vía counter doc `_counters/tickets` — el MISMO doc que usan
 * sistema-modular (leadsService.getNextTicketNumero) y la Cloud Function de
 * firma remota (reportes-ot). Firestore garantiza atomicidad cross-app.
 *
 * Antes este portal usaba scan-and-max NO transaccional sobre `leads`, que no
 * tocaba el counter: eso desincronizaba a este portal de sistema-modular y
 * generaba números repetidos (ej. dos TKT-00164). No reintroducir scan-and-max.
 */
async function getNextTicketNumero(): Promise<string> {
  const counterRef = doc(db, '_counters', 'tickets');
  const next = await runTransaction(db, async (tx) => {
    const counterSnap = await tx.get(counterRef);
    let current: number;
    if (counterSnap.exists()) {
      current = counterSnap.data().value as number;
    } else {
      // Bootstrap: el counter no existe todavía → escanear leads una sola vez.
      const snap = await getDocs(collection(db, 'leads'));
      let max = 0;
      snap.docs.forEach(d => {
        const n = extractTicketNumber(d.data().numero);
        if (n > max) max = n;
      });
      current = max;
    }
    const nextVal = current + 1;
    tx.set(counterRef, { value: nextVal, updatedAt: Timestamp.now() });
    return nextVal;
  });
  return `TKT-${String(next).padStart(5, '0')}`;
}

export const leadsService = {
  async create(data: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'> & { createdAt?: string }): Promise<string> {
    const synced = syncFlatFromContactosData(data as Record<string, any>);
    const numero = data.numero || await getNextTicketNumero();
    // Si se recibe createdAt como ISO string, respetarlo (override manual desde UI).
    const createdTs = data.createdAt
      ? Timestamp.fromDate(new Date(data.createdAt))
      : Timestamp.now();
    const { createdAt: _omit, ...syncedRest } = synced;
    // Auto-asignar responsable por defecto del área cuando el ticket se crea
    // con areaActual pero sin asignadoA (si no, el responsable del área no lo ve).
    if (!syncedRest.asignadoA && syncedRest.areaActual) {
      const def = await resolveDefaultResponsableForArea(syncedRest.areaActual as TicketArea);
      if (def) {
        syncedRest.asignadoA = def.id;
        syncedRest.asignadoNombre = def.displayName;
      }
    }
    const payload = {
      ...cleanFirestoreData(syncedRest),
      numero,
      ...getCreateTrace(),
      estado: data.estado || 'nuevo',
      postas: data.postas || [],
      presupuestosIds: data.presupuestosIds || [],
      otIds: data.otIds || [],
      createdAt: createdTs,
      updatedAt: Timestamp.now(),
    };
    const ref = await addDoc(collection(db, 'leads'), payload);
    logAudit({ action: 'create', collection: 'leads', documentId: ref.id, after: payload });
    return ref.id;
  },

  async getAll(filters?: { estado?: TicketEstado; asignadoA?: string }): Promise<Lead[]> {
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
    filters: { estado?: TicketEstado; asignadoA?: string; createdBy?: string } | undefined,
    callback: (leads: Lead[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    const constraints: QueryConstraint[] = [];
    if (filters?.estado) constraints.push(where('estado', '==', filters.estado));
    if (filters?.asignadoA) constraints.push(where('asignadoA', '==', filters.asignadoA));
    if (filters?.createdBy) constraints.push(where('createdBy', '==', filters.createdBy));
    constraints.push(orderBy('createdAt', 'desc'));
    const q = query(collection(db, 'leads'), ...constraints);
    // En remounts rápidos (volver atrás desde detalle), el SDK puede emitir un snapshot
    // vacío desde cache antes que llegue el del servidor. Saltamos ese primero para
    // evitar el flash "No se encontraron tickets".
    let serverConfirmed = false;
    return onSnapshot(q, { includeMetadataChanges: true }, snap => {
      if (!serverConfirmed && snap.metadata.fromCache && snap.empty) return;
      serverConfirmed = true;
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
    const synced = syncFlatFromContactosData(data as Record<string, any>);
    const payload = {
      ...cleanFirestoreData(synced),
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    };
    await updateDoc(doc(db, 'leads', id), payload);
    logAudit({ action: 'update', collection: 'leads', documentId: id, after: payload });
  },

  async derivar(id: string, posta: Posta, nuevoAsignadoA: string, nuevoAsignadoNombre?: string | null, area?: TicketArea | null, accionRequerida?: string | null, extras?: { motivoLlamado?: MotivoLlamado; motivoOtros?: string | null }): Promise<void> {
    // Si se deriva a un área sin elegir persona, auto-asignar al responsable
    // configurado para esa área. Refleja también el destinatario en el posta.
    let postaFinal = posta;
    if (!nuevoAsignadoA && area && area !== 'sistema') {
      const def = await resolveDefaultResponsableForArea(area);
      if (def) {
        nuevoAsignadoA = def.id;
        nuevoAsignadoNombre = def.displayName;
        postaFinal = { ...posta, aUsuarioId: def.id, aUsuarioNombre: def.displayName };
      }
    }
    const update: Record<string, any> = {
      postas: arrayUnion(cleanFirestoreData(postaFinal as unknown as Record<string, unknown>)),
      asignadoA: nuevoAsignadoA || null,
      asignadoNombre: nuevoAsignadoNombre || null,
      derivadoPor: postaFinal.deUsuarioId,
      estado: postaFinal.estadoNuevo,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    };
    if (area !== undefined) update.areaActual = area || null;
    if (accionRequerida !== undefined) update.accionPendiente = accionRequerida || null;
    if (extras?.motivoLlamado !== undefined) {
      update.motivoLlamado = extras.motivoLlamado;
      update.motivoOtros = extras.motivoLlamado === 'otros' ? (extras.motivoOtros?.trim() || null) : null;
    }
    await updateDoc(doc(db, 'leads', id), update);
    logAudit({ action: 'update', collection: 'leads', documentId: id, after: { ...update, _action: 'derivar', estadoNuevo: postaFinal.estadoNuevo } });
  },

  async completarAccion(id: string, posta: Posta): Promise<void> {
    const payload = {
      postas: arrayUnion(cleanFirestoreData(posta as unknown as Record<string, unknown>)),
      accionPendiente: null,
      estado: posta.estadoNuevo,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    };
    await updateDoc(doc(db, 'leads', id), payload);
    logAudit({ action: 'update', collection: 'leads', documentId: id, after: { _action: 'completarAccion', estadoNuevo: posta.estadoNuevo } });
  },

  async finalizar(id: string, posta: Posta): Promise<void> {
    const payload = {
      postas: arrayUnion(cleanFirestoreData(posta as unknown as Record<string, unknown>)),
      estado: posta.estadoNuevo,
      finalizadoAt: Timestamp.now(),
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    };
    await updateDoc(doc(db, 'leads', id), payload);
    logAudit({ action: 'update', collection: 'leads', documentId: id, after: { _action: 'finalizar', estadoNuevo: posta.estadoNuevo } });
  },

  async agregarComentario(id: string, posta: Posta): Promise<void> {
    const payload = {
      postas: arrayUnion(cleanFirestoreData(posta as unknown as Record<string, unknown>)),
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    };
    await updateDoc(doc(db, 'leads', id), payload);
    logAudit({ action: 'update', collection: 'leads', documentId: id, after: { _action: 'agregarComentario' } });
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, 'leads', id));
    logAudit({ action: 'delete', collection: 'leads', documentId: id });
  },

  async uploadAdjuntos(leadId: string, files: File[], existingCount: number): Promise<AdjuntoTicket[]> {
    const available = TICKET_MAX_ADJUNTOS - existingCount;
    const toUpload = files.slice(0, available);
    const uploaded: AdjuntoTicket[] = [];

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
      logAudit({ action: 'update', collection: 'leads', documentId: leadId, after: { _action: 'uploadAdjuntos', count: uploaded.length } });
    }

    return uploaded;
  },

  async removeAdjunto(leadId: string, adjunto: AdjuntoTicket, allAdjuntos: AdjuntoTicket[]): Promise<void> {
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
    logAudit({ action: 'update', collection: 'leads', documentId: leadId, after: { _action: 'removeAdjunto', adjuntoId: adjunto.id } });
  },
};

function toOT(id: string, data: Record<string, unknown>): WorkOrderWithPdf {
  const raw = {
    ...data,
    id,
    pdfUrl: (data['pdfUrl'] as string) ?? null,
    protocolPdfUrl: (data['protocolPdfUrl'] as string) ?? null,
    updatedAt: (data['updatedAt'] as { toDate?: () => Date } | null)?.toDate?.()?.toISOString?.() ?? (data['updatedAt'] as string) ?? '',
    createdAt: (data['createdAt'] as { toDate?: () => Date } | null)?.toDate?.()?.toISOString?.() ?? (data['createdAt'] as string) ?? '',
  };
  return raw as unknown as WorkOrderWithPdf;
}

// =============================================
// --- OTs ---
// =============================================

/** Registro del último intento de envío del reporte al cliente por mail.
 *  Lo escribe reportes-ot (useSendReportByEmail) en CADA intento, éxito o fallo. */
export interface EnviadoPorEmail {
  estado?: 'enviado' | 'error' | null;
  fecha?: string | null;
  destinatarios?: string[] | null;
  bcc?: string[] | null;
  variante?: string | null;
  adjuntoTamanoMB?: number | null;
  error?: string | null;
}

/** Marca manual: "el reporte se entregó por otro medio" (WhatsApp, mail personal,
 *  impreso, etc.). La pone un usuario desde el Historial del portal cuando el envío
 *  automático falló (típicamente adjunto > 24 MB) pero el reporte igual llegó al
 *  cliente. Vive como campo HERMANO de `enviadoPorEmail` para no pisar la traza del
 *  intento real del sistema: el badge le da prioridad cuando está presente, y
 *  "deshacer" la borra dejando a la vista el estado real (error / sin envío). */
export interface EnvioManual {
  marcadoPorUid?: string | null;
  marcadoPorNombre?: string | null;
  fecha?: string | null;
}

/** WorkOrder extendido con pdfUrl(s) de reportes finalizados.
 *  protocolPdfUrl existe cuando la OT tiene protocolo digital adjunto (split en 2 archivos).
 *  enviadoPorEmail registra si el reporte se envió al cliente por mail (y si falló).
 *  envioManual registra una entrega manual marcada desde el portal (override). */
export type WorkOrderWithPdf = WorkOrder & {
  pdfUrl?: string | null;
  protocolPdfUrl?: string | null;
  enviadoPorEmail?: EnviadoPorEmail | null;
  envioManual?: EnvioManual | null;
};

function reporteToWorkOrder(id: string, data: Record<string, unknown>): WorkOrderWithPdf {
  // Spread completo para preservar campos administrativos (estadoAdmin, esFacturable,
  // tieneContrato, sistemaId, etc.) que sistema-modular escribe en `reportes`.
  return {
    ...data,
    id,
    otNumber: (data.otNumber as string) ?? id,
    status: (data.status as string) ?? 'BORRADOR',
    pdfUrl: (data.pdfUrl as string) ?? null,
    updatedAt: (data.updatedAt as { toDate?: () => Date } | null)?.toDate?.()?.toISOString?.() ?? (data.updatedAt as string) ?? '',
    createdAt: (data.createdAt as { toDate?: () => Date } | null)?.toDate?.()?.toISOString?.() ?? (data.createdAt as string) ?? '',
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

    // 3. Merge: ordenes_trabajo tiene prioridad si hay duplicados por otNumber.
    //    pdfUrl/protocolPdfUrl/enviadoPorEmail los escribe reportes-ot en la colección
    //    `reportes`, no en `ordenes_trabajo`. Para que el historial vea el PDF y el
    //    estado de envío al cliente, los traemos al objeto ganador cuando éste no los
    //    tiene (sin pisar valores ya presentes).
    const reportesByOt = new Map(fromReportes.map(r => [r.otNumber, r]));
    const fromOTEnriched = fromOT.map(ot => {
      const rep = reportesByOt.get(ot.otNumber);
      if (!rep) return ot;
      return {
        ...ot,
        // fechaInicio/fechaFin: prevalece la del reporte (fecha de realización que
        // cargó el técnico) sobre la planificada en ordenes_trabajo.
        fechaInicio: rep.fechaInicio || ot.fechaInicio,
        fechaFin: rep.fechaFin || ot.fechaFin,
        pdfUrl: ot.pdfUrl ?? rep.pdfUrl ?? null,
        protocolPdfUrl: ot.protocolPdfUrl ?? rep.protocolPdfUrl ?? null,
        enviadoPorEmail: ot.enviadoPorEmail ?? rep.enviadoPorEmail ?? null,
        envioManual: ot.envioManual ?? rep.envioManual ?? null,
      };
    });
    const seen = new Set(fromOT.map(ot => ot.otNumber));
    const merged = [...fromOTEnriched, ...fromReportes.filter(r => !seen.has(r.otNumber))];

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
    let otData: Record<string, unknown> | null = null;
    let repData: Record<string, unknown> | null = null;
    let otExists = false;
    let otLoaded = false;
    let repLoaded = false;

    // Report-specific fields that reportes-ot writes — merge these from reportes if empty in ordenes_trabajo
    const REPORT_FIELDS = [
      'reporteTecnico', 'accionesTomar', 'horasTrabajadas', 'tiempoViaje',
      'fechaInicio', 'fechaFin', 'signatureEngineer', 'signatureClient',
      'aclaracionEspecialista', 'aclaracionCliente', 'pdfUrl', 'protocolPdfUrl',
      'problemaFallaInicial', 'materialesParaServicio', 'articulos', 'enviadoPorEmail',
      'envioManual',
    ];

    const emit = () => {
      if (!active) return;
      // Wait until BOTH subscriptions have fired at least once before emitting null
      if (!otLoaded || !repLoaded) return;

      if (!otExists && !repData) { callback(null); return; }
      if (otExists && otData) {
        // Merge report fields from reportes if they're empty in ordenes_trabajo
        const merged = { ...otData };
        if (repData) {
          for (const f of REPORT_FIELDS) {
            const otVal = merged[f];
            const repVal = repData[f];
            const isEmpty = otVal === undefined || otVal === null || otVal === '' || (Array.isArray(otVal) && otVal.length === 0);
            if (isEmpty && repVal !== undefined && repVal !== null && repVal !== '') {
              merged[f] = repVal;
            }
          }
        }
        callback(toOT(otNumber, merged));
      } else if (repData) {
        callback(toOT(otNumber, repData));
      }
    };

    // Subscribe to ordenes_trabajo
    const unsubOT = onSnapshot(doc(db, 'ordenes_trabajo', otNumber), snap => {
      if (!active) return;
      otLoaded = true;
      otExists = snap.exists();
      otData = otExists ? snap.data() as Record<string, unknown> : null;
      emit();
    }, err => {
      console.error('OT ordenes_trabajo subscription error:', err);
      otLoaded = true;
      onError?.(err);
    });

    // Also subscribe to reportes (for merged report data)
    const unsubRep = onSnapshot(doc(db, 'reportes', otNumber), snap => {
      if (!active) return;
      repLoaded = true;
      repData = snap.exists() ? snap.data() as Record<string, unknown> : null;
      emit();
    }, () => {
      // reportes may not exist or permission denied — that's OK
      repLoaded = true;
      repData = null;
      emit();
    });

    return () => {
      active = false;
      unsubOT();
      unsubRep();
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

  /** Marca el reporte como "entregado por otro medio" (override manual del Historial).
   *  Escribe el campo hermano `envioManual` en `reportes/{otNumber}` (merge) sin tocar
   *  `enviadoPorEmail`, para que el badge muestre verde sin perder la traza del fallo
   *  real del envío automático. La lista (subscribe realtime) refleja el cambio sola. */
  async marcarEnvioManual(otNumber: string): Promise<void> {
    const trace = getCurrentUserTrace();
    await setDoc(doc(db, 'reportes', otNumber), {
      envioManual: {
        marcadoPorUid: trace?.uid ?? null,
        marcadoPorNombre: trace?.name ?? null,
        fecha: new Date().toISOString(),
      },
      updatedAt: Timestamp.now(),
    }, { merge: true });
  },

  /** Deshace la marca manual: borra `envioManual` y deja a la vista el estado real
   *  (error / sin envío). No toca `enviadoPorEmail`. */
  async quitarEnvioManual(otNumber: string): Promise<void> {
    await setDoc(doc(db, 'reportes', otNumber), {
      envioManual: deleteField(),
      updatedAt: Timestamp.now(),
    }, { merge: true });
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

  /** Real-time subscription to OTs. Subscribes to BOTH ordenes_trabajo (legacy)
   *  y reportes (canonical, donde sistema-modular escribe), mergeando por otNumber.
   *  `updatedAfter` aplica un cut server-side por updatedAt — clave para Historial,
   *  donde se quieren los últimos N días sin traer la base entera. */
  subscribe(
    filters: { ingenieroId?: string; status?: string; updatedAfter?: Date } | undefined,
    callback: (ots: WorkOrderWithPdf[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    let fromOT: WorkOrderWithPdf[] = [];
    let fromReportes: WorkOrderWithPdf[] = [];
    let otLoaded = false;
    let repLoaded = false;

    const emit = () => {
      if (!otLoaded || !repLoaded) return;
      // ordenes_trabajo gana en duplicados por otNumber, PERO pdfUrl/protocolPdfUrl/
      // enviadoPorEmail viven en `reportes` (los escribe reportes-ot), no en
      // ordenes_trabajo. Sin este enrichment, una OT presente en ambas colecciones
      // muestra "Sin envío" y manda "Reporte" a la app en vez del PDF, aunque el
      // mail al cliente haya salido. Mismo merge que getAll() (ver arriba).
      const reportesByOt = new Map(fromReportes.map(r => [r.otNumber, r]));
      const fromOTEnriched = fromOT.map(ot => {
        const rep = reportesByOt.get(ot.otNumber);
        if (!rep) return ot;
        return {
          ...ot,
          // fechaInicio/fechaFin: prevalece la del reporte (fecha de realización que
          // cargó el técnico) sobre la planificada en ordenes_trabajo. Si el reporte
          // no la tiene, cae a la de la OT.
          fechaInicio: rep.fechaInicio || ot.fechaInicio,
          fechaFin: rep.fechaFin || ot.fechaFin,
          pdfUrl: ot.pdfUrl ?? rep.pdfUrl ?? null,
          protocolPdfUrl: ot.protocolPdfUrl ?? rep.protocolPdfUrl ?? null,
          enviadoPorEmail: ot.enviadoPorEmail ?? rep.enviadoPorEmail ?? null,
          envioManual: ot.envioManual ?? rep.envioManual ?? null,
        };
      });
      const seen = new Set(fromOT.map(o => o.otNumber));
      const merged = [...fromOTEnriched, ...fromReportes.filter(r => !seen.has(r.otNumber))];
      merged.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      callback(merged);
    };

    const updatedAfterTs = filters?.updatedAfter ? Timestamp.fromDate(filters.updatedAfter) : null;

    const otConstraints: QueryConstraint[] = [];
    if (filters?.ingenieroId) otConstraints.push(where('ingenieroAsignadoId', '==', filters.ingenieroId));
    if (filters?.status) otConstraints.push(where('status', '==', filters.status));
    if (updatedAfterTs) otConstraints.push(where('updatedAt', '>=', updatedAfterTs));

    const unsubOT = onSnapshot(query(collection(db, 'ordenes_trabajo'), ...otConstraints), snap => {
      fromOT = snap.docs.map(d => toOT(d.id, d.data() as Record<string, unknown>));
      otLoaded = true;
      emit();
    }, err => {
      console.warn('ordenes_trabajo subscription error:', err);
      otLoaded = true;
      emit();
      onError?.(err);
    });

    // Para reportes no aplicamos filtro de ingenieroId (los docs antiguos no lo tienen).
    const repConstraints: QueryConstraint[] = [];
    if (filters?.status) repConstraints.push(where('status', '==', filters.status));
    if (updatedAfterTs) repConstraints.push(where('updatedAt', '>=', updatedAfterTs));
    const unsubRep = onSnapshot(query(collection(db, 'reportes'), ...repConstraints), snap => {
      fromReportes = snap.docs.map(d => reporteToWorkOrder(d.id, d.data() as Record<string, unknown>));
      // Si hay filtro de ingenieroId, aplicamos client-side para reportes
      if (filters?.ingenieroId) {
        fromReportes = fromReportes.filter(r => r.ingenieroAsignadoId === filters.ingenieroId);
      }
      repLoaded = true;
      emit();
    }, err => {
      console.warn('reportes subscription error:', err);
      repLoaded = true;
      emit();
    });

    return () => { unsubOT(); unsubRep(); };
  },
};

// =============================================
// --- Tipos de Servicio (read-only) ---
// =============================================
export const tiposServicioService = {
  async getAll(): Promise<{ id: string; nombre: string }[]> {
    const snap = await getDocs(collection(db, 'tipos_servicio'));
    return snap.docs
      .map(d => ({ id: d.id, nombre: (d.data().nombre as string) ?? '' }))
      .filter(t => t.nombre)
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
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
// --- Reportes pendientes (borradores del ingeniero) ---
// =============================================

/**
 * Reporte pendiente desde el POV del ingeniero. Dos tipos:
 *   - 'borrador': el ingeniero ya entró al reporte y lo dejó sin finalizar.
 *   - 'sin_empezar': OT asignada al ingeniero (o a cualquier ing. en vista admin)
 *     que aún no fue tocada en reportes-ot — sin `creadoPor` populated.
 */
export interface BorradorPendiente {
  otNumber: string;
  razonSocial: string | null;
  sistema: string | null;
  /** agsVisibleId del equipo — guardado como `codigoInternoCliente` en el doc. */
  idEquipo: string | null;
  tipoServicio: string | null;
  creadoFecha: string | null;
  creadoPorNombre: string | null;
  creadoPorEmail: string | null;
  tipo: 'borrador' | 'sin_empezar';
  /** Nombre del ingeniero asignado — relevante en 'sin_empezar' para admin view */
  ingenieroAsignadoNombre: string | null;
}

function tsToIso(v: unknown): string | null {
  const ts = v as { toDate?: () => Date } | undefined;
  return ts?.toDate?.()?.toISOString?.() ?? null;
}

function parseBorradorEmpezado(id: string, data: Record<string, unknown>): BorradorPendiente {
  const creadoPor = (data.creadoPor as Record<string, unknown> | undefined) ?? {};
  return {
    otNumber: (data.otNumber as string) ?? id,
    razonSocial: (data.razonSocial as string) ?? null,
    sistema: (data.sistema as string) ?? null,
    idEquipo: (data.codigoInternoCliente as string) ?? null,
    tipoServicio: (data.tipoServicio as string) ?? null,
    creadoFecha: tsToIso(creadoPor.fecha),
    creadoPorNombre: (creadoPor.nombre as string) ?? null,
    creadoPorEmail: (creadoPor.email as string) ?? null,
    tipo: 'borrador',
    ingenieroAsignadoNombre: (data.ingenieroAsignadoNombre as string) ?? null,
  };
}

function parseSinEmpezar(id: string, data: Record<string, unknown>): BorradorPendiente {
  return {
    otNumber: (data.otNumber as string) ?? id,
    razonSocial: (data.razonSocial as string) ?? null,
    sistema: (data.sistema as string) ?? null,
    idEquipo: (data.codigoInternoCliente as string) ?? null,
    tipoServicio: (data.tipoServicio as string) ?? null,
    // En 'sin_empezar' no hay creadoPor.fecha — usamos createdAt de la OT como referencia visual.
    creadoFecha: tsToIso(data.createdAt),
    creadoPorNombre: null,
    creadoPorEmail: null,
    tipo: 'sin_empezar',
    ingenieroAsignadoNombre: (data.ingenieroAsignadoNombre as string) ?? null,
  };
}

function mergeAndSort(empezados: BorradorPendiente[], sinEmpezar: BorradorPendiente[]): BorradorPendiente[] {
  // 'borrador' tiene precedencia: si una OT está en ambas listas (raro pero posible
  // si el ingeniero asignado abrió el reporte), quedarse con la versión empezada.
  const empezadosNums = new Set(empezados.map(b => b.otNumber));
  const merged = [
    ...empezados,
    ...sinEmpezar.filter(s => !empezadosNums.has(s.otNumber)),
  ];
  merged.sort((a, b) => (b.creadoFecha ?? '').localeCompare(a.creadoFecha ?? ''));
  return merged;
}

export const reportesPendientesService = {
  /**
   * Pendientes del ingeniero: mergea (1) borradores empezados por él en
   * reportes-ot + (2) OTs asignadas a él en estado BORRADOR sin tocar todavía.
   * El callback se invoca cada vez que llega snapshot de cualquiera de las
   * dos queries; mantiene state interno para reemitir merge consistente.
   */
  subscribeMisBorradores(
    uid: string,
    callback: (list: BorradorPendiente[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    let empezados: BorradorPendiente[] = [];
    let sinEmpezar: BorradorPendiente[] = [];
    const emit = () => callback(mergeAndSort(empezados, sinEmpezar));

    // (1) Borradores empezados por este ingeniero — índice (status, creadoPor.uid).
    const qEmpezados = query(
      collection(db, 'reportes'),
      where('status', '==', 'BORRADOR'),
      where('creadoPor.uid', '==', uid),
    );
    const unsubE = onSnapshot(
      qEmpezados,
      (snap) => {
        empezados = snap.docs.map(d => parseBorradorEmpezado(d.id, d.data() as Record<string, unknown>));
        emit();
      },
      onError,
    );

    // (2) OTs BORRADOR asignadas a este ingeniero sin tocar — single-field index.
    // Filtramos en memoria por status + child-only + ausencia de creadoPor para
    // no requerir índice compuesto nuevo.
    const qAsignadas = query(
      collection(db, 'reportes'),
      where('ingenieroAsignadoId', '==', uid),
    );
    const unsubA = onSnapshot(
      qAsignadas,
      (snap) => {
        sinEmpezar = snap.docs
          .filter(d => {
            const data = d.data() as Record<string, unknown>;
            const creadoPor = data.creadoPor as Record<string, unknown> | undefined;
            return data.status === 'BORRADOR'
              && d.id.includes('.')                          // solo children (work units)
              && !creadoPor?.uid;                            // no tocado todavía
          })
          .map(d => parseSinEmpezar(d.id, d.data() as Record<string, unknown>));
        emit();
      },
      onError,
    );

    return () => { unsubE(); unsubA(); };
  },

  /**
   * Vista admin: todos los borradores empezados + todas las OTs BORRADOR
   * asignadas a algún ingeniero sin tocar. Una sola query por status, categoriza
   * en memoria — evita 2x reads y mantiene visibilidad de OTs sin empezar.
   */
  subscribeTodosBorradores(
    callback: (list: BorradorPendiente[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    const q = query(
      collection(db, 'reportes'),
      where('status', '==', 'BORRADOR'),
    );
    return onSnapshot(
      q,
      (snap) => {
        const empezados: BorradorPendiente[] = [];
        const sinEmpezar: BorradorPendiente[] = [];
        for (const d of snap.docs) {
          const data = d.data() as Record<string, unknown>;
          if (!d.id.includes('.')) continue;                  // skip parents
          const creadoPor = data.creadoPor as Record<string, unknown> | undefined;
          if (creadoPor?.uid) {
            empezados.push(parseBorradorEmpezado(d.id, data));
          } else if (data.ingenieroAsignadoId) {
            sinEmpezar.push(parseSinEmpezar(d.id, data));
          }
          // else: legacy sin creadoPor ni asignación — skip para no contaminar.
        }
        callback(mergeAndSort(empezados, sinEmpezar));
      },
      onError,
    );
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
    equipoModelo: (data.equipoModelo as string) ?? null,
    equipoAgsId: (data.equipoAgsId as string) ?? null,
    estadoAgenda: (data.estadoAgenda as AgendaEntry['estadoAgenda']) ?? 'pendiente',
    notas: (data.notas as string) ?? null,
    titulo: (data.titulo as string) ?? null,
    createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? '',
    updatedAt: (data.updatedAt as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? '',
  };
}

export const agendaService = {
  /** Real-time subscription for entries in a date range.
   *  - null → all engineers (admin view)
   *  - string → single engineer match
   *  - string[] → match any of these IDs (up to 30, Firestore 'in' limit) */
  subscribeToRange(
    rangeStart: string,
    rangeEnd: string,
    ingenieroId: string | string[] | null,
    callback: (entries: AgendaEntry[]) => void,
  ): () => void {
    const constraints: QueryConstraint[] = [
      where('fechaInicio', '<=', rangeEnd),
      orderBy('fechaInicio', 'asc'),
    ];
    if (Array.isArray(ingenieroId)) {
      const unique = Array.from(new Set(ingenieroId.filter(Boolean)));
      if (unique.length === 0) {
        // No valid IDs → return empty immediately
        callback([]);
        return () => {};
      }
      if (unique.length === 1) {
        constraints.unshift(where('ingenieroId', '==', unique[0]));
      } else {
        constraints.unshift(where('ingenieroId', 'in', unique));
      }
    } else if (ingenieroId) {
      constraints.unshift(where('ingenieroId', '==', ingenieroId));
    }
    const q = query(collection(db, 'agendaEntries'), ...constraints);
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

  // Las 3 mutaciones de gastos[] van por runTransaction para evitar
  // last-write-wins entre dos tablets editando el mismo período.

  /** Agrega un gasto al período abierto */
  async agregarGasto(periodoId: string, gasto: GastoViatico): Promise<void> {
    const docRef = doc(db, 'viaticos', periodoId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(docRef);
      if (!snap.exists()) throw new Error('Período no encontrado');
      const data = snap.data();
      const gastos = [...((data.gastos as GastoViatico[]) ?? []), gasto];
      const totales = calcularTotales(gastos);
      tx.update(docRef, { gastos, ...totales, updatedAt: Timestamp.now() });
    });
  },

  /** Edita un gasto existente del período */
  async editarGasto(periodoId: string, gastoId: string, updates: Partial<Omit<GastoViatico, 'id'>>): Promise<void> {
    const docRef = doc(db, 'viaticos', periodoId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(docRef);
      if (!snap.exists()) throw new Error('Período no encontrado');
      const data = snap.data();
      const gastos = ((data.gastos as GastoViatico[]) ?? []).map(g =>
        g.id === gastoId ? { ...g, ...updates } : g
      );
      const totales = calcularTotales(gastos);
      tx.update(docRef, { gastos, ...totales, updatedAt: Timestamp.now() });
    });
  },

  /** Elimina un gasto del período */
  async eliminarGasto(periodoId: string, gastoId: string): Promise<void> {
    const docRef = doc(db, 'viaticos', periodoId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(docRef);
      if (!snap.exists()) throw new Error('Período no encontrado');
      const data = snap.data();
      const gastos = ((data.gastos as GastoViatico[]) ?? []).filter(g => g.id !== gastoId);
      const totales = calcularTotales(gastos);
      tx.update(docRef, { gastos, ...totales, updatedAt: Timestamp.now() });
    });
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

// =============================================
// --- FCM Tokens & Notification Preferences ---
// =============================================
// Bound al db de portal-ingeniero. La implementación vive en @ags/shared/services/fcm
// (antes estaba duplicada byte-cercanamente con sistema-modular).

import { makeFcmTokensService, makeNotificationPrefsService } from '@ags/shared';

export const fcmTokensService = makeFcmTokensService(db);
export const notificationPrefsService = makeNotificationPrefsService(db);

// =============================================
// --- Pendientes (create-only, para derivar a sistema) ---
// =============================================

export const pendientesService = {
  async create(data: Record<string, unknown>): Promise<string> {
    const payload = cleanFirestoreData({
      ...data,
      estado: data.estado || 'pendiente',
      ...getCreateTrace(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const ref = await addDoc(collection(db, 'pendientes'), payload);
    return ref.id;
  },
};
