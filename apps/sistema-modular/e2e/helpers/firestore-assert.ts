/**
 * Firestore read helpers for Playwright E2E specs (Phase 8 Wave 0).
 *
 * Purpose: let specs assert against Firestore state written by the app
 * (e.g. `pendingActions[]`, `mailQueue` docs, OC cliente shape, ticket
 * estado). Uses the client SDK via `fixtures/firebase-e2e.ts`.
 *
 * NOTE: `PendingAction` and `OrdenCompraCliente` types don't yet exist in
 * `@ags/shared` — they land in Wave 1 (plan 08-01). This file declares
 * local type aliases that mirror the locked shapes from 08-CONTEXT.md.
 * Once 08-01 lands the canonical types, replace these with imports:
 *   import type { PendingAction, OrdenCompraCliente } from '@ags/shared';
 *
 * RED baseline: all readers target collections/fields that don't all
 * exist yet. Queries return `[]` / `null` until Wave 1-3 populate them.
 */

import { db } from '../fixtures/firebase-e2e';
import {
  doc,
  getDoc,
  collection,
  collectionGroup,
  query,
  where,
  getDocs,
  orderBy,
  limit as qLimit,
} from 'firebase/firestore';
import type { TicketEstado, RequerimientoCompra, SolicitudFacturacion } from '@ags/shared';

// ── Local type aliases (upgrade to `@ags/shared` imports in Wave 1) ────────

/** PendingAction — shape locked in 08-CONTEXT.md FLOW-06. */
export interface PendingAction {
  id: string;
  type:
    | 'crear_ticket_seguimiento'
    | 'derivar_comex'
    | 'enviar_mail_facturacion'
    | 'notificar_coordinador_ot';
  reason: string;
  createdAt: string;
  resolvedAt?: string;
  attempts: number;
}

/** OrdenCompraCliente — shape locked in 08-CONTEXT.md FLOW-02. */
export interface OrdenCompraCliente {
  id: string;
  numero: string;
  fecha: string;
  clienteId: string;
  presupuestosIds: string[];
  adjuntos: Array<{
    id: string;
    url: string;
    tipo: 'pdf' | 'jpg' | 'png';
    nombre: string;
    fechaCarga: string;
  }>;
  notas?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
  updatedBy?: string | null;
  updatedByName?: string | null;
}

// ── Readers ────────────────────────────────────────────────────────────────

/** Reads the `pendingActions[]` array of a presupuesto. Returns [] if doc missing. */
export async function getPendingActions(presupuestoId: string): Promise<PendingAction[]> {
  const snap = await getDoc(doc(db, 'presupuestos', presupuestoId));
  if (!snap.exists()) return [];
  const data = snap.data() as { pendingActions?: PendingAction[] };
  return data.pendingActions ?? [];
}

/** Lists all unresolved pendingActions across presupuestos. Optional type filter. */
export async function getUnresolvedPendingActions(opts?: {
  type?: PendingAction['type'];
}): Promise<Array<{ presupuestoId: string; action: PendingAction }>> {
  const snap = await getDocs(collection(db, 'presupuestos'));
  const out: Array<{ presupuestoId: string; action: PendingAction }> = [];
  for (const d of snap.docs) {
    const actions = ((d.data() as any).pendingActions as PendingAction[] | undefined) ?? [];
    for (const a of actions) {
      if (a.resolvedAt) continue;
      if (opts?.type && a.type !== opts.type) continue;
      out.push({ presupuestoId: d.id, action: a });
    }
  }
  return out;
}

/** Reads the current `estado` field of a ticket (stored in `leads` collection). */
export async function getTicketEstado(leadId: string): Promise<TicketEstado | null> {
  const snap = await getDoc(doc(db, 'leads', leadId));
  if (!snap.exists()) return null;
  return ((snap.data() as any).estado as TicketEstado) ?? null;
}

/** Reads an OC cliente by id from `ordenesCompraCliente`. Null if missing. */
export async function getOCCliente(id: string): Promise<OrdenCompraCliente | null> {
  const snap = await getDoc(doc(db, 'ordenesCompraCliente', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<OrdenCompraCliente, 'id'>) };
}

/** Lists all OC cliente linked to a presupuesto (via `presupuestosIds` array). */
export async function getOCsByPresupuesto(presupuestoId: string): Promise<OrdenCompraCliente[]> {
  const q = query(
    collection(db, 'ordenesCompraCliente'),
    where('presupuestosIds', 'array-contains', presupuestoId),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<OrdenCompraCliente, 'id'>) }));
}

