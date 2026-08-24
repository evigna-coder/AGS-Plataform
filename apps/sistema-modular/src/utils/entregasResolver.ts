/**
 * Phase 16 — Pure-function resolver para el visor de entregas.
 *
 * 3 funciones puras testeables sin Firestore:
 *   - computeSemaforo(diasRestantes, opts) — clasifica el semáforo
 *   - computeEtaFecha(fechaAceptacionIso, etaDiasEstimados) — calcula la fecha ETA
 *   - buildEntregaRows(input) — joins en memoria de la cadena ppto→req→oc→imp
 *
 * Plan 16-01 (Wave 0): STUBS — funciones tiran NotImplemented.
 * Plan 16-03 (Wave 1): impls. Tests turn GREEN.
 */
import type {
  Presupuesto,
  RequerimientoCompra,
  Importacion,
  Disponibilidad,
} from '@ags/shared';
import { cantidadEnUnidadBase, esUnidadDeServicio } from '@ags/shared';

export type Semaforo = 'verde' | 'amarillo' | 'rojo' | 'entregado' | 'sin_eta';

export const SEMAFORO_COLORS: Record<Semaforo, string> = {
  verde:     'text-emerald-600',
  amarillo:  'text-amber-500',
  rojo:      'text-red-600',
  entregado: 'text-slate-400',
  sin_eta:   'text-slate-300',
};

export const SEMAFORO_LABELS: Record<Semaforo, string> = {
  verde:     'En plazo',
  amarillo:  'Próximo',
  rojo:      'Vencido',
  entregado: 'Entregado',
  sin_eta:   'Sin ETA',
};

export interface EntregaRow {
  presupuestoId: string;
  presupuestoNumero: string;
  itemId: string;
  clienteId: string;
  clienteNombre: string;
  establecimientoId: string | null;
  /**
   * N° de parte del ítem (2026-08-13). Sale del `codigoProducto` cargado en el
   * presupuesto y, si está vacío, del código que estampó el requerimiento. Sin
   * esta columna había que abrir el presupuesto para saber qué pieza es.
   */
  codigoProducto: string | null;
  /** FK al artículo de stock, cuando el ítem está vinculado al catálogo. */
  stockArticuloId: string | null;
  /**
   * Stock REAL de hoy (2026-08-13). `disponibilidad` es una decisión congelada
   * al presupuestar —dice "stock" para siempre aunque las unidades se hayan
   * consumido—, así que el visor prometía entregas que no se podían cumplir
   * (caso 5183-2067). Estos dos números se recalculan en cada carga:
   *   - `stockReservado`: unidades reservadas PARA ESTE presupuesto (ya son de
   *     este cliente: es lo que de verdad se puede entregar).
   *   - `stockLibre`: unidades en estante sin dueño, disponibles para cubrir.
   */
  stockReservado: number;
  stockLibre: number;
  descripcion: string;
  /** Cantidad tal como se cotizó (envases si el ítem lleva presentación). */
  cantidad: number;
  /**
   * Unidades BASE que compromete la línea (Fase 3 presentaciones, 2026-08-13).
   * Es contra este número que hay que comparar el stock: cotizar 1 envase de 10
   * compromete 10 unidades del pool.
   */
  cantidadBase: number;
  /** Envase cotizado, para mostrarlo al lado de la cantidad. */
  presentacionCodigo: string | null;
  precioUnitario: number;
  moneda: 'USD' | 'ARS' | 'EUR' | null;
  disponibilidad: Disponibilidad | null;
  /**
   * Default sugerido cuando el item no tiene disponibilidad cargada (UAT 2026-07-15):
   * sin requerimiento vinculado = hubo stock al aceptar → 'stock';
   * con requerimiento = hay que comprar/importar → 'a_importar'.
   * Solo display — se persiste recién cuando el usuario elige explícitamente.
   */
  disponibilidadSugerida: Disponibilidad;
  /** Disponibilidad REAL, calculada de lo que hay hoy. Reemplaza al selector. */
  disponibilidadCalculada: DisponibilidadCalculada;
  /** El presupuesto se cobra por adelantado — no se entrega sin confirmar el pago. */
  pagoAnticipado: boolean;
  etaDiasEstimados: number | null;
  fechaAceptacion: string | null;
  etaFecha: string | null;
  diasRestantes: number | null;
  semaforo: Semaforo;
  otNumeroVinculada: string | null;
  fechaComprometida: string | null;
  entregadoManual: boolean | null;
  requerimientoId: string | null;
  requerimientoNumero: string | null;
  ocId: string | null;
  ocNumero: string | null;
  /** Estado de la OC — 'recibida' habilita agrupar la entrega por OC en el visor. */
  ocEstado: string | null;
  importacionId: string | null;
  importacionNumero: string | null;
  importacionEstado: string | null;
  /** OC del CLIENTE sobre el presupuesto — el papel con el que compró. */
  ocCliente: OCClienteRef | null;
  /** A dónde va este ítem: id de la dirección elegida y su texto al elegirla. */
  direccionEntregaId: string | null;
  direccionEntregaTexto: string | null;
}

