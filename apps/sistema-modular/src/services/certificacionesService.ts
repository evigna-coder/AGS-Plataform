import { doc, collection, getDocs, getDoc, query, where, Timestamp } from 'firebase/firestore';
import { db, createBatch, batchAudit, deepCleanForFirestore, getCreateTrace } from './firebase';
import { ordenesTrabajoService } from './otService';
import { certificacionStorageService } from './certificacionStorageService';
import type { Certificacion, CertificacionRecibida, EstadoOTCertificacion, ImporteCertificado, ItemCertificacion } from '@ags/shared';
import { certificacionResuelta, itemsDeCertificacion, recibidasDeCertificacion, totalesCertificados } from '@ags/shared';
import { facturacionService } from './facturacionService';

export interface CreateCertificacionInput {
  numero?: string | null;
  clienteId?: string | null;
  clienteNombre?: string | null;
  fecha: string;
  otNumbers: string[];
  archivo?: File | null;
  observaciones?: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapDoc = (d: any): Certificacion => ({
  id: d.id,
  ...d.data(),
  createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
  updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
});

export const certificacionesService = {
  /**
   * Registra una certificación del cliente y LIBERA para facturación cada OT que
   * cubre (clientes `requisitoFacturacion === 'certificacion'`). Sube el archivo a
   * Storage y estampa `certificacionId` en cada OT liberada (trazabilidad).
   * La liberación por OT es best-effort: si una falla, las demás igual se liberan.
   */
  async create(
    input: CreateCertificacionInput,
    actor?: { uid: string; name?: string },
  ): Promise<{ id: string; liberadas: string[] }> {
    const id = crypto.randomUUID();
    let archivoUrl: string | null = null;
    let archivoPath: string | null = null;
    if (input.archivo) {
      const up = await certificacionStorageService.upload(id, input.archivo, input.archivo.name);
      archivoUrl = up.url;
      archivoPath = up.storagePath;
    }

    const payload = deepCleanForFirestore({
      numero: input.numero ?? null,
      clienteId: input.clienteId ?? null,
      clienteNombre: input.clienteNombre ?? null,
      fecha: input.fecha,
      otNumbers: input.otNumbers,
      archivoUrl,
      archivoPath,
      observaciones: input.observaciones ?? null,
      ...getCreateTrace(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.set(doc(db, 'certificaciones', id), payload);
    batchAudit(batch, { action: 'create', collection: 'certificaciones', documentId: id, after: payload });
    await batch.commit();

    const liberadas: string[] = [];
    for (const otNumber of input.otNumbers) {
      try {
        await ordenesTrabajoService.liberarParaFacturacion(otNumber, actor);
        await ordenesTrabajoService.update(otNumber, {
          certificacionId: id,
          certificacionNumero: input.numero ?? null,
        });
        liberadas.push(otNumber);
      } catch (err) {
        console.error(`[certificaciones.create] no se pudo liberar OT ${otNumber}:`, err);
      }
    }
    return { id, liberadas };
  },

  async getAll(filters?: { clienteId?: string }): Promise<Certificacion[]> {
    let q = query(collection(db, 'certificaciones'));
    if (filters?.clienteId) q = query(q, where('clienteId', '==', filters.clienteId));
    const snap = await getDocs(q);
    const items = snap.docs.map(mapDoc);
    items.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    return items;
  },

  async getById(id: string): Promise<Certificacion | null> {
    const snap = await getDoc(doc(db, 'certificaciones', id));
    return snap.exists() ? mapDoc(snap) : null;
  },

  /** Pedidos que todavía tienen alguna OT sin resolver. */
  async getAbiertas(filters?: { contratoId?: string; clienteId?: string }): Promise<Certificacion[]> {
    const todas = await this.getAll(filters?.clienteId ? { clienteId: filters.clienteId } : undefined);
    return todas
      .filter(c => !filters?.contratoId || c.contratoId === filters.contratoId)
      .filter(c => c.estado !== 'cerrada' && !certificacionResuelta(c));
  },

  /**
   * SOLICITA una certificación por un lote de OTs (2026-08-17).
   *
   * A diferencia de `create`, que registra el papel que YA llegó, esto arma el
   * pedido antes: junta las OTs del período, las deja `pendiente` y NO libera
   * nada. Es el circuito de las plantas que certifican por lote mensual — se
   * manda el resumen al cliente y se espera.
   *
   * Las OTs siguen retenidas hasta que cada una se resuelva con `resolverItem`.
   */
  async solicitar(input: {
    contratoId?: string | null;
    contratoNumero?: string | null;
    clienteId?: string | null;
    clienteNombre?: string | null;
    establecimientoIds?: string[];
    /** `YYYY-MM` del lote. */
    periodo?: string | null;
    /** Lineas del resumen, ya con el texto que va a ver el cliente. */
    items: ItemCertificacion[];
    observaciones?: string | null;
  }): Promise<string> {
    if (input.items.length === 0) throw new Error('El pedido no tiene ninguna OT');
    const id = crypto.randomUUID();
    const hoy = new Date().toISOString().slice(0, 10);
    const payload = deepCleanForFirestore({
      numero: null,
      clienteId: input.clienteId ?? null,
      clienteNombre: input.clienteNombre ?? null,
      contratoId: input.contratoId ?? null,
      contratoNumero: input.contratoNumero ?? null,
      establecimientoIds: input.establecimientoIds ?? [],
      periodo: input.periodo ?? null,
      fecha: hoy,
      estado: 'solicitada' as const,
      otNumbers: input.items.map(i => i.otNumber),
      items: input.items.map(i => ({ ...i, estado: 'pendiente' as const })),
      archivoUrl: null, archivoPath: null,
      observaciones: input.observaciones ?? null,
      ...getCreateTrace(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.set(doc(db, 'certificaciones', id), payload);
    batchAudit(batch, { action: 'create', collection: 'certificaciones', documentId: id, after: payload });
    await batch.commit();
    return id;
  },

  /**
   * Reescribe las lineas del resumen (2026-08-17). Solo el texto que ve el
   * cliente: no toca el estado de cada OT ni la OT en si.
   */
  async actualizarItems(certificacionId: string, items: ItemCertificacion[]): Promise<void> {
    const patch = deepCleanForFirestore({
      items,
      otNumbers: items.map(i => i.otNumber),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.update(doc(db, 'certificaciones', certificacionId), patch);
    batchAudit(batch, { action: 'update', collection: 'certificaciones', documentId: certificacionId, after: patch });
    await batch.commit();
  },

  /**
   * Agrega una certificacion RECIBIDA al lote (2026-08-17).
   *
   * Un lote puede tener varias: el cliente devuelve un documento por planta, o
   * separa por moneda. Cada una trae su papel y los importes que habilita a
   * facturar — y ESE importe, no el del presupuesto, es el que se factura.
   *
   * Mismo rol que la OC del cliente en un presupuesto.
   */
  async agregarRecibida(
    loteId: string,
    datos: {
      numero?: string | null;
      fecha: string;
      importes: ImporteCertificado[];
      observaciones?: string | null;
      archivo?: File | null;
      /**
       * Certifica de una todas las OTs que sigan pendientes (default true).
       *
       * El cliente manda UN documento por el conjunto de servicios, no uno por
       * OT: obligar a resolver de a una era invertir el caso normal. Las
       * excepciones —lo que el cliente objetó— se marcan aparte, antes o
       * después, y este barrido no las pisa.
       */
      certificarPendientes?: boolean;
    },
    actor?: { uid: string; name?: string },
  ): Promise<CertificacionRecibida> {
    const lote = await this.getById(loteId);
    if (!lote) throw new Error('Lote de certificacion no encontrado');

    const id = crypto.randomUUID();
    let archivoUrl: string | null = null;
    let archivoPath: string | null = null;
    if (datos.archivo) {
      const up = await certificacionStorageService.upload(loteId, datos.archivo, datos.archivo.name);
      archivoUrl = up.url;
      archivoPath = up.storagePath;
    }
    const nueva: CertificacionRecibida = {
      id,
      numero: datos.numero ?? null,
      fecha: datos.fecha,
      archivoUrl, archivoPath,
      importes: (datos.importes ?? []).filter(i => Number.isFinite(i.monto) && i.monto !== 0),
      observaciones: datos.observaciones ?? null,
    };
    const recibidas = [...recibidasDeCertificacion(lote).filter(r => r.id !== 'legacy'), nueva];

    // Barrido: lo pendiente pasa a certificado con esta certificacion. Lo ya
    // objetado o marcado no facturable se respeta.
    const certificarTodas = datos.certificarPendientes !== false;
    const itemsPrevios = itemsDeCertificacion(lote);
    const aLiberar = certificarTodas ? itemsPrevios.filter(i => i.estado === 'pendiente') : [];
    const itemsFinales = certificarTodas
      ? itemsPrevios.map(i => i.estado === 'pendiente'
          ? { ...i, estado: 'certificada' as const, fechaResolucion: new Date().toISOString() }
          : i)
      : itemsPrevios;
    const resuelto = itemsFinales.every(i => i.estado !== 'pendiente');

    const patch = deepCleanForFirestore({
      recibidas,
      items: itemsFinales,
      estado: resuelto ? ('cerrada' as const) : ('recibida' as const),
      // El numero del lote refleja la primera certificacion, para los listados
      // que muestran una sola linea.
      ...(lote.numero ? {} : { numero: nueva.numero ?? null }),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.update(doc(db, 'certificaciones', loteId), patch);
    batchAudit(batch, { action: 'update', collection: 'certificaciones', documentId: loteId, after: patch });
    await batch.commit();

    // Liberar a facturacion las que quedaron certificadas por este documento.
    // Best-effort por OT: si una falla, las demas igual se liberan.
    for (const it of aLiberar) {
      try {
        await ordenesTrabajoService.liberarParaFacturacion(it.otNumber, actor);
        await ordenesTrabajoService.update(it.otNumber, {
          certificacionId: loteId,
          certificacionNumero: nueva.numero ?? null,
          certificacionArchivoUrl: nueva.archivoUrl ?? null,
        });
      } catch (err) {
        console.error(`[agregarRecibida] no se pudo liberar OT ${it.otNumber}:`, err);
      }
    }
    return nueva;
  },

  /**
   * Genera la(s) solicitud(es) de facturacion del lote (2026-08-17).
   *
   * SE FACTURA LO CERTIFICADO: el monto sale de `totalesCertificados`, no de
   * los presupuestos. Si el cliente certifico menos de lo presupuestado, se
   * factura lo que certifico.
   *
   * Una solicitud POR MONEDA — un lote puede tener importes en pesos y en
   * dolares, y son comprobantes distintos.
   *
   * Si las OTs certificadas cuelgan de MAS DE UN presupuesto, corta y avisa en
   * vez de repartir el importe con un criterio inventado: partir plata a ojo es
   * peor que pedir que se arme un lote por presupuesto.
   */
  async generarSolicitudes(loteId: string, actor?: { uid: string; name?: string }): Promise<string[]> {
    const lote = await this.getById(loteId);
    if (!lote) throw new Error('Lote no encontrado');
    if (lote.solicitudesIds?.length) {
      throw new Error('Este lote ya se paso a facturacion');
    }
    const totales = totalesCertificados(recibidasDeCertificacion(lote));
    if (totales.length === 0) {
      throw new Error('El lote no tiene importes certificados: carga la certificacion con su importe');
    }
    const certificadas = itemsDeCertificacion(lote).filter(i => i.estado === 'certificada');
    if (certificadas.length === 0) throw new Error('El lote no tiene ninguna OT certificada');

    // Presupuesto de las OTs certificadas. Debe ser uno solo.
    const presupuestos = new Set<string>();
    for (const it of certificadas) {
      const ot = await ordenesTrabajoService.getByOtNumber(it.otNumber);
      for (const b of ot?.budgets ?? []) presupuestos.add(b);
    }
    if (presupuestos.size > 1) {
      throw new Error(
        `Las OTs certificadas pertenecen a ${presupuestos.size} presupuestos distintos `
        + `(${[...presupuestos].join(', ')}). Arma un lote por presupuesto para no repartir el importe a ojo.`,
      );
    }
    const numeroPpto = [...presupuestos][0] ?? '';
    const { presupuestosService } = await import('./presupuestosService');
    const ppto = numeroPpto ? await presupuestosService.getByNumero(numeroPpto) : null;

    const recibidas = recibidasDeCertificacion(lote);
    const refCert = recibidas.map(r => r.numero).filter(Boolean).join(', ');
    const ids: string[] = [];
    for (const total of totales) {
      const id = await facturacionService.create({
        presupuestoId: ppto?.id ?? '',
        presupuestoNumero: numeroPpto,
        clienteId: lote.clienteId ?? '',
        clienteNombre: lote.clienteNombre ?? '',
        condicionPago: '',
        items: [{
          id: crypto.randomUUID(),
          presupuestoItemId: '__certificacion__',
          descripcion: `Servicios certificados${lote.periodo ? ` — periodo ${lote.periodo}` : ''}`
            + `${refCert ? ` (cert. ${refCert})` : ''}`,
          cantidad: 1,
          cantidadTotal: 1,
          precioUnitario: total.monto,
          subtotal: total.monto,
        }],
        montoTotal: total.monto,
        moneda: total.moneda,
        estado: 'pendiente',
        otNumbers: certificadas.map(i => i.otNumber),
        observaciones: `Importe segun certificacion del cliente`
          + `${refCert ? ` N° ${refCert}` : ''}. ${certificadas.length} OT(s).`,
        solicitadoPor: actor?.uid ?? null,
        solicitadoPorNombre: actor?.name ?? null,
      } as any);
      ids.push(id);
    }

    await this.getById(loteId).then(async () => {
      const patch = deepCleanForFirestore({ solicitudesIds: ids, updatedAt: Timestamp.now() });
      const batch = createBatch();
      batch.update(doc(db, 'certificaciones', loteId), patch);
      batchAudit(batch, { action: 'update', collection: 'certificaciones', documentId: loteId, after: patch });
      await batch.commit();
    });
    return ids;
  },

  /**
   * Resuelve UNA OT del pedido (2026-08-17).
   *
   * - `certificada` → libera la OT para facturación y le estampa la trazabilidad.
   * - `objetada` → queda pendiente de resolver con el cliente; sigue retenida.
   * - `no_facturable` → se decidió no cobrarla. Sale del circuito sin facturarse,
   *   que es la salida que faltaba: sin ella la OT quedaba retenida para siempre.
   *
   * El pedido pasa a `cerrada` cuando ninguna OT queda pendiente.
   */
  async resolverItem(
    certificacionId: string,
    otNumber: string,
    estado: EstadoOTCertificacion,
    opts?: { motivo?: string | null; numeroCertificacion?: string | null; actor?: { uid: string; name?: string } },
  ): Promise<void> {
    const cert = await this.getById(certificacionId);
    if (!cert) throw new Error('Certificación no encontrada');

    const items = itemsDeCertificacion(cert).map(i =>
      i.otNumber === otNumber
        ? { ...i, estado, motivo: opts?.motivo ?? null, fechaResolucion: new Date().toISOString() }
        : i);
    const resuelta = items.every(i => i.estado !== 'pendiente');

    const patch = deepCleanForFirestore({
      items,
      estado: resuelta ? ('cerrada' as const) : ('recibida' as const),
      ...(opts?.numeroCertificacion ? { numero: opts.numeroCertificacion } : {}),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.update(doc(db, 'certificaciones', certificacionId), patch);
    batchAudit(batch, { action: 'update', collection: 'certificaciones', documentId: certificacionId, after: patch });
    await batch.commit();

    if (estado === 'certificada') {
      try {
        await ordenesTrabajoService.liberarParaFacturacion(otNumber, opts?.actor);
        await ordenesTrabajoService.update(otNumber, {
          certificacionId,
          certificacionNumero: opts?.numeroCertificacion ?? cert.numero ?? null,
          // El papel viaja con la OT: Facturación no tiene que ir a buscarlo.
          certificacionArchivoUrl: recibidasDeCertificacion(cert).find(r => r.archivoUrl)?.archivoUrl ?? null,
        });
      } catch (err) {
        console.error(`[certificaciones.resolverItem] no se pudo liberar OT ${otNumber}:`, err);
      }
    }

    if (estado === 'no_facturable') {
      // La OT sale del circuito: deja de estar retenida esperando un papel que
      // no va a llegar, y queda el motivo escrito en el cierre.
      try {
        await ordenesTrabajoService.update(otNumber, {
          retenidaFacturacion: false,
          requisitoFacturacionPendiente: null,
          certificacionId,
        });
      } catch (err) {
        console.error(`[certificaciones.resolverItem] no se pudo destrabar OT ${otNumber}:`, err);
      }
    }
  },
};
