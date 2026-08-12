import { doc, Timestamp, type DocumentData, type DocumentSnapshot } from 'firebase/firestore';
import {
  db, docRef, createBatch, batchAudit, deepCleanForFirestore,
  getCreateTrace, getUpdateTrace, logAudit, runTransaction,
} from './firebase';
import { ubicacionDeRemito } from '@ags/shared';
import type {
  Articulo, EstadoUnidad, Remito, RemitoItem, TipoMovimiento, TipoOrigenDestino,
  TipoUbicacionStock, UbicacionStock, UnidadStock,
} from '@ags/shared';

/**
 * Aplicación REAL de los movimientos manuales del modal "Nuevo movimiento"
 * (fix B4 auditoría de stock pre go-live): cada asiento en `movimientosStock`
 * debe mover existencias en `unidades` en la MISMA operación (tx o batch).
 *
 * Replica los patrones de `stockService` (deducirUnidadDisponible / reservar
 * con split de lote) sin editarlo: unidad + movimiento se escriben juntos,
 * con validación atómica de estado dentro de la transacción.
 *
 * Convención firestore.md: nunca `undefined` (deepCleanForFirestore en todos
 * los payloads); writes solo vía wrappers de `./firebase`.
 */

/** Origen o destino de un movimiento, ya resuelto por el form. */
export interface PuntoMovimiento {
  tipo: TipoOrigenDestino;
  id: string;
  nombre: string;
}

const UBICACIONES_INTERNAS: TipoOrigenDestino[] = ['posicion', 'minikit', 'ingeniero'];

// ── Remitos manuales (fix I4 auditoría): el papel y las existencias van juntos ──

/**
 * Un item de remito "de stock propio" referencia una unidad de `unidades`
 * elegida en el editor de remitos (RemitoEditor). Los items que vienen de una
 * asignación (`asignacionId`/`tipoEntidad`, CrearRemitoDesdeInventarioModal) o
 * de una ficha del cliente (`fichaId`, sin `unidadId`) son DOCUMENTALES: su
 * efecto de stock ya se registró en el flujo de asignaciones, o no aplica
 * porque la mercadería es propiedad del cliente. Esos items no mueven
 * existencias al confirmar el remito.
 */
export function esItemStockRemito(item: RemitoItem): boolean {
  return !!item.unidadId && !item.asignacionId && !item.tipoEntidad;
}

/** True si al confirmar este remito corresponde mover existencias. */
export function remitoMueveStock(remito: Pick<Remito, 'items'>): boolean {
  return remito.items.some(esItemStockRemito);
}

/**
 * Metadata que `aplicarSalidaRemito` estampa en cada item de stock al confirmar,
 * para que el retorno ("marcar devuelto") sepa qué doc mover y adónde.
 * Extiende `RemitoItem` localmente — se persiste en el doc del remito.
 */
export interface RemitoItemAplicado extends RemitoItem {
  stockAplicado?: boolean;
  /** Doc de unidad efectivamente movido (difiere de `unidadId` si hubo split de lote). */
  salidaUnidadId?: string | null;
  salidaCantidad?: number | null;
  /** Ubicación de la unidad antes de la salida — destino del retorno. */
  salidaUbicacionOrigen?: UbicacionStock | null;
}

/** True si la salida de stock de este item ya fue aplicada al confirmar el remito. */
export function itemRemitoConEfectoAplicado(item: RemitoItem): item is RemitoItemAplicado {
  return esItemStockRemito(item) && (item as RemitoItemAplicado).stockAplicado === true;
}

const UBICACION_FALLBACK: UbicacionStock = { tipo: 'posicion', referenciaId: '', referenciaNombre: 'Stock' };

