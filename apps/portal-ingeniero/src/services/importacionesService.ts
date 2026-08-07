import { collection, query, orderBy, where, getDocs, type QueryConstraint } from 'firebase/firestore';
import { db } from './firebaseService';
import type { Importacion, PagoExterior } from '@ags/shared';

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

/**
 * Pagos al exterior cargados a mano en sistema-modular (2026-08-06). El portal
 * los lee para que el flujo de fondos de tesorería esté completo — solo consulta.
 */
export const pagosExteriorService = {
  async getAll(): Promise<PagoExterior[]> {
    const snap = await getDocs(collection(db, 'pagosExterior'));
    return snap.docs.map(d => {
      const data = d.data() as Record<string, unknown> & { fecha?: unknown };
      const f = data.fecha;
      const fecha = typeof f === 'string'
        ? f
        : (f as { toDate?: () => Date })?.toDate?.().toISOString().slice(0, 10) ?? '';
      return { id: d.id, ...data, fecha } as PagoExterior;
    });
  },
};
