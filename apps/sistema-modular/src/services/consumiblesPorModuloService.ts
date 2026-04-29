import { collection, getDocs, doc, getDoc, query, where, limit, Timestamp } from 'firebase/firestore';
import type { ConsumiblesPorModulo, ConsumibleModulo } from '@ags/shared';
import { db, deepCleanForFirestore, getCreateTrace, getUpdateTrace, createBatch, newDocRef, docRef, batchAudit } from './firebase';

const COLLECTION = 'consumibles_por_modulo';

function toISO(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val?.toDate === 'function') return val.toDate().toISOString();
  if (typeof val?.seconds === 'number') return new Date(val.seconds * 1000).toISOString();
  return '';
}

function hydrate(id: string, data: any): ConsumiblesPorModulo {
  return {
    id,
    codigoModulo: data.codigoModulo || '',
    descripcion: data.descripcion ?? null,
    consumibles: Array.isArray(data.consumibles)
      ? data.consumibles.map((c: any): ConsumibleModulo => ({
          codigo: c?.codigo || '',
          descripcion: c?.descripcion || '',
          cantidad: typeof c?.cantidad === 'number' ? c.cantidad : Number(c?.cantidad) || 0,
        }))
      : [],
    activo: data.activo !== false,
    createdAt: toISO(data.createdAt),
    updatedAt: toISO(data.updatedAt),
    createdBy: data.createdBy ?? null,
    createdByName: data.createdByName ?? null,
    updatedBy: data.updatedBy ?? null,
    updatedByName: data.updatedByName ?? null,
  };
}

/**
 * CRUD para el catálogo `consumibles_por_modulo`.
 * Cada doc declara qué consumibles lleva un módulo (part number Agilent, ej: G7129A).
 * El builder de anexos del plan 04-04 lee `getByCodigoModulo()` al armar el PDF
 * adjunto cuando el ítem MPCC del presupuesto tiene `requiereAnexoConsumibles=true`.
 *
 * NO usa caché: la colección es chica pero el catálogo cambia con cierta frecuencia
 * y el builder necesita data fresca al generar PDF.
 */
export const consumiblesPorModuloService = {
  /** Devuelve todos los docs ordenados alfabéticamente por `codigoModulo`. */
  async getAll(): Promise<ConsumiblesPorModulo[]> {
    const snap = await getDocs(collection(db, COLLECTION));
    const items = snap.docs.map(d => hydrate(d.id, d.data()));
    items.sort((a, b) => a.codigoModulo.localeCompare(b.codigoModulo));
    return items;
  },

  async getById(id: string): Promise<ConsumiblesPorModulo | null> {
    const snap = await getDoc(doc(db, COLLECTION, id));
    if (!snap.exists()) return null;
    return hydrate(snap.id, snap.data());
  },

  /**
   * Lookup por `codigoModulo` exacto (case-sensitive — los part numbers Agilent
   * son códigos cerrados). Devuelve el doc REGARDLESS del flag `activo` —
   * los callers deciden la política sobre entradas inactivas.
   */
  async getByCodigoModulo(codigoModulo: string): Promise<ConsumiblesPorModulo | null> {
    const q = query(
      collection(db, COLLECTION),
      where('codigoModulo', '==', codigoModulo),
      limit(1),
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return hydrate(d.id, d.data());
  },

  async create(data: Omit<ConsumiblesPorModulo, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    // deepCleanForFirestore — el payload contiene el array nested `consumibles[]`
    // (regla firestore.md: "Use deepCleanForFirestore for any payload that contains
    // nested objects, arrays of objects, or optional sub-documents").
    const cleaned = deepCleanForFirestore({
      ...data,
      ...getCreateTrace(),
      activo: data.activo !== false,
      consumibles: data.consumibles || [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const ref = newDocRef(COLLECTION);
    const batch = createBatch();
    batch.set(ref, cleaned);
    batchAudit(batch, { action: 'create', collection: COLLECTION, documentId: ref.id, after: cleaned });
    await batch.commit();
    return ref.id;
  },

  async update(id: string, data: Partial<Omit<ConsumiblesPorModulo, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    // deepCleanForFirestore — el patch puede traer `consumibles[]` modificado.
    const cleaned = deepCleanForFirestore({ ...data, ...getUpdateTrace(), updatedAt: Timestamp.now() });
    const batch = createBatch();
    batch.update(docRef(COLLECTION, id), cleaned);
    batchAudit(batch, { action: 'update', collection: COLLECTION, documentId: id, after: cleaned });
    await batch.commit();
  },

  async delete(id: string): Promise<void> {
    const batch = createBatch();
    batch.delete(docRef(COLLECTION, id));
    batchAudit(batch, { action: 'delete', collection: COLLECTION, documentId: id });
    await batch.commit();
  },
};
