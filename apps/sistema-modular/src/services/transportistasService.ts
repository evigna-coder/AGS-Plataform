import { collection, getDocs, doc, Timestamp } from 'firebase/firestore';
import { db, cleanFirestoreData, createBatch, batchAudit, getCreateTrace, getUpdateTrace, docRef } from './firebase';
import type { DatosTransportista } from './stockService';

/**
 * Catálogo de transportistas para remitos (2026-08-06): los datos se tipeaban
 * a mano en cada remito. Se alimenta solo — al generar un remito con un
 * transportista nuevo, `guardarSiNuevo` lo persiste (dedupe por razón social).
 */
export interface Transportista extends DatosTransportista {
  id: string;
}

export const transportistasService = {
  async getAll(): Promise<Transportista[]> {
    const snap = await getDocs(collection(db, 'transportistas'));
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Transportista[];
    items.sort((a, b) => a.razonSocial.localeCompare(b.razonSocial));
    return items;
  },

  async create(data: DatosTransportista): Promise<string> {
    const id = crypto.randomUUID();
    const payload = cleanFirestoreData({
      ...data,
      ...getCreateTrace(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.set(doc(db, 'transportistas', id), payload);
    batchAudit(batch, { action: 'create', collection: 'transportistas', documentId: id, after: payload });
    await batch.commit();
    return id;
  },

  async update(id: string, data: Partial<DatosTransportista>): Promise<void> {
    const payload = cleanFirestoreData({ ...data, ...getUpdateTrace(), updatedAt: Timestamp.now() });
    const batch = createBatch();
    batch.update(docRef('transportistas', id), payload);
    batchAudit(batch, { action: 'update', collection: 'transportistas', documentId: id, after: payload });
    await batch.commit();
  },

  /**
   * Guarda el transportista si no existe uno con la misma razón social
   * (case-insensitive). Si existe pero con datos incompletos, lo completa.
   * Best-effort: pensado para llamarse fire-and-forget al generar el remito.
   */
  async guardarSiNuevo(data: DatosTransportista): Promise<void> {
    const nombre = data.razonSocial.trim();
    if (!nombre) return;
    const existentes = await this.getAll();
    const previo = existentes.find(t => t.razonSocial.trim().toLowerCase() === nombre.toLowerCase());
    if (!previo) {
      await this.create({ ...data, razonSocial: nombre });
      return;
    }
    // Completar campos vacíos del existente con lo tipeado ahora (no pisar).
    const patch: Partial<DatosTransportista> = {};
    for (const k of ['domicilio', 'localidad', 'provincia', 'iva', 'cuit'] as const) {
      if (!previo[k]?.trim() && data[k]?.trim()) patch[k] = data[k].trim();
    }
    if (Object.keys(patch).length > 0) await this.update(previo.id, patch);
  },
};
