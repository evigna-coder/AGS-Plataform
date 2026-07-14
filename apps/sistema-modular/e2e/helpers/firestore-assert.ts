/**
 * Firestore read helpers for Playwright E2E specs.
 *
 * REWRITE 2026-07: las reglas Firestore endurecidas (auth requerido para todo)
 * rompieron el acceso vía client SDK desde Node sin autenticar (PERMISSION_DENIED).
 * Ahora TODAS las lecturas corren EN EL BROWSER autenticado vía `page.evaluate`
 * usando `window.__ags` (expuesto dev-only en src/services/firebase.ts) — mismo
 * patrón que circuits/15-checklist-stock-ot.spec.ts.
 *
 * Toda función recibe `page: Page` como primer argumento; la firma de retorno
 * se mantiene igual que la versión Node-side.
 *
 * `fixtures/firebase-e2e.ts` queda obsoleto — nada debe importarlo.
 */

import type { Page } from '@playwright/test';
import type { TicketEstado, RequerimientoCompra, SolicitudFacturacion } from '@ags/shared';

// ── Local type aliases ─────────────────────────────────────────────────────

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

// ── Core in-browser executors ──────────────────────────────────────────────

/**
 * La page compartida a veces pierde la app (crash/reload). Si `window.__ags`
 * no está, recargamos la app y esperamos el sidebar (auth gate resuelto).
 */
async function ensureAgs(page: Page): Promise<void> {
  const ok = await page
    .evaluate(() => typeof (window as any).__ags !== 'undefined')
    .catch(() => false);
  if (!ok) {
    await page.goto('http://localhost:3001');
    await page.locator('aside nav').waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1000);
  }
}

interface QuerySpec {
  col: string;
  wheres?: Array<[field: string, op: string, value: unknown]>;
  orderBy?: [field: string, dir: 'asc' | 'desc'];
  /** Aplicado client-side (window.__ags no expone `limit`). */
  limit?: number;
}

/** Query genérica contra una colección, ejecutada en el browser autenticado. */
async function queryCol(page: Page, spec: QuerySpec): Promise<any[]> {
  await ensureAgs(page);
  return page.evaluate(async (s) => {
    const ags = (window as any).__ags;
    if (!ags) throw new Error('window.__ags no disponible — ¿dev server en modo DEV?');
    const { collection, query, where, orderBy, getDocs } = ags.firestore;
    const clauses: any[] = (s.wheres ?? []).map(([f, op, v]: any) => where(f, op, v));
    if (s.orderBy) clauses.push(orderBy(s.orderBy[0], s.orderBy[1]));
    const snap = await getDocs(query(collection(ags.db, s.col), ...clauses));
    let docs = snap.docs.map((d: any) => ({ id: d.id, ...JSON.parse(JSON.stringify(d.data())) }));
    if (s.limit) docs = docs.slice(0, s.limit);
    return docs;
  }, spec);
}

/** Lectura de un doc por id, ejecutada en el browser autenticado. */
async function getDocById(page: Page, col: string, id: string): Promise<any | null> {
  await ensureAgs(page);
  return page.evaluate(async (p) => {
    const ags = (window as any).__ags;
    if (!ags) throw new Error('window.__ags no disponible — ¿dev server en modo DEV?');
    const { doc, getDoc } = ags.firestore;
    const snap = await getDoc(doc(ags.db, p.col, p.id));
    return snap.exists() ? { id: snap.id, ...JSON.parse(JSON.stringify(snap.data())) } : null;
  }, { col, id });
}

// ── Readers ────────────────────────────────────────────────────────────────

/** Reads the `pendingActions[]` array of a presupuesto. Returns [] if doc missing. */
export async function getPendingActions(page: Page, presupuestoId: string): Promise<PendingAction[]> {
  const doc = await getDocById(page, 'presupuestos', presupuestoId);
  return (doc?.pendingActions as PendingAction[] | undefined) ?? [];
}

