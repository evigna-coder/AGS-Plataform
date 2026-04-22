import {
  collection, doc, getDoc, getDocs, query, where, Timestamp,
  updateDoc, deleteDoc, runTransaction,
} from 'firebase/firestore';
import type {
  OrdenCompraCliente, Presupuesto, Posta, TicketEstado, Ticket,
} from '@ags/shared';
import {
  db, deepCleanForFirestore, getUpdateTrace, onSnapshot,
} from './firebase';
import { notifyCoordinadorOTBestEffort } from './cargarOCHelpers';

/**
 * Servicio para la colección `ordenesCompraCliente` (OCs emitidas por el CLIENTE hacia AGS — FLOW-02).
 * Separada de `ordenes_compra` (OCs internas a proveedores).
 *
 * CRUD baseline entregado en plan 08-01. La operación transaccional `cargarOC`
 * es el core de FLOW-02 (plan 08-02): crea/actualiza la OC, linkea el/los
 * presupuesto(s) (N:M) y transiciona el ticket de seguimiento a `oc_recibida`
 * atómicamente.
 *
 * **Regla de negocio (2026-04-22)**: adjuntar OC = señal de aceptación del cliente.
 * Si el ppto está en `borrador` o `enviado`, `cargarOC` ahora dispara
 * `aceptarConRequerimientos` antes del tx principal (pre-flight secuencial),
 * aplicando toda la lógica de aceptación (derivación Comex, auto-ticket coordinación ventas,
 * requerimientos condicionales). Si está `aceptado`, comportamiento actual. Si está
 * `rechazado` o `vencido`, sigue fallando fast.
 *
 * Hard rules (RESEARCH):
 * - NO `arrayUnion` dentro de `runTransaction` (no transaccional → merge manual).
 * - NO llamar otros services que abran batch/tx (nested prohibido) — todas las
 *   writes inline aquí.
 * - Reads antes que writes (Firestore SDK constraint).
 * - `deepCleanForFirestore` en cada write (no undefined).
 */

const COLLECTION = 'ordenesCompraCliente';

function toISO(val: any, fallback: string | null = null): string | null {
  if (!val) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val?.toDate === 'function') return val.toDate().toISOString();
  if (typeof val?.seconds === 'number') return new Date(val.seconds * 1000).toISOString();
  return fallback;
}

function parseOC(d: any, id: string): OrdenCompraCliente {
  return {
    id,
    ...d,
    createdAt: (toISO(d.createdAt, '') as string) || '',
    updatedAt: (toISO(d.updatedAt, '') as string) || '',
  };
}

