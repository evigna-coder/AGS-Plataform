import { collection, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import type { GastoEnvio, Presupuesto } from '@ags/shared';
import { db, createBatch, newDocRef, docRef, batchAudit, cleanFirestoreData, getCreateTrace } from './firebase';

const tsToIso = (v: unknown): string =>
  (v as { toDate?: () => Date } | undefined)?.toDate?.()?.toISOString?.() ?? (typeof v === 'string' ? v : '');

/**
 * Gastos de envío (2026-09-23): un documento por VIAJE de entrega a cliente.
 * Puede cubrir varios remitos y OT. Se carga en pesos con el BNA vendedor del
 * día y se guarda también el equivalente en dólares, que es la unidad del
 * pool de envíos (ver `utils/poolEnvios`). Colección `gastosEnvio`.
 */
export const gastosEnvioService = {
  async getAll(): Promise<GastoEnvio[]> {
    const snap = await getDocs(query(collection(db, 'gastosEnvio'), orderBy('fecha', 'desc')));
    return snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: tsToIso(d.data().createdAt),
      updatedAt: tsToIso(d.data().updatedAt),
    })) as GastoEnvio[];
  },

  async create(data: Omit<GastoEnvio, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const ref = newDocRef('gastosEnvio');
    const payload = cleanFirestoreData({
      ...data,
      ...getCreateTrace(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.set(ref, payload);
    batchAudit(batch, { action: 'create', collection: 'gastosEnvio', documentId: ref.id, after: payload });
    await batch.commit();
    return ref.id;
  },

  async delete(id: string): Promise<void> {
    const batch = createBatch();
    batch.delete(docRef('gastosEnvio', id));
    batchAudit(batch, { action: 'delete', collection: 'gastosEnvio', documentId: id });
    await batch.commit();
  },

  /**
   * Presupuestos con envío contemplado, de cualquier estado: son las ENTRADAS
   * del pool (el filtro "aceptado" lo aplica el util). Una consulta por el
   * campo, no todos los presupuestos: solo traen el campo los cotizados desde
   * que existe.
   */
  async getPresupuestosConEnvio(): Promise<Presupuesto[]> {
    const snap = await getDocs(query(collection(db, 'presupuestos'), where('envioContemplado', '>', 0)));
    return snap.docs.map(d => ({ id: d.id, ...d.data(), updatedAt: tsToIso(d.data().updatedAt) })) as Presupuesto[];
  },
};