/** Lists all unresolved pendingActions across presupuestos. Optional type filter. */
export async function getUnresolvedPendingActions(page: Page, opts?: {
  type?: PendingAction['type'];
}): Promise<Array<{ presupuestoId: string; action: PendingAction }>> {
  const docs = await queryCol(page, { col: 'presupuestos' });
  const out: Array<{ presupuestoId: string; action: PendingAction }> = [];
  for (const d of docs) {
    const actions = (d.pendingActions as PendingAction[] | undefined) ?? [];
    for (const a of actions) {
      if (a.resolvedAt) continue;
      if (opts?.type && a.type !== opts.type) continue;
      out.push({ presupuestoId: d.id, action: a });
    }
  }
  return out;
}

/** Reads the current `estado` field of a ticket (stored in `leads` collection). */
export async function getTicketEstado(page: Page, leadId: string): Promise<TicketEstado | null> {
  const doc = await getDocById(page, 'leads', leadId);
  return (doc?.estado as TicketEstado) ?? null;
}

/** Reads an OC cliente by id from `ordenesCompraCliente`. Null if missing. */
export async function getOCCliente(page: Page, id: string): Promise<OrdenCompraCliente | null> {
  return (await getDocById(page, 'ordenesCompraCliente', id)) as OrdenCompraCliente | null;
}

/** Lists all OC cliente linked to a presupuesto (via `presupuestosIds` array). */
export async function getOCsByPresupuesto(page: Page, presupuestoId: string): Promise<OrdenCompraCliente[]> {
  return queryCol(page, {
    col: 'ordenesCompraCliente',
    wheres: [['presupuestosIds', 'array-contains', presupuestoId]],
  }) as Promise<OrdenCompraCliente[]>;
}

/** Reads docs in `mailQueue` filtered by type + status. */
export async function getMailQueueDocs(page: Page, opts: {
  type?: 'cierre_admin_ot' | string;
  status?: 'pending' | 'sent' | 'failed';
  limit?: number;
}): Promise<Array<{ id: string; data: any }>> {
  const wheres: QuerySpec['wheres'] = [];
  if (opts.type) wheres.push(['type', '==', opts.type]);
  if (opts.status) wheres.push(['status', '==', opts.status]);
  const docs = await queryCol(page, {
    col: 'mailQueue',
    wheres,
    orderBy: ['createdAt', 'desc'],
    limit: opts.limit ?? 50,
  });
  return docs.map((d) => {
    const { id, ...data } = d;
    return { id, data };
  });
}

/** Reads docs in `mailQueue` for a specific OT (data.otNumber). Sin orderBy — determinista y sin índice compuesto. */
export async function getMailQueueDocsByOt(page: Page, otNumber: string): Promise<Array<{ id: string; data: any }>> {
  const docs = await queryCol(page, {
    col: 'mailQueue',
    wheres: [['data.otNumber', '==', otNumber]],
  });
  return docs.map((d) => {
    const { id, ...data } = d;
    return { id, data };
  });
}

/** Reads `adminConfig/flujos` doc. Null if not initialized yet. */
export async function getAdminConfigFlujos(page: Page): Promise<{
  usuarioSeguimientoId?: string;
  usuarioCoordinadorOTId?: string;
  mailFacturacion?: string;
} | null> {
  return getDocById(page, 'adminConfig', 'flujos');
}

/**
 * Reads requerimientos linked to a presupuesto, with optional filters.
 * NOTE: la colección real es `requerimientos_compra` (snake_case — ver
 * importacionesService.ts); la versión anterior de este helper apuntaba a
 * `requerimientosCompra` y devolvía siempre [].
 */
export async function getRequerimientosByPresupuesto(
  page: Page,
  presupuestoId: string,
  opts?: { estado?: string; condicional?: boolean },
): Promise<RequerimientoCompra[]> {
  const wheres: QuerySpec['wheres'] = [['presupuestoId', '==', presupuestoId]];
  if (opts?.estado) wheres.push(['estado', '==', opts.estado]);
  if (typeof opts?.condicional === 'boolean') wheres.push(['condicional', '==', opts.condicional]);
  return queryCol(page, { col: 'requerimientos_compra', wheres }) as Promise<RequerimientoCompra[]>;
}

