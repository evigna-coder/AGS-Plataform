import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import type { NotaPrecioCliente } from '@ags/shared';
import {
  db, docRef, newDocRef, createBatch, batchAudit,
  deepCleanForFirestore, getCreateTrace, getUpdateTrace,
} from './firebase';

const COL = 'notas_precio_cliente';

function toNota(id: string, data: Record<string, unknown>): NotaPrecioCliente {
  const ts = (v: unknown): string =>
    (v as { toDate?: () => Date } | null)?.toDate?.()?.toISOString?.() ?? (v as string) ?? '';
  return {
    id,
    clienteId: (data.clienteId as string) ?? '',
    texto: (data.texto as string) ?? '',
    presupuestoId: (data.presupuestoId as string) ?? null,
    presupuestoNumero: (data.presupuestoNumero as string) ?? null,
    createdAt: ts(data.createdAt),
    updatedAt: ts(data.updatedAt),
    createdBy: (data.createdBy as string) ?? null,
    createdByName: (data.createdByName as string) ?? null,
    updatedBy: (data.updatedBy as string) ?? null,
    updatedByName: (data.updatedByName as string) ?? null,
  };
}

/**
 * Libreta de notas de armado de precio por cliente (2026-08-08).
 *
 * Compartida entre quienes cotizan: el criterio con el que se armó un precio no
 * puede vivir solo en la cabeza de una persona.
 */
export const notasPrecioService = {
  /** Notas del cliente, más recientes primero. */
  async getByCliente(clienteId: string): Promise<NotaPrecioCliente[]> {
    if (!clienteId) return [];
    // Sin orderBy en la query para no exigir índice compuesto: el orden se hace
    // en memoria (una libreta por cliente es chica).
    const snap = await getDocs(query(collection(db, COL), where('clienteId', '==', clienteId)));
    const notas = snap.docs.map(d => toNota(d.id, d.data()));
    notas.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return notas;
  },

  async create(input: {
    clienteId: string;
    texto: string;
    presupuestoId?: string | null;
    presupuestoNumero?: string | null;
  }): Promise<string> {
    const ref = newDocRef(COL);
    const payload = deepCleanForFirestore({
      clienteId: input.clienteId,
      texto: input.texto.trim(),
      presupuestoId: input.presupuestoId ?? null,
      presupuestoNumero: input.presupuestoNumero ?? null,
      ...getCreateTrace(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.set(ref, payload);
    batchAudit(batch, { action: 'create', collection: COL, documentId: ref.id, after: payload });
    await batch.commit();
    return ref.id;
  },

  async update(id: string, texto: string): Promise<void> {
    const payload = deepCleanForFirestore({
      texto: texto.trim(),
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.update(docRef(COL, id), payload);
    batchAudit(batch, { action: 'update', collection: COL, documentId: id, after: payload });
    await batch.commit();
  },

  async remove(id: string): Promise<void> {
    const batch = createBatch();
    batch.delete(docRef(COL, id));
    batchAudit(batch, { action: 'delete', collection: COL, documentId: id });
    await batch.commit();
  },
};
