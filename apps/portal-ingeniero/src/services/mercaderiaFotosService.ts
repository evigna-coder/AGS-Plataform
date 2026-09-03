/**
 * Fotos de mercaderia por DOCUMENTO (2026-09-03).
 *
 * La recepcion es un evento del embarque y la entrega, del remito. Antes cada
 * foto colgaba de una unidad de stock y era inviable: en la compra de un equipo
 * con 30 items nadie elige el renglon foto por foto. Ahora se elige el
 * documento UNA vez y se disparan fotos seguidas.
 *
 * La tanda queda abierta y admite mas fotos hasta que se cierra; puede cerrarse
 * incompleta.
 *
 * Igual que loaners y fichas: la captura NO sube directo. El blob va a la cola
 * y el drain llama a `agregarFoto` cuando hay senal — aca no hay reintentos
 * propios, los maneja la cola con su backoff.
 */
import {
  collection, doc, getDoc, getDocs, limit as fsLimit, onSnapshot,
  orderBy, query, updateDoc, Timestamp,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { FotoMercaderia, Importacion, Remito } from '@ags/shared';
import { deepCleanForFirestore } from '@ags/shared';
import { db, storage } from './firebase';
import { getCurrentUser, getUpdateTrace } from './currentUser';

/** Los dos documentos que pueden llevar una tanda de fotos. */
export type DestinoFotos = 'importacion' | 'remito';

const COLECCION: Record<DestinoFotos, string> = {
  importacion: 'importaciones',
  remito: 'remitos',
};

/** Documento con tanda, en la forma minima que necesitan las pantallas. */
export interface DocumentoConFotos {
  id: string;
  destino: DestinoFotos;
  /** IMP-0007 o 0001-00017463 — lo que el usuario reconoce. */
  numero: string;
  /** Segunda linea: proveedor o destinatario. */
  subtitulo: string;
  fecha: string | null;
  fotos: FotoMercaderia[];
  cerradaAt: string | null;
}

const iso = (v: unknown): string | null =>
  (v as { toDate?: () => Date })?.toDate?.()?.toISOString?.()
  ?? (typeof v === 'string' ? v : null);

function parseImportacion(id: string, d: Record<string, unknown>): DocumentoConFotos {
  const imp = d as unknown as Importacion;
  return {
    id, destino: 'importacion',
    numero: imp.numero || id,
    subtitulo: [imp.proveedorNombre, imp.ordenCompraNumero && `OC ${imp.ordenCompraNumero}`]
      .filter(Boolean).join(' · ') || 'sin proveedor',
    fecha: iso(d['fechaArriboReal']) ?? iso(d['fechaEstimadaArribo']) ?? iso(d['createdAt']),
    fotos: imp.fotos ?? [],
    cerradaAt: iso(d['fotosCerradasAt']),
  };
}

function parseRemito(id: string, d: Record<string, unknown>): DocumentoConFotos {
  const rem = d as unknown as Remito;
  return {
    id, destino: 'remito',
    numero: rem.numero || id,
    subtitulo: (d['destinatarioNombre'] as string) || (d['clienteNombre'] as string) || 'sin destinatario',
    fecha: iso(d['fecha']) ?? iso(d['createdAt']),
    fotos: rem.fotos ?? [],
    cerradaAt: iso(d['fotosCerradasAt']),
  };
}

const PARSE: Record<DestinoFotos, (id: string, d: Record<string, unknown>) => DocumentoConFotos> = {
  importacion: parseImportacion,
  remito: parseRemito,
};

export const mercaderiaFotosService = {
  /**
   * Ultimos documentos de cada tipo — es la pantalla de entrada: lo que acaba
   * de llegar o de salir es lo que hay que fotografiar.
   */
  async recientes(destino: DestinoFotos, cantidad = 40): Promise<DocumentoConFotos[]> {
    const snap = await getDocs(query(
      collection(db, COLECCION[destino]),
      orderBy('createdAt', 'desc'),
      fsLimit(cantidad),
    ));
    return snap.docs.map(d => PARSE[destino](d.id, d.data() as Record<string, unknown>));
  },

  /** Suscripcion a un documento — la galeria se actualiza sola al drenar la cola. */
  subscribeById(
    destino: DestinoFotos,
    id: string,
    callback: (d: DocumentoConFotos | null) => void,
  ): () => void {
    return onSnapshot(doc(db, COLECCION[destino], id), snap => {
      callback(snap.exists() ? PARSE[destino](snap.id, snap.data() as Record<string, unknown>) : null);
    }, err => {
      console.error('[mercaderiaFotos] subscripcion:', err);
      callback(null);
    });
  },

  /**
   * Sube la foto a Storage y la anexa a la tanda del documento.
   * La llama el drain de la cola, no la pantalla de captura.
   */
  async agregarFoto(destino: DestinoFotos, id: string, blob: File | Blob, meta: {
    nombre?: string | null;
    /** ISO de la captura — la cola lo pasa para conservar el momento real. */
    fecha?: string | null;
    /** Quien capturo — al drenar puede haber otro user logueado. */
    subidoPor?: string | null;
  }): Promise<FotoMercaderia> {
    const rawName = meta.nombre || (blob instanceof File ? blob.name : 'foto.jpg');
    const safeName = rawName.replace(/[^\w.\-]/g, '_');
    const storagePath = `${COLECCION[destino]}/${id}/fotos/${Date.now()}-${safeName}`;
    const r = storageRef(storage, storagePath);
    await uploadBytes(r, blob, { contentType: blob.type || 'image/jpeg' });
    const url = await getDownloadURL(r);

    const foto: FotoMercaderia = {
      id: crypto.randomUUID(),
      url,
      storagePath,
      nombre: rawName,
      fecha: meta.fecha ?? new Date().toISOString(),
      subidoPor: meta.subidoPor ?? getCurrentUser()?.displayName ?? null,
    };

    // Leer fresco justo antes del append: dos telefonos pueden estar
    // fotografiando el mismo embarque.
    const ref = doc(db, COLECCION[destino], id);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('El documento ya no existe');
    const actuales = ((snap.data() as { fotos?: FotoMercaderia[] }).fotos) ?? [];
    await updateDoc(ref, {
      ...deepCleanForFirestore({ fotos: [...actuales, foto], ...getUpdateTrace() }),
      updatedAt: Timestamp.now(),
    });
    return foto;
  },

  /** Cierra o reabre la tanda. Cerrada = "esto es todo lo que se documento". */
  async cerrarTanda(destino: DestinoFotos, id: string, cerrar: boolean): Promise<void> {
    await updateDoc(doc(db, COLECCION[destino], id), {
      ...deepCleanForFirestore({
        fotosCerradasAt: cerrar ? new Date().toISOString() : null,
        fotosCerradasPor: cerrar ? (getCurrentUser()?.displayName ?? null) : null,
        ...getUpdateTrace(),
      }),
      updatedAt: Timestamp.now(),
    });
  },
};