export const movimientosAplicarService = {
  /**
   * Ingreso (o devolución desde OT) manual: CREA las unidades con el mismo shape
   * que el alta por intake (`useStockIntake`) y su MovimientoStock, todo en un
   * mismo batch atómico (unidad + movimiento + audits).
   * - Artículo con `requiereNumeroSerie`: un doc por serie, cantidad 1.
   * - Con `requiereNumeroLote` (sin serie): un doc lote con cantidad N.
   * - Granel: un doc con cantidad N.
   */
  async ingresarUnidades(params: {
    articulo: Articulo;
    cantidad: number;
    /** Series (una por unidad) cuando el artículo requiere n° de serie. */
    series: string[];
    /** Lote cuando el artículo requiere n° de lote. */
    lote: string | null;
    tipoMov: Extract<TipoMovimiento, 'ingreso' | 'devolucion'>;
    origen: PuntoMovimiento;
    destino: PuntoMovimiento;
    otNumber: string | null;
    motivo: string | null;
    creadoPor: string;
  }): Promise<string[]> {
    const { articulo, destino } = params;
    if (!UBICACIONES_INTERNAS.includes(destino.tipo)) {
      throw new Error('El destino de un ingreso debe ser una ubicación interna (posición, minikit o ingeniero)');
    }
    const base = {
      articuloId: articulo.id,
      articuloCodigo: articulo.codigo,
      articuloDescripcion: articulo.descripcion,
      condicion: 'nuevo' as const,
      estado: 'disponible' as EstadoUnidad,
      ubicacion: { tipo: destino.tipo as TipoUbicacionStock, referenciaId: destino.id, referenciaNombre: destino.nombre },
      costoUnitario: null, monedaCosto: null,
      ordenCompraNumero: null, despachoImportacionNumero: null,
      observaciones: null, activo: true,
    };
    const lote = params.lote?.trim() || null;
    const units = articulo.requiereNumeroSerie
      ? params.series.map(s => ({ ...base, nroSerie: s, nroLote: lote, cantidad: 1 }))
      : [{ ...base, nroSerie: null, nroLote: lote, cantidad: params.cantidad }];

    const now = Timestamp.now();
    const ids: string[] = [];
    // 4 ops por unidad (set unidad + audit + set mov + audit) → chunk de 100 < límite 500.
    const CHUNK = 100;
    for (let i = 0; i < units.length; i += CHUNK) {
      const batch = createBatch();
      for (const u of units.slice(i, i + CHUNK)) {
        const unidadId = crypto.randomUUID();
        const unidadPayload = deepCleanForFirestore({
          ...u, ...getCreateTrace(), createdAt: now, updatedAt: now,
        });
        batch.set(doc(db, 'unidades', unidadId), unidadPayload);
        batchAudit(batch, { action: 'create', collection: 'unidades_stock', documentId: unidadId, after: unidadPayload });

        const movId = crypto.randomUUID();
        const movPayload = deepCleanForFirestore({
          tipo: params.tipoMov,
          unidadId,
          articuloId: articulo.id,
          articuloCodigo: articulo.codigo,
          articuloDescripcion: articulo.descripcion,
          cantidad: u.cantidad,
          nroSerie: u.nroSerie ?? null, nroLote: u.nroLote ?? null,
          origenTipo: params.origen.tipo, origenId: params.origen.id, origenNombre: params.origen.nombre,
          destinoTipo: destino.tipo, destinoId: destino.id, destinoNombre: destino.nombre,
          remitoId: null,
          otNumber: params.otNumber,
          motivo: params.motivo,
          creadoPor: params.creadoPor,
          ...getCreateTrace(),
          createdAt: now,
        });
        batch.set(doc(db, 'movimientosStock', movId), movPayload);
        batchAudit(batch, { action: 'create', collection: 'movimientos_stock', documentId: movId, after: movPayload });
        ids.push(unidadId);
      }
      await batch.commit();
    }
    return ids;
  },

  /**
   * Egreso/consumo manual de una unidad DISPONIBLE. Mismo patrón que
   * `stockService.deducirUnidadDisponible`:
   * - aDeducir >= cantidad del doc → estado terminal (`entregado`/`consumido`), sale del ATP.
   * - aDeducir < cantidad (lote) → decrementa `cantidad`.
   * Unidad + movimiento en la misma transacción; validación atómica de estado.
   * Devuelve la cantidad efectivamente descontada.
   */
  async deducirUnidad(params: {
    unidad: UnidadStock;
    aDeducir: number;
    tipoMov: Extract<TipoMovimiento, 'egreso' | 'consumo'>;
    estadoFinal: Extract<EstadoUnidad, 'entregado' | 'consumido'>;
    destino: PuntoMovimiento;
    otNumber: string | null;
    motivo: string | null;
    creadoPor: string;
  }): Promise<number> {
    const now = Timestamp.now();
    const unidadRef = docRef('unidades', params.unidad.id);
    const movRef = doc(db, 'movimientosStock', crypto.randomUUID());

    const descontado = await runTransaction(db, async (tx) => {
      const snap = await tx.get(unidadRef);
      if (!snap.exists()) throw new Error(`Unidad ${params.unidad.id} no encontrada`);
      const data = snap.data();
      if (data.estado !== 'disponible' || data.activo === false) {
        throw new Error(`Unidad no descontable — estado '${data.estado}' (esperaba 'disponible')`);
      }
      const qtyActual = data.cantidad ?? 1;
      const total = params.aDeducir >= qtyActual;
      const cantidadMov = total ? qtyActual : params.aDeducir;
      tx.update(unidadRef, deepCleanForFirestore(total
        ? { estado: params.estadoFinal, ...getUpdateTrace(), updatedAt: now }
        : { cantidad: qtyActual - params.aDeducir, ...getUpdateTrace(), updatedAt: now }));
      tx.set(movRef, deepCleanForFirestore({
        tipo: params.tipoMov,
        unidadId: params.unidad.id,
        articuloId: params.unidad.articuloId,
        articuloCodigo: params.unidad.articuloCodigo,
        articuloDescripcion: params.unidad.articuloDescripcion,
        cantidad: cantidadMov,
        nroSerie: params.unidad.nroSerie ?? null, nroLote: params.unidad.nroLote ?? null,
        origenTipo: params.unidad.ubicacion.tipo as TipoOrigenDestino,
        origenId: params.unidad.ubicacion.referenciaId,
        origenNombre: params.unidad.ubicacion.referenciaNombre,
        destinoTipo: params.destino.tipo, destinoId: params.destino.id, destinoNombre: params.destino.nombre,
        remitoId: null,
        otNumber: params.otNumber,
        motivo: params.motivo,
        creadoPor: params.creadoPor,
        ...getCreateTrace(),
        createdAt: now,
      }));
      return cantidadMov;
    });

    logAudit({ action: 'update', collection: 'unidades_stock', documentId: params.unidad.id });
    return descontado;
  },

  /**
   * Transferencia manual de una unidad DISPONIBLE a otra ubicación interna.
   * - aMover >= cantidad del doc → mueve el doc entero (update de `ubicacion`).
   * - aMover < cantidad (lote) → SPLIT (patrón de `reservasService.reservar`):
   *   decrementa el doc original y crea un doc nuevo en el destino con la porción movida.
   * Unidad + movimiento en la misma transacción. Devuelve la cantidad movida.
   */
  async transferirUnidad(params: {
    unidad: UnidadStock;
    aMover: number;
    destino: PuntoMovimiento;
    motivo: string | null;
    creadoPor: string;
  }): Promise<number> {
    const { destino } = params;
    if (!UBICACIONES_INTERNAS.includes(destino.tipo)) {
      throw new Error('El destino de una transferencia debe ser una ubicación interna (posición, minikit o ingeniero)');
    }
    const now = Timestamp.now();
    const unidadRef = docRef('unidades', params.unidad.id);
    const movRef = doc(db, 'movimientosStock', crypto.randomUUID());
    const splitRef = docRef('unidades', crypto.randomUUID()); // destino si hay split de lote
    const nuevaUbicacion = { tipo: destino.tipo as TipoUbicacionStock, referenciaId: destino.id, referenciaNombre: destino.nombre };

    const movido = await runTransaction(db, async (tx) => {
      const snap = await tx.get(unidadRef);
      if (!snap.exists()) throw new Error(`Unidad ${params.unidad.id} no encontrada`);
      const data = snap.data();
      if (data.estado !== 'disponible' || data.activo === false) {
        throw new Error(`Unidad no transferible — estado '${data.estado}' (esperaba 'disponible')`);
      }
      const qtyActual = data.cantidad ?? 1;
      const aMover = Math.min(params.aMover, qtyActual);
      let movUnidadId = params.unidad.id;
      if (aMover < qtyActual) {
        const { id: _id, ...rest } = data as Record<string, unknown>;
        tx.update(unidadRef, deepCleanForFirestore({
          cantidad: qtyActual - aMover, ...getUpdateTrace(), updatedAt: now,
        }));
        tx.set(splitRef, deepCleanForFirestore({
          ...rest, cantidad: aMover, ubicacion: nuevaUbicacion,
          ...getCreateTrace(), createdAt: now, updatedAt: now,
        }));
        movUnidadId = splitRef.id;
      } else {
        tx.update(unidadRef, deepCleanForFirestore({
          ubicacion: nuevaUbicacion, ...getUpdateTrace(), updatedAt: now,
        }));
      }
      tx.set(movRef, deepCleanForFirestore({
        tipo: 'transferencia' as TipoMovimiento,
        unidadId: movUnidadId,
        articuloId: params.unidad.articuloId,
        articuloCodigo: params.unidad.articuloCodigo,
        articuloDescripcion: params.unidad.articuloDescripcion,
        cantidad: aMover,
        nroSerie: params.unidad.nroSerie ?? null, nroLote: params.unidad.nroLote ?? null,
        origenTipo: params.unidad.ubicacion.tipo as TipoOrigenDestino,
        origenId: params.unidad.ubicacion.referenciaId,
        origenNombre: params.unidad.ubicacion.referenciaNombre,
        destinoTipo: destino.tipo, destinoId: destino.id, destinoNombre: destino.nombre,
        remitoId: null, otNumber: null,
        motivo: params.motivo,
        creadoPor: params.creadoPor,
        ...getCreateTrace(),
        createdAt: now,
      }));
      return aMover;
    });

    logAudit({ action: 'update', collection: 'unidades_stock', documentId: params.unidad.id });
    return movido;
  },

  /**
   * Fracciona un lote disponible SIN moverlo (2026-08-11): decrementa el doc
   * original y crea un clon con `cantidad` en la MISMA ubicación/estado.
   * Split puro, suma cero — no genera MovimientoStock. Lo usa la asignación
   * rápida para llevarse una parte del lote ("el stock debe permitir
   * cantidades"): el clon es lo que se asigna, el original queda disponible.
   * Devuelve el id del doc nuevo (o el original si la cantidad pedida cubre
   * todo el lote — en ese caso no hay split).
   */
  async fraccionarUnidad(params: { unidad: UnidadStock; cantidad: number }): Promise<string> {
    const now = Timestamp.now();
    const unidadRef = docRef('unidades', params.unidad.id);
    const splitRef = docRef('unidades', crypto.randomUUID());

    const idFinal = await runTransaction(db, async (tx) => {
      const snap = await tx.get(unidadRef);
      if (!snap.exists()) throw new Error(`Unidad ${params.unidad.id} no encontrada`);
      const data = snap.data();
      if (data.estado !== 'disponible' || data.activo === false) {
        throw new Error(`Unidad no fraccionable — estado '${data.estado}' (esperaba 'disponible')`);
      }
      const qtyActual = data.cantidad ?? 1;
      const pedida = Math.min(params.cantidad, qtyActual);
      if (pedida >= qtyActual) return params.unidad.id;
      const { id: _id, ...rest } = data as Record<string, unknown>;
      tx.update(unidadRef, deepCleanForFirestore({
        cantidad: qtyActual - pedida, ...getUpdateTrace(), updatedAt: now,
      }));
      tx.set(splitRef, deepCleanForFirestore({
        ...rest, cantidad: pedida,
        ...getCreateTrace(), createdAt: now, updatedAt: now,
      }));
      return splitRef.id;
    });

    logAudit({ action: 'update', collection: 'unidades_stock', documentId: params.unidad.id });
    return idFinal;
  },

  /**
   * Ajuste manual de la cantidad de UNA unidad (motivo obligatorio). Mismo
   * comportamiento que `AjusteStockModal` pero atómico (unidad + movimiento en tx):
   * - nueva cantidad > 0 → update de `cantidad`.
   * - nueva cantidad = 0 → baja (`estado: 'baja'`, `activo: false`).
   */
  async ajustarUnidad(params: {
    unidad: UnidadStock;
    /** Delta con signo: positivo suma, negativo resta. */
    delta: number;
    motivo: string;
    creadoPor: string;
  }): Promise<void> {
    if (!params.motivo.trim()) throw new Error('El motivo del ajuste es obligatorio');
    if (params.delta === 0) throw new Error('El ajuste no puede ser cero');
    const now = Timestamp.now();
    const unidadRef = docRef('unidades', params.unidad.id);
    const movRef = doc(db, 'movimientosStock', crypto.randomUUID());

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(unidadRef);
      if (!snap.exists()) throw new Error(`Unidad ${params.unidad.id} no encontrada`);
      const data = snap.data();
      if (data.estado !== 'disponible' || data.activo === false) {
        throw new Error(`Solo se ajustan unidades disponibles — estado '${data.estado}'`);
      }
      if (data.nroSerie && params.delta > 0) {
        throw new Error('Artículo serializado: las unidades nuevas se cargan con su n° de serie desde "Cargar stock"');
      }
      const qtyActual = data.cantidad ?? 1;
      const nueva = qtyActual + params.delta;
      if (nueva < 0) throw new Error(`El ajuste deja la cantidad en negativo (actual: ${qtyActual})`);
      tx.update(unidadRef, deepCleanForFirestore(nueva === 0
        ? { cantidad: 0, estado: 'baja' as EstadoUnidad, activo: false, ...getUpdateTrace(), updatedAt: now }
        : { cantidad: nueva, ...getUpdateTrace(), updatedAt: now }));
      tx.set(movRef, deepCleanForFirestore({
        tipo: 'ajuste' as TipoMovimiento,
        unidadId: params.unidad.id,
        articuloId: params.unidad.articuloId,
        articuloCodigo: params.unidad.articuloCodigo,
        articuloDescripcion: params.unidad.articuloDescripcion,
        cantidad: params.delta,
        nroSerie: params.unidad.nroSerie ?? null, nroLote: params.unidad.nroLote ?? null,
        origenTipo: params.unidad.ubicacion.tipo as TipoOrigenDestino,
        origenId: params.unidad.ubicacion.referenciaId,
        origenNombre: params.unidad.ubicacion.referenciaNombre,
        destinoTipo: 'ajuste' as TipoOrigenDestino,
        destinoId: '',
        destinoNombre: 'Ajuste de stock',
        remitoId: null, otNumber: null,
        motivo: params.motivo.trim(),
        creadoPor: params.creadoPor,
        ...getCreateTrace(),
        createdAt: now,
      }));
    });

    logAudit({ action: 'update', collection: 'unidades_stock', documentId: params.unidad.id });
  },

  /**
   * Confirmación de un remito manual (fix I4): aplica el efecto REAL de stock
   * de todos los items con unidad propia y pasa el remito a 'confirmado', en
   * UNA sola transacción — si un item no puede aplicarse, no se confirma nada
   * (regla del dueño: nada de papeles que no muevan existencias).
   * - `tipoItem 'entrega'`      → egreso definitivo (estado 'entregado', o decremento si es lote parcial).
   * - `tipoItem 'sale_y_vuelve'` → transferencia a la ubicación 'ingeniero' (split si es parcial);
   *   la unidad sigue 'disponible' y el retorno se asienta al marcar "devuelto".
   * Los items documentales (asignación / ficha del cliente) no se tocan.
   * Devuelve la cantidad de unidades afectadas.
   */
  async aplicarSalidaRemito(params: { remito: Remito; creadoPor: string }): Promise<number> {
    const { remito, creadoPor } = params;
    if (remito.estado !== 'borrador') throw new Error('Solo se puede confirmar un remito en borrador');
    const stockItems = remito.items.filter(esItemStockRemito);
    if (stockItems.length === 0) {
      throw new Error('El remito no tiene items de stock propio — confirmarlo como documental');
    }
    const vistos = new Set<string>();
    for (const it of stockItems) {
      if (vistos.has(it.unidadId!)) {
        throw new Error(`La unidad de ${it.articuloCodigo ?? 'un item'} aparece más de una vez en el remito`);
      }
      vistos.add(it.unidadId!);
    }
    // Ya NO se exige ingeniero para "sale y vuelve" (2026-08-09): la mercadería
    // para en la posición del REMITO, no en la del ingeniero, así que una entrega
    // que lleva un transportista —o que sale sin ingeniero— también puede salir.

    const now = Timestamp.now();
    const otNumber = remito.otNumbers?.length === 1 ? remito.otNumbers[0] : null;
    const ubicRemito = ubicacionDeRemito(remito.id, remito.numero);
    const destinoRemito: PuntoMovimiento = {
      tipo: 'remito', id: ubicRemito.referenciaId, nombre: ubicRemito.referenciaNombre,
    };
    const destinoEntrega: PuntoMovimiento = remito.tipo === 'entrega_cliente'
      ? { tipo: 'cliente', id: remito.clienteId ?? '', nombre: remito.clienteNombre ?? 'Cliente' }
      : { tipo: 'ingeniero', id: remito.ingenieroId, nombre: remito.ingenieroNombre || 'Ingeniero' };

    const unidadesAfectadas = await runTransaction(db, async (tx) => {
      // 1) READS — todos antes de cualquier write (regla de tx Firestore).
      const snaps = new Map<string, DocumentSnapshot<DocumentData>>();
      for (const it of stockItems) {
        snaps.set(it.id, await tx.get(docRef('unidades', it.unidadId!)));
      }

      // 2) Validación integral: si UN item no puede aplicarse, no se confirma nada.
      for (const it of stockItems) {
        const snap = snaps.get(it.id)!;
        const etiqueta = it.articuloCodigo || it.articuloDescripcion || it.unidadId!;
        if (!snap.exists()) throw new Error(`${etiqueta}: la unidad ya no existe en stock`);
        const data = snap.data();
        if (data.activo === false) throw new Error(`${etiqueta}: la unidad está dada de baja`);
        // 'reservado' vale (2026-08-07): entregarle al cliente la pieza que se
        // le reservó es el caso normal, y la reserva se limpia al pasar a
        // 'entregado'. El resto de los estados sigue bloqueado.
        if (data.estado !== 'disponible' && data.estado !== 'reservado') {
          throw new Error(`${etiqueta}: la unidad no está disponible (estado '${data.estado}')`);
        }
        const qty = data.cantidad ?? 1;
        if (it.cantidad > qty) {
          throw new Error(`${etiqueta}: el remito pide ${it.cantidad} y la unidad tiene ${qty}`);
        }
      }

      // 3) WRITES: unidad + movimiento por item; el remito (estado + metadata) al final.
      const afectadas: string[] = [];
      const itemsFinales: RemitoItemAplicado[] = remito.items.map(orig => {
        if (!esItemStockRemito(orig)) return orig; // documental: intacto
        const it = orig;
        const snap = snaps.get(it.id)!;
        const data = snap.data()!;
        const qty = data.cantidad ?? 1;
        const origenUbic: UbicacionStock = data.ubicacion ?? UBICACION_FALLBACK;
        const unidadRef = docRef('unidades', it.unidadId!);
        let unidadMovidaId = it.unidadId!;

        if (it.tipoItem === 'entrega') {
          tx.update(unidadRef, deepCleanForFirestore(it.cantidad >= qty
            ? {
                estado: 'entregado' as EstadoUnidad,
                // La reserva se cumplió al entregar: si no se limpia, la unidad
                // queda 'entregado' arrastrando el presupuesto que la reservaba
                // (2026-08-07, al permitir remitir piezas reservadas).
                reservadoParaPresupuestoId: null,
                reservadoParaPresupuestoNumero: null,
                reservadoParaClienteId: null,
                reservadoParaClienteNombre: null,
                ...getUpdateTrace(), updatedAt: now,
              }
            : { cantidad: qty - it.cantidad, ...getUpdateTrace(), updatedAt: now }));
        } else {
          // "Sale y vuelve" → posición provisoria del remito (2026-08-09).
          const nuevaUbic: UbicacionStock = { ...ubicRemito };
          if (it.cantidad < qty) {
            // Split de lote: la porción que sale viaja en un doc nuevo.
            const { id: _id, ...rest } = data as Record<string, unknown>;
            const splitRef = docRef('unidades', crypto.randomUUID());
            tx.update(unidadRef, deepCleanForFirestore({ cantidad: qty - it.cantidad, ...getUpdateTrace(), updatedAt: now }));
            tx.set(splitRef, deepCleanForFirestore({
              ...rest, cantidad: it.cantidad, ubicacion: nuevaUbic,
              ...getCreateTrace(), createdAt: now, updatedAt: now,
            }));
            unidadMovidaId = splitRef.id;
          } else {
            tx.update(unidadRef, deepCleanForFirestore({ ubicacion: nuevaUbic, ...getUpdateTrace(), updatedAt: now }));
          }
        }

        const destino = it.tipoItem === 'entrega' ? destinoEntrega : destinoRemito;
        tx.set(doc(db, 'movimientosStock', crypto.randomUUID()), deepCleanForFirestore({
          tipo: (it.tipoItem === 'entrega' ? 'egreso' : 'transferencia') as TipoMovimiento,
          unidadId: unidadMovidaId,
          articuloId: data.articuloId ?? it.articuloId ?? '',
          articuloCodigo: data.articuloCodigo ?? it.articuloCodigo ?? '',
          articuloDescripcion: data.articuloDescripcion ?? it.articuloDescripcion ?? '',
          cantidad: it.cantidad,
          nroSerie: data.nroSerie ?? null, nroLote: data.nroLote ?? null,
          origenTipo: origenUbic.tipo as TipoOrigenDestino,
          origenId: origenUbic.referenciaId,
          origenNombre: origenUbic.referenciaNombre,
          destinoTipo: destino.tipo, destinoId: destino.id, destinoNombre: destino.nombre,
          remitoId: remito.id,
          otNumber,
          motivo: it.tipoItem === 'entrega'
            ? `Remito ${remito.numero} — entrega`
            : `Remito ${remito.numero} — salida transitoria (sale y vuelve)`,
          creadoPor,
          ...getCreateTrace(),
          createdAt: now,
        }));

        afectadas.push(it.unidadId!);
        return {
          ...it,
          stockAplicado: true,
          salidaUnidadId: unidadMovidaId,
          salidaCantidad: it.cantidad,
          salidaUbicacionOrigen: origenUbic,
        };
      });

      tx.update(docRef('remitos', remito.id), deepCleanForFirestore({
        estado: 'confirmado', items: itemsFinales, ...getUpdateTrace(), updatedAt: now,
      }));
      return afectadas;
    });

    logAudit({ action: 'update', collection: 'remitos', documentId: remito.id });
    for (const uid of unidadesAfectadas) {
      logAudit({ action: 'update', collection: 'unidades_stock', documentId: uid });
    }
    return unidadesAfectadas.length;
  },

  /**
   * DESCARGA de un remito de stock propio (2026-08-04: "la descarga se pueda
   * realizar desde el remito, así no se pierde ninguna parte de la cadena"):
   * resuelve items 'sale_y_vuelve' pendientes en UNA transacción — por item,
   * `consumir` N unidades (movimiento 'consumo' contra la OT) y el resto vuelve
   * a su ubicación de origen (movimiento 'devolucion'). Al final el remito
   * queda 'completado' si no restan items pendientes, o 'completado_parcial'.
   * (Los remitos de ASIGNACIÓN se descargan vía asignacionesService, que además
   * mantiene el comprobante de asignación.)
   */
  async descargarItemsStockRemito(params: {
    remito: Remito;
    /** Por item: cuánto se consume. `devolverResto: false` (cierre de OT) deja el
     *  remanente en poder del ingeniero (el item sigue pendiente si quedó algo);
     *  default true: el resto vuelve a su ubicación de origen y el item se resuelve. */
    resoluciones: { itemId: string; consumir: number; devolverResto?: boolean }[];
    otNumber: string | null;
    creadoPor: string;
  }): Promise<void> {
    const { remito, resoluciones, otNumber, creadoPor } = params;
    if (!['confirmado', 'en_transito', 'completado_parcial'].includes(remito.estado)) {
      throw new Error(`El remito no admite descarga en estado '${remito.estado}'`);
    }
    if (resoluciones.length === 0) return;
    const porItem = new Map(resoluciones.map(r => [r.itemId, r]));
    const aResolver = remito.items.filter(it => porItem.has(it.id));
    for (const it of aResolver) {
      const etiqueta = it.articuloCodigo || it.articuloDescripcion || it.id;
      if (!itemRemitoConEfectoAplicado(it) || it.tipoItem !== 'sale_y_vuelve') {
        throw new Error(`${etiqueta}: este item no tiene efecto de stock aplicado — descargarlo desde su flujo de origen`);
      }
      if (it.devuelto || it.consumido) throw new Error(`${etiqueta}: el item ya está resuelto`);
      if (porItem.get(it.id)!.devolverResto !== false && !it.salidaUbicacionOrigen?.referenciaId) {
        throw new Error(`${etiqueta}: no quedó registrada la ubicación de origen — resolverlo con un movimiento manual`);
      }
    }

    const now = Timestamp.now();
    const nowIso = new Date().toISOString();

    await runTransaction(db, async (tx) => {
      // READS primero (regla de tx Firestore).
      const snaps = new Map<string, DocumentSnapshot<DocumentData>>();
      for (const it of aResolver) {
        const item = it as RemitoItemAplicado;
        snaps.set(it.id, await tx.get(docRef('unidades', item.salidaUnidadId || item.unidadId!)));
      }

      const resueltos = new Map<string, { consumir: number; devolver: number; agotada: boolean }>();
      for (const it of aResolver) {
        const item = it as RemitoItemAplicado;
        const etiqueta = it.articuloCodigo || it.articuloDescripcion || it.id;
        const snap = snaps.get(it.id)!;
        if (!snap.exists()) throw new Error(`${etiqueta}: la unidad ya no existe en stock`);
        const data = snap.data();
        if (data.activo === false) throw new Error(`${etiqueta}: la unidad está dada de baja`);
        // Igual que en la salida: una unidad reservada puede estar en poder del
        // ingeniero y hay que poder descargarla (2026-08-07).
        if (data.estado !== 'disponible' && data.estado !== 'reservado') {
          throw new Error(`${etiqueta}: la unidad no está disponible (estado '${data.estado}')`);
        }
        // La unidad tiene que estar en la posición del remito. Los remitos abiertos
        // ANTES del 2026-08-09 dejaron la unidad en la posición del ingeniero: se
        // aceptan también, así se descargan sin necesidad de migrar nada.
        const enRemito = data.ubicacion?.tipo === 'remito' && data.ubicacion?.referenciaId === remito.id;
        const enIngenieroLegacy = data.ubicacion?.tipo === 'ingeniero'
          && !!remito.ingenieroId && data.ubicacion?.referenciaId === remito.ingenieroId;
        if (!enRemito && !enIngenieroLegacy) {
          throw new Error(`${etiqueta}: la unidad ya no figura en el remito — verificar su ubicación en Stock`);
        }
        const qty = data.cantidad ?? 1;
        const res = porItem.get(it.id)!;
        const consumir = Math.min(Math.max(0, res.consumir), qty);
        // Cierre de OT (devolverResto false): el remanente sigue con el ingeniero.
        const devolver = res.devolverResto === false ? 0 : qty - consumir;
        const unidadId = item.salidaUnidadId || item.unidadId!;
        const unidadRef = docRef('unidades', unidadId);
        const origen = item.salidaUbicacionOrigen!;

        if (consumir >= qty) {
          tx.update(unidadRef, deepCleanForFirestore({
            estado: 'consumido' as EstadoUnidad, ...getUpdateTrace(), updatedAt: now,
          }));
        } else if (devolver > 0) {
          tx.update(unidadRef, deepCleanForFirestore({
            ...(consumir > 0 ? { cantidad: qty - consumir } : {}),
            ubicacion: origen, ...getUpdateTrace(), updatedAt: now,
          }));
        } else if (consumir > 0) {
          // Consumo parcial sin devolución: solo decrementa; queda en el ingeniero.
          tx.update(unidadRef, deepCleanForFirestore({
            cantidad: qty - consumir, ...getUpdateTrace(), updatedAt: now,
          }));
        }

        const movBase = {
          unidadId,
          articuloId: data.articuloId ?? '',
          articuloCodigo: data.articuloCodigo ?? '',
          articuloDescripcion: data.articuloDescripcion ?? '',
          nroSerie: data.nroSerie ?? null,
          nroLote: data.nroLote ?? null,
          // Origen = de dónde sale al descargarse. Para remitos abiertos antes del
          // 2026-08-09 la unidad todavía está en la posición del ingeniero.
          ...(data.ubicacion?.tipo === 'ingeniero'
            ? {
                origenTipo: 'ingeniero' as TipoOrigenDestino,
                origenId: remito.ingenieroId,
                origenNombre: remito.ingenieroNombre || 'Ingeniero',
              }
            : {
                origenTipo: 'remito' as TipoOrigenDestino,
                origenId: remito.id,
                origenNombre: `Remito ${remito.numero}`,
              }),
          remitoId: remito.id,
          creadoPor,
          ...getCreateTrace(),
          createdAt: now,
        };
        if (consumir > 0) {
          tx.set(doc(db, 'movimientosStock', crypto.randomUUID()), deepCleanForFirestore({
            ...movBase,
            tipo: 'consumo' as TipoMovimiento,
            cantidad: consumir,
            destinoTipo: 'consumo_ot' as TipoOrigenDestino,
            destinoId: otNumber ?? '',
            destinoNombre: otNumber ? `OT ${otNumber}` : 'Consumo en campo',
            otNumber: otNumber ?? null,
            motivo: `Remito ${remito.numero} — descarga: consumo`,
          }));
        }
        if (devolver > 0) {
          tx.set(doc(db, 'movimientosStock', crypto.randomUUID()), deepCleanForFirestore({
            ...movBase,
            tipo: 'devolucion' as TipoMovimiento,
            cantidad: devolver,
            destinoTipo: origen.tipo as TipoOrigenDestino,
            destinoId: origen.referenciaId,
            destinoNombre: origen.referenciaNombre,
            otNumber: null,
            motivo: `Remito ${remito.numero} — descarga: devolución a stock`,
          }));
        }
        resueltos.set(it.id, { consumir, devolver, agotada: consumir >= qty });
      }

      const itemsFinales = remito.items.map(it => {
        const res = resueltos.get(it.id);
        if (!res) return it;
        return {
          ...it,
          ...(res.consumir > 0
            ? { cantidadConsumida: (it.cantidadConsumida ?? 0) + res.consumir, fechaConsumo: nowIso }
            : {}),
          // Resuelto por consumo total, o por devolución del resto; con
          // devolverResto=false y consumo parcial el item sigue pendiente.
          ...(res.agotada
            ? { consumido: true }
            : res.devolver > 0 ? { devuelto: true, fechaDevolucion: nowIso } : {}),
        };
      });
      const pendientes = itemsFinales.some(it =>
        itemRemitoConEfectoAplicado(it) && it.tipoItem === 'sale_y_vuelve' && !it.devuelto && !it.consumido);
      tx.update(docRef('remitos', remito.id), deepCleanForFirestore({
        items: itemsFinales,
        estado: pendientes ? 'completado_parcial' : 'completado',
        ...(pendientes ? {} : { fechaDevolucion: nowIso }),
        ...getUpdateTrace(), updatedAt: now,
      }));
    });

    logAudit({ action: 'update', collection: 'remitos', documentId: remito.id });
    for (const it of aResolver) {
      const item = it as RemitoItemAplicado;
      logAudit({ action: 'update', collection: 'unidades_stock', documentId: item.salidaUnidadId || item.unidadId! });
    }
  },

  /**
   * Marca (o des-marca) el retorno físico de un item 'sale_y_vuelve' cuya
   * salida fue aplicada al confirmar el remito: mueve la unidad de vuelta a su
   * ubicación de origen (o la re-saca al ingeniero si se des-marca) y asienta
   * el movimiento, junto con el update del item, en UNA transacción.
   * Para items documentales, actualizar el remito directamente (acá se rechaza).
   */
  async marcarRetornoRemitoItem(params: {
    remito: Remito; itemId: string; devuelto: boolean; creadoPor: string;
  }): Promise<void> {
    const { remito, itemId, devuelto, creadoPor } = params;
    const item = remito.items.find(i => i.id === itemId);
    if (!item) throw new Error('Item no encontrado en el remito');
    if (!itemRemitoConEfectoAplicado(item) || item.tipoItem !== 'sale_y_vuelve') {
      throw new Error('Este item no tiene efecto de stock aplicado — actualizar el remito directamente');
    }
    const origen = item.salidaUbicacionOrigen;
    if (!origen?.referenciaId) {
      throw new Error('No quedó registrada la ubicación de origen de la unidad — registrar el retorno con un movimiento manual de transferencia');
    }
    const unidadId = item.salidaUnidadId || item.unidadId!;
    const now = Timestamp.now();
    const nuevosItems = remito.items.map(i => i.id === itemId
      ? { ...i, devuelto, fechaDevolucion: devuelto ? new Date().toISOString() : null }
      : i);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(docRef('unidades', unidadId));
      if (!snap.exists()) throw new Error('La unidad del item ya no existe en stock');
      const data = snap.data();
      if (data.activo === false) throw new Error('La unidad está dada de baja');
      if (data.estado !== 'disponible') {
        throw new Error(`La unidad no está disponible (estado '${data.estado}') — resolver su estado antes de registrar el retorno`);
      }
      const ubic: UbicacionStock | undefined = data.ubicacion;
      const cantidad = data.cantidad ?? 1;
      const movRef = doc(db, 'movimientosStock', crypto.randomUUID());
      const movBase = {
        unidadId,
        articuloId: data.articuloId ?? '',
        articuloCodigo: data.articuloCodigo ?? '',
        articuloDescripcion: data.articuloDescripcion ?? '',
        cantidad,
        nroSerie: data.nroSerie ?? null,
        nroLote: data.nroLote ?? null,
        remitoId: remito.id,
        otNumber: null,
        creadoPor,
        ...getCreateTrace(),
        createdAt: now,
      };

      if (devuelto) {
        // Posición del remito, o la del ingeniero para remitos abiertos antes del
        // 2026-08-09 (no se migran: se aceptan las dos).
        const enRemito = ubic?.tipo === 'remito' && ubic.referenciaId === remito.id;
        const enIngenieroLegacy = ubic?.tipo === 'ingeniero'
          && !!remito.ingenieroId && ubic.referenciaId === remito.ingenieroId;
        if (!enRemito && !enIngenieroLegacy) {
          throw new Error('La unidad ya no figura en el remito — verificar su ubicación en Stock antes de marcarla devuelta');
        }
        tx.update(docRef('unidades', unidadId), deepCleanForFirestore({
          ubicacion: origen, ...getUpdateTrace(), updatedAt: now,
        }));
        tx.set(movRef, deepCleanForFirestore({
          ...movBase,
          tipo: 'devolucion' as TipoMovimiento,
          ...(enIngenieroLegacy
            ? {
                origenTipo: 'ingeniero' as TipoOrigenDestino,
                origenId: remito.ingenieroId,
                origenNombre: remito.ingenieroNombre || 'Ingeniero',
              }
            : {
                origenTipo: 'remito' as TipoOrigenDestino,
                origenId: remito.id,
                origenNombre: `Remito ${remito.numero}`,
              }),
          destinoTipo: origen.tipo as TipoOrigenDestino,
          destinoId: origen.referenciaId,
          destinoNombre: origen.referenciaNombre,
          motivo: `Remito ${remito.numero} — retorno de "sale y vuelve"`,
        }));
      } else {
        if (ubic?.tipo !== origen.tipo || ubic.referenciaId !== origen.referenciaId) {
          throw new Error('La unidad no está en la ubicación a la que había vuelto — corregir el stock con un movimiento manual');
        }
        // Deshacer la devolución: la unidad vuelve a la posición del REMITO
        // (2026-08-09), no a la del ingeniero.
        tx.update(docRef('unidades', unidadId), deepCleanForFirestore({
          ubicacion: ubicacionDeRemito(remito.id, remito.numero),
          ...getUpdateTrace(), updatedAt: now,
        }));
        tx.set(movRef, deepCleanForFirestore({
          ...movBase,
          tipo: 'transferencia' as TipoMovimiento,
          origenTipo: origen.tipo as TipoOrigenDestino,
          origenId: origen.referenciaId,
          origenNombre: origen.referenciaNombre,
          destinoTipo: 'remito' as TipoOrigenDestino,
          destinoId: remito.id,
          destinoNombre: `Remito ${remito.numero}`,
          motivo: `Remito ${remito.numero} — reversa del retorno`,
        }));
      }

      tx.update(docRef('remitos', remito.id), deepCleanForFirestore({
        items: nuevosItems, ...getUpdateTrace(), updatedAt: now,
      }));
    });

    logAudit({ action: 'update', collection: 'remitos', documentId: remito.id });
    logAudit({ action: 'update', collection: 'unidades_stock', documentId: unidadId });
  },
};
