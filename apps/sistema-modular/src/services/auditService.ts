import { collection, getDocs, query, where, orderBy, limit, Timestamp, type QueryConstraint } from 'firebase/firestore';
import type { AuditLogEntry, AuditAction } from '@ags/shared';
import { db } from './firebase';

export interface AuditFilters {
  /** UID del usuario que ejecutó la acción */
  userId?: string;
  /** Colección de la entidad afectada (ej: 'clientes', 'ordenes_trabajo') */
  collection?: string;
  /** ID específico de un documento (para vista historial por entidad) */
  documentId?: string;
  /** Tipo de acción */
  action?: AuditAction;
  /** Solo eventos de negocio con este nombre (ej: 'presupuesto.enviado') */
  eventName?: string;
  /** Fecha mínima (ISO yyyy-mm-dd) */
  desde?: string;
  /** Fecha máxima (ISO yyyy-mm-dd) — incluye todo el día */
  hasta?: string;
}

interface RawAuditDoc {
  action: AuditAction;
  collection: string;
  documentId: string;
  userId: string;
  userName: string;
  timestamp: Timestamp;
  changes?: { before?: Record<string, unknown>; after?: Record<string, unknown> } | null;
  eventName?: string | null;
  details?: Record<string, unknown> | null;
  entityLabel?: string | null;
}

function toEntry(id: string, d: RawAuditDoc): AuditLogEntry {
  return {
    id,
    action: d.action,
    collection: d.collection,
    documentId: d.documentId,
    userId: d.userId,
    userName: d.userName,
    timestamp: d.timestamp instanceof Timestamp ? d.timestamp.toDate().toISOString() : String(d.timestamp ?? ''),
    changes: d.changes ?? null,
    eventName: d.eventName ?? null,
    details: d.details ?? null,
    entityLabel: d.entityLabel ?? null,
  };
}

export const auditService = {
  /** Lista entries con filtros. `pageSize` default 200 (suficiente para una vista
   * típica). Para volúmenes mayores el usuario debería refinar filtros. */
  async list(filters: AuditFilters = {}, pageSize = 200): Promise<AuditLogEntry[]> {
    const constraints: QueryConstraint[] = [];

    // Aplicamos hasta 1 filtro de igualdad por campo + el orden por timestamp.
    // Firestore acepta múltiples where('==') sin requerir índice compuesto si la
    // cardinalidad de cada filtro es razonable. Si combinás user + collection +
    // action + range de fechas vas a necesitar un índice compuesto — Firestore
    // te dará el link al fallar. Aceptable.
    if (filters.userId) constraints.push(where('userId', '==', filters.userId));
    if (filters.collection) constraints.push(where('collection', '==', filters.collection));
    if (filters.documentId) constraints.push(where('documentId', '==', filters.documentId));
    if (filters.action) constraints.push(where('action', '==', filters.action));
    if (filters.eventName) constraints.push(where('eventName', '==', filters.eventName));

    if (filters.desde) {
      constraints.push(where('timestamp', '>=', Timestamp.fromDate(new Date(filters.desde + 'T00:00:00'))));
    }
    if (filters.hasta) {
      constraints.push(where('timestamp', '<=', Timestamp.fromDate(new Date(filters.hasta + 'T23:59:59'))));
    }

    constraints.push(orderBy('timestamp', 'desc'));
    constraints.push(limit(pageSize));

    const q = query(collection(db, 'audit_log'), ...constraints);
    const snap = await getDocs(q);
    return snap.docs.map(d => toEntry(d.id, d.data() as RawAuditDoc));
  },

  /** Lista entries por entidad — atajo para la vista "Historial" en detail pages. */
  async listForEntity(collectionName: string, documentId: string, pageSize = 100): Promise<AuditLogEntry[]> {
    return this.list({ collection: collectionName, documentId }, pageSize);
  },
};
