/**
 * Service de loaners para portal-ingeniero.
 *
 * Regla de negocio: el préstamo (egreso) se registra SIEMPRE desde el
 * back-office porque lleva remito — el portal NO crea préstamos. Desde acá el
 * ingeniero solo:
 *   - agrega fotos de salida al préstamo activo (contexto 'prestamo'),
 *   - registra la devolución con fotos (contexto 'devolucion') → el loaner
 *     queda 'en_recalificacion' (pendiente de RQ). La OT de recalificación y
 *     el ticket a coordinación los crea el back-office vía sweep
 *     (sistema-modular · utils/loanerRecalificacion), NO el portal.
 *
 * Paths de Storage y shape de FotoLoaner idénticos a loanersService de
 * sistema-modular (`loaners/{id}/fotos/{ts}-{nombre}`, contexto + prestamoId)
 * para que la galería del back-office muestre las fotos sin nada extra.
 *
 * Las fotos NO se suben directo desde la UI: se encolan en la cola offline
 * (uploadQueueManager) y el drain llama a `agregarFoto` cuando hay señal.
 * Por eso acá no hay reintentos propios — los maneja la cola (backoff).
 */
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  updateDoc,
  where,
  Timestamp,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { Loaner, FotoLoaner, PrestamoLoaner } from '@ags/shared';
import { deepCleanForFirestore } from '@ags/shared';
import { db, storage } from './firebase';
import { getCurrentUser, getUpdateTrace } from './currentUser';

const COLLECTION = 'loaners';

function parseLoaner(id: string, data: Record<string, unknown>): Loaner {
  return {
    id,
    ...data,
    createdAt: (data['createdAt'] as { toDate?: () => Date })?.toDate?.()?.toISOString?.()
      ?? (data['createdAt'] as string) ?? new Date().toISOString(),
    updatedAt: (data['updatedAt'] as { toDate?: () => Date })?.toDate?.()?.toISOString?.()
      ?? (data['updatedAt'] as string) ?? new Date().toISOString(),
  } as Loaner;
}

/** Préstamo activo del loaner (el que el portal fotografía / devuelve). */
export function prestamoActivo(l: Loaner): PrestamoLoaner | undefined {
  return (l.prestamos ?? []).find(p => p.estado === 'activo');
}

/** Último préstamo devuelto (para mostrar contexto en 'en_recalificacion'). */
export function ultimoPrestamoDevuelto(l: Loaner): PrestamoLoaner | undefined {
  const prestamos = l.prestamos ?? [];
  for (let i = prestamos.length - 1; i >= 0; i--) {
    if (prestamos[i].estado === 'devuelto') return prestamos[i];
  }
  return undefined;
}