/** Reads docs in `mailQueue` filtered by type + status. */
export async function getMailQueueDocs(opts: {
  type?: 'cierre_admin_ot' | string;
  status?: 'pending' | 'sent' | 'failed';
  limit?: number;
}): Promise<Array<{ id: string; data: any }>> {
  const clauses: any[] = [];
  if (opts.type) clauses.push(where('type', '==', opts.type));
  if (opts.status) clauses.push(where('status', '==', opts.status));
  const q = query(
    collection(db, 'mailQueue'),
    ...clauses,
    orderBy('createdAt', 'desc'),
    qLimit(opts.limit ?? 50),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
}

/** Reads `adminConfig/flujos` doc. Null if not initialized yet. */
export async function getAdminConfigFlujos(): Promise<{
  usuarioSeguimientoId?: string;
  usuarioCoordinadorOTId?: string;
  mailFacturacion?: string;
} | null> {
  const snap = await getDoc(doc(db, 'adminConfig', 'flujos'));
  if (!snap.exists()) return null;
  return snap.data() as any;
}

/** Reads requerimientos linked to a presupuesto, with optional filters. */
export async function getRequerimientosByPresupuesto(
  presupuestoId: string,
  opts?: { estado?: string; condicional?: boolean },
): Promise<RequerimientoCompra[]> {
  const clauses: any[] = [where('presupuestoId', '==', presupuestoId)];
  if (opts?.estado) clauses.push(where('estado', '==', opts.estado));
  if (typeof opts?.condicional === 'boolean') {
    clauses.push(where('condicional', '==', opts.condicional));
  }
  const q = query(collection(db, 'requerimientosCompra'), ...clauses);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RequerimientoCompra, 'id'>) }));
}

// ── Phase 10 helpers (Wave 0 RED baseline) ─────────────────────────────────

/**
 * Reads a presupuesto doc by id.
 * Returns full doc (any-typed — no canonical PresupuestoDoc in test layer) or null if missing.
 */
export async function getPresupuesto(id: string): Promise<any | null> {
  const snap = await getDoc(doc(db, 'presupuestos', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Reads a solicitudFacturacion doc by id.
 * TODO(Wave 1): tighten type once SolicitudFacturacion extension lands (add 'enviada' estado, enviadaAt, ordenesCompraIds).
 */
export async function getSolicitudFacturacion(
  id: string,
): Promise<(SolicitudFacturacion & { id: string }) | null> {
  const snap = await getDoc(doc(db, 'solicitudesFacturacion', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<SolicitudFacturacion, 'id'>) };
}

/**
 * Lists solicitudesFacturacion linked to a given OT number (via `otNumbers` array).
 * Uses array-contains pattern consistent with getOCsByPresupuesto.
 * TODO(Wave 1): tighten type once SolicitudFacturacion extension lands.
 */
export async function getSolicitudesFacturacionByOt(
  otNumber: string,
): Promise<Array<SolicitudFacturacion & { id: string }>> {
  const q = query(
    collection(db, 'solicitudesFacturacion'),
    where('otNumbers', 'array-contains', otNumber),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<SolicitudFacturacion, 'id'>),
  }));
}

/**
 * Lists solicitudesFacturacion linked to a presupuesto by presupuestoId field.
 * TODO(Wave 1): tighten type once SolicitudFacturacion extension lands.
 */
export async function getSolicitudesFacturacionByPresupuesto(
  presupuestoId: string,
): Promise<Array<SolicitudFacturacion & { id: string }>> {
  const q = query(
    collection(db, 'solicitudesFacturacion'),
    where('presupuestoId', '==', presupuestoId),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<SolicitudFacturacion, 'id'>),
  }));
}

/**
 * Lists solicitudesFacturacion filtered by optional estado.
 * Used for assertions that do not have a specific ID or OT number (e.g. 11.13b).
 */
export async function getSolicitudesFacturacion(
  filters?: { estado?: string; limit?: number },
): Promise<Array<SolicitudFacturacion & { id: string }>> {
  let q = query(collection(db, 'solicitudesFacturacion'));
  if (filters?.estado) q = query(q, where('estado', '==', filters.estado));
  const snap = await getDocs(q);
  const items = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<SolicitudFacturacion, 'id'>),
  }));
  return filters?.limit ? items.slice(0, filters.limit) : items;
}

/**
 * Lists OTs (stored in `reportes` collection per otService.ts:40 comment) linked to a
 * budget number (via `budgets` array-contains).
 * Collection name: `reportes` (not `ordenesTrabajo`) — this is the canonical OT collection.
 */
export async function getOTsByBudget(budgetNumber: string): Promise<any[]> {
  const q = query(
    collection(db, 'reportes'),
    where('budgets', 'array-contains', budgetNumber),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Poll an async reader until `predicate(value)` returns true, or timeout.
 * Default: 10s total with 500ms interval. Throws the last value if predicate
 * never holds — specs get a clear failure instead of a generic timeout.
 */
export async function pollUntil<T>(
  fn: () => Promise<T>,
  predicate: (v: T) => boolean,
  opts?: { timeout?: number; interval?: number },
): Promise<T> {
  const timeout = opts?.timeout ?? 10_000;
  const interval = opts?.interval ?? 500;
  const start = Date.now();
  let lastValue: T;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    lastValue = await fn();
    if (predicate(lastValue)) return lastValue;
    if (Date.now() - start >= timeout) {
      throw new Error(
        `pollUntil: predicate did not hold within ${timeout}ms. Last value: ${JSON.stringify(lastValue)}`,
      );
    }
    await new Promise((r) => setTimeout(r, interval));
  }
}
