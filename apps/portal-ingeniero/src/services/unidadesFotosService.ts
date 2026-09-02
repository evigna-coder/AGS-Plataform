/**
 * Fotos de mercaderia por unidad de stock (2026-09-02).
 *
 * Las fotos cuelgan de la UNIDAD fisica, no del evento que las origino: es lo
 * que permite contestar despues "mostrame la foto de la columna que le vendimos
 * a Synthon" (cliente -> remito -> `RemitoItem.unidadId` -> unidad -> fotos).
 *
 * Igual que loaners: la captura NO sube directo. El blob va a la cola
 * (uploadQueueManager) y el drain llama a `agregarFoto` cuando hay senal, asi
 * que aca no hay reintentos propios — los maneja la cola con su backoff.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  Timestamp,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { FotoUnidad, MomentoFotoUnidad, UnidadStock } from '@ags/shared';
import { deepCleanForFirestore } from '@ags/shared';
import { db, storage } from './firebase';
import { getCurrentUser, getUpdateTrace } from './currentUser';

const COLLECTION = 'unidades';

function parseUnidad(id: string, data: Record<string, unknown>): UnidadStock {
  const iso = (v: unknown) =>
    (v as { toDate?: () => Date })?.toDate?.()?.toISOString?.()
    ?? (typeof v === 'string' ? v : new Date().toISOString());
  return {
    id,
    ...data,
    createdAt: iso(data['createdAt']),
    updatedAt: iso(data['updatedAt']),
  } as UnidadStock;
}

/** Etiqueta corta de la unidad para listas y para el nombre del archivo. */
export function etiquetaUnidad(u: UnidadStock): string {
  if (u.nroSerie) return `S/N ${u.nroSerie}`;
  if (u.nroLote) return `Lote ${u.nroLote}`;
  const cant = u.cantidad ?? 1;
  return cant > 1 ? `${cant} u. sin serie` : 'sin serie';
}

export const unidadesFotosService = {
  /**
   * Ultimas unidades ingresadas al stock — es la pantalla de entrada de la
   * recepcion: lo que acaba de llegar es lo que hay que fotografiar.
   *
   * Sin `where` a proposito: `activo` se filtra en memoria para no depender de
   * un indice compuesto (activo + createdAt) que hoy no esta desplegado.
   */
  async recientes(cantidad = 150): Promise<UnidadStock[]> {
    const q = query(
      collection(db, COLLECTION),
      orderBy('createdAt', 'desc'),
      fsLimit(cantidad),
    );
    const snap = await getDocs(q);
    return snap.docs
      .map(d => parseUnidad(d.id, d.data() as Record<string, unknown>))
      .filter(u => u.activo !== false);
  },

  /** Unidades ingresadas por una importacion (por su numero IMP-xxxx). */
  async getPorImportacion(importacionNumero: string): Promise<UnidadStock[]> {
    const q = query(
      collection(db, COLLECTION),
      where('importacionNumero', '==', importacionNumero),
    );
    const snap = await getDocs(q);
    return snap.docs
      .map(d => parseUnidad(d.id, d.data() as Record<string, unknown>))
      .filter(u => u.activo !== false);
  },

  /** Suscripcion a una unidad — la galeria se actualiza sola cuando drena la cola. */
  subscribeById(unidadId: string, callback: (u: UnidadStock | null) => void): () => void {
    return onSnapshot(doc(db, COLLECTION, unidadId), snap => {
      callback(snap.exists() ? parseUnidad(snap.id, snap.data() as Record<string, unknown>) : null);
    }, err => {
      console.error('[unidadesFotos] subscripcion:', err);
      callback(null);
    });
  },

  /**
   * Sube la foto a Storage y la anexa al array `fotos` de la unidad.
   * La llama el drain de la cola, no la pantalla de captura.
   */
  async agregarFoto(unidadId: string, blob: File | Blob, meta: {
    nombre?: string | null;
    descripcion?: string | null;
    momento: MomentoFotoUnidad;
    /** ISO de la captura — la cola lo pasa para conservar el momento real. */
    fecha?: string | null;
    /** Quien capturo — la cola lo pasa (al drenar puede haber otro user). */
    subidoPor?: string | null;
  }): Promise<FotoUnidad> {
    const rawName = meta.nombre || (blob instanceof File ? blob.name : 'foto.jpg');
    const safeName = rawName.replace(/[^\w.\-]/g, '_');
    const storagePath = `unidades/${unidadId}/fotos/${Date.now()}-${safeName}`;
    const r = storageRef(storage, storagePath);
    await uploadBytes(r, blob, { contentType: blob.type || 'image/jpeg' });
    const url = await getDownloadURL(r);

    const foto: FotoUnidad = {
      id: crypto.randomUUID(),
      url,
      storagePath,
      nombre: rawName,
      descripcion: meta.descripcion ?? null,
      momento: meta.momento,
      fecha: meta.fecha ?? new Date().toISOString(),
      subidoPor: meta.subidoPor ?? getCurrentUser()?.displayName ?? null,
    };

    // Leer fresco justo antes del append para minimizar pisadas concurrentes
    // (dos telefonos fotografiando la misma unidad).
    const ref = doc(db, COLLECTION, unidadId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Unidad de stock no encontrada');
    const unidad = parseUnidad(snap.id, snap.data() as Record<string, unknown>);
    await updateDoc(ref, {
      ...deepCleanForFirestore({
        fotos: [...(unidad.fotos ?? []), foto],
        ...getUpdateTrace(),
      }),
      updatedAt: Timestamp.now(),
    });
    return foto;
  },
};
