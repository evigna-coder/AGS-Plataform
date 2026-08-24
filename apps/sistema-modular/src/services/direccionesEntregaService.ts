import { collection, getDocs, getDoc, doc, query, where, Timestamp, type QueryDocumentSnapshot } from 'firebase/firestore';
import { db, addDoc, setDoc, updateDoc, deepCleanForFirestore, getCreateTrace, getUpdateTrace } from './firebase';
import type { DireccionEntrega } from '@ags/shared';

/**
 * Direcciones de entrega por cliente (2026-08-24).
 *
 * A dónde hay que mandar la mercadería. No es el establecimiento —ahí está el
 * equipo— y hasta ahora no vivía en ningún lado: se resolvía por teléfono o
 * quedaba en la memoria de quien despachaba.
 *
 * Baja LÓGICA (`activo: false`): una dirección usada en una entrega vieja no se
 * borra, se retira de los selectores. El ítem del presupuesto guarda además el
 * texto de la dirección al momento de elegirla, así que lo comprometido no
 * cambia si después alguien la corrige.
 */

const COL = 'direccionesEntrega';

function toISO(val: unknown, fallback: string | undefined = undefined): string | undefined {
  if (!val) return fallback;
  if (typeof val === 'string') return val;
  const v = val as { toDate?: () => Date; seconds?: number };
  if (typeof v.toDate === 'function') return v.toDate().toISOString();
  if (typeof v.seconds === 'number') return new Date(v.seconds * 1000).toISOString();
  return fallback;
}

function parse(d: QueryDocumentSnapshot | { id: string; data: () => any }): DireccionEntrega {
  const raw = d.data() as Record<string, unknown>;
  return {
    ...(raw as object),
    id: d.id,
    clienteId: (raw.clienteId as string) ?? '',
    etiqueta: (raw.etiqueta as string) ?? '',
    direccion: (raw.direccion as string) ?? '',
    // Las viejas sin el campo se consideran activas: ausente ≠ dada de baja.
    activo: raw.activo !== false,
    createdAt: toISO(raw.createdAt),
    updatedAt: toISO(raw.updatedAt),
  } as DireccionEntrega;
}

export type DireccionEntregaInput = Omit<
  DireccionEntrega, 'id' | 'createdAt' | 'updatedAt' | 'createdByName' | 'updatedByName'
>;

export const direccionesEntregaService = {
  /** Todas las direcciones, para armar el mapa del visor de entregas de una sola lectura. */
  async getAll(): Promise<DireccionEntrega[]> {
    const snap = await getDocs(collection(db, COL));
    return snap.docs.map(parse);
  },

  async getByCliente(clienteId: string): Promise<DireccionEntrega[]> {
    if (!clienteId) return [];
    const snap = await getDocs(query(collection(db, COL), where('clienteId', '==', clienteId)));
    return snap.docs.map(parse);
  },

  async getById(id: string): Promise<DireccionEntrega | null> {
    const d = await getDoc(doc(db, COL, id));
    return d.exists() ? parse(d as any) : null;
  },

  async create(data: DireccionEntregaInput): Promise<string> {
    const ref = await addDoc(collection(db, COL), deepCleanForFirestore({
      ...data,
      activo: data.activo !== false,
      ...getCreateTrace(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }));
    if (data.predeterminada) await limpiarOtrasPredeterminadas(data.clienteId, ref.id);
    return ref.id;
  },

  async update(id: string, data: Partial<DireccionEntregaInput>): Promise<void> {
    await updateDoc(doc(db, COL, id), deepCleanForFirestore({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    }));
    if (data.predeterminada && data.clienteId) await limpiarOtrasPredeterminadas(data.clienteId, id);
  },

  /** Baja lógica: sale de los selectores, sigue existiendo para las entregas ya hechas. */
  async desactivar(id: string): Promise<void> {
    await updateDoc(doc(db, COL, id), deepCleanForFirestore({
      activo: false, ...getUpdateTrace(), updatedAt: Timestamp.now(),
    }));
  },

  async reactivar(id: string): Promise<void> {
    await updateDoc(doc(db, COL, id), deepCleanForFirestore({
      activo: true, ...getUpdateTrace(), updatedAt: Timestamp.now(),
    }));
  },
};

/** Una sola predeterminada por cliente: al marcar una, se desmarcan las demás. */
async function limpiarOtrasPredeterminadas(clienteId: string, mantenerId: string): Promise<void> {
  const otras = await direccionesEntregaService.getByCliente(clienteId);
  await Promise.all(
    otras
      .filter(d => d.id !== mantenerId && d.predeterminada)
      .map(d => setDoc(doc(db, COL, d.id), { predeterminada: false }, { merge: true })),
  );
}