export const ordenesCompraClienteService = {
  async getAll(filters?: { clienteId?: string }): Promise<OrdenCompraCliente[]> {
    let q = query(collection(db, COLLECTION));
    if (filters?.clienteId) q = query(q, where('clienteId', '==', filters.clienteId));
    const snap = await getDocs(q);
    const items = snap.docs.map(d => parseOC(d.data(), d.id));
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return items;
  },

  async getById(id: string): Promise<OrdenCompraCliente | null> {
    const snap = await getDoc(doc(db, COLLECTION, id));
    if (!snap.exists()) return null;
    return parseOC(snap.data(), snap.id);
  },

  async getByPresupuesto(presupuestoId: string): Promise<OrdenCompraCliente[]> {
    const q = query(
      collection(db, COLLECTION),
      where('presupuestosIds', 'array-contains', presupuestoId),
    );
    const snap = await getDocs(q);
    const items = snap.docs.map(d => parseOC(d.data(), d.id));
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return items;
  },

  async getByCliente(clienteId: string): Promise<OrdenCompraCliente[]> {
    const q = query(collection(db, COLLECTION), where('clienteId', '==', clienteId));
    const snap = await getDocs(q);
    const items = snap.docs.map(d => parseOC(d.data(), d.id));
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return items;
  },

  subscribe(
    filters: { clienteId?: string } | undefined,
    callback: (docs: OrdenCompraCliente[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    let q = query(collection(db, COLLECTION));
    if (filters?.clienteId) q = query(q, where('clienteId', '==', filters.clienteId));
    return onSnapshot(q, snap => {
      const items = snap.docs.map(d => parseOC(d.data(), d.id));
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(items);
    }, err => {
      console.error('ordenesCompraCliente subscription error:', err);
      onError?.(err);
    });
  },

  async update(id: string, data: Partial<OrdenCompraCliente>): Promise<void> {
    const { id: _omit, createdAt: _skip, ...rest } = data;
    void _omit; void _skip;
    await updateDoc(doc(db, COLLECTION, id), deepCleanForFirestore({
      ...rest,
      updatedAt: Timestamp.now(),
      ...getUpdateTrace(),
    }));
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, id));
  },

  /**
   * FLOW-02 core: carga atómica de una OC del cliente.
   *
   * Flow:
   *   1. Lee todos los presupuestos target + lead (si hay) + OC existente (si hay).
   *   2. Valida: cada presupuesto debe estar `aceptado` (si no → throw, tx rollback).
   *   3. Crea nueva OC o mergea `presupuestosIds` en la existente.
   *   4. Para cada presupuesto: mergea manualmente `ordenesCompraIds` (sin arrayUnion).
   *   5. Si hay lead: transiciona a `oc_recibida` + appendea Posta.
   *   6. Post-commit best-effort: notifica al coordinador OT. Si falla, appendea
   *      `pendingAction 'notificar_coordinador_ot'` a cada presupuesto.
   *
   * NO appendea `pendingAction 'derivar_comex'` (W1 fix 2026-04-21: la derivación
   * a Comex ocurre en acceptance vía plan 08-04 `aceptarConRequerimientos`).
   */
  async cargarOC(
    payload: Omit<OrdenCompraCliente, 'id' | 'createdAt' | 'updatedAt'>,
    context: {
      leadId?: string | null;
      presupuestosIds: string[];
      existingOcId?: string | null;
    },
    actor?: { uid: string; name?: string },
  ): Promise<{ id: string; numero: string }> {
    if (!context.presupuestosIds.length) {
      throw new Error('cargarOC: al menos 1 presupuesto requerido');
    }

    // Pre-flight: OC adjunta = aceptación. Para cada ppto no-aceptado, disparar
    // aceptarConRequerimientos antes del tx. Fallar fast en estados terminales.
    // Lazy import para mantener consistencia con el pattern de plan 10-04 y evitar
    // futura circular dep si presupuestosService importara este service.
    const preflightSnaps = await Promise.all(
      context.presupuestosIds.map(id => getDoc(doc(db, 'presupuestos', id))),
    );
    for (let i = 0; i < preflightSnaps.length; i++) {
      const snap = preflightSnaps[i];
      const pid = context.presupuestosIds[i];
      if (!snap.exists()) {
        throw new Error(`Presupuesto ${pid} no encontrado`);
      }
      const p = snap.data() as any;
      if (p.estado === 'rechazado' || p.estado === 'vencido') {
        throw new Error(
          `Presupuesto ${p.numero || pid} está ${p.estado}; no se puede cargar OC.`,
        );
      }
      if (p.estado === 'borrador' || p.estado === 'enviado') {
        const { presupuestosService } = await import('./presupuestosService');
        await presupuestosService.aceptarConRequerimientos(pid, actor);
      }
      // else: estado === 'aceptado' → proceed
    }

    const nowIso = new Date().toISOString();
    const ocRef = context.existingOcId
      ? doc(db, COLLECTION, context.existingOcId)
      : doc(collection(db, COLLECTION));
    const finalOcId = ocRef.id;
    const actorUid = actor?.uid || null;
    const actorName = actor?.name || null;

    let finalNumero = payload.numero;

    await runTransaction(db, async (tx) => {
      // ── READS (todas primero) ─────────────────────────────────────────
      const presSnaps = await Promise.all(
        context.presupuestosIds.map(id => tx.get(doc(db, 'presupuestos', id))),
      );
      const leadSnap = context.leadId
        ? await tx.get(doc(db, 'leads', context.leadId))
        : null;
      const ocSnap = context.existingOcId ? await tx.get(ocRef) : null;

      // ── VALIDATIONS ───────────────────────────────────────────────────
      const presupuestos = presSnaps.map((s, i) => {
        if (!s.exists()) {
          throw new Error(`Presupuesto ${context.presupuestosIds[i]} no encontrado`);
        }
        const p = { id: s.id, ...(s.data() as any) } as Presupuesto;
        if (p.estado !== 'aceptado') {
          throw new Error(
            `Presupuesto ${p.numero || p.id} no está aceptado (estado actual: ${p.estado}). No se puede cargar OC.`,
          );
        }
        return p;
      });

      // Si es OC existente, guarda el numero real (payload.numero puede venir vacío del caller).
      if (context.existingOcId && ocSnap?.exists()) {
        const existing = ocSnap.data() as OrdenCompraCliente;
        finalNumero = existing.numero || finalNumero;
      }

      // ── WRITES ────────────────────────────────────────────────────────
      if (context.existingOcId && ocSnap?.exists()) {
        const existing = ocSnap.data() as OrdenCompraCliente;
        const mergedPresIds = Array.from(new Set([
          ...(existing.presupuestosIds || []),
          ...context.presupuestosIds,
        ]));
        const mergedAdjuntos = [
          ...(existing.adjuntos || []),
          ...(payload.adjuntos || []),
        ];
        tx.update(ocRef, deepCleanForFirestore({
          presupuestosIds: mergedPresIds,
          adjuntos: mergedAdjuntos,
          notas: payload.notas ?? existing.notas ?? null,
          updatedAt: nowIso,
          updatedBy: actorUid,
          updatedByName: actorName,
        }));
      } else {
        tx.set(ocRef, deepCleanForFirestore({
          numero: payload.numero,
          fecha: payload.fecha,
          clienteId: payload.clienteId,
          presupuestosIds: Array.from(new Set(context.presupuestosIds)),
          adjuntos: payload.adjuntos || [],
          notas: payload.notas ?? null,
          createdAt: nowIso,
          updatedAt: nowIso,
          createdBy: actorUid,
          createdByName: actorName,
          updatedBy: actorUid,
          updatedByName: actorName,
        }));
      }

      // Per-presupuesto: merge manual de ordenesCompraIds (NO arrayUnion).
      for (const p of presupuestos) {
        const currentOcIds = p.ordenesCompraIds || [];
        const newOcIds = currentOcIds.includes(finalOcId)
          ? currentOcIds
          : [...currentOcIds, finalOcId];

        tx.update(doc(db, 'presupuestos', p.id), deepCleanForFirestore({
          ordenesCompraIds: newOcIds,
          updatedAt: nowIso,
          updatedBy: actorUid,
          updatedByName: actorName,
        }));
      }

      // Lead update + posta append (si hay lead).
      if (leadSnap?.exists()) {
        const lead = leadSnap.data() as Ticket;
        const estadoAnterior: TicketEstado = lead.estado;
        // Idempotencia: si el ticket ya está en 'oc_recibida', no cambiar estado
        // pero sí appendear Posta (registra la 2da OC cargada).
        const nuevaPosta: Posta = {
          id: crypto.randomUUID(),
          fecha: nowIso,
          deUsuarioId: actorUid || '',
          deUsuarioNombre: actorName || 'sistema',
          aUsuarioId: lead.asignadoA || '',
          aUsuarioNombre: lead.asignadoNombre || '',
          aArea: lead.areaActual || undefined,
          estadoAnterior,
          estadoNuevo: 'oc_recibida' as TicketEstado,
          comentario: `OC ${payload.numero} cargada para presupuesto(s) ${presupuestos.map(p => p.numero).filter(Boolean).join(', ')}`,
        };
        const nuevasPostas = [...(lead.postas || []), nuevaPosta];
        tx.update(leadSnap.ref, deepCleanForFirestore({
          estado: 'oc_recibida' as TicketEstado,
          postas: nuevasPostas,
          updatedAt: nowIso,
          updatedBy: actorUid,
          updatedByName: actorName,
        }));
      }
    });

    // ── POST-COMMIT best-effort: notificar coordinador OT ─────────────────
    // Appendea pendingAction `'notificar_coordinador_ot'` SOLO si la notificación falla.
    await notifyCoordinadorOTBestEffort(context.presupuestosIds);

    return { id: finalOcId, numero: finalNumero };
  },
};
