import { collection, getDocs, doc, getDoc, query, where, Timestamp, runTransaction, onSnapshot } from 'firebase/firestore';
import type { Contrato, EstadoContrato } from '@ags/shared';
import { db, cleanFirestoreData, getCreateTrace, getUpdateTrace, createBatch, newDocRef, docRef, inTransition } from './firebase';

function toISO(val: any, fallback: string | null = null): string | null {
  if (!val) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val?.toDate === 'function') return val.toDate().toISOString();
  if (typeof val?.seconds === 'number') return new Date(val.seconds * 1000).toISOString();
  return fallback;
}

function parseContrato(d: any, id: string): Contrato {
  return {
    id,
    ...d,
    createdAt: toISO(d.createdAt, '') as string,
    updatedAt: toISO(d.updatedAt, '') as string,
  };
}

export const contratosService = {
  async getNextContratoNumber(): Promise<string> {
    const counterRef = doc(db, '_counters', 'contratoNumber');
    const next = await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(counterRef);
      let current = snap.exists() ? (snap.data().value as number) : 0;
      const nextVal = current + 1;
      transaction.set(counterRef, { value: nextVal });
      return nextVal;
    });
    return `CON-${String(next).padStart(4, '0')}`;
  },

  async getAll(filters?: { clienteId?: string; estado?: EstadoContrato }) {
    let q = query(collection(db, 'contratos'));
    if (filters?.clienteId) q = query(q, where('clienteId', '==', filters.clienteId));
    if (filters?.estado) q = query(q, where('estado', '==', filters.estado));

    const snap = await getDocs(q);
    const items = snap.docs.map(d => parseContrato(d.data(), d.id));
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return items;
  },

  subscribe(
    filters: { clienteId?: string; estado?: EstadoContrato } | undefined,
    callback: (items: Contrato[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    let q = query(collection(db, 'contratos'));
    if (filters?.clienteId) q = query(q, where('clienteId', '==', filters.clienteId));
    if (filters?.estado) q = query(q, where('estado', '==', filters.estado));

    return onSnapshot(q, snap => {
      const items = snap.docs.map(d => parseContrato(d.data(), d.id));
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      inTransition(callback)(items);
    }, err => {
      console.error('Contratos subscription error:', err);
      onError?.(err);
    });
  },

  async getById(id: string): Promise<Contrato | null> {
    const snap = await getDoc(doc(db, 'contratos', id));
    if (!snap.exists()) return null;
    return parseContrato(snap.data(), snap.id);
  },

  async getActiveForCliente(clienteId: string): Promise<Contrato[]> {
    const q = query(collection(db, 'contratos'), where('clienteId', '==', clienteId), where('estado', '==', 'activo'));
    const snap = await getDocs(q);
    const today = new Date().toISOString().split('T')[0];
    return snap.docs
      .map(d => parseContrato(d.data(), d.id))
      .filter(c => c.fechaFin >= today);
  },

  async create(data: Omit<Contrato, 'id' | 'createdAt' | 'updatedAt' | 'numero'>): Promise<{ id: string; numero: string }> {
    const numero = await this.getNextContratoNumber();
    const ref = newDocRef('contratos');
    const batch = createBatch();
    const cleaned = cleanFirestoreData({
      ...data,
      numero,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      ...getCreateTrace(),
    });
    batch.set(ref, cleaned);
    await batch.commit();
    return { id: ref.id, numero };
  },

  async update(id: string, data: Partial<Contrato>): Promise<void> {
    const ref = docRef('contratos', id);
    const batch = createBatch();
    const { id: _, createdAt: __, ...rest } = data;
    const cleaned = cleanFirestoreData({
      ...rest,
      updatedAt: Timestamp.now(),
      ...getUpdateTrace(),
    });
    batch.update(ref, cleaned);
    await batch.commit();
  },

  /** Atomically increment visitasUsadas using a transaction */
  async incrementVisitas(id: string): Promise<number> {
    const contratoRef = doc(db, 'contratos', id);
    return runTransaction(db, async (transaction) => {
      const snap = await transaction.get(contratoRef);
      if (!snap.exists()) throw new Error('Contrato no encontrado');
      const current = snap.data().visitasUsadas || 0;
      const next = current + 1;
      transaction.update(contratoRef, {
        visitasUsadas: next,
        updatedAt: Timestamp.now(),
        ...getUpdateTrace(),
      });
      return next;
    });
  },

  /** Validate if an OT can be created under this contract */
  async validateOTCreation(contratoId: string, tipoServicioNombre?: string): Promise<{ allowed: boolean; reason?: string }> {
    const contrato = await this.getById(contratoId);
    if (!contrato) return { allowed: false, reason: 'Contrato no encontrado' };
    if (contrato.estado !== 'activo') return { allowed: false, reason: 'Contrato no activo' };

    const today = new Date().toISOString().split('T')[0];
    if (today > contrato.fechaFin) return { allowed: false, reason: 'Contrato vencido' };

    if (contrato.tipoLimite === 'visitas' && contrato.maxVisitas !== null) {
      if (contrato.visitasUsadas >= contrato.maxVisitas) {
        return { allowed: false, reason: `Visitas agotadas (${contrato.visitasUsadas}/${contrato.maxVisitas})` };
      }
    }

    if (tipoServicioNombre && contrato.serviciosIncluidos.length > 0) {
      const included = contrato.serviciosIncluidos.some(s =>
        s.tipoServicioNombre.toLowerCase() === tipoServicioNombre.toLowerCase()
      );
      if (!included) {
        return { allowed: false, reason: `Servicio "${tipoServicioNombre}" no incluido en el contrato` };
      }
    }

    return { allowed: true };
  },
};