/**
 * Reads a presupuesto doc by id.
 * Returns full doc (any-typed — no canonical PresupuestoDoc in test layer) or null if missing.
 */
export async function getPresupuesto(page: Page, id: string): Promise<any | null> {
  return getDocById(page, 'presupuestos', id);
}

// ── Phase 12 helpers ───────────────────────────────────────────────────────

/** Local alias — matches locked shape from 12-CONTEXT.md */
type PresupuestoCuotaFacturacion = {
  id: string;
  numero: number;
  porcentajePorMoneda: Partial<Record<'ARS' | 'USD' | 'EUR', number>>;
  descripcion: string;
  hito: 'ppto_aceptado' | 'oc_recibida' | 'pre_embarque' | 'todas_ots_cerradas' | 'manual';
  estado: 'pendiente' | 'habilitada' | 'solicitada' | 'facturada' | 'cobrada';
  solicitudFacturacionId?: string | null;
  montoFacturadoPorMoneda?: Partial<Record<'ARS' | 'USD' | 'EUR', number>> | null;
};

/**
 * Phase 12 BILL-08 helper: returns the cuota schema attached to a presupuesto.
 * Returns [] for legacy Tier-1 presupuestos (esquemaFacturacion is null/undefined).
 */
export async function getPresupuestoEsquema(page: Page, presId: string): Promise<PresupuestoCuotaFacturacion[]> {
  const pres = await getPresupuesto(page, presId);
  return (pres?.esquemaFacturacion ?? []) as PresupuestoCuotaFacturacion[];
}

/** Reads a solicitudFacturacion doc by id. */
export async function getSolicitudFacturacion(
  page: Page,
  id: string,
): Promise<(SolicitudFacturacion & { id: string }) | null> {
  return getDocById(page, 'solicitudesFacturacion', id);
}

/** Lists solicitudesFacturacion linked to a given OT number (via `otNumbers` array). */
export async function getSolicitudesFacturacionByOt(
  page: Page,
  otNumber: string,
): Promise<Array<SolicitudFacturacion & { id: string }>> {
  return queryCol(page, {
    col: 'solicitudesFacturacion',
    wheres: [['otNumbers', 'array-contains', otNumber]],
  });
}

/** Lists solicitudesFacturacion linked to a presupuesto by presupuestoId field. */
export async function getSolicitudesFacturacionByPresupuesto(
  page: Page,
  presupuestoId: string,
): Promise<Array<SolicitudFacturacion & { id: string }>> {
  return queryCol(page, {
    col: 'solicitudesFacturacion',
    wheres: [['presupuestoId', '==', presupuestoId]],
  });
}

/**
 * Lists solicitudesFacturacion filtered by optional estado.
 * Used for assertions that do not have a specific ID or OT number (e.g. 11.13b).
 */
export async function getSolicitudesFacturacion(
  page: Page,
  filters?: { estado?: string; limit?: number },
): Promise<Array<SolicitudFacturacion & { id: string }>> {
  const wheres: QuerySpec['wheres'] = [];
  if (filters?.estado) wheres.push(['estado', '==', filters.estado]);
  return queryCol(page, { col: 'solicitudesFacturacion', wheres, limit: filters?.limit });
}

/**
 * Lists OTs (stored in `reportes` collection per otService.ts:40 comment) linked to a
 * budget number (via `budgets` array-contains).
 */
export async function getOTsByBudget(page: Page, budgetNumber: string): Promise<any[]> {
  return queryCol(page, {
    col: 'reportes',
    wheres: [['budgets', 'array-contains', budgetNumber]],
  });
}

/**
 * Lists tickets de coordinación (colección `leads`, estado `en_coordinacion`) linkeados
 * a un presupuesto por ID.
 */
export async function getTicketsCoordinacionByPresupuesto(page: Page, presupuestoId: string): Promise<any[]> {
  return queryCol(page, {
    col: 'leads',
    wheres: [
      ['presupuestosIds', 'array-contains', presupuestoId],
      ['estado', '==', 'en_coordinacion'],
    ],
  });
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