/**
 * La orden de compra del cliente, lista para abrir desde la grilla (2026-08-24).
 *
 * No confundir con `ocNumero`, que es la OC que AGS le emite al PROVEEDOR. Esta
 * es la que manda el cliente y es el respaldo de la entrega.
 *
 * `url` puede venir vacía: hay presupuestos con el número de OC cargado a mano
 * y sin archivo adjunto. En ese caso se muestra el número, apagado.
 */
export interface OCClienteRef {
  numero: string;
  url: string | null;
  /** Nombre del archivo, para el título del visor. */
  nombre: string | null;
}

export interface BuildEntregaRowsInput {
  presupuestos: Array<
    Pick<Presupuesto, 'id' | 'numero' | 'clienteId' | 'establecimientoId' | 'estado' | 'items' | 'fechaAceptacion'>
    & {
      condicionPagoId?: string | null;
      ordenesCompraIds?: string[] | null;
      ordenCompraNumero?: string | null;
      adjuntos?: Array<{ id: string; tipo?: string | null; url: string; nombre: string }> | null;
    }
  >;
  requerimientos: RequerimientoCompra[];
  ordenesCompra: Array<{ id: string; numero: string; estado?: string | null; items: Array<{ id: string; requerimientoId?: string | null }> }>;
  importaciones: Array<Pick<Importacion, 'id' | 'numero' | 'estado' | 'items'>>;
  clienteNombreById: Map<string, string>;
  /**
   * Stock de hoy por artículo (2026-08-13). Opcional: sin estos mapas las
   * columnas quedan en 0 y el visor se comporta como antes.
   *   - `stockLibrePorArticulo`: articuloId → unidades en estante sin dueño.
   *   - `stockReservadoPorPptoArticulo`: `${presupuestoId}:${articuloId}` →
   *     unidades ya reservadas para ese presupuesto.
   */
  stockLibrePorArticulo?: Map<string, number>;
  stockReservadoPorPptoArticulo?: Map<string, number>;
  /**
   * Ids de las condiciones de pago ANTICIPADAS (2026-08-24).
   *
   * Se pasan resueltas desde el catálogo en vez de hardcodear un id: la
   * condición "Anticipado" es un registro que alguien puede renombrar o
   * duplicar, y el visor no tiene por qué saber cuál es.
   */
  condicionesAnticipadas?: Set<string>;
  /**
   * OCs del cliente por id (colección `ordenesCompraCliente`), para resolver el
   * archivo adjunto sin una lectura por fila.
   */
  ocClienteById?: Map<string, { numero: string; adjuntos?: Array<{ url: string; nombre: string }> }>;
  /** Inyectable para tests; default = new Date() */
  now?: Date;
}