export const loanersPortalService = {
  /**
   * Loaners visibles en el portal: con préstamo activo ('en_cliente') y los
   * pendientes de recalificación ('en_recalificacion', solo lectura).
   */
  subscribeVisibles(
    callback: (items: Loaner[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    const q = query(
      collection(db, COLLECTION),
      where('estado', 'in', ['en_cliente', 'en_recalificacion']),
    );
    return onSnapshot(q, snap => {
      const items = snap.docs.map(d => parseLoaner(d.id, d.data() as Record<string, unknown>));
      items.sort((a, b) => {
        // En cliente primero (accionables), después por código.
        if (a.estado !== b.estado) return a.estado === 'en_cliente' ? -1 : 1;
        return (a.codigo || '').localeCompare(b.codigo || '');
      });
      callback(items);
    }, err => {
      console.error('loaners subscription error:', err);
      onError?.(err);
    });
  },

  async getById(id: string): Promise<Loaner | null> {
    const snap = await getDoc(doc(db, COLLECTION, id));
    if (!snap.exists()) return null;
    return parseLoaner(snap.id, snap.data() as Record<string, unknown>);
  },

  subscribeById(
    id: string,
    callback: (item: Loaner | null) => void,
    onError?: (err: Error) => void,
  ): () => void {
    return onSnapshot(doc(db, COLLECTION, id), snap => {
      callback(snap.exists() ? parseLoaner(snap.id, snap.data() as Record<string, unknown>) : null);
    }, err => {
      console.error('loaner subscription error:', err);
      onError?.(err);
    });
  },

  /**
   * Sube UNA foto a Storage (`loaners/{id}/fotos/{ts}-{nombre}` — mismo path
   * que sistema-modular) y la appendea al array `fotos` del doc con el mismo
   * shape FotoLoaner que usa el back-office. Punto único de esta lógica: la
   * cola offline (uploadQueueManager) lo llama al drenar; no subir por afuera.
   */
  async agregarFoto(loanerId: string, blob: File | Blob, meta: {
    nombre?: string | null;
    descripcion?: string | null;
    contexto: FotoLoaner['contexto'];
    prestamoId?: string | null;
    /** ISO de la captura — la cola lo pasa para conservar el momento real. */
    fecha?: string | null;
    /** Quién capturó — la cola lo pasa (al drenar puede haber otro user). */
    subidoPor?: string | null;
  }): Promise<FotoLoaner> {
    const rawName = meta.nombre || (blob instanceof File ? blob.name : 'foto.jpg');
    const safeName = rawName.replace(/[^\w.\-]/g, '_');
    const storagePath = `loaners/${loanerId}/fotos/${Date.now()}-${safeName}`;
    const r = storageRef(storage, storagePath);
    await uploadBytes(r, blob, { contentType: blob.type || 'image/jpeg' });
    const url = await getDownloadURL(r);

    const foto: FotoLoaner = {
      id: crypto.randomUUID(),
      url,
      storagePath,
      nombre: rawName,
      descripcion: meta.descripcion ?? null,
      contexto: meta.contexto,
      prestamoId: meta.prestamoId ?? null,
      fecha: meta.fecha ?? new Date().toISOString(),
      subidoPor: meta.subidoPor ?? getCurrentUser()?.displayName ?? null,
    };

    // Leer fresco justo antes del append para minimizar pisadas concurrentes.
    const ref = doc(db, COLLECTION, loanerId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Loaner no encontrado');
    const loaner = parseLoaner(snap.id, snap.data() as Record<string, unknown>);
    await updateDoc(ref, {
      ...deepCleanForFirestore({
        fotos: [...(loaner.fotos ?? []), foto],
        ...getUpdateTrace(),
      }),
      updatedAt: Timestamp.now(),
    });
    return foto;
  },

  /**
   * Registra la devolución del préstamo — espeja la semántica de
   * loanersService.registrarDevolucion de sistema-modular: el préstamo pasa a
   * 'devuelto' y el loaner a 'en_recalificacion' (requiereRecalificacion
   * default true; con false volvería 'en_base'). La OT/ticket NO se crean acá.
   */
  async registrarDevolucion(loanerId: string, prestamoId: string, data: {
    fechaRetornoReal: string;
    condicionRetorno: string;
    requiereRecalificacion?: boolean;
  }): Promise<void> {
    const ref = doc(db, COLLECTION, loanerId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Loaner no encontrado');
    const loaner = parseLoaner(snap.id, snap.data() as Record<string, unknown>);
    const prestamo = (loaner.prestamos ?? []).find(p => p.id === prestamoId);
    if (!prestamo) throw new Error('Préstamo no encontrado');
    if (prestamo.estado !== 'activo') throw new Error('El préstamo ya fue devuelto');

    const recalifica = data.requiereRecalificacion ?? true;
    const prestamos = loaner.prestamos.map(p =>
      p.id === prestamoId
        ? {
            ...p,
            fechaRetornoReal: data.fechaRetornoReal,
            condicionRetorno: data.condicionRetorno,
            requiereRecalificacion: recalifica,
            estado: 'devuelto' as const,
          }
        : p
    );
    await updateDoc(ref, {
      ...deepCleanForFirestore({
        estado: recalifica ? 'en_recalificacion' : 'en_base',
        prestamos,
        condicion: data.condicionRetorno,
        ...getUpdateTrace(),
      }),
      updatedAt: Timestamp.now(),
    });
  },
};
