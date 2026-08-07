import { collection, getDocs, doc, Timestamp } from 'firebase/firestore';
import { db, cleanFirestoreData, createBatch, batchAudit, docRef, getCreateTrace, getUpdateTrace } from './firebase';
import type { PagoExterior } from '@ags/shared';

/**
 * Pagos al exterior cargados A MANO (2026-08-06) — puente durante el pasaje al
 * sistema: giros (y VEPs) de OCs que todavía no están cargadas como
 * importación, para que el flujo de fondos esté completo desde el día uno.
 */
export const pagosExteriorService = {
  async getAll(): Promise<PagoExterior[]> {
    const snap = await getDocs(collection(db, 'pagosExterior'));
    const items = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        fecha: typeof data.fecha === 'string' ? data.fecha : (data.fecha?.toDate?.().toISOString().slice(0, 10) ?? ''),
        createdAt: data.createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      } as PagoExterior;
    });
    items.sort((a, b) => a.fecha.localeCompare(b.fecha));
    return items;
  },

  async create(data: Omit<PagoExterior, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const payload = cleanFirestoreData({
      ...data,
      ...getCreateTrace(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.set(doc(db, 'pagosExterior', id), payload);
    batchAudit(batch, { action: 'create', collection: 'pagos_exterior', documentId: id, after: payload });
    await batch.commit();
    return id;
  },

  async update(id: string, data: Partial<Omit<PagoExterior, 'id' | 'createdAt'>>): Promise<void> {
    const payload = cleanFirestoreData({ ...data, ...getUpdateTrace(), updatedAt: Timestamp.now() });
    const batch = createBatch();
    batch.update(docRef('pagosExterior', id), payload);
    batchAudit(batch, { action: 'update', collection: 'pagos_exterior', documentId: id, after: payload });
    await batch.commit();
  },

  async delete(id: string): Promise<void> {
    const batch = createBatch();
    batch.delete(docRef('pagosExterior', id));
    batchAudit(batch, { action: 'delete', collection: 'pagos_exterior', documentId: id });
    await batch.commit();
  },
};
