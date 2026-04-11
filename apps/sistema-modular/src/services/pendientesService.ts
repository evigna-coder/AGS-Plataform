import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  type QueryConstraint,
} from 'firebase/firestore';
import type {
  Pendiente,
  PendienteEstado,
  PendienteResolucionDocType,
  PendienteTipo,
} from '@ags/shared';
import {
  db,
  cleanFirestoreData,
  createBatch,
  batchAudit,
  getCreateTrace,
  getUpdateTrace,
  onSnapshot,
} from './firebase';
import { invalidateCache } from './serviceCache';
import { getCurrentUser } from './currentUser';

const COLLECTION = 'pendientes';

/** Deserializa un doc Firestore a Pendiente (convierte Timestamps a ISO strings). */
function parsePendiente(id: string, data: Record<string, unknown>): Pendiente {
  const toISO = (v: unknown): string | null => {
    if (!v) return null;
    if (typeof v === 'string') return v;
    const ts = v as { toDate?: () => Date };
    return ts.toDate ? ts.toDate().toISOString() : null;
  };
  return {
    id,
    clienteId: (data.clienteId as string) ?? '',
    clienteNombre: (data.clienteNombre as string) ?? '',
    equipoId: (data.equipoId as string) ?? null,
    equipoNombre: (data.equipoNombre as string) ?? null,
    equipoAgsId: (data.equipoAgsId as string) ?? null,
    tipo: (data.tipo as PendienteTipo) ?? 'ambos',
    descripcion: (data.descripcion as string) ?? '',
    estado: (data.estado as PendienteEstado) ?? 'pendiente',
    origenTicketId: (data.origenTicketId as string) ?? null,
    origenTicketRazonSocial: (data.origenTicketRazonSocial as string) ?? null,
    completadaEn: toISO(data.completadaEn),
    completadaPor: (data.completadaPor as string) ?? null,
    completadaPorNombre: (data.completadaPorNombre as string) ?? null,
    resolucionDocType: (data.resolucionDocType as PendienteResolucionDocType) ?? null,
    resolucionDocId: (data.resolucionDocId as string) ?? null,
    resolucionDocLabel: (data.resolucionDocLabel as string) ?? null,
    descartadaEn: toISO(data.descartadaEn),
    descartadaPor: (data.descartadaPor as string) ?? null,
    descartadaPorNombre: (data.descartadaPorNombre as string) ?? null,
    descartadaMotivo: (data.descartadaMotivo as string) ?? null,
    createdAt: toISO(data.createdAt) ?? new Date().toISOString(),
    updatedAt: toISO(data.updatedAt) ?? new Date().toISOString(),
    createdBy: (data.createdBy as string) ?? null,
    createdByName: (data.createdByName as string) ?? null,
    updatedBy: (data.updatedBy as string) ?? null,
    updatedByName: (data.updatedByName as string) ?? null,
  };
}

export interface PendienteFilters {
  clienteId?: string;
  equipoId?: string;
  tipo?: PendienteTipo;
  estado?: PendienteEstado;
  /** Si false (default), excluye descartadas en subscribe/getAll */
  includeDescartadas?: boolean;
}

function buildConstraints(filters?: PendienteFilters): QueryConstraint[] {
  const constraints: QueryConstraint[] = [];
  if (filters?.clienteId) constraints.push(where('clienteId', '==', filters.clienteId));
  if (filters?.equipoId) constraints.push(where('equipoId', '==', filters.equipoId));
  if (filters?.tipo) constraints.push(where('tipo', '==', filters.tipo));
  if (filters?.estado) constraints.push(where('estado', '==', filters.estado));
  constraints.push(orderBy('createdAt', 'desc'));
  return constraints;
}

