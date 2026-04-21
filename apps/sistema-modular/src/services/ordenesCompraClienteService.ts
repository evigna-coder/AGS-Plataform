import {
  collection, doc, getDoc, getDocs, query, where, Timestamp,
  updateDoc, deleteDoc,
} from 'firebase/firestore';
import type { OrdenCompraCliente } from '@ags/shared';
import {
  db, deepCleanForFirestore, getUpdateTrace, onSnapshot,
} from './firebase';

/**
 * Servicio para la colección `ordenesCompraCliente` (OCs emitidas por el CLIENTE hacia AGS — FLOW-02).
 * Separada de `ordenes_compra` (OCs internas a proveedores).
 *
 * CRUD baseline lista en plan 08-01. La operación transaccional `cargarOC` queda
 * como stub — el plan 08-02 implementa el `runTransaction` completo que toca
 * `ordenesCompraCliente` + `presupuesto.ordenesCompraIds` + `lead.estado`.
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
   * STUB — plan 08-02 implementa el `runTransaction` completo.
   *
   * Debe:
   *   1. Leer presupuesto(s) + lead(s) + OC existente (si `existingOcId`).
   *   2. Crear/actualizar `ordenesCompraCliente` (merge de `presupuestosIds` manual — no `arrayUnion` en tx).
   *   3. Append `ocRef.id` a `presupuesto.ordenesCompraIds`.
   *   4. Transicionar `ticket.estado` a `'oc_recibida'` + append `Posta`.
   *   5. Registrar `pendingAction` condicional (derivar_comex / notificar_coordinador_ot).
   */
  async cargarOC(
    _payload: Omit<OrdenCompraCliente, 'id' | 'createdAt' | 'updatedAt'>,
    _context: { leadId?: string | null; presupuestosIds: string[]; existingOcId?: string | null },
  ): Promise<{ id: string; numero: string }> {
    throw new Error('NOT_IMPLEMENTED — plan 08-02 implementa la runTransaction completa');
  },
};