/**
 * Disponibilidad REAL del ítem, calculada de lo que hay hoy (2026-08-24).
 *
 * Reemplaza al selector manual. La disponibilidad se derivaba una sola vez —al
 * aceptar el presupuesto— y quedaba congelada: "A importar" seguía diciendo lo
 * mismo con el embarque ya en aduana, y el override existía para tapar eso a
 * mano. Con los estados de importación y el stock de hoy en la fila, el dato se
 * puede calcular en vivo y no hay nada que elegir.
 *
 * Gana lo más específico: una importación en curso dice DÓNDE está la
 * mercadería, que es más que "a importar".
 */
export type ClaveDisponibilidad =
  | 'en_stock' | 'reservado' | 'importacion' | 'a_importar' | 'sin_stock';

export interface DisponibilidadCalculada {
  clave: ClaveDisponibilidad;
  label: string;
  /** Para colorear: verde = disponible, ámbar = en camino, gris = nada aún. */
  tono: 'ok' | 'camino' | 'nada';
}

const IMPORTACION_EN_CURSO: Record<string, string> = {
  preparacion: 'En preparación',
  // Hay compra en marcha pero la mercadería no salió: la fecha es estimada.
  en_origen: 'En origen',
  embarcado: 'Embarcada',
  en_transito: 'En tránsito',
  en_aduana: 'En aduana',
  despachado: 'Oficializada',
};

export function calcularDisponibilidad(datos: {
  importacionEstado?: string | null;
  stockLibre?: number;
  stockReservado?: number;
  cantidadBase?: number;
  requerimientoId?: string | null;
}): DisponibilidadCalculada {
  const necesita = datos.cantidadBase && datos.cantidadBase > 0 ? datos.cantidadBase : 1;

  // 1. Importación en curso: su estado es el dato más preciso que tenemos.
  const enCurso = datos.importacionEstado ? IMPORTACION_EN_CURSO[datos.importacionEstado] : null;
  if (enCurso) return { clave: 'importacion', label: enCurso, tono: 'camino' };

  // 2. Reservado para ESTE presupuesto: está y tiene dueño.
  if ((datos.stockReservado ?? 0) >= necesita) {
    return { clave: 'reservado', label: 'Reservado', tono: 'ok' };
  }

  // 3. Stock libre suficiente. Una importación 'recibido' cae acá: la
  //    mercadería entró y ahora se mide contra el estante, no contra el embarque.
  if ((datos.stockLibre ?? 0) >= necesita) {
    return { clave: 'en_stock', label: 'En stock', tono: 'ok' };
  }

  // 4. Hay una compra en marcha pero todavía no embarcó.
  if (datos.requerimientoId) return { clave: 'a_importar', label: 'A importar', tono: 'camino' };

  // 5. Ni stock ni compra: es el caso que hay que mirar.
  return { clave: 'sin_stock', label: 'Sin stock', tono: 'nada' };
}

/**
 * La OC del cliente de un presupuesto (2026-08-24).
 *
 * Hay DOS formas de cargarla y las dos son legítimas —la colección
 * `ordenesCompraCliente` (FLOW-02) y un adjunto del propio presupuesto con
 * `tipo: 'orden_compra'`— así que se miran las dos: leyendo una sola, la mitad
 * de los presupuestos dice "sin OC" con el papel adjunto ahí mismo. Mismo
 * criterio que la tarjeta de documentos de facturación.
 *
 * Último recurso: el número suelto en `ordenCompraNumero`, sin archivo. Es un
 * dato real (alguien lo tipeó) y ocultarlo sería peor que mostrarlo apagado.
 */
