import { collection, query, orderBy, where, getDocs, type QueryConstraint } from 'firebase/firestore';
import { db } from './firebaseService';
import type { Importacion } from '@ags/shared';

/** Lectura de importaciones (solo consulta) para el módulo de Pagos VEP / flujo de fondos. */
export const importacionesService = {
  async getAll(filters?: { estado?: string }): Promise<Importacion[]> {
    const constraints: QueryConstraint[] = [];
    if (filters?.estado) constraints.push(where('estado', '==', filters.estado));
    constraints.push(orderBy('numero', 'desc'));
    const snap = await getDocs(query(collection(db, 'importaciones'), ...constraints));
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as object) } as Importacion));
  },
};
