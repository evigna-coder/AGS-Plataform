import { collection, getDoc, getDocs, Timestamp, runTransaction, doc } from 'firebase/firestore';
import type { PresupuestoComex } from '@ags/shared';
import { db, deepCleanForFirestore, getCreateTrace, getUpdateTrace, createBatch, newDocRef, docRef, batchAudit } from './firebase';

/**
 * Presupuestador de comex (2026-10-01): estimaciones de costo de importación
 * sin artículos. Colección `presupuestosComex`, numeración CX-0001 con contador
 * atómico (mismo patrón que requerimientos).
 */
const COLLECTION = 'presupuestosComex';

const toISO = (v: unknown): string => {
  const t = v as { toDate?: () => Date } | string | null | undefined;
  if (!t) return '';
  if (typeof t === 'string') return t;
  return typeof t.toDate === 'function' ? t.toDate().toISOString() : '';
};

function hydrate(id: string, d: Record<string, any>): PresupuestoComex {
  return {
    id,
    numero: d.numero ?? '',
    titulo: d.titulo ?? '',
    cliente: d.cliente ?? null,
    fecha: d.fecha ?? '',
    posiciones: Array.isArray(d.posiciones) ? d.posiciones : [],
    gastos: Array.isArray(d.gastos) ? d.gastos : [],
    gastosBancarios: Number(d.gastosBancarios) || 0,
    costoFinancieroPct: d.costoFinancieroPct != null ? Number(d.costoFinancieroPct) : 3,
    tipoCambio: d.tipoCambio ?? null,
    notas: d.notas ?? null,
    createdAt: toISO(d.createdAt),
    updatedAt: toISO(d.updatedAt),
    createdByName: d.createdByName ?? null,
  };
}

type Datos = Omit<PresupuestoComex, 'id' | 'numero' | 'createdAt' | 'updatedAt' | 'createdByName'>;

async function siguienteNumero(): Promise<string> {
  const ref = doc(db, '_counters', 'presupuestoComexNumber');
  const n = await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    const actual = snap.exists() ? (snap.data().value as number) : 0;
    tx.set(ref, { value: actual + 1, updatedAt: Timestamp.now() });
    return actual + 1;
  });
  return `CX-${String(n).padStart(4, '0')}`;
}

export const presupuestosComexService = {
  async getAll(): Promise<PresupuestoComex[]> {
    const snap = await getDocs(collection(db, COLLECTION));
    return snap.docs.map(d => hydrate(d.id, d.data()))
      .sort((a, b) => (b.numero ?? '').localeCompare(a.numero ?? ''));
  },

  async getById(id: string): Promise<PresupuestoComex | null> {
    const snap = await getDoc(docRef(COLLECTION, id));
    return snap.exists() ? hydrate(snap.id, snap.data()) : null;
  },

  async create(datos: Datos): Promise<string> {
    const numero = await siguienteNumero();
    const ref = newDocRef(COLLECTION);
    const payload = deepCleanForFirestore({ ...datos, numero, ...getCreateTrace() });
    const batch = createBatch();
    batch.set(ref, { ...payload, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    batchAudit(batch, { action: 'create', collection: COLLECTION, documentId: ref.id, after: payload });
    await batch.commit();
    return ref.id;
  },

  async update(id: string, datos: Partial<Datos>): Promise<void> {
    const payload = deepCleanForFirestore({ ...datos, ...getUpdateTrace() });
    const batch = createBatch();
    batch.update(docRef(COLLECTION, id), { ...payload, updatedAt: Timestamp.now() });
    batchAudit(batch, { action: 'update', collection: COLLECTION, documentId: id, after: payload });
    await batch.commit();
  },

  async delete(id: string): Promise<void> {
    const batch = createBatch();
    batch.delete(docRef(COLLECTION, id));
    batchAudit(batch, { action: 'delete', collection: COLLECTION, documentId: id });
    await batch.commit();
  },
};