export function resolverOCCliente(
  ppto: {
    ordenesCompraIds?: string[] | null;
    ordenCompraNumero?: string | null;
    adjuntos?: Array<{ id: string; tipo?: string | null; url: string; nombre: string }> | null;
  },
  ocClienteById?: Map<string, { numero: string; adjuntos?: Array<{ url: string; nombre: string }> }>,
): OCClienteRef | null {
  for (const id of ppto.ordenesCompraIds ?? []) {
    const oc = ocClienteById?.get(id);
    if (!oc) continue;
    const adj = oc.adjuntos?.[0] ?? null;
    return { numero: oc.numero, url: adj?.url ?? null, nombre: adj?.nombre ?? null };
  }

  const adjunto = (ppto.adjuntos ?? []).find(a => a.tipo === 'orden_compra');
  if (adjunto) {
    return {
      numero: (ppto.ordenCompraNumero ?? '').trim() || adjunto.nombre,
      url: adjunto.url,
      nombre: adjunto.nombre,
    };
  }

  const suelto = (ppto.ordenCompraNumero ?? '').trim();
  return suelto ? { numero: suelto, url: null, nombre: null } : null;
}

/**
 * Clasifica el semáforo de entrega según días restantes.
 * Override: opts.entregado=true → 'entregado' (ganador absoluto).
 */
export function computeSemaforo(
  diasRestantes: number | null,
  opts?: { entregado?: boolean },
): Semaforo {
  if (opts?.entregado) return 'entregado';
  if (diasRestantes === null) return 'sin_eta';
  if (diasRestantes > 5) return 'verde';
  if (diasRestantes >= 0) return 'amarillo';
  return 'rojo';
}

/**
 * Calcula la fecha ETA como UTC midnight de fechaAceptacion + etaDiasEstimados días.
 * Suma días en UTC para evitar drift por DST/timezone (Pitfall 5 del RESEARCH).
 */
export function computeEtaFecha(
  fechaAceptacionIso: string | null,
  etaDiasEstimados: number | null,
): string | null {
  if (!fechaAceptacionIso || etaDiasEstimados == null) return null;
  const base = new Date(fechaAceptacionIso);
  if (isNaN(base.getTime())) return null;
  const eta = new Date(Date.UTC(
    base.getUTCFullYear(),
    base.getUTCMonth(),
    base.getUTCDate() + etaDiasEstimados,
  ));
  return eta.toISOString();
}

/** Diferencia en días completos (UTC) entre una fecha ISO y "now". */
function diasEntre(etaIso: string, now: Date): number {
  const eta = new Date(etaIso);
  const etaUtc = Date.UTC(eta.getUTCFullYear(), eta.getUTCMonth(), eta.getUTCDate());
  const nowUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((etaUtc - nowUtc) / 86400000);
}

/**
 * Produce una EntregaRow por item de cada presupuesto, realizando joins en memoria:
 *   presupuestoItem ↔ requerimiento via `req.presupuestoItemId` (O(1), Plan 16-02)
 *   requerimiento ↔ ocItem via `ocItem.requerimientoId`
 *   requerimiento ↔ itemImportacion via `itemImp.requerimientoId`
 * Legacy: reqs con presupuestoItemId=null no se unen (sin_eta + no req chain).
 */