export const pendientesService = {
  /** Lista con filtros opcionales. */
  async getAll(filters?: PendienteFilters): Promise<Pendiente[]> {
    const q = query(collection(db, COLLECTION), ...buildConstraints(filters));
    const snap = await getDocs(q);
    let items = snap.docs.map(d => parsePendiente(d.id, d.data() as Record<string, unknown>));
    if (!filters?.includeDescartadas && !filters?.estado) {
      items = items.filter(p => p.estado !== 'descartada');
    }
    return items;
  },

  /** Real-time subscription. Returns unsubscribe function. */
  subscribe(
    filters: PendienteFilters | undefined,
    callback: (items: Pendiente[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    const q = query(collection(db, COLLECTION), ...buildConstraints(filters));
    return onSnapshot(
      q,
      snap => {
        let items = snap.docs.map(d => parsePendiente(d.id, d.data() as Record<string, unknown>));
        if (!filters?.includeDescartadas && !filters?.estado) {
          items = items.filter(p => p.estado !== 'descartada');
        }
        callback(items);
      },
      err => {
        console.error('Pendientes subscription error:', err);
        onError?.(err);
      },
    );
  },

  async getById(id: string): Promise<Pendiente | null> {
    const snap = await getDoc(doc(db, COLLECTION, id));
    if (!snap.exists()) return null;
    return parsePendiente(snap.id, snap.data() as Record<string, unknown>);
  },

  /** Subscripción en tiempo real a un pendiente individual */
  subscribeById(
    id: string,
    callback: (item: Pendiente | null) => void,
    onError?: (err: Error) => void,
  ): () => void {
    return onSnapshot(
      doc(db, COLLECTION, id),
      snap => {
        if (!snap.exists()) {
          callback(null);
          return;
        }
        callback(parsePendiente(snap.id, snap.data() as Record<string, unknown>));
      },
      err => {
        console.error('Pendiente subscription error:', err);
        onError?.(err);
      },
    );
  },

  async create(
    data: Omit<
      Pendiente,
      'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'createdByName' | 'updatedBy' | 'updatedByName'
    >,
  ): Promise<string> {
    const id = crypto.randomUUID();
    const payload = cleanFirestoreData({
      ...data,
      estado: data.estado || 'pendiente',
      ...getCreateTrace(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.set(doc(db, COLLECTION, id), payload);
    batchAudit(batch, {
      action: 'create',
      collection: COLLECTION,
      documentId: id,
      after: payload as any,
    });
    await batch.commit();
    invalidateCache(COLLECTION);
    return id;
  },

  async update(id: string, data: Partial<Omit<Pendiente, 'id' | 'createdAt'>>): Promise<void> {
    const payload = cleanFirestoreData({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.update(doc(db, COLLECTION, id), payload);
    batchAudit(batch, {
      action: 'update',
      collection: COLLECTION,
      documentId: id,
      after: payload as any,
    });
    await batch.commit();
    invalidateCache(COLLECTION);
  },

  /**
   * Marca como completada con link al doc resolución.
   * Usado desde flujos de crear presupuesto/OT (Fase 3-4).
   */
  async completar(
    id: string,
    data: {
      resolucionDocType: PendienteResolucionDocType;
      resolucionDocId: string;
      resolucionDocLabel: string;
    },
  ): Promise<void> {
    const user = getCurrentUser();
    await this.update(id, {
      estado: 'completada',
      completadaEn: new Date().toISOString(),
      completadaPor: user?.id ?? null,
      completadaPorNombre: user?.displayName ?? null,
      resolucionDocType: data.resolucionDocType,
      resolucionDocId: data.resolucionDocId,
      resolucionDocLabel: data.resolucionDocLabel,
    });
  },

  /** Marca como descartada con motivo opcional */
  async descartar(id: string, motivo?: string | null): Promise<void> {
    const user = getCurrentUser();
    await this.update(id, {
      estado: 'descartada',
      descartadaEn: new Date().toISOString(),
      descartadaPor: user?.id ?? null,
      descartadaPorNombre: user?.displayName ?? null,
      descartadaMotivo: motivo || null,
    });
  },

  /** Vuelve a pendiente (undo de completada/descartada) */
  async reabrir(id: string): Promise<void> {
    await this.update(id, {
      estado: 'pendiente',
      completadaEn: null,
      completadaPor: null,
      completadaPorNombre: null,
      resolucionDocType: null,
      resolucionDocId: null,
      resolucionDocLabel: null,
      descartadaEn: null,
      descartadaPor: null,
      descartadaPorNombre: null,
      descartadaMotivo: null,
    });
  },

  /** Hard delete — solo para admin en casos excepcionales */
  async delete(id: string): Promise<void> {
    const batch = createBatch();
    batch.delete(doc(db, COLLECTION, id));
    batchAudit(batch, {
      action: 'delete',
      collection: COLLECTION,
      documentId: id,
    });
    await batch.commit();
    invalidateCache(COLLECTION);
  },
};
