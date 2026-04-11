import { collection, getDocs, doc, getDoc, Timestamp } from 'firebase/firestore';
import type { TipoEquipoPlantilla } from '@ags/shared';
import { db, cleanFirestoreData, getCreateTrace, getUpdateTrace, createBatch, newDocRef, docRef, batchAudit } from './firebase';

const COLLECTION = 'tiposEquipoPlantillas';

function toISO(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val?.toDate === 'function') return val.toDate().toISOString();
  if (typeof val?.seconds === 'number') return new Date(val.seconds * 1000).toISOString();
  return '';
}

function hydrate(id: string, data: any): TipoEquipoPlantilla {
  return {
    id,
    nombre: data.nombre || '',
    descripcion: data.descripcion ?? null,
    activo: data.activo !== false,
    componentes: Array.isArray(data.componentes) ? data.componentes : [],
    servicios: Array.isArray(data.servicios) ? data.servicios : [],
    createdAt: toISO(data.createdAt),
    updatedAt: toISO(data.updatedAt),
    createdBy: data.createdBy ?? null,
    updatedBy: data.updatedBy ?? null,
  };
}

/**
 * CRUD para plantillas de tipo de equipo.
 * Usadas en presupuestos de contrato para autogenerar items de un sistema
 * (componentes S/L + servicios estándar) al seleccionar el tipo.
 */
export const tiposEquipoService = {
  async getAll(): Promise<TipoEquipoPlantilla[]> {
    const snap = await getDocs(collection(db, COLLECTION));
    const items = snap.docs.map(d => hydrate(d.id, d.data()));
    items.sort((a, b) => a.nombre.localeCompare(b.nombre));
    return items;
  },

  async getById(id: string): Promise<TipoEquipoPlantilla | null> {
    const snap = await getDoc(doc(db, COLLECTION, id));
    if (!snap.exists()) return null;
    return hydrate(snap.id, snap.data());
  },

  async create(data: Omit<TipoEquipoPlantilla, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const cleaned = cleanFirestoreData({
      ...data,
      ...getCreateTrace(),
      activo: data.activo !== false,
      componentes: data.componentes || [],
      servicios: data.servicios || [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const ref = newDocRef(COLLECTION);
    const batch = createBatch();
    batch.set(ref, cleaned);
    batchAudit(batch, { action: 'create', collection: COLLECTION, documentId: ref.id, after: cleaned as any });
    await batch.commit();
    return ref.id;
  },

  async update(id: string, data: Partial<Omit<TipoEquipoPlantilla, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    const cleaned = cleanFirestoreData({ ...data, ...getUpdateTrace(), updatedAt: Timestamp.now() });
    const batch = createBatch();
    batch.update(docRef(COLLECTION, id), cleaned);
    batchAudit(batch, { action: 'update', collection: COLLECTION, documentId: id, after: cleaned as any });
    await batch.commit();
  },

  async delete(id: string): Promise<void> {
    const batch = createBatch();
    batch.delete(docRef(COLLECTION, id));
    batchAudit(batch, { action: 'delete', collection: COLLECTION, documentId: id });
    await batch.commit();
  },
};
