import { collection, getDocs, getDoc, doc, query, orderBy, Timestamp, arrayUnion } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import type { Factura, EstadoFactura, ComentarioFactura, Posta, TicketArea } from '@ags/shared';
import {
  db, storage, updateDoc, uploadBytes, deepCleanForFirestore,
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
  /** N° REAL de la factura del proveedor, tipeado a mano (2026-08-20). */
  numero: string;
  proveedorId: string | null;
  proveedorNombre: string;
  pdfFile: File;
  areaDestino: TicketArea;
  responsableId: string;
  responsableNombre: string;
}

export const facturasService = {
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
    // El número es el REAL de la factura del proveedor (2026-08-20): administración
    // lo tipea al cargar. Antes se generaba un correlativo FAC-00001 propio, que no
    // servía para cruzar contra el papel ni contra el resumen del proveedor.
    const numero = input.numero.trim();

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
      facturaId: facturaRef.id,
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

  /**
   * Aviso al CREADOR de la factura vía ticket nuevo asignado a él (pedido
   * 2026-08-03): cuando otro usuario aprueba o comenta, el creador tiene que
   * enterarse. No se toca el ticket original de validación/pago — ese sigue
   * en la bandeja del responsable. Best-effort: si falla, no rompe la acción.
   */
  async _avisarCreador(factura: Factura, resumen: string, detalle: string | null): Promise<void> {
    try {
      const user = getCurrentUserTrace();
      // Sin creador registrado, o el actor ES el creador → no hay a quién avisar.
      if (!factura.createdBy || !factura.createdByName) return;
      if (user && user.uid === factura.createdBy) return;

      const descripcion = `${resumen}${detalle ? `\n\n"${detalle}"` : ''}\n\n(Factura ${factura.numero ?? ''} — Control de facturas #${factura.id})`;
      const posta: Posta | null = user ? {
        id: crypto.randomUUID(),
        fecha: new Date().toISOString(),
        deUsuarioId: user.uid,
        deUsuarioNombre: user.name,
        aUsuarioId: factura.createdBy,
        aUsuarioNombre: factura.createdByName,
        estadoAnterior: 'nuevo',
        estadoNuevo: 'nuevo',
        comentario: resumen,
      } : null;

      await leadsService.create({
        clienteId: null,
        contactoId: null,
        razonSocial: factura.proveedorNombre,
        contacto: '',
        email: '',
        telefono: '',
        motivoLlamado: 'administracion',
        motivoContacto: resumen,
        descripcion,
        sistemaId: null,
        moduloId: null,
        estado: 'nuevo',
        postas: posta ? [posta] : [],
        asignadoA: factura.createdBy,
        asignadoNombre: factura.createdByName,
        derivadoPor: null,
        areaActual: 'administracion',
        accionPendiente: resumen,
        prioridad: 'normal',
        proximoContacto: null,
        valorEstimado: null,
        createdBy: user?.uid,
        finalizadoAt: null,
        presupuestosIds: [],
        otIds: [],
        facturaId: factura.id,
      });
    } catch (err) {
      console.error('No se pudo avisar al creador de la factura:', err);
    }
  },

  async aprobar(id: string, actor?: string, comentarioAprobacion?: string): Promise<void> {
    const texto = comentarioAprobacion?.trim() || '';
    const batch = createBatch();
    const data: Record<string, any> = {
      estado: 'aprobada' as EstadoFactura,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    };
    if (texto) {
      const comentario: ComentarioFactura = { texto, autor: actor ?? 'Sistema', fecha: new Date().toISOString(), tipo: 'aprobacion' };
      data.comentarios = arrayUnion(deepCleanForFirestore(comentario));
    }
    batch.update(docRef(COLLECTION, id), data);
    batchAudit(batch, { action: 'update', collection: COLLECTION, documentId: id, after: { estado: 'aprobada', actor: actor ?? null, comentario: texto || null } });
    await batch.commit();
    logBusinessEvent({ eventName: 'factura.aprobada', collection: COLLECTION, documentId: id, details: { actor: actor ?? null, comentario: texto || null } });

    const factura = await this.getById(id);
    if (factura) {
      await this._avisarCreador(
        factura,
        `Factura ${factura.numero ?? ''} de ${factura.proveedorNombre} APROBADA por ${actor ?? 'Sistema'}`,
        texto || null,
      );

      // Aprobar FINALIZA el ticket de validación (pedido 2026-08-03): su
      // trabajo era validar la factura — aprobada, cumplió. El ticket de
      // aviso al creador queda vivo. Best-effort.
      if (factura.ticketId) {
        try {
          const user = getCurrentUserTrace();
          await leadsService.finalizar(factura.ticketId, {
            id: crypto.randomUUID(),
            fecha: new Date().toISOString(),
            deUsuarioId: user?.uid ?? 'system',
            deUsuarioNombre: user?.name ?? 'Sistema',
            aUsuarioId: user?.uid ?? 'system',
            aUsuarioNombre: user?.name ?? 'Sistema',
            comentario: `Factura ${factura.numero ?? ''} aprobada${texto ? ` — "${texto}"` : ''} — validación completada.`,
            estadoAnterior: 'nuevo',
            estadoNuevo: 'finalizado',
          });
        } catch (err) {
          console.error('[facturasService.aprobar] finalizar ticket falló (no bloquea):', err);
        }
      }
    }
  },

  /**
   * RECHAZA una factura: no se paga (2026-08-17).
   *
   * No correspondia, vino duplicada, o el importe esta mal. Es un cierre con
   * motivo obligatorio, no una baja silenciosa — y finaliza el ticket de
   * validacion, igual que aprobar. Sin esto una factura que no habia que pagar
   * quedaba pendiente para siempre (caso FAC-00010).
   */
  async rechazar(id: string, motivo: string, actor?: string): Promise<void> {
    const texto = motivo.trim();
    if (!texto) throw new Error('El rechazo necesita un motivo');
    const comentario: ComentarioFactura = {
      texto, autor: actor ?? 'Sistema', fecha: new Date().toISOString(), tipo: 'rechazo',
    };
    const batch = createBatch();
    batch.update(docRef(COLLECTION, id), {
      estado: 'rechazada' as EstadoFactura,
      comentarios: arrayUnion(deepCleanForFirestore(comentario)),
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    batchAudit(batch, { action: 'update', collection: COLLECTION, documentId: id, after: { estado: 'rechazada', actor: actor ?? null, motivo: texto } });
    await batch.commit();
    logBusinessEvent({ eventName: 'factura.rechazada', collection: COLLECTION, documentId: id, details: { actor: actor ?? null, motivo: texto } });

    const factura = await this.getById(id);
    if (!factura) return;
    await this._avisarCreador(
      factura,
      `Factura ${factura.numero ?? ''} de ${factura.proveedorNombre} RECHAZADA por ${actor ?? 'Sistema'}`,
      texto,
    );
    // Rechazar tambien cierra la validacion: el trabajo era decidir, y se decidio.
    if (factura.ticketId) {
      try {
        const user = getCurrentUserTrace();
        await leadsService.finalizar(factura.ticketId, {
          id: crypto.randomUUID(),
          fecha: new Date().toISOString(),
          deUsuarioId: user?.uid ?? 'system',
          deUsuarioNombre: user?.name ?? 'Sistema',
          aUsuarioId: user?.uid ?? 'system',
          aUsuarioNombre: user?.name ?? 'Sistema',
          comentario: `Factura ${factura.numero ?? ''} RECHAZADA — "${texto}". No se paga.`,
          estadoAnterior: 'nuevo',
          estadoNuevo: 'finalizado',
        });
      } catch (err) {
        console.error('[facturasService.rechazar] finalizar ticket fallo (no bloquea):', err);
      }
    }
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

    const factura = await this.getById(id);
    if (factura) {
      await this._avisarCreador(
        factura,
        `Nuevo comentario de ${autor} en factura ${factura.numero ?? ''} de ${factura.proveedorNombre}`,
        texto,
      );
    }
  },
};
