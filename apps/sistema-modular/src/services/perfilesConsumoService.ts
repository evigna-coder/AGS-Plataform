import { collection, getDocs, Timestamp } from 'firebase/firestore';
import type { PerfilConsumo } from '@ags/shared';
import { db, deepCleanForFirestore, getCreateTrace, getUpdateTrace, createBatch, newDocRef, docRef, batchAudit } from './firebase';

const COLLECTION = 'perfiles_consumo';

function toISO(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  const v = val as { toDate?: () => Date; seconds?: number };
  if (typeof v.toDate === 'function') return v.toDate().toISOString();
  if (typeof v.seconds === 'number') return new Date(v.seconds * 1000).toISOString();
  return '';
}

function hydrate(id: string, data: Record<string, unknown>): PerfilConsumo {
  const items = Array.isArray(data.items) ? data.items as PerfilConsumo['items'] : [];
  return {
    id,
    nombre: String(data.nombre ?? ''),
    criterio: (data.criterio as PerfilConsumo['criterio']) ?? { ambito: 'categoria' },
    items: items.map(it => ({
      articuloId: it.articuloId,
      articuloCodigo: it.articuloCodigo ?? '',
      cantidadPorServicio: Number(it.cantidadPorServicio) || 0,
      porPuerto: it.porPuerto ?? null,
    })),
    activo: data.activo !== false,
    notas: (data.notas as string | null) ?? null,
    createdAt: toISO(data.createdAt),
    updatedAt: toISO(data.updatedAt),
    createdBy: (data.createdBy as string | null) ?? null,
    createdByName: (data.createdByName as string | null) ?? null,
    updatedBy: (data.updatedBy as string | null) ?? null,
    updatedByName: (data.updatedByName as string | null) ?? null,
  };
}

/**
 * CRUD de `perfiles_consumo`: qué insumos críticos consume un mantenimiento
 * preventivo según la configuración del equipo (Planificación de insumos,
 * 2026-09-28). Sin caché: es una colección chica y la pantalla la relee al abrir.
 */
export const perfilesConsumoService = {
  async getAll(): Promise<PerfilConsumo[]> {
    const snap = await getDocs(collection(db, COLLECTION));
    return snap.docs.map(d => hydrate(d.id, d.data())).sort((a, b) => a.nombre.localeCompare(b.nombre));
  },

  async create(data: Omit<PerfilConsumo, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    // Payload con `criterio` anidado e `items[]`: deepCleanForFirestore (regla firestore.md).
    const cleaned = deepCleanForFirestore({
      ...data,
      ...getCreateTrace(),
      activo: data.activo !== false,
      items: data.items ?? [],
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

  async update(id: string, data: Partial<Omit<PerfilConsumo, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
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
