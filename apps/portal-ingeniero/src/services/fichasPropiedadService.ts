/**
 * Service para FichaPropiedad desde portal-ingeniero (recepcion movil).
 *
 * Modelo nuevo: la ficha contiene una lista de items (una pieza física por item).
 * Desde el portal solo creamos la ficha con UN item placeholder — el detalle
 * (artículo del catálogo, problema, accesorios, etc.) se completa después
 * desde sistema-modular. Las fotos del portal van al item placeholder.
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
} from 'firebase/firestore';
import type {
  FichaPropiedad,
  ItemFicha,
  FotoFicha,
  ViaIngreso,
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
  clienteId: string;
  clienteNombre: string;
  establecimientoId?: string | null;
  establecimientoNombre?: string | null;
  // Heredados de la OT si aplica
  articuloDescripcionHint?: string | null;   // texto para el item placeholder
  serieHint?: string | null;
  // Ingreso
  viaIngreso: ViaIngreso;
  traidoPor: string;
  fechaIngreso: string;
  otReferencia?: string | null;
  otNumber?: string | null;
}

export const fichasPropiedadService = {
  /**
   * Crea la ficha con UN item placeholder y devuelve { id, numero, itemId }.
   * El caller usa `itemId` para encolar fotos contra ese item.
   */
  async create(input: CreateFichaInput): Promise<{ id: string; numero: string; itemId: string }> {
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

    const itemId = crypto.randomUUID();
    const itemPlaceholder: ItemFicha = {
      id: itemId,
      subId: `${numero}-1`,
      articuloId: null,
      articuloCodigo: null,
      articuloDescripcion: null,
      descripcionLibre: input.articuloDescripcionHint ?? null,
      serie: input.serieHint ?? null,
      parentItemId: null,
      estado: 'recibido',
      historial: [historialInicial],
      derivaciones: [],
      remitoDevolucionId: null,
      fechaEntrega: null,
      fotos: [],
      descripcionProblema: null,
      sintomasReportados: null,
      accesorios: [],
      condicionFisica: null,
      createdAt: now,
    };

    const payload: Omit<FichaPropiedad, 'id'> = {
      numero,
      clienteId: input.clienteId,
      clienteNombre: input.clienteNombre,
      establecimientoId: input.establecimientoId ?? null,
      establecimientoNombre: input.establecimientoNombre ?? null,
      viaIngreso: input.viaIngreso,
      traidoPor: input.traidoPor,
      fechaIngreso: input.fechaIngreso,
      otReferencia: input.otReferencia ?? null,
      items: [itemPlaceholder],
      estado: 'recibido',
      historial: [historialInicial],
      repuestosPendientes: [],
      loanerId: null,
      loanerCodigo: null,
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
    return { id, numero, itemId };
  },

  async getById(id: string): Promise<FichaPropiedad | null> {
    const snap = await getDoc(doc(db, COLLECTION, id));
    if (!snap.exists()) return null;
    return parseFicha(snap.id, snap.data() as Record<string, unknown>);
  },

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
   * Agrega una foto al item específico de la ficha. Usa transacción de lectura
   * + write porque las fotos viven dentro del array items[].fotos[] (no se puede
   * arrayUnion al estar nesteado). En offline, Firestore persistencia se encarga.
   */
  async addFoto(fichaId: string, itemId: string, foto: FotoFicha): Promise<void> {
    const ref = doc(db, COLLECTION, fichaId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Ficha no encontrada');
    const ficha = parseFicha(snap.id, snap.data() as Record<string, unknown>);
    const newItems = ficha.items.map(it => {
      if (it.id !== itemId) return it;
      return { ...it, fotos: [...(it.fotos ?? []), foto] };
    });
    await updateDoc(ref, deepCleanForFirestore({
      items: newItems,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    }));
  },

  async linkOT(fichaId: string, otNumber: string): Promise<void> {
    const ref = doc(db, COLLECTION, fichaId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const ficha = parseFicha(snap.id, snap.data() as Record<string, unknown>);
    const otIds = Array.from(new Set([...(ficha.otIds ?? []), otNumber]));
    await updateDoc(ref, deepCleanForFirestore({
      otIds,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    }));
  },
};

export { getNextFichaNumber };
