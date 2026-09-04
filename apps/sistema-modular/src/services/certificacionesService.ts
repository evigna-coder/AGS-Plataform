import { doc, collection, getDocs, getDoc, query, where, Timestamp } from 'firebase/firestore';
import { db, createBatch, batchAudit, deepCleanForFirestore, getCreateTrace } from './firebase';
import { ordenesTrabajoService } from './otService';
import { certificacionStorageService } from './certificacionStorageService';
import type { Certificacion, CertificacionRecibida, EstadoOTCertificacion, ImporteCertificado, ItemCertificacion } from '@ags/shared';
import { certificacionAbierta, itemsDeCertificacion, recibidasDeCertificacion, recibidasSinFacturar } from '@ags/shared';
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

  /**
   * Pedidos con algo por hacer: OTs sin resolver o certificaciones sin pasar a
   * facturación. Antes un lote desaparecía en cuanto se resolvía la última OT
   * —y con eso se llevaba el botón "Pasar a facturación" y la posibilidad de
   * cargar el segundo papel del cliente (2026-09-04).
   */
  async getAbiertas(filters?: { contratoId?: string; clienteId?: string }): Promise<Certificacion[]> {
    const todas = await this.getAll(filters?.clienteId ? { clienteId: filters.clienteId } : undefined);
    return todas
      .filter(c => !filters?.contratoId || c.contratoId === filters.contratoId)
      .filter(certificacionAbierta);
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
   * Suma OTs a un lote YA pedido (2026-09-04).
   *
   * El lote mensual se arma y se manda, y después cierran más OTs del mismo
   * período: antes la única salida era abrir un segundo lote para dos OTs,
   * y el cliente recibía dos resúmenes del mismo mes. Las nuevas entran
   * `pendiente`, como las demás, y se resuelven de a una cuando vuelve la
   * certificación. Una OT que ya está en el lote no se duplica.
   *
   * Un lote cerrado no admite más OTs: eso es otro lote.
   */
  async agregarItems(loteId: string, nuevos: ItemCertificacion[]): Promise<{ agregadas: string[] }> {
    const cert = await this.getById(loteId);
    if (!cert) throw new Error('El lote no existe');
    if (cert.estado === 'cerrada') throw new Error('El lote ya está cerrado — armá uno nuevo');
    const actuales = itemsDeCertificacion(cert);
    const yaEstan = new Set(actuales.map(i => i.otNumber));
    const aSumar = nuevos
      .filter(i => i.otNumber && !yaEstan.has(i.otNumber))
      .map(i => ({ ...i, estado: 'pendiente' as const }));
    if (aSumar.length === 0) throw new Error('Todas esas OTs ya están en el lote');
    const items = [...actuales, ...aSumar];
    const patch = deepCleanForFirestore({
      items,
      otNumbers: items.map(i => i.otNumber),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.update(doc(db, 'certificaciones', loteId), patch);
    batchAudit(batch, { action: 'update', collection: 'certificaciones', documentId: loteId, after: patch });
    await batch.commit();
    return { agregadas: aSumar.map(i => i.otNumber) };
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
      fecha?: string | null;
      importes: ImporteCertificado[];
      observaciones?: string | null;
      archivo?: File | null;
      /** Varios archivos por documento (2026-09-04). */
      archivos?: File[] | null;
      /**
       * Certifica de una todas las OTs que sigan pendientes (default true).
       *
       * El cliente manda UN documento por el conjunto de servicios, no uno por
       * OT: obligar a resolver de a una era invertir el caso normal. Las
       * excepciones —lo que el cliente objetó— se marcan aparte, antes o
       * después, y este barrido no las pisa.
       */
      certificarPendientes?: boolean;
      /**
       * Qué OTs certifica ESTE documento (2026-09-04). Si viene, manda sobre
       * `certificarPendientes`: el cliente puede devolver un papel por planta
       * y el lote sigue abierto para el siguiente.
       */
      otNumbers?: string[];
    },
    actor?: { uid: string; name?: string },
  ): Promise<CertificacionRecibida> {
    const lote = await this.getById(loteId);
    if (!lote) throw new Error('Lote de certificacion no encontrado');

    const id = crypto.randomUUID();
    const archivos: { url: string; path: string; nombre: string }[] = [];
    for (const f of [...(datos.archivos ?? []), ...(datos.archivo ? [datos.archivo] : [])]) {
      const up = await certificacionStorageService.upload(loteId, f, f.name);
      archivos.push({ url: up.url, path: up.storagePath, nombre: f.name });
    }
    const archivoUrl = archivos[0]?.url ?? null;
    const archivoPath = archivos[0]?.path ?? null;
    // Qué OTs certifica este papel: las elegidas, o todas las pendientes.
    // Lo ya objetado o marcado no facturable se respeta.
    const itemsPrevios = itemsDeCertificacion(lote);
    const elegidas = datos.otNumbers ? new Set(datos.otNumbers) : null;
    const certificarTodas = datos.certificarPendientes !== false;
    const aLiberar = itemsPrevios.filter(i => i.estado === 'pendiente'
      && (elegidas ? elegidas.has(i.otNumber) : certificarTodas));
    const liberadas = new Set(aLiberar.map(i => i.otNumber));
    const nueva: CertificacionRecibida = {
      id,
      numero: datos.numero ?? null,
      fecha: datos.fecha || null,
      archivoUrl, archivoPath,
      archivos,
      importes: (datos.importes ?? []).filter(i => Number.isFinite(i.monto) && i.monto !== 0),
      observaciones: datos.observaciones ?? null,
      otNumbers: [...liberadas],
      solicitudesIds: [],
    };
    const recibidas = [...recibidasDeCertificacion(lote).filter(r => r.id !== 'legacy'), nueva];
    const itemsFinales = itemsPrevios.map(i => liberadas.has(i.otNumber)
      ? { ...i, estado: 'certificada' as const, fechaResolucion: new Date().toISOString(), recibidaId: id }
      : i);
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
   * SE FACTURA LO CERTIFICADO: el monto sale de cada documento del cliente,
   * no de los presupuestos. Si el cliente certifico menos de lo
   * presupuestado, se factura lo que certifico.
   *
   * Por DOCUMENTO sin facturar y por MONEDA (2026-09-04): un lote con dos
   * plantas recibe dos papeles en momentos distintos, y cada uno se factura
   * cuando llega. Antes era una sola pasada por lote, y el segundo papel no
   * tenia como facturarse.
   *
   * Si las OTs de un documento cuelgan de MAS DE UN presupuesto, corta y avisa
   * en vez de repartir el importe con un criterio inventado.
   */
  async generarSolicitudes(loteId: string, actor?: { uid: string; name?: string }): Promise<string[]> {
    const lote = await this.getById(loteId);
    if (!lote) throw new Error('Lote no encontrado');
    const pendientes = recibidasSinFacturar(lote);
    if (pendientes.length === 0) {
      throw new Error(lote.solicitudesIds?.length
        ? 'Todas las certificaciones de este lote ya se pasaron a facturacion'
        : 'El lote no tiene importes certificados: carga la certificacion con su importe');
    }
    const certificadas = itemsDeCertificacion(lote).filter(i => i.estado === 'certificada');
    if (certificadas.length === 0) throw new Error('El lote no tiene ninguna OT certificada');
    const { presupuestosService } = await import('./presupuestosService');

    const idsNuevos: string[] = [];
    const recibidasActualizadas = recibidasDeCertificacion(lote).map(r => ({ ...r }));
    for (const rec of pendientes) {
      // OTs que respalda este papel. Un documento viejo sin la lista cubre
      // todo lo certificado del lote.
      const otsDelPapel = rec.otNumbers?.length
        ? certificadas.filter(i => rec.otNumbers!.includes(i.otNumber))
        : certificadas;
      // Presupuesto de esas OTs. Debe ser uno solo.
      const presupuestos = new Set<string>();
      for (const it of otsDelPapel) {
        const ot = await ordenesTrabajoService.getByOtNumber(it.otNumber);
        for (const b of ot?.budgets ?? []) presupuestos.add(b);
      }
      if (presupuestos.size > 1) {
        throw new Error(
          `Las OTs de la certificacion ${rec.numero ?? ''} pertenecen a ${presupuestos.size} presupuestos distintos `
          + `(${[...presupuestos].join(', ')}). Arma un lote por presupuesto para no repartir el importe a ojo.`,
        );
      }
      const numeroPpto = [...presupuestos][0] ?? '';
      const ppto = numeroPpto ? await presupuestosService.getByNumero(numeroPpto) : null;
      const refCert = rec.numero ?? '';
      const ids: string[] = [];
      for (const imp of rec.importes) {
        if (!Number.isFinite(imp.monto) || imp.monto === 0) continue;
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
            precioUnitario: imp.monto,
            subtotal: imp.monto,
          }],
          montoTotal: imp.monto,
          moneda: imp.moneda,
          estado: 'pendiente',
          otNumbers: otsDelPapel.map(i => i.otNumber),
          observaciones: `Importe segun certificacion del cliente`
            + `${refCert ? ` N° ${refCert}` : ''}. ${otsDelPapel.length} OT(s).`,
          solicitadoPor: actor?.uid ?? null,
          solicitadoPorNombre: actor?.name ?? null,
        } as any);
        ids.push(id);
      }
      const idx = recibidasActualizadas.findIndex(r => r.id === rec.id);
      if (idx >= 0) recibidasActualizadas[idx] = { ...recibidasActualizadas[idx], solicitudesIds: ids };
      idsNuevos.push(...ids);
    }

    const patch = deepCleanForFirestore({
      recibidas: recibidasActualizadas.filter(r => r.id !== 'legacy'),
      solicitudesIds: [...(lote.solicitudesIds ?? []), ...idsNuevos],
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.update(doc(db, 'certificaciones', loteId), patch);
    batchAudit(batch, { action: 'update', collection: 'certificaciones', documentId: loteId, after: patch });
    await batch.commit();
    return idsNuevos;
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
