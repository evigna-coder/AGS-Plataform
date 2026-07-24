import { collection, getDocs, getDoc, doc, query, orderBy, Timestamp, arrayUnion } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import type { Factura, EstadoFactura, ComentarioFactura, Posta, TicketArea } from '@ags/shared';
import {
  db, storage, updateDoc, runTransaction, uploadBytes, deepCleanForFirestore,
  getCreateTrace, getUpdateTrace, createBatch, newDocRef, docRef, batchAudit,
  logBusinessEvent, getCurrentUserTrace, onSnapshot,
} from './firebase';
import { leadsService } from './leadsService';

const COLLECTION = 'facturas';

function parseFacturaDoc(d: { id: string; data: () => any }): Factura {
  const data = d.data();
  return {
    id: d.id,
    numero: data.numero ?? undefined,
    proveedorId: data.proveedorId ?? null,
    proveedorNombre: data.proveedorNombre ?? '',
    pdfUrl: data.pdfUrl ?? '',
    pdfPath: data.pdfPath ?? '',
    estado: (data.estado ?? 'pendiente') as EstadoFactura,
    comentarios: Array.isArray(data.comentarios) ? data.comentarios : [],
    ticketId: data.ticketId ?? null,
    areaDestino: (data.areaDestino ?? null) as TicketArea | null,
    responsableId: data.responsableId ?? null,
    responsableNombre: data.responsableNombre ?? null,
    createdAt: data.createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    updatedAt: data.updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    createdBy: data.createdBy ?? null,
    createdByName: data.createdByName ?? null,
    updatedBy: data.updatedBy ?? null,
    updatedByName: data.updatedByName ?? null,
  };
}

export interface CrearFacturaInput {
  proveedorId: string | null;
  proveedorNombre: string;
  pdfFile: File;
  areaDestino: TicketArea;
  responsableId: string;
  responsableNombre: string;
}