export function buildEntregaRows(input: BuildEntregaRowsInput): EntregaRow[] {
  const now = input.now ?? new Date();

  // 1) Indexar requerimientos por presupuestoItemId.
  const reqByItemId = new Map<string, RequerimientoCompra>();
  // Fallback para reqs creados sin presupuestoItemId (auto-generados pre-fix
  // 2026-07-16): matchear por (presupuestoId, articuloId). Si un ppto tiene dos
  // items del mismo artículo el match es ambiguo — se usa solo si falla el directo.
  const reqByPptoArticulo = new Map<string, RequerimientoCompra>();
  for (const req of input.requerimientos) {
    if (req.presupuestoItemId) {
      reqByItemId.set(req.presupuestoItemId, req);
    } else if (req.presupuestoId && req.articuloId) {
      reqByPptoArticulo.set(`${req.presupuestoId}:${req.articuloId}`, req);
    }
  }

  // 2) Indexar ocItem.requerimientoId → { ocId, ocNumero, ocEstado }.
  const ocByReqId = new Map<string, { ocId: string; ocNumero: string; ocEstado: string | null }>();
  for (const oc of input.ordenesCompra) {
    for (const ocItem of oc.items) {
      if (ocItem.requerimientoId) {
        ocByReqId.set(ocItem.requerimientoId, { ocId: oc.id, ocNumero: oc.numero, ocEstado: oc.estado ?? null });
      }
    }
  }

  // 3) Indexar itemImportacion.requerimientoId → resumen importación.
  type ImpResumen = { impId: string; impNumero: string; impEstado: string; entregado: boolean };
  const impByReqId = new Map<string, ImpResumen>();
  for (const imp of input.importaciones) {
    for (const itemImp of (imp.items ?? [])) {
      if (!itemImp.requerimientoId) continue;
      const entregado =
        imp.estado === 'recibido' ||
        ((itemImp.cantidadRecibida ?? 0) >= itemImp.cantidadPedida);
      impByReqId.set(itemImp.requerimientoId, {
        impId: imp.id,
        impNumero: imp.numero,
        impEstado: imp.estado as string,
        entregado,
      });
    }
  }

  // 4) Construir filas — una por item de presupuesto.
  const rows: EntregaRow[] = [];
  for (const ppto of input.presupuestos) {

    /**
     * Sin aceptación no hay nada que entregar (2026-08-24).
     *
     * La obligación de entrega nace cuando el cliente acepta. Un presupuesto
     * que llegó a 'finalizado' sin haber pasado nunca por aceptado —dato
     * anterior al arranque del módulo, o cerrado a mano— mostraba sus ítems
     * como pendientes de entrega y nadie entendía de dónde salían.
     */
    if (!ppto.fechaAceptacion) continue;
    const clienteNombre = input.clienteNombreById.get(ppto.clienteId) ?? '—';
    const ocCliente = resolverOCCliente(ppto, input.ocClienteById);
    for (const item of (ppto.items ?? [])) {
      const stockArticuloId = (item as { stockArticuloId?: string | null }).stockArticuloId ?? null;
      const req = (item.id ? reqByItemId.get(item.id) : null)
        ?? (stockArticuloId ? reqByPptoArticulo.get(`${ppto.id}:${stockArticuloId}`) ?? null : null);

      // Entregas = cumplimiento de PARTES físicas (pedido 2026-07-30): los
      // servicios (items de contratos P5, conceptos de servicio) se coordinan
      // en la AGENDA, no acá.
      //
      // El criterio era "tiene artículo de stock o requerimiento", y eso
      // ESCONDÍA partes reales (2026-08-13, caso P1-005035-01: el presupuesto
      // tiene 2 artículos y el visor mostraba 1). Una parte tipeada a mano con
      // su número de parte, sin vincular al catálogo y sin requerimiento —
      // porque había stock—, es igual de física y hay que entregarla.
      //
      // Ahora se EXCLUYE lo que es servicio de forma explícita, en vez de
      // incluir solo lo que está vinculado al catálogo.
      // La UNIDAD de la línea también dice que es un servicio (2026-08-20).
      //
      // Los ítems de contrato traen el código de servicio en `codigoProducto`
      // —"MP3_SN_12B", "AT1_BAS_11A", "CAP_L1", "ST_01"— y `servicioCode` vacío,
      // así que pasaban el filtro y "Mantenimiento preventivo" o "Capacitación"
      // figuraban como partes a entregar. 21 lineas en produccion.
      //
      // Se discrimina por `unidad` y no por tipo de presupuesto: es lo que la
      // línea declara ser, sirve igual si algún día un contrato cotiza una parte
      // real, y no toca ninguno de los ítems físicos legítimos.
      const esServicio = !!item.conceptoServicioId
        || !!item.servicioCode
        || esUnidadDeServicio(item.unidad);
      const codigoProducto = (item.codigoProducto ?? '').trim() || null;
      if (esServicio) continue;
      if (!stockArticuloId && !req && !codigoProducto) continue;

      const oc = req ? ocByReqId.get(req.id) ?? null : null;
      const imp = req ? impByReqId.get(req.id) ?? null : null;

      // La fecha comprometida manual tiene prioridad sobre el cálculo fechaAceptacion + días.
      const etaFecha = item.fechaComprometida ?? computeEtaFecha(
        ppto.fechaAceptacion ?? null,
        item.etaDiasEstimados ?? null,
      );
      const diasRestantes = etaFecha ? diasEntre(etaFecha, now) : null;
      const entregado = item.entregadoManual === true || imp?.entregado === true;
      const semaforo = computeSemaforo(diasRestantes, { entregado });

      rows.push({
        presupuestoId: ppto.id,
        presupuestoNumero: ppto.numero,
        itemId: item.id ?? `${ppto.id}::${rows.length}`,
        clienteId: ppto.clienteId,
        clienteNombre,
        establecimientoId: ppto.establecimientoId ?? null,
        codigoProducto: codigoProducto ?? req?.articuloCodigo ?? null,
        stockArticuloId,
        stockReservado: stockArticuloId
          ? (input.stockReservadoPorPptoArticulo?.get(`${ppto.id}:${stockArticuloId}`) ?? 0)
          : 0,
        stockLibre: stockArticuloId
          ? (input.stockLibrePorArticulo?.get(stockArticuloId) ?? 0)
          : 0,
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        cantidadBase: cantidadEnUnidadBase(item.cantidad, item.presentacion),
        presentacionCodigo: item.presentacion?.codigoParte ?? null,
        precioUnitario: item.precioUnitario,
        moneda: (item.moneda ?? null) as EntregaRow['moneda'],
        disponibilidad: (item.disponibilidad ?? null) as EntregaRow['disponibilidad'],
        disponibilidadSugerida: req ? 'a_importar' : 'stock',
        disponibilidadCalculada: calcularDisponibilidad({
          importacionEstado: imp?.impEstado ?? null,
          stockLibre: stockArticuloId ? (input.stockLibrePorArticulo?.get(stockArticuloId) ?? 0) : 0,
          stockReservado: stockArticuloId
            ? (input.stockReservadoPorPptoArticulo?.get(`${ppto.id}:${stockArticuloId}`) ?? 0)
            : 0,
          cantidadBase: cantidadEnUnidadBase(item.cantidad, item.presentacion),
          requerimientoId: req?.id ?? null,
        }),
        // El presupuesto se cobra por adelantado: la mercadería no sale hasta
        // que paguen, aunque esté en el estante (2026-08-24).
        pagoAnticipado: !!ppto.condicionPagoId
          && (input.condicionesAnticipadas?.has(ppto.condicionPagoId) ?? false),
        etaDiasEstimados: item.etaDiasEstimados ?? null,
        fechaAceptacion: ppto.fechaAceptacion ?? null,
        etaFecha,
        diasRestantes,
        semaforo,
        otNumeroVinculada: item.otNumeroVinculada ?? null,
        fechaComprometida: item.fechaComprometida ?? null,
        entregadoManual: item.entregadoManual ?? null,
        requerimientoId: req?.id ?? null,
        requerimientoNumero: req?.numero ?? null,
        ocId: oc?.ocId ?? null,
        ocNumero: oc?.ocNumero ?? null,
        ocEstado: oc?.ocEstado ?? null,
        importacionId: imp?.impId ?? null,
        importacionNumero: imp?.impNumero ?? null,
        importacionEstado: imp?.impEstado ?? null,
        ocCliente,
        direccionEntregaId: item.direccionEntregaId ?? null,
        direccionEntregaTexto: item.direccionEntregaTexto ?? null,
      });
    }
  }
  return rows;
}
