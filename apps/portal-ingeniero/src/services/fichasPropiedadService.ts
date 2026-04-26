/**
 * Service para FichaPropiedad desde portal-ingeniero (recepcion movil).
 *
 * No es 1:1 con sistema-modular/fichasService — el portal solo necesita:
 *   - crear ficha (con o sin OT asociada),
 *   - listar fichas activas (para captura de egreso),
 *   - agregar fotos (metadata después de subir el blob a Storage),
 *   - vincular a OT después.
 * Edición compleja (historial, derivaciones, repuestos) sigue en sistema-modular.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  onSnapshot,
  setDoc,
  updateDoc,
  arrayUnion,
} from 'firebase/firestore';
import type {
  FichaPropiedad,
  FotoFicha,
  ViaIngreso,
  AccesorioFicha,
  HistorialFicha,
} from '@ags/shared';
import { db } from './firebase';
import { getCreateTrace, getUpdateTrace, getCurrentUser } from './currentUser';

const COLLECTION = 'fichasPropiedad';

function deepCleanForFirestore<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function parseFicha(id: string, data: Record<string, unknown>): FichaPropiedad {
  return {
    id,
    ...data,
    createdAt: (data['createdAt'] as { toDate?: () => Date })?.toDate?.()?.toISOString?.()
      ?? (data['createdAt'] as string) ?? new Date().toISOString(),
    updatedAt: (data['updatedAt'] as { toDate?: () => Date })?.toDate?.()?.toISOString?.()
      ?? (data['updatedAt'] as string) ?? new Date().toISOString(),
  } as FichaPropiedad;
}

async function getNextFichaNumber(): Promise<string> {
  const q = query(collection(db, COLLECTION), orderBy('numero', 'desc'));
  const snap = await getDocs(q);
  let max = 0;
  snap.docs.forEach(d => {
    const n = d.data().numero;
    const m = typeof n === 'string' ? n.match(/FPC-(\d+)/) : null;
    if (m) {
      const v = parseInt(m[1], 10);
      if (v > max) max = v;
    }
  });
  return `FPC-${String(max + 1).padStart(4, '0')}`;
}

export interface CreateFichaInput {
  // Cliente
  clienteId: string;
  clienteNombre: string;
  establecimientoId?: string | null;
  establecimientoNombre?: string | null;
  // Equipo
  sistemaId?: string | null;
  sistemaNombre?: string | null;
  moduloId?: string | null;
  moduloNombre?: string | null;
  descripcionLibre?: string | null;
  codigoArticulo?: string | null;
  serie?: string | null;
  // Ingreso
  viaIngreso: ViaIngreso;
  traidoPor: string;
  fechaIngreso: string;
  otReferencia?: string | null;
  otNumber?: string | null;
  // Problema
  descripcionProblema: string;
  sintomasReportados?: string | null;
  // Detalle
  accesorios?: AccesorioFicha[];
  condicionFisica?: string | null;
}

export const fichasPropiedadService = {
  /**
   * Crea la ficha en estado `recibido` y devuelve { id, numero } para que el
   * caller pueda encolar las fotos en IndexedDB con el numero correcto.
   *
   * Si `input.otNumber` viene, se agrega a `otIds[]` para que la OT quede
   * vinculada desde el inicio. Sin OT también es válido (caso item 2 que se
   * asigna después al equipo del item 1).
   */
  async create(input: CreateFichaInput): Promise<{ id: string; numero: string }> {
    const id = crypto.randomUUID();
    const numero = await getNextFichaNumber();
    const user = getCurrentUser();
    const now = new Date().toISOString();

    const historialInicial: HistorialFicha = {
      id: crypto.randomUUID(),
      fecha: now,
      estadoAnterior: 'recibido',
      estadoNuevo: 'recibido',
      nota: 'Ficha creada desde recepcion movil',
      creadoPor: user?.displayName ?? 'Sistema',
    };

    const payload: Omit<FichaPropiedad, 'id'> = {
      numero,
      sistemaId: input.sistemaId ?? null,
      sistemaNombre: input.sistemaNombre ?? null,
      moduloId: input.moduloId ?? null,
      moduloNombre: input.moduloNombre ?? null,
      descripcionLibre: input.descripcionLibre ?? null,
      codigoArticulo: input.codigoArticulo ?? null,
      serie: input.serie ?? null,
      accesorios: input.accesorios ?? [],
      condicionFisica: input.condicionFisica ?? null,
      clienteId: input.clienteId,
      clienteNombre: input.clienteNombre,
      establecimientoId: input.establecimientoId ?? null,
      establecimientoNombre: input.establecimientoNombre ?? null,
      viaIngreso: input.viaIngreso,
      traidoPor: input.traidoPor,
      fechaIngreso: input.fechaIngreso,
      otReferencia: input.otReferencia ?? null,
      descripcionProblema: input.descripcionProblema,
      sintomasReportados: input.sintomasReportados ?? null,
      estado: 'recibido',
      historial: [historialInicial],
      derivaciones: [],
      repuestosPendientes: [],
      remitoDevolucionId: null,
      fechaEntrega: null,
      loanerId: null,
      loanerCodigo: null,
      fotos: [],
      otIds: input.otNumber ? [input.otNumber] : [],
      createdAt: now,
      updatedAt: now,
      ...getCreateTrace(),
    };

    await setDoc(
      doc(db, COLLECTION, id),
      deepCleanForFirestore({
        ...payload,
        createdAt: Timestamp.fromDate(new Date(now)),
        updatedAt: Timestamp.now(),
      }),
    );
    return { id, numero };
  },

  async getById(id: string): Promise<FichaPropiedad | null> {
    const snap = await getDoc(doc(db, COLLECTION, id));
    if (!snap.exists()) return null;
    return parseFicha(snap.id, snap.data() as Record<string, unknown>);
  },

  /** Lista fichas activas (no entregadas) — para la pantalla de captura de egreso. */
  async getActivas(): Promise<FichaPropiedad[]> {
    const q = query(collection(db, COLLECTION), where('estado', '!=', 'entregado'));
    const snap = await getDocs(q);
    const items = snap.docs.map(d => parseFicha(d.id, d.data() as Record<string, unknown>));
    items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return items;
  },

  subscribeActivas(
    callback: (items: FichaPropiedad[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    const q = query(collection(db, COLLECTION), where('estado', '!=', 'entregado'));
    return onSnapshot(q, snap => {
      const items = snap.docs.map(d => parseFicha(d.id, d.data() as Record<string, unknown>));
      items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      callback(items);
    }, err => {
      console.error('fichas activas subscription error:', err);
      onError?.(err);
    });
  },

  /**
   * Agrega una foto (metadata, ya subida a Storage) al doc de la ficha.
   * Usa arrayUnion para que múltiples drains concurrentes no se pisen.
   */
  async addFoto(fichaId: string, foto: FotoFicha): Promise<void> {
    await updateDoc(doc(db, COLLECTION, fichaId), {
      fotos: arrayUnion(deepCleanForFirestore(foto)),
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
  },

  /** Asocia una OT a la ficha (no remueve las existentes). */
  async linkOT(fichaId: string, otNumber: string): Promise<void> {
    await updateDoc(doc(db, COLLECTION, fichaId), {
      otIds: arrayUnion(otNumber),
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
  },
};

export { getNextFichaNumber };