export const facturasService = {
  /**
   * Genera el siguiente correlativo FAC-00001. Atómico vía counter `_counters/facturas`.
   */
  async getNextNumero(): Promise<string> {
    const counterRef = doc(db, '_counters', COLLECTION);
    const next = await runTransaction(db, async (tx) => {
      const snap = await tx.get(counterRef);
      const current = snap.exists() ? (snap.data().value as number) : 0;
      const nextVal = current + 1;
      tx.set(counterRef, { value: nextVal, updatedAt: Timestamp.now() });
      return nextVal;
    });
    return `FAC-${String(next).padStart(5, '0')}`;
  },

  async list(): Promise<Factura[]> {
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(parseFacturaDoc);
  },

  /** Suscripción en tiempo real. Devuelve la función de unsubscribe. */
  subscribe(callback: (items: Factura[]) => void, onError?: (err: Error) => void): () => void {
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      callback(snap.docs.map(parseFacturaDoc));
    }, err => {
      console.error('Facturas subscription error:', err);
      onError?.(err);
    });
  },

  async getById(id: string): Promise<Factura | null> {
    const snap = await getDoc(doc(db, COLLECTION, id));
    if (!snap.exists()) return null;
    return parseFacturaDoc(snap);
  },

  /**
   * Sube el PDF, crea el doc de la factura y deriva un ticket al área + responsable
   * elegidos. El ticket linkea la factura (número + id) en su descripción.
   */
  async crearConTicket(input: CrearFacturaInput): Promise<{ facturaId: string; ticketId: string; numero: string }> {
    const facturaRef = newDocRef(COLLECTION);
    const numero = await this.getNextNumero();

    // PDF a Storage (uploadBytes wrappeado por firebase.ts, igual que el resto del sistema).
    const storageReference = ref(storage, `${COLLECTION}/${facturaRef.id}/${Date.now()}_${input.pdfFile.name}`);
    await uploadBytes(storageReference, input.pdfFile);
    const pdfUrl = await getDownloadURL(storageReference);
    const pdfPath = storageReference.fullPath;

    const payload = deepCleanForFirestore({
      numero,
      proveedorId: input.proveedorId ?? null,
      proveedorNombre: input.proveedorNombre,
      pdfUrl,
      pdfPath,
      estado: 'pendiente' as EstadoFactura,
      comentarios: [],
      ticketId: null,
      areaDestino: input.areaDestino,
      responsableId: input.responsableId,
      responsableNombre: input.responsableNombre,
      ...getCreateTrace(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.set(facturaRef, payload);
    batchAudit(batch, { action: 'create', collection: COLLECTION, documentId: facturaRef.id, after: payload });
    await batch.commit();

    // Derivar ticket al área + responsable elegidos.
    const user = getCurrentUserTrace();
    const descripcion = `Factura ${numero} — Proveedor: ${input.proveedorNombre} (Control de facturas #${facturaRef.id})`;
    const initialPosta: Posta | null = user ? {
      id: crypto.randomUUID(),
      fecha: new Date().toISOString(),
      deUsuarioId: user.uid,
      deUsuarioNombre: user.name,
      aUsuarioId: input.responsableId,
      aUsuarioNombre: input.responsableNombre,
      estadoAnterior: 'nuevo',
      estadoNuevo: 'nuevo',
      comentario: descripcion,
    } : null;

    const ticketId = await leadsService.create({
      clienteId: null,
      contactoId: null,
      razonSocial: input.proveedorNombre,
      contacto: '',
      email: '',
      telefono: '',
      motivoLlamado: 'administracion',
      motivoContacto: descripcion,
      descripcion,
      sistemaId: null,
      moduloId: null,
      estado: 'nuevo',
      postas: initialPosta ? [initialPosta] : [],
      asignadoA: input.responsableId,
      asignadoNombre: input.responsableNombre,
      derivadoPor: null,
      areaActual: input.areaDestino,
      accionPendiente: `Validar / pagar factura ${numero} de ${input.proveedorNombre}`,
      prioridad: 'normal',
      proximoContacto: null,
      valorEstimado: null,
      createdBy: user?.uid,
      finalizadoAt: null,
      presupuestosIds: [],
      otIds: [],
    });

    await updateDoc(docRef(COLLECTION, facturaRef.id), deepCleanForFirestore({
      ticketId,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    }));

    logBusinessEvent({
      eventName: 'factura.cargada',
      collection: COLLECTION,
      documentId: facturaRef.id,
      details: { numero, proveedor: input.proveedorNombre, ticketId, area: input.areaDestino, responsable: input.responsableNombre },
    });

    return { facturaId: facturaRef.id, ticketId, numero };
  },

  async aprobar(id: string, actor?: string): Promise<void> {
    const batch = createBatch();
    batch.update(docRef(COLLECTION, id), {
      estado: 'aprobada' as EstadoFactura,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    batchAudit(batch, { action: 'update', collection: COLLECTION, documentId: id, after: { estado: 'aprobada', actor: actor ?? null } });
    await batch.commit();
    logBusinessEvent({ eventName: 'factura.aprobada', collection: COLLECTION, documentId: id, details: { actor: actor ?? null } });
  },

  async marcarPagada(id: string, actor?: string): Promise<void> {
    const batch = createBatch();
    batch.update(docRef(COLLECTION, id), {
      estado: 'pagada' as EstadoFactura,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    batchAudit(batch, { action: 'update', collection: COLLECTION, documentId: id, after: { estado: 'pagada', actor: actor ?? null } });
    await batch.commit();
    logBusinessEvent({ eventName: 'factura.pagada', collection: COLLECTION, documentId: id, details: { actor: actor ?? null } });
  },

  async agregarComentario(id: string, texto: string, autor: string): Promise<void> {
    const comentario: ComentarioFactura = { texto, autor, fecha: new Date().toISOString() };
    await updateDoc(docRef(COLLECTION, id), {
      comentarios: arrayUnion(deepCleanForFirestore(comentario)),
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
  },
};
