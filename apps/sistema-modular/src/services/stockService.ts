import { collection, getDocs, doc, getDoc, query, where, orderBy, Timestamp, arrayUnion } from 'firebase/firestore';
import { runTransaction } from './firebase';
import type { PosicionStock, Articulo, UnidadStock, Minikit, MovimientoStock, Remito, RemitoItem, EstadoUnidad, TipoMovimiento, TipoOrigenDestino, HistorialFicha, ItemFicha, FichaPropiedad, DerivacionProveedor, StockSelection, PatronLote, Presentacion, UbicacionStock, SalidaAProveedor, CondicionUnidad, EstadoRemito } from '@ags/shared';
import { computeFichaEstado } from '@ags/shared';
import { db, createBatch, docRef, batchAudit, cleanFirestoreData, deepCleanForFirestore, getCreateTrace, getUpdateTrace, logAudit, logBusinessEvent, onSnapshot } from './firebase';
import { getCached, setCache, invalidateCache } from './serviceCache';

// ========== POSICIONES DE STOCK ==========

export const posicionesStockService = {
  async getAll(activoOnly: boolean = true): Promise<PosicionStock[]> {
    // Cache (TTL 2 min): catálogo casi estático, alto reuso en selects; invalidateCache en las mutaciones.
    const cacheKey = `posicionesStock:${activoOnly}`;
    const cached = getCached<PosicionStock[]>(cacheKey);
    if (cached) return cached;

    let q;
    if (activoOnly) {
      q = query(collection(db, 'posicionesStock'), where('activo', '==', true));
    } else {
      q = query(collection(db, 'posicionesStock'));
    }
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    })) as PosicionStock[];
    items.sort((a, b) => a.codigo.localeCompare(b.codigo));
    setCache(cacheKey, items);
    return items;
  },

  async getById(id: string): Promise<PosicionStock | null> {
    const snap = await getDoc(doc(db, 'posicionesStock', id));
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...snap.data(),
      createdAt: snap.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: snap.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    } as PosicionStock;
  },

  async create(data: Omit<PosicionStock, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const payload = cleanFirestoreData({
      ...data,
      ...getCreateTrace(),
      activo: data.activo !== undefined ? data.activo : true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.set(doc(db, 'posicionesStock', id), payload);
    batchAudit(batch, { action: 'create', collection: 'posiciones_stock', documentId: id, after: payload });
    await batch.commit();
    invalidateCache('posicionesStock');
    return id;
  },

  async update(id: string, data: Partial<Omit<PosicionStock, 'id' | 'createdAt'>>): Promise<void> {
    const payload = cleanFirestoreData({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.update(docRef('posicionesStock', id), payload);
    batchAudit(batch, { action: 'update', collection: 'posiciones_stock', documentId: id, after: payload });
    await batch.commit();
    invalidateCache('posicionesStock');
  },

  async getByParent(parentId: string | null): Promise<PosicionStock[]> {
    let q;
    if (parentId) {
      q = query(collection(db, 'posicionesStock'), where('parentId', '==', parentId), where('activo', '==', true));
    } else {
      q = query(collection(db, 'posicionesStock'), where('activo', '==', true));
      const snap = await getDocs(q);
      const items = snap.docs
        .filter(d => !d.data().parentId)
        .map(d => ({
          id: d.id,
          ...d.data(),
          createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
          updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
        })) as PosicionStock[];
      items.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.codigo.localeCompare(b.codigo));
      return items;
    }
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    })) as PosicionStock[];
    items.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.codigo.localeCompare(b.codigo));
    return items;
  },

  async delete(id: string): Promise<void> {
    const batch = createBatch();
    batch.delete(docRef('posicionesStock', id));
    batchAudit(batch, { action: 'delete', collection: 'posiciones_stock', documentId: id });
    await batch.commit();
    invalidateCache('posicionesStock');
  },

  subscribe(
    activoOnly: boolean,
    callback: (items: PosicionStock[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    let q;
    if (activoOnly) {
      q = query(collection(db, 'posicionesStock'), where('activo', '==', true));
    } else {
      q = query(collection(db, 'posicionesStock'));
    }
    return onSnapshot(q, snap => {
      const items = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
        updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      })) as PosicionStock[];
      items.sort((a, b) => a.codigo.localeCompare(b.codigo));
      callback(items);
    }, err => {
      console.error('posicionesStock subscribe error:', err);
      onError?.(err);
    });
  },
};

/**
 * Returns the "RESERVAS" PosicionStock document, creating it if it doesn't exist.
 * The Reservas position has a well-known code 'RESERVAS' so it can be found reliably.
 */
export async function getOrCreateReservasPosition(): Promise<PosicionStock> {
  const all = await posicionesStockService.getAll(false); // include inactive
  const existing = all.find(p => p.codigo === 'RESERVAS');
  if (existing) return existing;
  // Create it if missing — safe to run multiple times (idempotent by code lookup)
  const id = await posicionesStockService.create({
    codigo: 'RESERVAS',
    nombre: 'Reservas',
    descripcion: 'Posición de reserva para unidades asignadas a presupuestos',
    tipo: 'deposito',
    parentId: null,
    activo: true,
  });
  const created = await posicionesStockService.getById(id);
  if (!created) throw new Error('Failed to create Reservas position');
  return created;
}

// ========== ARTICULOS (catalogo de partes) ==========

export const articulosService = {
  async getAll(filters?: {
    categoriaEquipo?: string;
    marcaId?: string;
    tipo?: string;
    activoOnly?: boolean;
  }): Promise<Articulo[]> {
    // Cache (TTL 2 min): el catálogo de artículos (~2200) alimenta selects en
    // muchos modales; sin cache cada apertura re-leía la colección entera y se
    // sentía el "tarda en cargar". La key incluye los filtros; invalidateCache
    // ('articulos') en create/update/delete borra todas las variantes. Las
    // listas en vivo usan subscribe() y no tocan esta cache.
    const cacheKey = `articulos:${filters?.activoOnly !== false}:${filters?.categoriaEquipo ?? ''}:${filters?.marcaId ?? ''}:${filters?.tipo ?? ''}`;
    const cached = getCached<Articulo[]>(cacheKey);
    if (cached) return cached;

    let q = query(collection(db, 'articulos'));
    if (filters?.activoOnly !== false) {
      q = query(q, where('activo', '==', true));
    }
    if (filters?.categoriaEquipo) {
      q = query(q, where('categoriaEquipo', '==', filters.categoriaEquipo));
    }
    if (filters?.marcaId) {
      q = query(q, where('marcaId', '==', filters.marcaId));
    }
    if (filters?.tipo) {
      q = query(q, where('tipo', '==', filters.tipo));
    }
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    })) as Articulo[];
    items.sort((a, b) => a.codigo.localeCompare(b.codigo));
    setCache(cacheKey, items);
    return items;
  },

  async getById(id: string): Promise<Articulo | null> {
    const snap = await getDoc(doc(db, 'articulos', id));
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...snap.data(),
      createdAt: snap.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: snap.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    } as Articulo;
  },

  async getByCodigo(codigo: string): Promise<Articulo | null> {
    const q = query(collection(db, 'articulos'), where('codigo', '==', codigo));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return {
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    } as Articulo;
  },

  /**
   * Vista inversa de presentaciones: dado un N° de parte, encuentra TODOS los artículos BASE
   * que lo declaran como presentación (y su factor). Un mismo envase puede ser presentación
   * de más de una base (2026-08-25: 5183-2067 lo declaran 5182-0714 y 5182-0715). Usa el
   * índice plano `presentacionCodigos` (array-contains). Ordenado por código de base.
   * Nota: requiere que la base tenga `presentacionCodigos` poblado (se setea al guardar el artículo).
   */
  async findBasesDePresentacion(codigo: string): Promise<{ base: Articulo; presentacion: Presentacion }[]> {
    if (!codigo) return [];
    const q = query(collection(db, 'articulos'), where('presentacionCodigos', 'array-contains', codigo));
    const snap = await getDocs(q);
    const out: { base: Articulo; presentacion: Presentacion }[] = [];
    for (const d of snap.docs) {
      const base = {
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
        updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      } as Articulo;
      const presentacion = (base.presentaciones ?? []).find(p => p.codigoParte === codigo && p.activo !== false);
      if (presentacion) out.push({ base, presentacion });
    }
    return out.sort((a, b) => (a.base.codigo ?? '').localeCompare(b.base.codigo ?? ''));
  },

  /** Primera base que declara el código como presentación. Ver `findBasesDePresentacion`. */
  async findBaseDePresentacion(codigo: string): Promise<{ base: Articulo; presentacion: Presentacion } | null> {
    return (await this.findBasesDePresentacion(codigo))[0] ?? null;
  },

  async create(data: Omit<Articulo, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const payload = deepCleanForFirestore({
      ...data,
      ...getCreateTrace(),
      activo: data.activo !== undefined ? data.activo : true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.set(doc(db, 'articulos', id), payload);
    batchAudit(batch, { action: 'create', collection: 'articulos', documentId: id, after: payload });
    await batch.commit();
    invalidateCache('articulos');
    return id;
  },

  async update(id: string, data: Partial<Omit<Articulo, 'id' | 'createdAt'>>): Promise<void> {
    const payload = deepCleanForFirestore({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.update(docRef('articulos', id), payload);
    batchAudit(batch, { action: 'update', collection: 'articulos', documentId: id, after: payload });
    await batch.commit();
    invalidateCache('articulos');

    // Phase 13 STKE-02 — recompute denormalized equivalencia fields on origenes pointing to this articulo.
    // LAZY DYNAMIC IMPORT: avoids module-load cycle with equivalenciasService.ts (which also imports
    // articulosService via dynamic import for prod-path reads). By the time this function executes at
    // runtime, both modules are fully initialized; the import resolves instantly.
    const codigoChanged = data.codigo !== undefined;
    const descChanged = data.descripcion !== undefined;
    if (codigoChanged || descChanged) {
      void (async () => {
        try {
          const { recomputeEquivalenciaDenormalization } = await import('./equivalenciasService');
          await recomputeEquivalenciaDenormalization(id);
        } catch (err) {
          console.error('[articulosService.update] equivalencia denormalization recompute failed:', err);
        }
      })();
    }
  },

  subscribeById(
    id: string,
    callback: (item: Articulo | null) => void,
    onError?: (err: Error) => void,
  ): () => void {
    return onSnapshot(doc(db, 'articulos', id), snap => {
      if (!snap.exists()) { callback(null); return; }
      callback({
        id: snap.id,
        ...snap.data(),
        createdAt: snap.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
        updatedAt: snap.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      } as Articulo);
    }, err => {
      console.error('articulos subscription error:', err);
      onError?.(err);
    });
  },

  async deactivate(id: string): Promise<void> {
    await this.update(id, { activo: false });
    logBusinessEvent({
      eventName: 'articulo.dado_de_baja',
      collection: 'articulos',
      documentId: id,
    });
  },

  async delete(id: string): Promise<void> {
    const batch = createBatch();
    batch.delete(docRef('articulos', id));
    batchAudit(batch, { action: 'delete', collection: 'articulos', documentId: id });
    await batch.commit();
    invalidateCache('articulos');
  },

  subscribe(
    filters: { categoriaEquipo?: string; marcaId?: string; tipo?: string; activoOnly?: boolean } | undefined,
    callback: (items: Articulo[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    let q = query(collection(db, 'articulos'));
    if (filters?.activoOnly !== false) {
      q = query(q, where('activo', '==', true));
    }
    if (filters?.categoriaEquipo) {
      q = query(q, where('categoriaEquipo', '==', filters.categoriaEquipo));
    }
    if (filters?.marcaId) {
      q = query(q, where('marcaId', '==', filters.marcaId));
    }
    if (filters?.tipo) {
      q = query(q, where('tipo', '==', filters.tipo));
    }
    return onSnapshot(q, snap => {
      const items = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
        updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      })) as Articulo[];
      items.sort((a, b) => a.codigo.localeCompare(b.codigo));
      callback(items);
    }, err => {
      console.error('articulos subscribe error:', err);
      onError?.(err);
    });
  },
};

// ========== UNIDADES DE STOCK ==========

export const unidadesService = {
  async getAll(filters?: {
    articuloId?: string;
    estado?: string;
    condicion?: string;
    activoOnly?: boolean;
  }): Promise<UnidadStock[]> {
    let q = query(collection(db, 'unidades'));
    if (filters?.activoOnly !== false) {
      q = query(q, where('activo', '==', true));
    }
    if (filters?.articuloId) {
      q = query(q, where('articuloId', '==', filters.articuloId));
    }
    if (filters?.estado) {
      q = query(q, where('estado', '==', filters.estado));
    }
    if (filters?.condicion) {
      q = query(q, where('condicion', '==', filters.condicion));
    }
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    })) as UnidadStock[];
    items.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
    return items;
  },

  async getByArticulo(articuloId: string): Promise<UnidadStock[]> {
    return this.getAll({ articuloId, activoOnly: true });
  },

  /** Unidades ingresadas por una importación (por su número IMP-xxxx). */
  async getByImportacion(importacionNumero: string): Promise<UnidadStock[]> {
    const q = query(collection(db, 'unidades'), where('importacionNumero', '==', importacionNumero));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    })) as UnidadStock[];
  },

  /**
   * Confirmar el costeo DEFINITIVO de una importación (2026-08-21).
   *
   * El stock entra apenas llega la mercadería, cuando todavía faltan facturas:
   * el costo y el factor de ese momento son estimados. Cuando llegan las
   * facturas reales se recalcula el costeo y el valor definitivo se estampa acá.
   *
   * Se re-estampa en TODAS las unidades del embarque, incluidas las que ya
   * salieron por remito o se entregaron: el costo real de esa mercadería no
   * depende de dónde esté hoy.
   *
   * El estimado NO se toca — queda como registro de con qué número se trabajó
   * mientras el real no existía, que es lo que explica un precio cotizado en el
   * medio. `costoUnitarioVigente()` decide cuál se usa.
   *
   * `costoPorArticulo` viene del costeo recalculado: articuloId -> costo por
   * unidad base. Las unidades cuyo artículo no esté en el mapa no se tocan.
   */
  async confirmarCosteoImportacion(params: {
    importacionNumero: string;
    factorEmbarque: number;
    costoPorArticulo: Map<string, number>;
  }): Promise<{ actualizadas: number; sinCosto: number }> {
    const unidades = await this.getByImportacion(params.importacionNumero);
    const ahora = new Date().toISOString();
    let actualizadas = 0, sinCosto = 0;

    for (const u of unidades) {
      const costo = params.costoPorArticulo.get(u.articuloId);
      if (costo == null) { sinCosto++; continue; }
      await this.update(u.id, {
        costoUnitarioReal: costo,
        factorImportacionReal: params.factorEmbarque,
        costeoConfirmadoAt: ahora,
      } as Partial<UnidadStock>);
      actualizadas++;
    }

    logBusinessEvent({
      eventName: 'importacion.costeo_confirmado',
      collection: 'unidades',
      documentId: params.importacionNumero,
      details: { factorEmbarque: params.factorEmbarque, actualizadas, sinCosto },
    });
    return { actualizadas, sinCosto };
  },

  /**
   * Re-estampar el costeo ESTIMADO de una importación (2026-08-25).
   *
   * El estimado se congela en las unidades al ingresar la mercadería; si a
   * alguien se le olvidó un gasto (flete, seguro, honorarios) el número queda
   * mal durante el mes o más que tardan las facturas reales. Esto recalcula el
   * estimado con los gastos cargados HOY y lo re-estampa en las unidades del
   * embarque — sigue siendo estimado: NO marca `costeoConfirmadoAt` ni toca los
   * campos `*Real`. Las unidades ya confirmadas se saltean (el real manda).
   *
   * El estimado anterior se pisa (a diferencia del definitivo, que lo conserva):
   * un estimado incompleto no documenta nada útil. El valor viejo queda en el
   * business event para auditoría.
   *
   * También refresca el snapshot `ultimoCosto*` del artículo, pero solo si
   * ninguna importación posterior lo pisó (last-wins: se compara
   * `ultimoCostoFecha` contra el ingreso de estas unidades).
   */
  async reestimarCosteoImportacion(params: {
    importacionNumero: string;
    factorEmbarque: number;
    costoPorArticulo: Map<string, number>;
  }): Promise<{ actualizadas: number; sinCosto: number; confirmadas: number }> {
    const unidades = await this.getByImportacion(params.importacionNumero);
    let actualizadas = 0, sinCosto = 0, confirmadas = 0;
    const factorAnteriorPorArticulo = new Map<string, number | null>();
    let ultimoIngreso = '';

    for (const u of unidades) {
      const costo = params.costoPorArticulo.get(u.articuloId);
      if (costo == null) { sinCosto++; continue; }
      if (u.costeoConfirmadoAt) { confirmadas++; continue; }
      if (!factorAnteriorPorArticulo.has(u.articuloId)) {
        factorAnteriorPorArticulo.set(u.articuloId, u.factorImportacion ?? null);
      }
      if (u.createdAt > ultimoIngreso) ultimoIngreso = u.createdAt;
      await this.update(u.id, {
        costoUnitario: costo,
        factorImportacion: params.factorEmbarque,
      } as Partial<UnidadStock>);
      actualizadas++;
    }

    // Snapshot del catálogo: solo si esta impo sigue siendo la última que costeó
    // el artículo — una posterior ya habría estampado una fecha más nueva.
    const ahora = new Date().toISOString();
    for (const [articuloId, costo] of params.costoPorArticulo) {
      if (!unidades.some(u => u.articuloId === articuloId && !u.costeoConfirmadoAt)) continue;
      try {
        const art = await articulosService.getById(articuloId);
        if (!art) continue;
        if (art.ultimoCostoFecha && ultimoIngreso && art.ultimoCostoFecha > ultimoIngreso) continue;
        await articulosService.update(articuloId, {
          ultimoCostoImportacion: costo,
          ultimoFactorImportacion: params.factorEmbarque,
          ultimoCostoMoneda: 'USD',
          ultimoCostoFecha: ahora,
        });
      } catch (err) {
        console.warn(`[reestimarCosteo] snapshot artículo ${articuloId}:`, err);
      }
    }

    logBusinessEvent({
      eventName: 'importacion.costeo_reestimado',
      collection: 'unidades',
      documentId: params.importacionNumero,
      details: {
        factorEmbarque: params.factorEmbarque,
        factoresAnteriores: Object.fromEntries(factorAnteriorPorArticulo),
        actualizadas, sinCosto, confirmadas,
      },
    });
    return { actualizadas, sinCosto, confirmadas };
  },

  async getByUbicacion(tipo: string, referenciaId: string): Promise<UnidadStock[]> {
    const q = query(
      collection(db, 'unidades'),
      where('ubicacion.tipo', '==', tipo),
      where('ubicacion.referenciaId', '==', referenciaId),
      where('activo', '==', true),
    );
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    })) as UnidadStock[];
    items.sort((a, b) => a.articuloCodigo.localeCompare(b.articuloCodigo));
    return items;
  },

  /** Suscripción en tiempo real a las unidades ubicadas en un minikit
   *  (2026-08-03): el detalle cargaba una vez y las pestañas viven horas —
   *  tras transferir unidades el listado mostraba la foto vieja. */
  subscribeByMinikit(minikitId: string, callback: (unidades: UnidadStock[]) => void): () => void {
    const q = query(
      collection(db, 'unidades'),
      where('ubicacion.tipo', '==', 'minikit'),
      where('ubicacion.referenciaId', '==', minikitId),
      where('activo', '==', true),
    );
    return onSnapshot(q, snap => {
      const items = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
        updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      })) as UnidadStock[];
      items.sort((a, b) => a.articuloCodigo.localeCompare(b.articuloCodigo));
      callback(items);
    }, err => console.error('[unidadesService.subscribeByMinikit] error:', err));
  },

  async getById(id: string): Promise<UnidadStock | null> {
    const snap = await getDoc(doc(db, 'unidades', id));
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...snap.data(),
      createdAt: snap.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: snap.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    } as UnidadStock;
  },

  async create(data: Omit<UnidadStock, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const payload = deepCleanForFirestore({
      ...data,
      ...getCreateTrace(),
      activo: data.activo !== undefined ? data.activo : true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.set(doc(db, 'unidades', id), payload);
    batchAudit(batch, { action: 'create', collection: 'unidades_stock', documentId: id, after: payload });
    await batch.commit();
    return id;
  },

  /**
   * Crea N unidades en lote. Cada unidad = un documento. Útil para el alta masiva
   * (artículos con serie: una fila por unidad; lotes: una fila por lote+cantidad).
   * Se chunkea cada 200 documentos porque cada unidad consume 2 ops de batch (set + audit)
   * y el límite de Firestore es 500 ops por commit.
   */
  async createMany(items: Omit<UnidadStock, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<string[]> {
    const ids: string[] = [];
    const CHUNK = 200;
    for (let i = 0; i < items.length; i += CHUNK) {
      const slice = items.slice(i, i + CHUNK);
      const batch = createBatch();
      const trace = getCreateTrace();
      for (const data of slice) {
        const id = crypto.randomUUID();
        const payload = deepCleanForFirestore({
          ...data,
          ...trace,
          activo: data.activo !== undefined ? data.activo : true,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        batch.set(doc(db, 'unidades', id), payload);
        batchAudit(batch, { action: 'create', collection: 'unidades_stock', documentId: id, after: payload });
        ids.push(id);
      }
      await batch.commit();
    }
    return ids;
  },

  async update(id: string, data: Partial<Omit<UnidadStock, 'id' | 'createdAt'>>): Promise<void> {
    const payload = deepCleanForFirestore({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.update(docRef('unidades', id), payload);
    batchAudit(batch, { action: 'update', collection: 'unidades_stock', documentId: id, after: payload });
    await batch.commit();
  },

  async delete(id: string): Promise<void> {
    const batch = createBatch();
    batch.delete(docRef('unidades', id));
    batchAudit(batch, { action: 'delete', collection: 'unidades_stock', documentId: id });
    await batch.commit();
  },

  subscribe(
    filters: { articuloId?: string; estado?: string; condicion?: string; activoOnly?: boolean } | undefined,
    callback: (items: UnidadStock[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    let q = query(collection(db, 'unidades'));
    if (filters?.activoOnly !== false) {
      q = query(q, where('activo', '==', true));
    }
    if (filters?.articuloId) {
      q = query(q, where('articuloId', '==', filters.articuloId));
    }
    if (filters?.estado) {
      q = query(q, where('estado', '==', filters.estado));
    }
    if (filters?.condicion) {
      q = query(q, where('condicion', '==', filters.condicion));
    }
    return onSnapshot(q, snap => {
      const items = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
        updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      })) as UnidadStock[];
      items.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      callback(items);
    }, err => {
      console.error('unidades subscribe error:', err);
      onError?.(err);
    });
  },
};

// ========== MINIKITS ==========

export const minikitsService = {
  async getAll(activoOnly: boolean = true): Promise<Minikit[]> {
    let q;
    if (activoOnly) {
      q = query(collection(db, 'minikits'), where('activo', '==', true));
    } else {
      q = query(collection(db, 'minikits'));
    }
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    })) as Minikit[];
    items.sort((a, b) => a.codigo.localeCompare(b.codigo));
    return items;
  },

  async getById(id: string): Promise<Minikit | null> {
    const snap = await getDoc(doc(db, 'minikits', id));
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...snap.data(),
      createdAt: snap.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: snap.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    } as Minikit;
  },

  async create(data: Omit<Minikit, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const payload = deepCleanForFirestore({
      ...data,
      ...getCreateTrace(),
      activo: data.activo !== undefined ? data.activo : true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.set(doc(db, 'minikits', id), payload);
    batchAudit(batch, { action: 'create', collection: 'minikits', documentId: id, after: payload });
    await batch.commit();
    return id;
  },

  async update(id: string, data: Partial<Omit<Minikit, 'id' | 'createdAt'>>): Promise<void> {
    const payload = deepCleanForFirestore({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.update(docRef('minikits', id), payload);
    batchAudit(batch, { action: 'update', collection: 'minikits', documentId: id, after: payload });
    await batch.commit();
  },

  subscribeById(
    id: string,
    callback: (item: Minikit | null) => void,
    onError?: (err: Error) => void,
  ): () => void {
    return onSnapshot(doc(db, 'minikits', id), snap => {
      if (!snap.exists()) { callback(null); return; }
      callback({
        id: snap.id,
        ...snap.data(),
        createdAt: snap.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
        updatedAt: snap.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      } as Minikit);
    }, err => {
      console.error('minikits subscription error:', err);
      onError?.(err);
    });
  },

  async delete(id: string): Promise<void> {
    const batch = createBatch();
    batch.delete(docRef('minikits', id));
    batchAudit(batch, { action: 'delete', collection: 'minikits', documentId: id });
    await batch.commit();
  },

  subscribe(
    activoOnly: boolean,
    callback: (items: Minikit[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    let q;
    if (activoOnly) {
      q = query(collection(db, 'minikits'), where('activo', '==', true));
    } else {
      q = query(collection(db, 'minikits'));
    }
    return onSnapshot(q, snap => {
      const items = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
        updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      })) as Minikit[];
      items.sort((a, b) => a.codigo.localeCompare(b.codigo));
      callback(items);
    }, err => {
      console.error('minikits subscribe error:', err);
      onError?.(err);
    });
  },
};

// ========== MOVIMIENTOS DE STOCK (log inmutable) ==========

export const movimientosService = {
  async getAll(filters?: {
    articuloId?: string;
    unidadId?: string;
    tipo?: string;
    remitoId?: string;
    otNumber?: string;
    limitCount?: number;
  }): Promise<MovimientoStock[]> {
    let q = query(collection(db, 'movimientosStock'));
    if (filters?.articuloId) {
      q = query(q, where('articuloId', '==', filters.articuloId));
    }
    if (filters?.unidadId) {
      q = query(q, where('unidadId', '==', filters.unidadId));
    }
    if (filters?.tipo) {
      q = query(q, where('tipo', '==', filters.tipo));
    }
    if (filters?.remitoId) {
      q = query(q, where('remitoId', '==', filters.remitoId));
    }
    if (filters?.otNumber) {
      q = query(q, where('otNumber', '==', filters.otNumber));
    }
    const snap = await getDocs(q);
    let items = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    })) as MovimientoStock[];
    items.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
    if (filters?.limitCount && filters.limitCount > 0) {
      items = items.slice(0, filters.limitCount);
    }
    return items;
  },

  async getByUnidad(unidadId: string): Promise<MovimientoStock[]> {
    return this.getAll({ unidadId });
  },

  async create(data: Omit<MovimientoStock, 'id' | 'createdAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const payload = deepCleanForFirestore({
      ...data,
      ...getCreateTrace(),
      createdAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.set(doc(db, 'movimientosStock', id), payload);
    batchAudit(batch, { action: 'create', collection: 'movimientos_stock', documentId: id, after: payload });
    await batch.commit();

    // Resolver código del artículo para que la auditoría muestre algo legible
    // ("artículo 5188-5367") en lugar del ID interno. Best-effort: si la lectura
    // falla cae al ID.
    let articuloCodigo: string | null = null;
    const articuloId = (data as any).articuloId ?? null;
    if (articuloId) {
      try {
        const snap = await getDoc(doc(db, 'articulos', articuloId));
        if (snap.exists()) articuloCodigo = (snap.data().codigoArticulo ?? snap.data().codigo) ?? null;
      } catch {
        // best-effort
      }
    }
    const tipo = (data as any).tipo ?? null;
    const cantidad = (data as any).cantidad ?? null;
    logBusinessEvent({
      eventName: 'stock.movimiento_creado',
      collection: 'movimientos_stock',
      documentId: id,
      entityLabel: articuloCodigo ? `Mov. ${tipo ?? ''} — ${articuloCodigo}`.trim() : undefined,
      details: {
        tipo,
        articuloId,
        articuloCodigo,
        cantidad,
        origenTipo: (data as any).origenTipo ?? null,
        destinoTipo: (data as any).destinoTipo ?? null,
      },
    });
    return id;
  },

  subscribe(
    filters: { articuloId?: string; unidadId?: string; tipo?: string; remitoId?: string; otNumber?: string; desde?: Date } | undefined,
    callback: (items: MovimientoStock[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    let q = query(collection(db, 'movimientosStock'));
    if (filters?.articuloId) {
      q = query(q, where('articuloId', '==', filters.articuloId));
    }
    if (filters?.unidadId) {
      q = query(q, where('unidadId', '==', filters.unidadId));
    }
    if (filters?.tipo) {
      q = query(q, where('tipo', '==', filters.tipo));
    }
    if (filters?.remitoId) {
      q = query(q, where('remitoId', '==', filters.remitoId));
    }
    if (filters?.otNumber) {
      q = query(q, where('otNumber', '==', filters.otNumber));
    }
    // Filtro por fecha (default de MovimientosPage = mes actual). El rango `>=` sobre
    // `createdAt` requiere un orderBy sobre el mismo campo. Deliberadamente NO se combina
    // con `where('tipo')` para no necesitar un índice compuesto: el caller que usa `desde`
    // filtra por tipo client-side.
    if (filters?.desde) {
      q = query(q, where('createdAt', '>=', Timestamp.fromDate(filters.desde)), orderBy('createdAt', 'desc'));
    }
    return onSnapshot(q, snap => {
      const items = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      })) as MovimientoStock[];
      items.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      callback(items);
    }, err => {
      console.error('movimientosStock subscribe error:', err);
      onError?.(err);
    });
  },
};

// ========== REMITOS ==========

export const remitosService = {
  /**
   * Sugiere el próximo correlativo en formato `PPPP-NNNNNNNN` (talonario preimpreso)
   * a partir del máximo ya registrado en `remitos`. Read-only — no consume número
   * (la numeración real la define el papel físico). Permite override manual.
   */
  async getProximoNumeroPreimpreso(prefix: string = '0001'): Promise<string> {
    // Piso del talonario real (2026-08-06): arranque de la numeración seria en
    // 0001-00017401 — los números de prueba anteriores no cuentan. Si el papel
    // ya va más adelante, manda el máximo registrado.
    const FLOOR_PREIMPRESO = 17400;
    const snap = await getDocs(collection(db, 'remitos'));
    let max = FLOOR_PREIMPRESO;
    for (const d of snap.docs) {
      const numero = d.data().numero as string | undefined;
      if (!numero) continue;
      const m = numero.match(/^(\d{4})-(\d{8})$/);
      if (!m || m[1] !== prefix) continue;
      const n = parseInt(m[2], 10);
      if (n > max) max = n;
    }
    return `${prefix}-${String(max + 1).padStart(8, '0')}`;
  },

  // Atómico vía counter doc — antes era scan-and-max no transaccional.
  async getNextRemitoNumber(): Promise<string> {
    const counterRef = doc(db, '_counters', 'remitoNumber');
    const next = await runTransaction(db, async (tx) => {
      const counterSnap = await tx.get(counterRef);
      let current: number;
      if (counterSnap.exists()) {
        current = counterSnap.data().value as number;
      } else {
        const snap = await getDocs(collection(db, 'remitos'));
        let maxNum = 0;
        snap.docs.forEach(d => {
          const match = d.data().numero?.match(/REM-(\d+)/);
          if (match) { const n = parseInt(match[1]); if (n > maxNum) maxNum = n; }
        });
        current = maxNum;
      }
      const nextVal = current + 1;
      tx.set(counterRef, { value: nextVal, updatedAt: Timestamp.now() });
      return nextVal;
    });
    return `REM-${String(next).padStart(4, '0')}`;
  },

  async getAll(filters?: {
    ingenieroId?: string;
    estado?: string;
    tipo?: string;
  }): Promise<Remito[]> {
    let q = query(collection(db, 'remitos'));
    if (filters?.ingenieroId) {
      q = query(q, where('ingenieroId', '==', filters.ingenieroId));
    }
    if (filters?.estado) {
      q = query(q, where('estado', '==', filters.estado));
    }
    if (filters?.tipo) {
      q = query(q, where('tipo', '==', filters.tipo));
    }
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      fechaSalida: d.data().fechaSalida?.toDate?.().toISOString() ?? d.data().fechaSalida ?? null,
      fechaDevolucion: d.data().fechaDevolucion?.toDate?.().toISOString() ?? d.data().fechaDevolucion ?? null,
    })) as Remito[];
    items.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
    return items;
  },

  async getById(id: string): Promise<Remito | null> {
    const snap = await getDoc(doc(db, 'remitos', id));
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...snap.data(),
      createdAt: snap.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: snap.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      fechaSalida: snap.data().fechaSalida?.toDate?.().toISOString() ?? snap.data().fechaSalida ?? null,
      fechaDevolucion: snap.data().fechaDevolucion?.toDate?.().toISOString() ?? snap.data().fechaDevolucion ?? null,
    } as Remito;
  },

  async create(data: Omit<Remito, 'id' | 'numero' | 'createdAt' | 'updatedAt'> & { numero?: string }): Promise<string> {
    const id = crypto.randomUUID();
    const numero = data.numero || await this.getNextRemitoNumber();
    const { numero: _num, ...rest } = data;
    const payload = deepCleanForFirestore({
      ...rest,
      ...getCreateTrace(),
      numero,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.set(doc(db, 'remitos', id), payload);
    batchAudit(batch, { action: 'create', collection: 'remitos', documentId: id, after: payload });
    await batch.commit();
    return id;
  },

  async update(id: string, data: Partial<Omit<Remito, 'id' | 'createdAt'>>): Promise<void> {
    const payload = deepCleanForFirestore({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.update(docRef('remitos', id), payload);
    batchAudit(batch, { action: 'update', collection: 'remitos', documentId: id, after: payload });
    await batch.commit();
  },

  subscribeById(
    id: string,
    callback: (item: Remito | null) => void,
    onError?: (err: Error) => void,
  ): () => void {
    return onSnapshot(doc(db, 'remitos', id), snap => {
      if (!snap.exists()) { callback(null); return; }
      callback({
        id: snap.id,
        ...snap.data(),
        createdAt: snap.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
        updatedAt: snap.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
        fechaSalida: snap.data().fechaSalida?.toDate?.().toISOString() ?? snap.data().fechaSalida ?? null,
        fechaDevolucion: snap.data().fechaDevolucion?.toDate?.().toISOString() ?? snap.data().fechaDevolucion ?? null,
      } as Remito);
    }, err => {
      console.error('remitos subscription error:', err);
      onError?.(err);
    });
  },

  async delete(id: string): Promise<void> {
    const batch = createBatch();
    batch.delete(docRef('remitos', id));
    batchAudit(batch, { action: 'delete', collection: 'remitos', documentId: id });
    await batch.commit();
  },

  subscribe(
    filters: { ingenieroId?: string; estado?: string; tipo?: string } | undefined,
    callback: (items: Remito[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    let q = query(collection(db, 'remitos'));
    if (filters?.ingenieroId) {
      q = query(q, where('ingenieroId', '==', filters.ingenieroId));
    }
    if (filters?.estado) {
      q = query(q, where('estado', '==', filters.estado));
    }
    if (filters?.tipo) {
      q = query(q, where('tipo', '==', filters.tipo));
    }
    return onSnapshot(q, snap => {
      const items = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
        updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
        fechaSalida: d.data().fechaSalida?.toDate?.().toISOString() ?? d.data().fechaSalida ?? null,
        fechaDevolucion: d.data().fechaDevolucion?.toDate?.().toISOString() ?? d.data().fechaDevolucion ?? null,
      })) as Remito[];
      items.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      callback(items);
    }, err => {
      console.error('remitos subscribe error:', err);
      onError?.(err);
    });
  },

  /**
   * Crea un remito de devolución o derivación a proveedor a partir de una lista
   * de items (cada item puede pertenecer a una ficha distinta), y aplica los
   * side effects: cada item afectado pasa a `en_envio` (devolución) o
   * `derivado_proveedor` (derivación), con su entrada al historial; el estado
   * agregado de la ficha se recalcula con `computeFichaEstado`.
   *
   * Numeración manual (la del papel preimpreso) — NO usa `getNextRemitoNumber`.
   */
  async createForItems(input: CreateRemitoItemsInput): Promise<{ id: string }> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const isDevolucion = input.tipo === 'devolucion';
    const proveedorNombre = input.proveedorNombre ?? 'proveedor';

    // Una línea por parte si el item se deriva por partes; una sola línea si el
    // módulo va completo (o si es devolución al cliente, donde partes no aplica).
    const remitoLineas: RemitoItem[] = input.items.flatMap(it => {
      const tienePartes = !isDevolucion && (it.partes?.length ?? 0) > 0;
      if (tienePartes) {
        return it.partes!.map(p => ({
          id: crypto.randomUUID(),
          cantidad: 1,
          tipoItem: 'entrega' as const,
          devuelto: false,
          fichaId: it.fichaId,
          fichaNumero: it.fichaNumero,
          itemSubId: it.itemSubId,
          otNumber: it.otNumber ?? null,
          // Código de la parte en su columna (2026-08-06) — antes el papel
          // imprimía el subId de la ficha como "código de artículo".
          articuloCodigo: p.articuloCodigo ?? undefined,
          // origenLabel (2026-08-06): módulo de origen con nombre y serie. Sin
          // fallback al subId (2026-08-07): el número de ficha no se declara ni
          // en el papel ni en el dato guardado, que es lo que se reimprime.
          fichaDescripcion: `${p.descripcion}${p.serie ? ` · S/N ${p.serie}` : ''}${it.origenLabel ? ` (de ${it.origenLabel})` : ''}`,
        }));
      }
      return [{
        id: crypto.randomUUID(),
        cantidad: 1,
        tipoItem: 'entrega' as const,
        devuelto: false,
        fichaId: it.fichaId,
        fichaNumero: it.fichaNumero,
        itemSubId: it.itemSubId,
        otNumber: it.otNumber ?? null,
        articuloCodigo: it.articuloCodigo ?? undefined,
        fichaDescripcion: it.descripcion,
      }];
    });

    // Loaners (2026-08-06): módulos AGS derivados al proveedor — líneas
    // DOCUMENTALES (el loaner no cambia de estado; trazabilidad por loanerId).
    const loanerLineas: RemitoItem[] = (input.loaners ?? []).flatMap(l => {
      if (l.partes && l.partes.length > 0) {
        return l.partes.map(p => ({
          id: crypto.randomUUID(),
          cantidad: 1,
          tipoItem: 'entrega' as const,
          devuelto: false,
          tipoEntidad: 'loaner' as const,
          loanerId: l.loanerId,
          loanerCodigo: l.loanerCodigo,
          // N° de parte en la columna Producto (el LNR no va al papel).
          articuloCodigo: p.articuloCodigo ?? undefined,
          loanerDescripcion: `${p.descripcion}${p.serie ? ` · S/N ${p.serie}` : ''} (de ${l.origenLabel ?? l.loanerCodigo})`,
        }));
      }
      return [{
        id: crypto.randomUUID(),
        cantidad: 1,
        tipoItem: 'entrega' as const,
        devuelto: false,
        tipoEntidad: 'loaner' as const,
        loanerId: l.loanerId,
        loanerCodigo: l.loanerCodigo,
        articuloCodigo: l.articuloCodigo ?? undefined,
        loanerDescripcion: l.descripcion,
      }];
    });
    remitoLineas.push(...loanerLineas);

    // Unidades de stock propias (2026-08-07): línea documental + side effect
    // sobre la unidad (queda en el proveedor, pendiente de retorno).
    const unidadesInput = isDevolucion ? [] : (input.unidades ?? []);
    const unidadLineas: RemitoItem[] = unidadesInput.map(u => ({
      id: crypto.randomUUID(),
      cantidad: u.cantidad ?? 1,
      tipoItem: 'entrega' as const,
      devuelto: false,
      tipoEntidad: 'articulo' as const,
      unidadId: u.unidadId,
      articuloId: u.articuloId,
      articuloCodigo: u.articuloCodigo,
      articuloDescripcion: [
        u.articuloDescripcion,
        u.serie ? `S/N ${u.serie}` : null,
        u.motivo?.trim() || null,
      ].filter(Boolean).join(' · '),
    }));
    remitoLineas.push(...unidadLineas);

    // Agrupar items por fichaId para hacer un solo update por ficha
    const itemsByFicha = new Map<string, typeof input.items>();
    for (const it of input.items) {
      const arr = itemsByFicha.get(it.fichaId) ?? [];
      arr.push(it);
      itemsByFicha.set(it.fichaId, arr);
    }

    const fichaIds = Array.from(itemsByFicha.keys());
    const fichaNumeros = Array.from(new Set(input.items.map(it => it.fichaNumero)));

    /**
     * Dueño de la mercadería (2026-08-07): en el listado de remitos la columna
     * Cliente NUNCA puede quedar vacía — es lo que dice de un vistazo de quién
     * es lo que salió. En una derivación el destinatario es el proveedor, pero
     * el dueño sigue siendo el cliente de la ficha; si lo que viaja es material
     * propio (loaner, patrón, parte de stock), el dueño es AGS.
     */
    const clientesDeFichas = Array.from(new Set(
      (input.clienteNombrePorFicha ? Object.values(input.clienteNombrePorFicha) : [])
        .filter((n): n is string => !!n && n.trim().length > 0),
    ));
    const duenoNombre = isDevolucion
      ? (input.clienteNombre ?? null)
      : clientesDeFichas.length === 1 ? clientesDeFichas[0]
      : clientesDeFichas.length > 1 ? 'Varios clientes'
      : 'AGS';

    const remitoPayload = deepCleanForFirestore({
      numero: input.numero,
      tipo: input.tipo,
      estado: 'en_transito',
      ingenieroId: '',
      ingenieroNombre: '',
      otNumbers: input.otNumbers ?? [],
      clienteId: isDevolucion ? (input.clienteId ?? null) : null,
      // En derivación el clienteId queda null a propósito (el destinatario del
      // papel es el proveedor); el nombre es informativo, para el listado.
      clienteNombre: duenoNombre,
      proveedorId: !isDevolucion ? (input.proveedorId ?? null) : null,
      proveedorNombre: !isDevolucion ? (input.proveedorNombre ?? null) : null,
      items: remitoLineas,
      observaciones: input.observaciones ?? null,
      fechaSalida: input.fecha,
      fechaDevolucion: null,
      fichaId: fichaIds.length === 1 ? fichaIds[0] : null,
      fichaNumero: fichaNumeros.length === 1 ? fichaNumeros[0] : null,
      loanerId: null,
      loanerCodigo: null,
      ...getCreateTrace(),
      createdAt: Timestamp.fromDate(new Date(now)),
      updatedAt: Timestamp.now(),
    });

    const batch = createBatch();
    batch.set(docRef('remitos', id), remitoPayload);
    batchAudit(batch, { action: 'create', collection: 'remitos', documentId: id, after: remitoPayload });

    // Loaners derivados (2026-08-12): la línea documental sola dejaba la lista
    // de loaners mintiendo "En base" con el módulo en el proveedor. Ahora el
    // loaner pasa a 'en_proveedor' con el snapshot de la derivación; la vuelta
    // (marcarLoanerRetornado) lo revierte a 'en_base'.
    if (!isDevolucion) {
      const loanersUnicos = new Map<string, NonNullable<typeof input.loaners>[number]>();
      for (const l of input.loaners ?? []) if (!loanersUnicos.has(l.loanerId)) loanersUnicos.set(l.loanerId, l);
      for (const l of loanersUnicos.values()) {
        const snapshotDerivacion = {
          proveedorId: input.proveedorId ?? null,
          proveedorNombre: input.proveedorNombre ?? null,
          remitoId: id,
          remitoNumero: input.numero,
          fechaEnvio: input.fecha,
          alcance: (l.partes && l.partes.length > 0 ? 'parte' : 'modulo'),
          // Con el N° de parte adelante (2026-08-27): "G1530-60600 — Electronic
          // Board · S/N x". Antes solo la descripción y el código se perdía.
          parteDescripcion: l.partes && l.partes.length > 0
            ? l.partes
                .map(p => [p.articuloCodigo, p.descripcion].filter(Boolean).join(' — '))
                .filter(Boolean).join(', ')
            : null,
        };
        const patch = deepCleanForFirestore({
          estado: 'en_proveedor',
          enProveedor: snapshotDerivacion,
          ...getUpdateTrace(),
          updatedAt: Timestamp.now(),
        });
        // La entrada de HISTORIAL va con arrayUnion FUERA del deepClean (el
        // JSON round-trip destruiría el sentinel) — espejo de prestamos[].
        const entradaHistorial = deepCleanForFirestore({
          id: crypto.randomUUID(), ...snapshotDerivacion, fechaRetorno: null,
        });
        batch.update(docRef('loaners', l.loanerId), { ...patch, derivaciones: arrayUnion(entradaHistorial) });
        batchAudit(batch, { action: 'update', collection: 'loaners', documentId: l.loanerId, after: { ...patch, derivacionNueva: entradaHistorial } });
      }
    }

    const creadoPor = getCreateTrace().createdByName ?? 'Sistema';

    for (const [fichaId, itemsDeFicha] of itemsByFicha) {
      const fichaSnap = await getDoc(doc(db, 'fichasPropiedad', fichaId));
      if (!fichaSnap.exists()) continue;
      const ficha = fichaSnap.data() as FichaPropiedad;
      const inputByItemId = new Map(itemsDeFicha.map(it => [it.itemId, it]));

      const updatedItems: ItemFicha[] = (ficha.items ?? []).map(it => {
        const inputItem = inputByItemId.get(it.id);
        if (!inputItem) return it;

        const tienePartes = !isDevolucion && (inputItem.partes?.length ?? 0) > 0;
        const nuevoEstado = isDevolucion
          ? 'en_envio'
          : (tienePartes ? 'esperando_repuesto' : 'derivado_proveedor');

        const motivoBase = isDevolucion
          ? `Remito de devolución ${input.numero}`
          : (tienePartes
              ? `Derivación parcial — remito ${input.numero} a ${proveedorNombre}`
              : `Remito de derivación a ${proveedorNombre} ${input.numero}`);

        const entry: HistorialFicha = {
          id: crypto.randomUUID(),
          fecha: now,
          estadoAnterior: it.estado,
          estadoNuevo: nuevoEstado,
          nota: motivoBase,
          creadoPor,
        };

        // Para derivación a proveedor también dejamos rastro estructurado en
        // `derivaciones[]` — alimenta la vista histórica del item y permite
        // marcar "recibido" cuando vuelven las partes.
        let nuevasDerivaciones: DerivacionProveedor[] = it.derivaciones ?? [];
        if (!isDevolucion) {
          const proveedorId = input.proveedorId ?? '';
          if (tienePartes) {
            for (const p of inputItem.partes!) {
              const der: DerivacionProveedor = {
                id: crypto.randomUUID(),
                proveedorId,
                proveedorNombre,
                remitoSalidaId: id,
                remitoSalidaNumero: input.numero,
                remitoRetornoId: null,
                fechaEnvio: now,
                fechaRetorno: null,
                descripcion: `${p.descripcion}${p.serie ? ` · S/N ${p.serie}` : ''} (de ${it.subId})`,
                estado: 'enviado',
                alcance: 'parte',
                parte: {
                  articuloId: p.articuloId ?? null,
                  articuloCodigo: p.articuloCodigo ?? null,
                  descripcion: p.descripcion,
                  serie: p.serie ?? null,
                },
              };
              nuevasDerivaciones = [...nuevasDerivaciones, der];
            }
          } else {
            const der: DerivacionProveedor = {
              id: crypto.randomUUID(),
              proveedorId,
              proveedorNombre,
              remitoSalidaId: id,
              remitoSalidaNumero: input.numero,
              remitoRetornoId: null,
              fechaEnvio: now,
              fechaRetorno: null,
              descripcion: inputItem.descripcion,
              estado: 'enviado',
              alcance: 'modulo_completo',
            };
            nuevasDerivaciones = [...nuevasDerivaciones, der];
          }
        }

        return {
          ...it,
          estado: nuevoEstado,
          historial: [...(it.historial ?? []), entry],
          derivaciones: nuevasDerivaciones,
          remitoDevolucionId: isDevolucion ? id : (it.remitoDevolucionId ?? null),
        };
      });

      const fichaPatch = deepCleanForFirestore({
        items: updatedItems,
        estado: computeFichaEstado(updatedItems),
        ...getUpdateTrace(),
        updatedAt: Timestamp.now(),
      });
      batch.update(docRef('fichasPropiedad', fichaId), fichaPatch);
      batchAudit(batch, { action: 'update', collection: 'fichas_propiedad', documentId: fichaId, after: fichaPatch });
    }

    // ── Unidades de stock: salen a la ubicación del proveedor ────────────────
    // No es un egreso definitivo: la unidad sigue siendo patrimonio de AGS y
    // vuelve con `retornarDeProveedor`. Por eso `en_transito` + `enProveedor`,
    // y no `entregado`/`consumido` (que la sacarían del ATP para siempre).
    const movimientosUnidades: Array<Omit<MovimientoStock, 'id' | 'createdAt'>> = [];
    for (const u of unidadesInput) {
      const uSnap = await getDoc(doc(db, 'unidades', u.unidadId));
      if (!uSnap.exists()) continue;
      const unidad = uSnap.data() as UnidadStock;
      const ubicacionOrigen: UbicacionStock = unidad.ubicacion ?? {
        tipo: 'posicion', referenciaId: '', referenciaNombre: '',
      };
      const salida: SalidaAProveedor = {
        proveedorId: input.proveedorId ?? '',
        proveedorNombre,
        remitoSalidaId: id,
        remitoSalidaNumero: input.numero,
        fechaEnvio: now,
        motivo: u.motivo?.trim() || null,
        ubicacionOrigen,
      };
      const unidadPatch = deepCleanForFirestore({
        estado: 'en_transito',
        ubicacion: {
          tipo: 'proveedor',
          referenciaId: input.proveedorId ?? '',
          referenciaNombre: proveedorNombre,
        },
        enProveedor: salida,
        ...getUpdateTrace(),
        updatedAt: Timestamp.now(),
      });
      batch.update(docRef('unidades', u.unidadId), unidadPatch);
      batchAudit(batch, { action: 'update', collection: 'unidades', documentId: u.unidadId, after: unidadPatch });

      movimientosUnidades.push({
        tipo: 'egreso',
        unidadId: u.unidadId,
        articuloId: u.articuloId,
        articuloCodigo: u.articuloCodigo,
        articuloDescripcion: u.articuloDescripcion,
        cantidad: u.cantidad ?? 1,
        origenTipo: ubicacionOrigen.tipo === 'transito' ? 'posicion' : (ubicacionOrigen.tipo as TipoOrigenDestino),
        origenId: ubicacionOrigen.referenciaId,
        origenNombre: ubicacionOrigen.referenciaNombre,
        destinoTipo: 'proveedor',
        destinoId: input.proveedorId ?? '',
        destinoNombre: proveedorNombre,
        remitoId: id,
        motivo: `Salida a proveedor — remito ${input.numero}${u.motivo?.trim() ? ` · ${u.motivo.trim()}` : ''}`,
        nroSerie: unidad.nroSerie ?? null,
        nroLote: unidad.nroLote ?? null,
        creadoPor,
      });
    }

    await batch.commit();

    // Movimientos después del commit: si alguno falla, la salida ya quedó
    // registrada en la unidad y el remito (el movimiento es la traza, no la
    // fuente de verdad).
    for (const mov of movimientosUnidades) {
      await movimientosService.create(mov).catch(err =>
        console.error('[createForItems] movimiento de salida a proveedor falló:', err),
      );
    }

    return { id };
  },

  /**
   * Marca el remito de derivación como entregado en el proveedor externo
   * (2026-08-07) y estampa la fecha en las unidades propias que viajaban —
   * una parte de stock sale sola, sin ficha, así que su estado no se actualiza
   * por ningún otro camino.
   */
  async marcarEntregadoEnProveedor(remitoId: string): Promise<void> {
    const rSnap = await getDoc(doc(db, 'remitos', remitoId));
    if (!rSnap.exists()) throw new Error('El remito no existe');
    const remito = rSnap.data() as Remito;
    const now = new Date().toISOString();

    const batch = createBatch();
    const remitoPatch = deepCleanForFirestore({
      estado: 'en_proveedor' as EstadoRemito,
      fechaEntregaProveedor: now,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    batch.update(docRef('remitos', remitoId), remitoPatch);
    batchAudit(batch, { action: 'update', collection: 'remitos', documentId: remitoId, after: remitoPatch });

    const unidadIds = Array.from(new Set(
      (remito.items ?? []).map(i => i.unidadId).filter((x): x is string => !!x),
    ));
    for (const unidadId of unidadIds) {
      const uSnap = await getDoc(doc(db, 'unidades', unidadId));
      if (!uSnap.exists()) continue;
      const unidad = uSnap.data() as UnidadStock;
      if (!unidad.enProveedor) continue;   // no salió por este circuito
      const patch = deepCleanForFirestore({
        enProveedor: { ...unidad.enProveedor, fechaEntrega: now },
        ...getUpdateTrace(),
        updatedAt: Timestamp.now(),
      });
      batch.update(docRef('unidades', unidadId), patch);
      batchAudit(batch, { action: 'update', collection: 'unidades', documentId: unidadId, after: patch });
    }

    await batch.commit();
  },

  /**
   * Registra el retorno de una unidad que estaba en el proveedor: vuelve a su
   * ubicación de origen, queda disponible y se marca la línea del remito de
   * salida como devuelta.
   *
   * Idempotente-ish: si la unidad no tiene `enProveedor` tira error en lugar de
   * inventar una ubicación.
   */
  async registrarRetornoUnidad(
    unidadId: string,
    opts?: { observaciones?: string | null; condicion?: CondicionUnidad | null },
  ): Promise<void> {
    const uSnap = await getDoc(doc(db, 'unidades', unidadId));
    if (!uSnap.exists()) throw new Error('La unidad no existe');
    const unidad = uSnap.data() as UnidadStock;
    const salida = unidad.enProveedor;
    if (!salida) throw new Error('La unidad no figura en un proveedor');

    const now = new Date().toISOString();
    const batch = createBatch();

    const unidadPatch = deepCleanForFirestore({
      estado: 'disponible',
      ubicacion: salida.ubicacionOrigen,
      enProveedor: null,
      condicion: opts?.condicion ?? unidad.condicion,
      observaciones: opts?.observaciones?.trim()
        ? [unidad.observaciones, opts.observaciones.trim()].filter(Boolean).join(' · ')
        : unidad.observaciones ?? null,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    batch.update(docRef('unidades', unidadId), unidadPatch);
    batchAudit(batch, { action: 'update', collection: 'unidades', documentId: unidadId, after: unidadPatch });

    // Marcar la línea del remito de salida como devuelta, para que el remito
    // pueda cerrarse y no quede eternamente "en tránsito".
    const rSnap = await getDoc(doc(db, 'remitos', salida.remitoSalidaId));
    if (rSnap.exists()) {
      const remito = rSnap.data() as Remito;
      const items = (remito.items ?? []).map(it =>
        it.unidadId === unidadId && !it.devuelto
          ? { ...it, devuelto: true, fechaDevolucion: now }
          : it,
      );
      const todoDevuelto = items.every(it => it.devuelto || it.consumido);
      const remitoPatch = deepCleanForFirestore({
        items,
        estado: (todoDevuelto ? 'completado' : remito.estado) as EstadoRemito,
        fechaDevolucion: todoDevuelto ? now : (remito.fechaDevolucion ?? null),
        ...getUpdateTrace(),
        updatedAt: Timestamp.now(),
      });
      batch.update(docRef('remitos', salida.remitoSalidaId), remitoPatch);
      batchAudit(batch, { action: 'update', collection: 'remitos', documentId: salida.remitoSalidaId, after: remitoPatch });
    }

    await batch.commit();

    await movimientosService.create({
      tipo: 'ingreso',
      unidadId,
      articuloId: unidad.articuloId,
      articuloCodigo: unidad.articuloCodigo,
      articuloDescripcion: unidad.articuloDescripcion,
      cantidad: unidad.cantidad ?? 1,
      origenTipo: 'proveedor',
      origenId: salida.proveedorId,
      origenNombre: salida.proveedorNombre,
      destinoTipo: salida.ubicacionOrigen.tipo === 'transito' ? 'posicion' : (salida.ubicacionOrigen.tipo as TipoOrigenDestino),
      destinoId: salida.ubicacionOrigen.referenciaId,
      destinoNombre: salida.ubicacionOrigen.referenciaNombre,
      remitoId: salida.remitoSalidaId,
      motivo: `Retorno de proveedor — remito ${salida.remitoSalidaNumero}`,
      nroSerie: unidad.nroSerie ?? null,
      nroLote: unidad.nroLote ?? null,
      creadoPor: getCreateTrace().createdByName ?? 'Sistema',
    }).catch(err =>
      console.error('[registrarRetornoUnidad] movimiento de retorno falló:', err),
    );
  },

  /**
   * Marca como devuelta una línea de LOANER de un remito de derivación a
   * proveedor (2026-08-12). Los loaners derivados son líneas documentales (el
   * loaner no cambia de estado), así que hasta ahora no existía el evento "el
   * loaner volvió del proveedor": este método lo crea — marca la línea
   * `devuelto`, cierra el remito si todo quedó resuelto y dispara la
   * calificación pendiente del proveedor (best-effort, idempotente).
   */
  async marcarLoanerRetornado(remitoId: string, itemId: string): Promise<void> {
    const rSnap = await getDoc(doc(db, 'remitos', remitoId));
    if (!rSnap.exists()) throw new Error('El remito no existe');
    const remito = rSnap.data() as Remito;
    const item = (remito.items ?? []).find(it => it.id === itemId);
    if (!item?.loanerId) throw new Error('La línea no corresponde a un loaner');
    if (item.devuelto) return;

    const now = new Date().toISOString();
    const items = (remito.items ?? []).map(it =>
      it.id === itemId ? { ...it, devuelto: true, fechaDevolucion: now } : it,
    );
    const todoDevuelto = items.every(it => it.devuelto || it.consumido);
    const remitoPatch = deepCleanForFirestore({
      items,
      estado: (todoDevuelto ? 'completado' : remito.estado) as EstadoRemito,
      fechaDevolucion: todoDevuelto ? now : (remito.fechaDevolucion ?? null),
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.update(docRef('remitos', remitoId), remitoPatch);
    batchAudit(batch, { action: 'update', collection: 'remitos', documentId: remitoId, after: remitoPatch });
    // La vuelta revierte el loaner a base, limpia el snapshot vigente y
    // estampa fechaRetorno en la entrada del HISTORIAL de este remito
    // (2026-08-12) — espejo del efecto de createForItems.
    const lSnap = await getDoc(doc(db, 'loaners', item.loanerId));
    const derivacionesPrevias = (lSnap.exists() ? (lSnap.data().derivaciones ?? []) : []) as Array<Record<string, unknown>>;
    const derivaciones = derivacionesPrevias.map(d =>
      d.remitoId === remitoId && !d.fechaRetorno ? { ...d, fechaRetorno: now } : d,
    );
    const loanerPatch = deepCleanForFirestore({
      estado: 'en_base',
      enProveedor: null,
      derivaciones,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    batch.update(docRef('loaners', item.loanerId), loanerPatch);
    batchAudit(batch, { action: 'update', collection: 'loaners', documentId: item.loanerId, after: loanerPatch });
    await batch.commit();

    // Calificación pendiente del proveedor (best-effort post-commit).
    if (remito.proveedorId && remito.proveedorNombre) {
      try {
        const { calificacionesService } = await import('./calificacionesService');
        const salida = remito.fechaEntregaProveedor ?? remito.fechaSalida;
        const salidaMs = salida ? new Date(salida).getTime() : NaN;
        await calificacionesService.crearPendienteSiNoExiste({
          proveedorId: remito.proveedorId,
          proveedorNombre: remito.proveedorNombre,
          origen: 'loaner_retorno',
          origenKey: `loaner_retorno:${remitoId}:${item.loanerId}`,
          origenId: remitoId,
          origenLabel: `Loaner ${item.loanerCodigo ?? item.loanerId} — retorno de ${remito.proveedorNombre}`,
          fechaEvento: now,
          diasEnProveedor: isNaN(salidaMs) ? null : Math.max(0, Math.round((Date.now() - salidaMs) / 86400000)),
          remitoId,
          remitoNro: remito.numero,
          loanerId: item.loanerId,
        });
      } catch (err) {
        console.error('[marcarLoanerRetornado] calificación pendiente falló (retorno OK):', err);
      }
    }
  },

  /**
   * Remito de SERVICIO (tipo `'servicio'`) — impreso sobre el papel preimpreso R.
   *
   * Se arma por EQUIPO: consolida N líneas de servicio (típicamente una por OT del
   * mismo equipo) en un solo remito, para no emitir un remito por servicio. NO toca
   * stock — es un entregable/comprobante, no un movimiento.
   *
   * Numeración: preimpresa manual (la del papel), igual que los remitos de ficha.
   */
  async createRemitoServicio(input: CreateRemitoServicioInput): Promise<{ id: string }> {
    const id = crypto.randomUUID();
    const items: RemitoItem[] = input.lineas.map(l => ({
      id: crypto.randomUUID(),
      cantidad: 1,
      tipoItem: 'entrega',
      devuelto: false,
      servicioCode: l.servicioCode ?? null,
      servicioDescripcion: l.servicioDescripcion,
      otNumberOrigen: l.otNumberOrigen ?? null,
      presupuestoNumero: l.presupuestoNumero ?? null,
      ocNumero: l.ocNumero ?? null,
    }));
    const otNumbers = Array.from(new Set(
      input.lineas.map(l => l.otNumberOrigen).filter((n): n is string => !!n),
    ));
    const payload = deepCleanForFirestore({
      numero: input.numero,
      tipo: 'servicio' as const,
      estado: 'confirmado' as const,
      ingenieroId: '',
      ingenieroNombre: '',
      otNumbers,
      clienteId: input.clienteId ?? null,
      clienteNombre: input.clienteNombre ?? null,
      sistemaId: input.sistemaId ?? null,
      sistemaNombre: input.sistemaNombre ?? null,
      sistemaCodigoInterno: input.sistemaCodigoInterno ?? null,
      ordenClienteNumero: input.ordenClienteNumero ?? null,
      datoInternoCliente: input.datoInternoCliente ?? null,
      items,
      observaciones: input.observaciones ?? null,
      fechaSalida: input.fecha,
      fechaDevolucion: null,
      ...getCreateTrace(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.set(docRef('remitos', id), payload);
    batchAudit(batch, { action: 'create', collection: 'remitos', documentId: id, after: payload });
    await batch.commit();
    return { id };
  },
};

/** Datos de razón social/domicilio/IVA/CUIT que van impresos en una columna. */
export interface DatosTransportista {
  razonSocial: string;
  domicilio: string;
  localidad: string;
  provincia: string;
  iva: string;
  cuit: string;
}

export interface CreateRemitoItemsInput {
  /** Número preimpreso del papel (ej. "0001-00017091"). */
  numero: string;
  tipo: 'devolucion' | 'derivacion_proveedor';
  destinatario: DatosTransportista;
  transportista?: DatosTransportista | null;
  fecha: string;
  /**
   * Items a incluir. Cada uno referencia su ficha + el item (módulo) dentro de la ficha.
   *
   * - Si `partes` está vacío/ausente: viaja el módulo completo. Una sola línea en el remito.
   *   En `derivacion_proveedor` el módulo padre transiciona a `derivado_proveedor` y se
   *   crea 1 `DerivacionProveedor` con `alcance: 'modulo_completo'`.
   * - Si `partes` tiene 1+ entradas: viajan solo esas partes (no el módulo). Una línea
   *   por parte. El módulo padre queda en planta y transiciona a `esperando_repuesto`,
   *   con N `DerivacionProveedor` (`alcance: 'parte'`) — una por parte.
   *
   * `partes` solo aplica para `tipo: 'derivacion_proveedor'`. En devoluciones al cliente
   * se ignora.
   */
  items: Array<{
    fichaId: string;
    fichaNumero: string;
    itemId: string;
    itemSubId: string;
    /** Código de artículo / N° de parte — columna "Producto" del remito. */
    articuloCodigo?: string | null;
    /** Módulo de origen para las líneas de partes: "SUB-XX · descripción · S/N ..." */
    origenLabel?: string;
    /** OT de esta línea, para el desglose del remito (2026-08-07). */
    otNumber?: string | null;
    descripcion: string;
    partes?: Array<{
      articuloId?: string | null;
      articuloCodigo?: string | null;
      descripcion: string;
      serie?: string | null;
    }>;
  }>;
  /** Loaners (módulos AGS) a derivar — líneas documentales, completo o por partes (2026-08-06). */
  loaners?: Array<{
    loanerId: string;
    loanerCodigo: string;
    /** Modelo del equipo para la columna Producto (el LNR no va al papel). */
    articuloCodigo?: string | null;
    descripcion: string;
    origenLabel?: string;
    partes?: Array<{
      articuloId?: string | null;
      articuloCodigo?: string | null;
      descripcion: string;
      serie?: string | null;
    }>;
  }>;
  /**
   * Unidades de stock PROPIAS que se mandan al proveedor a que les hagan un
   * trabajo y tienen que volver (2026-08-07). A diferencia de los loaners, acá
   * sí hay side effect sobre stock: la unidad queda `en_transito` en el
   * proveedor, con `enProveedor` marcando el retorno pendiente.
   *
   * Solo aplica a `tipo: 'derivacion_proveedor'`.
   */
  unidades?: Array<{
    unidadId: string;
    articuloId: string;
    articuloCodigo: string;
    articuloDescripcion: string;
    serie?: string | null;
    cantidad?: number;
    /** Qué le van a hacer — se concatena a la descripción de la línea. */
    motivo?: string | null;
  }>;
  observaciones?: string | null;
  proveedorId?: string | null;
  proveedorNombre?: string | null;
  clienteId?: string | null;
  clienteNombre?: string | null;
  /**
   * fichaId → razón social del dueño del equipo (2026-08-07). En una derivación
   * el remito se emite al proveedor, pero el listado tiene que mostrar de quién
   * es la mercadería. Sin esto la columna Cliente quedaba vacía.
   */
  clienteNombrePorFicha?: Record<string, string>;
  otNumbers?: string[];
}

/** Una línea de servicio del remito de servicio (típicamente una por OT del equipo). */
export interface RemitoServicioLinea {
  servicioDescripcion: string;
  servicioCode?: string | null;
  /** OT origen (una OT ≈ un servicio). */
  otNumberOrigen?: string | null;
  presupuestoNumero?: string | null;
  ocNumero?: string | null;
}

export interface CreateRemitoServicioInput {
  /** Número preimpreso del papel (ej. "0001-00017091"). */
  numero: string;
  fecha: string;
  destinatario: DatosTransportista;
  transportista?: DatosTransportista | null;
  clienteId?: string | null;
  clienteNombre?: string | null;
  /** Equipo al que refieren los servicios (el remito se arma por equipo). */
  sistemaId?: string | null;
  sistemaNombre?: string | null;
  sistemaCodigoInterno?: string | null;
  /** Datos comerciales que pide el cliente. */
  ordenClienteNumero?: string | null;
  datoInternoCliente?: string | null;
  lineas: RemitoServicioLinea[];
  observaciones?: string | null;
}

// ========== RESERVAS DE STOCK ==========

/** Fila del recuadro de reservas del cierre de OT. */
export interface ReservaVisibleCierre {
  presupuestoNumero: string;
  articuloCodigo: string;
  articuloDescripcion: string;
  cantidad: number;
  ubicacionNombre: string;
  nroSerie: string | null;
  nroLote: string | null;
  /** Unidades que agrupa la fila — las que libera el botón de la UI. */
  unidadIds: string[];
}

export const reservasService = {
  /** Unidades actualmente reservadas para un presupuesto (estado 'reservado'). */
  async getByPresupuesto(presupuestoId: string): Promise<UnidadStock[]> {
    if (!presupuestoId) return [];
    const q = query(
      collection(db, 'unidades'),
      where('reservadoParaPresupuestoId', '==', presupuestoId),
      where('estado', '==', 'reservado'),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as UnidadStock));
  },

  /**
   * Reservas vivas (estado 'reservado') de un artículo para un cliente dado. Usado por
   * la conciliación "saldar contra minikit": cuando el ingeniero instaló una parte de su
   * kit, la unidad reservada en estante para ese mismo cliente+artículo es la que debe
   * reponer el kit. Match por cliente+artículo (decisión UAT 2026-07-23).
   */
  async getReservadasByClienteArticulo(clienteId: string, articuloId: string): Promise<UnidadStock[]> {
    if (!clienteId || !articuloId) return [];
    const q = query(
      collection(db, 'unidades'),
      where('reservadoParaClienteId', '==', clienteId),
      where('articuloId', '==', articuloId),
      where('estado', '==', 'reservado'),
    );
    const snap = await getDocs(q);
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() } as UnidadStock))
      .filter(u => u.activo !== false);
  },

  /**
   * Reserves a specific UnidadStock for a presupuesto.
   * Physically moves the unit to the RESERVAS position and sets estado='reservado'.
   * Creates an immutable MovimientoStock of type 'transferencia'.
   * NEVER writes undefined — all optional fields use null.
   */
  async reservar(params: {
    unidadId: string;
    unidad: UnidadStock;
    presupuestoId: string;
    presupuestoNumero: string;
    clienteId: string;
    clienteNombre: string;
    solicitadoPorNombre: string;
    /**
     * Cantidad física a reservar de esta unidad. Para artículos serializados (cantidad 1)
     * omitir → reserva la unidad entera. Para LOTES (cantidad > 1) pasar la cantidad
     * necesaria: si es menor a la del lote, se SPLITEA — el resto queda disponible en la
     * unidad original y se crea una nueva unidad reservada con la porción pedida. Sin esto
     * se reservaba el lote entero aunque solo se necesitara una parte (bug de sobre-reserva).
     */
    cantidad?: number;
  }): Promise<void> {
    // Fetch RESERVAS position OUTSIDE tx — stable singleton, safe to prefetch.
    // getOrCreateReservasPosition() is idempotent by 'RESERVAS' code lookup.
    const posReservas = await getOrCreateReservasPosition();
    const now = Timestamp.now();
    const movId = crypto.randomUUID();
    const unidadRef = docRef('unidades', params.unidadId);
    const movRef = doc(db, 'movimientosStock', movId);
    const splitRef = docRef('unidades', crypto.randomUUID()); // destino si hay split de lote

    const reservadoUnidadId = await runTransaction(db, async (tx) => {
      // READ FIRST (all reads before any write — Firestore tx requirement)
      const unidadSnap = await tx.get(unidadRef);
      if (!unidadSnap.exists()) {
        throw new Error(`Unidad ${params.unidadId} no encontrada`);
      }
      const data = unidadSnap.data();
      if (data.estado !== 'disponible') {
        throw new Error(
          `Unidad no disponible — estado actual '${data.estado}' (reservada por otro usuario?)`,
        );
      }

      const qtyActual = data.cantidad ?? 1;
      const aReservar = params.cantidad != null ? Math.min(params.cantidad, qtyActual) : qtyActual;
      const esSplitParcial = aReservar < qtyActual;

      const reservaFields = {
        estado: 'reservado' as EstadoUnidad,
        ubicacion: { tipo: 'posicion', referenciaId: posReservas.id, referenciaNombre: posReservas.nombre },
        // Guardar de dónde salió: liberar() la devuelve a esta posición (UAT 2026-07-16).
        ubicacionAnterior: data.ubicacion ?? null,
        reservadoParaPresupuestoId: params.presupuestoId,
        reservadoParaPresupuestoNumero: params.presupuestoNumero,
        reservadoParaClienteId: params.clienteId,
        reservadoParaClienteNombre: params.clienteNombre,
      };

      let movUnidadId = params.unidadId;
      if (esSplitParcial) {
        // Lote: descontar lo reservado de la unidad original (queda disponible) y crear
        // una unidad nueva con la porción reservada. Clonamos el doc original; deepClean
        // preserva los Timestamp (no recursa instancias), y pisamos createdAt/updatedAt.
        const { id: _id, ...rest } = data as Record<string, any>;
        tx.update(unidadRef, deepCleanForFirestore({
          cantidad: qtyActual - aReservar,
          ...getUpdateTrace(),
          updatedAt: now.toDate().toISOString(),
        }));
        tx.set(splitRef, deepCleanForFirestore({
          ...rest,
          cantidad: aReservar,
          ...reservaFields,
          ...getCreateTrace(),
          createdAt: now,
          updatedAt: now,
        }));
        movUnidadId = splitRef.id;
      } else {
        tx.update(unidadRef, deepCleanForFirestore({
          ...reservaFields,
          ...getUpdateTrace(),
          updatedAt: now.toDate().toISOString(),
        }));
      }

      tx.set(movRef, deepCleanForFirestore({
        tipo: 'transferencia' as TipoMovimiento,
        unidadId: movUnidadId,
        articuloId: params.unidad.articuloId,
        articuloCodigo: params.unidad.articuloCodigo,
        articuloDescripcion: params.unidad.articuloDescripcion,
        cantidad: aReservar,
        origenTipo: params.unidad.ubicacion.tipo as TipoOrigenDestino,
        origenId: params.unidad.ubicacion.referenciaId,
        origenNombre: params.unidad.ubicacion.referenciaNombre,
        destinoTipo: 'posicion' as TipoOrigenDestino,
        destinoId: posReservas.id,
        destinoNombre: posReservas.nombre,
        motivo: `Reservado para presupuesto ${params.presupuestoNumero} — ${params.clienteNombre}`,
        creadoPor: params.solicitadoPorNombre,
        ...getCreateTrace(),
        createdAt: now,
      }));

      return movUnidadId;
    });

    // Audit — post-tx best-effort (fire-and-forget, non-blocking).
    // Audit is observational; losing it is acceptable vs. rolling back the reservation.
    logAudit({ action: 'update', collection: 'unidades_stock', documentId: reservadoUnidadId });
  },

  /**
   * Reserva automáticamente stock DISPONIBLE para cubrir lo que un presupuesto
   * aceptado aún tiene pendiente de un artículo (UAT 2026-07-16: al ingresar la
   * mercadería comprada para un ppto, el faltante debe reservarse solo).
   *
   * Pendiente = cantidad pedida en los items del ppto − (reservadas + entregadas)
   * de ese artículo para ese ppto. Reserva FIFO desde disponibles, excluyendo
   * stock en poder de ingenieros (mismo criterio que la aceptación). Best-effort:
   * cualquier falla deja de reservar pero no rompe el ingreso que la disparó.
   */
  async reservarPendientesParaPresupuesto(params: {
    presupuestoId: string;
    articuloId: string;
    solicitadoPorNombre: string;
  }): Promise<{ reservadas: number }> {
    const { presupuestosService } = await import('./presupuestosService');
    const pres = await presupuestosService.getById(params.presupuestoId).catch(() => null);
    // 'pendiente_facturacion' incluido (auditoría B5): si la OT cerró antes de que
    // ingresara la mercadería importada, el ppto ya avanzó de estado pero el stock
    // sigue adeudado al cliente. Sin esto, el ingreso posterior nunca reservaba para
    // ese ppto y el retry del cierre no encontraba nada que entregar.
    if (!pres || !['aceptado', 'en_ejecucion', 'pendiente_facturacion'].includes(pres.estado as string)) return { reservadas: 0 };

    const necesarias = (pres.items ?? [])
      .filter(i => i.stockArticuloId === params.articuloId)
      .reduce((acc, i) => acc + (i.cantidad || 0), 0);
    if (necesarias <= 0) return { reservadas: 0 };

    const snap = await getDocs(query(
      collection(db, 'unidades'),
      where('reservadoParaPresupuestoId', '==', params.presupuestoId),
      where('articuloId', '==', params.articuloId),
    ));
    const cubiertas = snap.docs
      .map(d => d.data())
      .filter(u => u.estado === 'reservado' || u.estado === 'entregado')
      .reduce((acc, u) => acc + (u.cantidad ?? 1), 0);
    let pendiente = necesarias - cubiertas;
    if (pendiente <= 0) return { reservadas: 0 };

    let clienteNombre = '';
    if (pres.clienteId) {
      try {
        const { clientesService } = await import('./clientesService');
        clienteNombre = (await clientesService.getById(pres.clienteId))?.razonSocial ?? '';
      } catch { /* nombre vacío — la reserva vale igual */ }
    }

    // Solo estante libre: excluir stock en poder de ingenieros Y el que está dentro de
    // minikits (ubicación 'minikit', estado 'disponible'). Ese stock está comprometido en
    // el kit del ingeniero — moverlo a RESERVAS lo sacaría del minikit en los papeles sin
    // que salga físicamente. La baja de esas partes se concilia en el consumo del kit
    // (reservasService.saldarConsumoMinikit). UAT 2026-07-23.
    const disponibles = (await unidadesService.getAll({ articuloId: params.articuloId, estado: 'disponible' }))
      .filter(u => u.ubicacion?.tipo !== 'ingeniero' && u.ubicacion?.tipo !== 'minikit');
    let reservadas = 0;
    for (const u of disponibles) {
      if (pendiente <= 0) break;
      const aReservar = Math.min(u.cantidad ?? 1, pendiente);
      try {
        await this.reservar({
          unidadId: u.id,
          unidad: u,
          presupuestoId: params.presupuestoId,
          presupuestoNumero: pres.numero ?? '',
          clienteId: pres.clienteId ?? '',
          clienteNombre,
          solicitadoPorNombre: params.solicitadoPorNombre,
          cantidad: aReservar,
        });
        pendiente -= aReservar;
        reservadas += aReservar;
      } catch (err) {
        console.error(`[reservarPendientesParaPresupuesto] unidad ${u.id}:`, err);
      }
    }
    if (reservadas > 0) {
      console.log(`[reservarPendientesParaPresupuesto] ${reservadas} u. reservadas para ppto ${pres.numero}`);

      // Aviso a Materiales para la reserva FÍSICA (UAT 2026-07-17): en el circuito
      // de compra/importación la reserva ocurre recién al ingresar la mercadería,
      // así que el aviso que aceptarConRequerimientos crea al aceptar nunca existió
      // para estos items. Dedupe: si ya hay un aviso abierto del ppto, se anexa la línea.
      try {
        const { leadsService } = await import('./leadsService');
        const art = disponibles[0] ?? null;
        const linea = `• ${art?.articuloCodigo ?? params.articuloId} ${art?.articuloDescripcion ?? ''} — ${reservadas}/${necesarias} u. (ingreso de mercadería)`;
        const vinculados = (await getDocs(query(
          collection(db, 'leads'),
          where('presupuestosIds', 'array-contains', params.presupuestoId),
        ))).docs.map(d => ({ id: d.id, data: d.data() as Record<string, unknown> }));
        const previo = vinculados.find(t =>
          // 'materiales' legacy: avisos creados antes de la regla de áreas 2026-08-05.
          (t.data.areaActual === 'admin_soporte' || t.data.areaActual === 'materiales') &&
          t.data.accionPendiente === 'Reservar stock físicamente' &&
          !['finalizado', 'no_concretado'].includes(t.data.estado as string));
        if (previo) {
          await leadsService.update(previo.id, {
            descripcion: `${(previo.data.descripcion as string) ?? ''}\n${linea}`,
          } as never);
        } else {
          // Área admin_soporte, pero el dueño del aviso es Materiales.
          const responsableMateriales = await leadsService.getResponsableMateriales();
          await leadsService.create({
            clienteId: pres.clienteId ?? null,
            contactoId: null,
            razonSocial: clienteNombre || '',
            contactos: [],
            contacto: '',
            email: '',
            telefono: '',
            motivoLlamado: 'administracion',
            motivoContacto: `Reservar stock — Ppto ${pres.numero}`,
            descripcion: `Reservar físicamente para el presupuesto ${pres.numero}${clienteNombre ? ` (${clienteNombre})` : ''}:\n${linea}`,
            sistemaId: null,
            moduloId: null,
            estado: 'nuevo',
            postas: [],
            asignadoA: responsableMateriales?.id ?? null,
            asignadoNombre: responsableMateriales?.displayName ?? null,
            derivadoPor: null,
            // Regla de áreas 2026-08-05: reserva de materiales → admin de soporte.
            areaActual: 'admin_soporte',
            esAutogenerado: true,
            accionPendiente: 'Reservar stock físicamente',
            adjuntos: [],
            presupuestosIds: [params.presupuestoId],
            otIds: [],
            finalizadoAt: null,
            prioridad: 'normal',
            proximoContacto: null,
            valorEstimado: null,
          } as never);
        }
      } catch (avisoErr) {
        console.warn('[reservarPendientesParaPresupuesto] aviso a Materiales falló:', avisoErr);
      }

      // Si con esta reserva el ppto quedó TOTALMENTE cubierto (todos sus items de
      // stock reservados/entregados), el circuito comercial avanza: el ticket pasa
      // de Compras a Coordinación de OTs (idempotente si ya estaba ahí).
      try {
        const cobertura = await getDocs(query(
          collection(db, 'unidades'),
          where('reservadoParaPresupuestoId', '==', params.presupuestoId),
        ));
        const porArticulo = new Map<string, number>();
        cobertura.docs
          .map(d => d.data())
          .filter(u => u.estado === 'reservado' || u.estado === 'entregado')
          .forEach(u => porArticulo.set(u.articuloId, (porArticulo.get(u.articuloId) ?? 0) + (u.cantidad ?? 1)));
        const completo = (pres.items ?? [])
          .filter(i => i.stockArticuloId)
          .every(i => (porArticulo.get(i.stockArticuloId!) ?? 0) >= (i.cantidad || 0));
        if (completo) {
          await presupuestosService.derivarTicketACoordinacion(params.presupuestoId);
          console.log(`[reservarPendientesParaPresupuesto] ppto ${pres.numero} totalmente cubierto → ticket a coordinación`);
        }
      } catch (err) {
        console.warn('[reservarPendientesParaPresupuesto] check de cobertura/coordinación falló:', err);
      }
    }
    return { reservadas };
  },

  /**
   * Releases a reserved UnidadStock back to disponible.
   * Moves unit back to its original position (or a default depot if unknown).
   * Creates an immutable MovimientoStock of type 'transferencia'.
   *
   * Migrado a runTransaction para evitar races con reservar() concurrente:
   * leemos el estado actual y validamos que esté 'reservado' antes de escribir,
   * todo atómico. Sin esto, una libera+reserva concurrentes podían dejar la
   * unidad en estado inconsistente con la reserva del segundo proceso perdida.
   */
  async liberar(params: {
    unidadId: string;
    unidad: UnidadStock;
    motivo: string;
    solicitadoPorNombre: string;
    destino?: { tipo: 'posicion' | 'minikit' | 'ingeniero'; referenciaId: string; referenciaNombre: string };
  }): Promise<void> {
    const now = Timestamp.now();
    const movId = crypto.randomUUID();
    const unidadRef = docRef('unidades', params.unidadId);
    const movRef = doc(db, 'movimientosStock', movId);

    await runTransaction(db, async (tx) => {
      // READ FIRST — todas las reads antes de cualquier write.
      const unidadSnap = await tx.get(unidadRef);
      if (!unidadSnap.exists()) {
        throw new Error(`Unidad ${params.unidadId} no encontrada`);
      }
      const currentData = unidadSnap.data();
      if (currentData.estado !== 'reservado') {
        throw new Error(
          `Unidad no liberable — estado actual '${currentData.estado}' (esperaba 'reservado')`,
        );
      }

      // Destino físico: explícito del caller > ubicación previa a la reserva >
      // quedarse donde está (unidades reservadas antes del campo ubicacionAnterior).
      // Sin esto, las liberadas quedaban "disponibles" en la posición RESERVAS (UAT 2026-07-16).
      const destinoFinal = params.destino ?? currentData.ubicacionAnterior ?? null;

      const unitPayload = deepCleanForFirestore({
        estado: 'disponible' as EstadoUnidad,
        reservadoParaPresupuestoId: null,
        reservadoParaPresupuestoNumero: null,
        reservadoParaClienteId: null,
        reservadoParaClienteNombre: null,
        ubicacionAnterior: null,
        ...(destinoFinal ? { ubicacion: destinoFinal } : {}),
        ...getUpdateTrace(),
        updatedAt: now.toDate().toISOString(),
      });

      const movPayload = deepCleanForFirestore({
        tipo: 'transferencia' as TipoMovimiento,
        unidadId: params.unidadId,
        articuloId: params.unidad.articuloId,
        articuloCodigo: params.unidad.articuloCodigo,
        articuloDescripcion: params.unidad.articuloDescripcion,
        // Cantidad real del doc (un lote puede representar N unidades) — leída en-tx.
        cantidad: currentData.cantidad ?? 1,
        origenTipo: params.unidad.ubicacion.tipo as TipoOrigenDestino,
        origenId: params.unidad.ubicacion.referenciaId,
        origenNombre: params.unidad.ubicacion.referenciaNombre,
        destinoTipo: (destinoFinal?.tipo ?? params.unidad.ubicacion.tipo) as TipoOrigenDestino,
        destinoId: destinoFinal?.referenciaId ?? params.unidad.ubicacion.referenciaId,
        destinoNombre: destinoFinal?.referenciaNombre ?? params.unidad.ubicacion.referenciaNombre,
        motivo: params.motivo,
        creadoPor: params.solicitadoPorNombre,
        ...getCreateTrace(),
        createdAt: now,
      });

      tx.update(unidadRef, unitPayload);
      tx.set(movRef, movPayload);
    });

    // Audit — post-tx best-effort (fire-and-forget). Mismo patrón que reservar().
    logAudit({ action: 'update', collection: 'unidades_stock', documentId: params.unidadId });
  },

  /**
   * Consume una unidad RESERVADA al cerrar la OT (salida DEFINITIVA del inventario).
   * reservado → consumido. Registra un MovimientoStock 'consumo' (destino consumo_ot con
   * el N° de OT), NO 'egreso': lo que sale por la OT es consumo definitivo — el egreso se
   * reserva para lo que puede volver (remito, asignación a ingeniero). Decisión 2026-07-23.
   * 'consumido' está fuera del whitelist de ATP (deja de contar como comprometido). Conserva
   * los campos reservadoPara* como traza. Validación atómica: solo si está 'reservado'.
   */
  async entregar(params: {
    unidadId: string;
    unidad: UnidadStock;
    otNumber: string;
    motivo: string;
    solicitadoPorNombre: string;
    clienteId?: string | null;
    clienteNombre?: string | null;
  }): Promise<void> {
    const now = Timestamp.now();
    const movId = crypto.randomUUID();
    const unidadRef = docRef('unidades', params.unidadId);
    const movRef = doc(db, 'movimientosStock', movId);

    await runTransaction(db, async (tx) => {
      const unidadSnap = await tx.get(unidadRef);
      if (!unidadSnap.exists()) {
        throw new Error(`Unidad ${params.unidadId} no encontrada`);
      }
      const data = unidadSnap.data();
      if (data.estado !== 'reservado') {
        throw new Error(
          `Unidad no entregable — estado actual '${data.estado}' (esperaba 'reservado')`,
        );
      }

      const unitPayload = deepCleanForFirestore({
        estado: 'consumido' as EstadoUnidad,
        ...getUpdateTrace(),
        updatedAt: now.toDate().toISOString(),
      });

      const movPayload = deepCleanForFirestore({
        tipo: 'consumo' as TipoMovimiento,
        subtipo: 'cierre_ot' as const,
        unidadId: params.unidadId,
        articuloId: params.unidad.articuloId,
        articuloCodigo: params.unidad.articuloCodigo,
        articuloDescripcion: params.unidad.articuloDescripcion,
        // Cantidad real del doc (un lote puede representar N unidades) — leída en-tx.
        cantidad: data.cantidad ?? 1,
        origenTipo: params.unidad.ubicacion.tipo as TipoOrigenDestino,
        origenId: params.unidad.ubicacion.referenciaId,
        origenNombre: params.unidad.ubicacion.referenciaNombre,
        destinoTipo: 'consumo_ot' as TipoOrigenDestino,
        destinoId: params.otNumber,
        // Destino visible = cliente de la OT (el N° de OT ya vive en su propia columna/link).
        destinoNombre: params.clienteNombre || `OT ${params.otNumber}`,
        otNumber: params.otNumber,
        // Denormalizado para filtrar Movimientos por cliente sin join a la OT.
        clienteId: params.clienteId ?? null,
        clienteNombre: params.clienteNombre ?? null,
        motivo: params.motivo,
        creadoPor: params.solicitadoPorNombre,
        ...getCreateTrace(),
        createdAt: now,
      });

      tx.update(unidadRef, unitPayload);
      tx.set(movRef, movPayload);
    });

    logAudit({ action: 'update', collection: 'unidades_stock', documentId: params.unidadId });
  },

  // `entregarPorPresupuesto` se ELIMINÓ el 2026-09-01. Entregaba de una todas
  // las unidades reservadas de un presupuesto al cerrar su última OT, sin que
  // nadie las eligiera. La reserva dice qué se pensaba usar, no qué se usó: en
  // la práctica el cierre descontaba material que había quedado sin usar, o
  // material de otro presupuesto. Hoy el único camino de consumo es la selección
  // manual del cierre (`entregarSeleccionesCierre`). No reponerla.

  /**
   * Concilia el caso "la parte presupuestada salió del minikit" (UAT 2026-07-23):
   * cuando el ingeniero instala una parte de su kit, la unidad reservada en estante no
   * es la que se usa — es la que REPONE el kit. Netea a −1 sin dejar unidades fantasma:
   *
   *  1. Consume la unidad del kit (`unidadKit`, disponible en ubicación minikit) → egreso
   *     atado a la OT/cliente. Es la baja real (−1 del ATP).
   *  2. Si se pasa `reservaUnidadId`, la unidad reservada (RESERVAS) se libera CON destino
   *     el minikit → entra al kit como disponible y se cierran los `reservadoPara*`. Es una
   *     relocación (0 neto), no un segundo egreso: al dejar de estar 'reservado', el cierre
   *     de la OT ya no la entrega (sin doble descuento).
   *
   * Orden deliberado: primero el consumo (la baja importante). Si el paso 2 falla, el kit
   * queda corto pero la contabilidad es correcta — se repone a mano. Devuelve qué pasó.
   */
  async saldarConsumoMinikit(params: {
    unidadKit: UnidadStock;
    minikitId: string;
    minikitNombre: string;
    otNumber?: string | null;
    clienteId?: string | null;
    clienteNombre?: string | null;
    reservaUnidad?: UnidadStock | null;
    solicitadoPorNombre: string;
  }): Promise<{ consumida: boolean; reservaSaldada: boolean; error?: string }> {
    const ot = params.otNumber || '';
    await this.deducirUnidadDisponible({
      unidad: params.unidadKit,
      aDeducir: params.unidadKit.cantidad ?? 1,
      otNumber: ot,
      clienteId: params.clienteId ?? null,
      clienteNombre: params.clienteNombre ?? null,
      motivo: ot
        ? `Consumo de minikit ${params.minikitNombre} en OT ${ot}`
        : `Consumo de minikit ${params.minikitNombre}`,
      solicitadoPorNombre: params.solicitadoPorNombre,
    });

    if (!params.reservaUnidad) return { consumida: true, reservaSaldada: false };

    try {
      await this.liberar({
        unidadId: params.reservaUnidad.id,
        unidad: params.reservaUnidad,
        motivo: `Saldo de reserva ${params.reservaUnidad.reservadoParaPresupuestoNumero ?? ''} — repone minikit ${params.minikitNombre} tras consumo${ot ? ` (OT ${ot})` : ''}`.trim(),
        solicitadoPorNombre: params.solicitadoPorNombre,
        destino: { tipo: 'minikit', referenciaId: params.minikitId, referenciaNombre: params.minikitNombre },
      });
      return { consumida: true, reservaSaldada: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo saldar la reserva';
      console.error('[saldarConsumoMinikit] consumo OK pero reserva no saldada:', err);
      return { consumida: true, reservaSaldada: false, error: msg };
    }
  },

  /**
   * Descuenta `aDeducir` unidades de un doc DISPONIBLE al cerrar la OT (o al consumir del
   * minikit). Es CONSUMO definitivo, no egreso: registra un MovimientoStock 'consumo'
   * (subtipo 'cierre_ot', destino consumo_ot con el N° de OT). El egreso se reserva para lo
   * que puede volver (remito, asignación). Decisión 2026-07-23.
   * - aDeducir >= cantidad del doc → el doc pasa a 'consumido' (sale del ATP).
   * - aDeducir < cantidad (lote/bulk) → decrementa `cantidad` del doc.
   * Validación atómica: solo toca 'disponible' (no choca con el camino reservado→consumido).
   */
  async deducirUnidadDisponible(params: {
    unidad: UnidadStock;
    aDeducir: number;
    otNumber: string;
    clienteId?: string | null;
    clienteNombre?: string | null;
    motivo: string;
    solicitadoPorNombre: string;
  }): Promise<void> {
    const now = Timestamp.now();
    const movRef = doc(db, 'movimientosStock', crypto.randomUUID());
    const unidadRef = docRef('unidades', params.unidad.id);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(unidadRef);
      if (!snap.exists()) throw new Error(`Unidad ${params.unidad.id} no encontrada`);
      const data = snap.data();
      if (data.estado !== 'disponible') {
        throw new Error(`Unidad no descontable — estado '${data.estado}' (esperaba 'disponible')`);
      }
      const qtyActual = data.cantidad ?? 1;
      const total = params.aDeducir >= qtyActual;
      tx.update(unidadRef, deepCleanForFirestore(total
        ? { estado: 'consumido' as EstadoUnidad, ...getUpdateTrace(), updatedAt: now.toDate().toISOString() }
        : { cantidad: qtyActual - params.aDeducir, ...getUpdateTrace(), updatedAt: now.toDate().toISOString() }));

      tx.set(movRef, deepCleanForFirestore({
        tipo: 'consumo' as TipoMovimiento,
        subtipo: 'cierre_ot' as const,
        unidadId: params.unidad.id,
        articuloId: params.unidad.articuloId,
        articuloCodigo: params.unidad.articuloCodigo,
        articuloDescripcion: params.unidad.articuloDescripcion,
        cantidad: total ? qtyActual : params.aDeducir,
        origenTipo: params.unidad.ubicacion.tipo as TipoOrigenDestino,
        origenId: params.unidad.ubicacion.referenciaId,
        origenNombre: params.unidad.ubicacion.referenciaNombre,
        destinoTipo: 'consumo_ot' as TipoOrigenDestino,
        destinoId: params.otNumber,
        // Destino visible = cliente de la OT (el N° de OT vive en su columna/link).
        destinoNombre: params.clienteNombre || `OT ${params.otNumber}`,
        otNumber: params.otNumber,
        clienteId: params.clienteId ?? null,
        clienteNombre: params.clienteNombre ?? null,
        motivo: params.motivo,
        creadoPor: params.solicitadoPorNombre,
        ...getCreateTrace(),
        createdAt: now,
      }));
    });

    logAudit({ action: 'update', collection: 'unidades_stock', documentId: params.unidad.id });
  },

  /**
   * Deducción al cierre por una StockSelection (selección MANUAL, no por reserva):
   * - con `unidadStockId` (serie/lote) → descuenta esa unidad puntual.
   * - sin unidad pero con `articuloId` (no-serializado) → descuenta `cantidad` de las
   *   unidades disponibles del artículo en la posición elegida (`origenId`), FIFO.
   * Best-effort por unidad. Devuelve cuántas se descontaron efectivamente.
   */
  async entregarSeleccionCierre(params: {
    selection: StockSelection;
    otNumber: string;
    clienteId?: string | null;
    clienteNombre?: string | null;
    solicitadoPorNombre: string;
  }): Promise<{ deducidas: number }> {
    const sel = params.selection;

    // Origen = lote de patrón (activo). No es stock: descuenta la cantidad del lote
    // en la colección `patrones` y asienta un consumo trazable al N° de OT.
    if (sel.origenTipo === 'patron' && sel.patronId && sel.patronLote) {
      return this.consumirPatronLoteCierre({
        selection: sel,
        otNumber: params.otNumber,
        clienteId: params.clienteId ?? null,
        clienteNombre: params.clienteNombre ?? null,
        solicitadoPorNombre: params.solicitadoPorNombre,
      });
    }

    let candidatos: UnidadStock[] = [];
    if (sel.unidadStockId) {
      const snap = await getDoc(docRef('unidades', sel.unidadStockId));
      if (snap.exists()) candidatos = [{ id: snap.id, ...snap.data() } as UnidadStock];
    } else if (sel.articuloId) {
      const todas = await unidadesService.getByArticulo(sel.articuloId);
      candidatos = todas
        .filter(u => u.estado === 'disponible' && (!sel.origenId || u.ubicacion.referenciaId === sel.origenId))
        .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')); // FIFO
    }

    let restante = sel.cantidad ?? 1;
    let deducidas = 0;
    for (const u of candidatos) {
      if (restante <= 0) break;
      const aDeducir = Math.min(u.cantidad ?? 1, restante);
      try {
        await this.deducirUnidadDisponible({
          unidad: u, aDeducir, otNumber: params.otNumber,
          clienteId: params.clienteId, clienteNombre: params.clienteNombre,
          motivo: `Consumido al cerrar OT ${params.otNumber}`,
          solicitadoPorNombre: params.solicitadoPorNombre,
        });
        deducidas += aDeducir;
        restante -= aDeducir;
      } catch (err) {
        console.error(`[entregarSeleccionCierre] unidad ${u.id}:`, err);
      }
    }
    return { deducidas };
  },

  /**
   * Consumo al cierre de un LOTE de patrón (activo) elegido como origen. Decremente
   * atómicamente `cantidad` del lote en `patrones` (floor en 0; si el lote no trackea
   * cantidad se deja intacto) y asienta un MovimientoStock 'consumo' (subtipo 'cierre_ot',
   * destino consumo_ot con el N° de OT). NO usa `entidadTipo:'patron'` a propósito: ese
   * discriminador lo reserva el descuento BOM (patronesConsumirHelpers) para su idempotencia,
   * y este consumo por-lote es un camino distinto (no debe disparar el read-only del BOM).
   */
  async consumirPatronLoteCierre(params: {
    selection: StockSelection;
    otNumber: string;
    solicitadoPorNombre: string;
    clienteId?: string | null;
    clienteNombre?: string | null;
  }): Promise<{ deducidas: number }> {
    const sel = params.selection;
    if (!sel.patronId || !sel.patronLote) return { deducidas: 0 };
    const aDeducir = sel.cantidad ?? 1;
    const now = Timestamp.now();
    const movRef = doc(db, 'movimientosStock', crypto.randomUUID());
    const patronRef = docRef('patrones', sel.patronId);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(patronRef);
      if (!snap.exists()) throw new Error(`Patrón ${sel.patronId} no encontrado`);
      const data = snap.data() as { lotes?: PatronLote[] };
      const lotes = data.lotes ?? [];
      const idx = lotes.findIndex(l => l.lote === sel.patronLote);
      if (idx === -1) throw new Error(`Lote ${sel.patronLote} no encontrado en patrón ${sel.patronId}`);

      // Solo decrementamos si el lote trackea cantidad; si es null se consume sin restar saldo.
      if (typeof lotes[idx].cantidad === 'number') {
        const nuevosLotes = [...lotes];
        nuevosLotes[idx] = { ...lotes[idx], cantidad: Math.max(0, (lotes[idx].cantidad ?? 0) - aDeducir) };
        tx.update(patronRef, deepCleanForFirestore({
          lotes: nuevosLotes, ...getUpdateTrace(), updatedAt: now,
        }));
      }

      tx.set(movRef, deepCleanForFirestore({
        tipo: 'consumo' as TipoMovimiento,
        subtipo: 'cierre_ot' as const,
        patronId: sel.patronId,
        lote: sel.patronLote,
        articuloId: null,
        articuloCodigo: sel.partCodigo,
        articuloDescripcion: sel.partDescripcion,
        cantidad: aDeducir,
        origenTipo: 'patron' as TipoOrigenDestino,
        origenId: sel.patronId,
        origenNombre: sel.origenNombre || `Patrón ${sel.partCodigo} · Lote ${sel.patronLote}`,
        destinoTipo: 'consumo_ot' as TipoOrigenDestino,
        destinoId: params.otNumber,
        destinoNombre: params.clienteNombre || `OT ${params.otNumber}`,
        otNumber: params.otNumber,
        clienteId: params.clienteId ?? null,
        clienteNombre: params.clienteNombre ?? null,
        nroLote: sel.patronLote,
        motivo: `Consumido al cerrar OT ${params.otNumber} (patrón)`,
        creadoPor: params.solicitadoPorNombre,
        ...getCreateTrace(),
        createdAt: now,
      }));
    });

    logAudit({ action: 'update', collection: 'patrones', documentId: sel.patronId });
    return { deducidas: aDeducir };
  },

  /**
   * Orquesta la deducción de todas las selecciones de stock del cierre. Best-effort.
   *
   * Anti doble-descuento (auditoría I2): si se pasan `presupuestoIds` (pptos vinculados
   * a la OT que cierra), lo seleccionado manualmente que ya esté cubierto por RESERVAS
   * de esos pptos consume LA RESERVA en lugar de una unidad libre adicional:
   * - selección con `unidadStockId` cuya unidad está reservada para uno de esos pptos
   *   → se entrega ESA unidad reservada (reservado→entregado), no otra disponible.
   * - selección por artículo (no serializado) → de la cantidad pedida se resta lo que
   *   ya está reservado para los pptos; solo el excedente se deduce de 'disponible'.
   *   La porción reservada la entrega el camino de reservas (al cierre de la última
   *   OT del ppto — ver I1 en otService).
   * Criterio elegido: ante la ambigüedad de si la selección manual refiere a lo
   * reservado o a unidades extra, se asume que refiere a lo reservado — preferimos
   * sub-deducir (corregible con un ajuste) antes que duplicar el egreso.
   */
  async entregarSeleccionesCierre(params: {
    selections: StockSelection[];
    otNumber: string;
    clienteId?: string | null;
    clienteNombre?: string | null;
    solicitadoPorNombre: string;
    /** Pptos vinculados a la OT que cierra — habilita el dedupe contra reservas (I2). */
    presupuestoIds?: string[];
    /**
     * Motivos por los que una selección NO se pudo descontar (2026-08-19).
     * Antes se tragaban con un `console.error` y la OT cerraba "bien" con el
     * stock intacto: nadie se enteraba hasta el inventario. Ahora suben al
     * cierre y terminan en las notas.
     */
  }): Promise<{ deducidas: number; cubiertasPorReserva: number; fallos: string[] }> {
    // Pool de reservas de los pptos vinculados, para el dedupe I2. Best-effort: si la
    // lectura de un ppto falla, el dedupe queda parcial (peor caso = comportamiento previo).
    const unidadesReservadas = new Map<string, UnidadStock>();
    const poolPorArticulo = new Map<string, number>();
    const fallos: string[] = [];
    for (const pid of params.presupuestoIds ?? []) {
      try {
        for (const u of await this.getByPresupuesto(pid)) {
          unidadesReservadas.set(u.id, u);
          poolPorArticulo.set(u.articuloId, (poolPorArticulo.get(u.articuloId) ?? 0) + (u.cantidad ?? 1));
        }
      } catch (err) {
        console.warn(`[entregarSeleccionesCierre] reservas del ppto ${pid} ilegibles (dedupe I2 parcial):`, err);
      }
    }

    let deducidas = 0;
    let cubiertasPorReserva = 0;
    for (const selection of params.selections) {
      // Caso 0a — origen ASIGNACIÓN en campo (2026-08-27): el material está en
      // poder de un ingeniero; se consume vía la asignación, que deja TODO
      // consistente de una: cantidadConsumida + OT en el ítem, unidad →
      // consumido, línea del remito interno resuelta y movimiento en el kardex.
      if (selection.origenTipo === 'ingeniero' && selection.asignacionId && selection.asignacionItemId) {
        try {
          const { asignacionesService } = await import('./firebaseService');
          await asignacionesService.consumirItems(selection.asignacionId, [{
            itemId: selection.asignacionItemId,
            cantidad: selection.cantidad ?? 1,
            otNumber: params.otNumber,
          }]);
          deducidas += selection.cantidad ?? 1;
        } catch (err) {
          const motivo = err instanceof Error ? err.message : String(err);
          console.error(`[entregarSeleccionesCierre] consumo desde asignación ${selection.asignacionId} falló:`, err);
          fallos.push(`${selection.partCodigo ?? 'item'} desde asignación (${selection.origenNombre}): ${motivo}`);
        }
        continue;
      }

      // Caso 0 — origen REMITO en campo (2026-08-04): el material ya salió con un
      // remito de salida; se consume desde el remito (que se resuelve/cierra solo
      // si no le quedan items pendientes) en vez de descontar del depósito.
      if (selection.origenTipo === 'remito' && selection.remitoId && selection.remitoItemId) {
        try {
          deducidas += await consumirSeleccionDesdeRemito({
            selection,
            otNumber: params.otNumber,
            solicitadoPorNombre: params.solicitadoPorNombre,
          });
        } catch (err) {
          const motivo = err instanceof Error ? err.message : String(err);
          console.error(`[entregarSeleccionesCierre] consumo desde remito ${selection.remitoNumero ?? selection.remitoId} falló:`, err);
          fallos.push(`${selection.partCodigo ?? 'item'} desde remito ${selection.remitoNumero ?? selection.remitoId}: ${motivo}`);
        }
        continue;
      }

      // Caso 1 — unidad puntual (serie/lote) que está RESERVADA para un ppto de esta OT:
      // consumir la reserva. Sin esto, deducirUnidadDisponible fallaba (estado 'reservado')
      // y la intención del admin ("esta unidad salió con esta OT") se perdía.
      const reservada = selection.unidadStockId ? unidadesReservadas.get(selection.unidadStockId) : undefined;
      if (reservada) {
        try {
          await this.entregar({
            unidadId: reservada.id,
            unidad: reservada,
            otNumber: params.otNumber,
            motivo: `Consumido al cerrar OT ${params.otNumber} (selección de unidad reservada)`,
            solicitadoPorNombre: params.solicitadoPorNombre,
            clienteId: params.clienteId ?? null,
            clienteNombre: params.clienteNombre ?? null,
          });
          const qty = reservada.cantidad ?? 1;
          deducidas += qty;
          poolPorArticulo.set(reservada.articuloId, Math.max(0, (poolPorArticulo.get(reservada.articuloId) ?? 0) - qty));
          unidadesReservadas.delete(reservada.id);
        } catch (err) {
          console.error(`[entregarSeleccionesCierre] reserva ${reservada.id} no entregada:`, err);
        }
        continue;
      }

      // Caso 2 — selección por artículo: restar del pedido lo ya reservado por los pptos.
      let sel = selection;
      if (!selection.unidadStockId && selection.articuloId) {
        const pool = poolPorArticulo.get(selection.articuloId) ?? 0;
        const cubiertas = Math.min(selection.cantidad ?? 1, pool);
        if (cubiertas > 0) {
          poolPorArticulo.set(selection.articuloId, pool - cubiertas);
          cubiertasPorReserva += cubiertas;
          const restante = (selection.cantidad ?? 1) - cubiertas;
          console.log(`[entregarSeleccionesCierre] ${selection.partCodigo}: ${cubiertas} u. ya reservadas por ppto vinculado — se deducen solo ${restante} adicionales`);
          if (restante <= 0) continue;
          sel = { ...selection, cantidad: restante };
        }
      }

      const r = await this.entregarSeleccionCierre({
        selection: sel,
        otNumber: params.otNumber,
        clienteId: params.clienteId,
        clienteNombre: params.clienteNombre,
        solicitadoPorNombre: params.solicitadoPorNombre,
      });
      deducidas += r.deducidas;
      // Fallo VISIBLE también para posición/patrón (2026-08-28, caso 29960.01):
      // asignación y remito ya reportaban; este camino se quedaba mudo y la OT
      // cerraba "bien" con el stock intacto.
      const pedidas = sel.cantidad ?? 1;
      if (r.deducidas < pedidas) {
        fallos.push(`${selection.partCodigo ?? 'item'}: ${pedidas - r.deducidas} u. sin descontar — sin disponible en ${selection.origenNombre || 'la ubicación elegida'}`);
      }
    }
    return { deducidas, cubiertasPorReserva, fallos };
  },

  /**
   * Unidades todavía RESERVADAS para los presupuestos dados (por número), para
   * que el cierre MUESTRE qué va a entregar el camino automático de reservas
   * (pedido 2026-08-31: "que se vea siempre de dónde se consume"). Las filas
   * sin serie se agrupan por artículo+ubicación+ppto sumando cantidad.
   */
  async reservadasPorNumeros(numeros: string[]): Promise<ReservaVisibleCierre[]> {
    const limpios = [...new Set(numeros.filter(Boolean))];
    if (limpios.length === 0) return [];
    const porClave = new Map<string, ReservaVisibleCierre>();
    for (let i = 0; i < limpios.length; i += 10) {
      const pSnap = await getDocs(query(
        collection(db, 'presupuestos'),
        where('numero', 'in', limpios.slice(i, i + 10)),
      ));
      for (const p of pSnap.docs) {
        const uSnap = await getDocs(query(
          collection(db, 'unidades'),
          where('reservadoParaPresupuestoId', '==', p.id),
          where('estado', '==', 'reservado'),
        ));
        for (const d of uSnap.docs) {
          const u = d.data();
          if (u.activo === false) continue;
          const fila: ReservaVisibleCierre = {
            presupuestoNumero: (p.data().numero as string) ?? p.id,
            articuloCodigo: (u.articuloCodigo as string) ?? '',
            articuloDescripcion: (u.articuloDescripcion as string) ?? '',
            cantidad: (u.cantidad as number) ?? 1,
            ubicacionNombre: (u.ubicacion?.referenciaNombre as string) ?? '',
            nroSerie: (u.nroSerie as string | null) ?? null,
            nroLote: (u.nroLote as string | null) ?? null,
            unidadIds: [d.id],
          };
          // Serie identifica pieza única → fila propia. Sin serie, se agrupa.
          const clave = fila.nroSerie
            ? `s:${d.id}`
            : `${fila.presupuestoNumero}|${fila.articuloCodigo}|${fila.nroLote ?? ''}|${fila.ubicacionNombre}`;
          const previa = porClave.get(clave);
          if (previa) { previa.cantidad += fila.cantidad; previa.unidadIds.push(d.id); }
          else porClave.set(clave, fila);
        }
      }
    }
    return [...porClave.values()];
  },

  /**
   * Libera un grupo de unidades reservadas desde el cierre de la OT
   * (2026-09-01). Al sacarse el consumo automático, el administrativo que ve en
   * el cierre que una reserva no se usó es el que mejor puede soltarla, y en el
   * momento en que se da cuenta. Best-effort por unidad: si una ya cambió de
   * estado se saltea y se informa, sin frenar a las demás.
   */
  async liberarVarias(params: {
    unidadIds: string[];
    motivo: string;
    solicitadoPorNombre: string;
  }): Promise<{ liberadas: number; fallos: string[] }> {
    let liberadas = 0;
    const fallos: string[] = [];
    for (const unidadId of params.unidadIds) {
      try {
        const snap = await getDoc(doc(db, 'unidades', unidadId));
        if (!snap.exists()) { fallos.push(`${unidadId}: la unidad ya no existe`); continue; }
        const unidad = { id: snap.id, ...snap.data() } as UnidadStock;
        await this.liberar({
          unidadId,
          unidad,
          motivo: params.motivo,
          solicitadoPorNombre: params.solicitadoPorNombre,
        });
        liberadas += unidad.cantidad ?? 1;
      } catch (err) {
        fallos.push(`${unidadId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return { liberadas, fallos };
  },

  /**
   * Unidades de stock que un presupuesto todavía ADEUDA al cliente:
   * suma de items con `stockArticuloId` − (reservadas + entregadas) para ese ppto.
   * Usado por el cierre de OT (auditoría B5) para dejar rastro visible cuando la
   * deducción dio 0 con items de stock pendientes (ej. mercadería aún no ingresada).
   */
  async pendienteDeEntrega(presupuestoId: string): Promise<number> {
    const { presupuestosService } = await import('./presupuestosService');
    const pres = await presupuestosService.getById(presupuestoId).catch(() => null);
    if (!pres) return 0;
    const necesariasPorArt = new Map<string, number>();
    for (const i of pres.items ?? []) {
      if (!i.stockArticuloId) continue;
      necesariasPorArt.set(i.stockArticuloId, (necesariasPorArt.get(i.stockArticuloId) ?? 0) + (i.cantidad || 0));
    }
    if (necesariasPorArt.size === 0) return 0;
    const snap = await getDocs(query(
      collection(db, 'unidades'),
      where('reservadoParaPresupuestoId', '==', presupuestoId),
    ));
    const cubiertasPorArt = new Map<string, number>();
    snap.docs
      .map(d => d.data())
      // 'consumido' también cubre (2026-08-31, caso 30236.01): el camino B del
      // cierre deja las reservas entregadas en 'consumido', y sin contarlas la
      // nota [stock] reportaba como adeudado lo que se acababa de entregar.
      .filter(u => u.estado === 'reservado' || u.estado === 'entregado' || u.estado === 'consumido')
      .forEach(u => cubiertasPorArt.set(u.articuloId, (cubiertasPorArt.get(u.articuloId) ?? 0) + (u.cantidad ?? 1)));
    let pendiente = 0;
    for (const [art, nec] of necesariasPorArt) {
      pendiente += Math.max(0, nec - (cubiertasPorArt.get(art) ?? 0));
    }
    return pendiente;
  },
};

/**
 * Consumo de una selección del cierre cuyo origen es un REMITO en campo
 * (2026-08-04, "descargar desde la posición Remito N° xxx"): descuenta del item
 * del remito — vía asignacionesService si el remito nació de una asignación
 * (mantiene también el comprobante), o vía el stock aplicado si es un remito
 * manual — y los servicios cierran el remito solo si no le quedan items
 * pendientes. Devuelve la cantidad consumida. Imports dinámicos para no crear
 * ciclos con el barrel firebaseService.
 */
async function consumirSeleccionDesdeRemito(params: {
  selection: StockSelection;
  otNumber: string;
  solicitadoPorNombre: string;
}): Promise<number> {
  const { selection } = params;
  const remito = await remitosService.getById(selection.remitoId!);
  if (!remito) throw new Error(`Remito ${selection.remitoNumero ?? selection.remitoId} no encontrado`);
  const item = remito.items.find(i => i.id === selection.remitoItemId);
  if (!item) throw new Error(`El item seleccionado ya no está en el remito ${remito.numero}`);
  if (item.devuelto || item.consumido) throw new Error(`El item del remito ${remito.numero} ya está resuelto`);
  const pendiente = item.cantidad - (item.cantidadConsumida ?? 0);
  const consumir = Math.min(selection.cantidad ?? 1, pendiente);
  if (consumir <= 0) return 0;

  // Vínculo con la asignación: por id si el item lo tiene, y si no —remitos
  // viejos que nunca lo estamparon— buscándola por la unidad (2026-08-19).
  //
  // Sin este fallback el item caía al camino de STOCK, que exige la unidad
  // 'disponible' o 'reservado'. Pero una unidad que salió por asignaciones está
  // 'asignado', así que rebotaba siempre: el consumo fallaba, el error se
  // tragaba y la OT cerraba con el material todavía en poder del ingeniero
  // (caso REM-0037 / OT 30055.01).
  const { asignacionesService } = await import('./firebaseService');
  let asignacionId = item.asignacionId ?? null;
  if (!asignacionId && item.unidadId) {
    const todas = await asignacionesService.getAll().catch(() => []);
    // Con saldo pendiente: lo ya consumido o devuelto no sirve como origen.
    const encontrada = todas.find(a => (a.items ?? []).some(ai =>
      ai.unidadId === item.unidadId
      && ai.cantidad - (ai.cantidadConsumida ?? 0) - (ai.cantidadDevuelta ?? 0) > 0));
    if (encontrada) {
      asignacionId = encontrada.id;
      console.log(`[consumirSeleccionDesdeRemito] remito ${remito.numero}: item sin asignacionId, resuelto por unidad → ${encontrada.id}`);
    }
  }

  if (asignacionId) {
    const asg = await asignacionesService.getById(asignacionId);
    if (!asg) throw new Error(`La asignación del remito ${remito.numero} ya no existe`);
    const ai = (item.asignacionItemId ? asg.items.find(a => a.id === item.asignacionItemId) : undefined)
      ?? asg.items.find(a =>
        (item.unidadId && a.unidadId === item.unidadId)
        || (item.instrumentoId && a.instrumentoId === item.instrumentoId)
        || (item.minikitId && a.minikitId === item.minikitId)
        || (item.dispositivoId && a.dispositivoId === item.dispositivoId));
    if (!ai) throw new Error(`No se pudo vincular el item del remito ${remito.numero} con su asignación`);
    await asignacionesService.consumirItems(asg.id, [{ itemId: ai.id, cantidad: consumir, otNumber: params.otNumber }]);
  } else {
    const { movimientosAplicarService } = await import('./movimientosAplicar');
    await movimientosAplicarService.descargarItemsStockRemito({
      remito,
      resoluciones: [{ itemId: item.id, consumir, devolverResto: false }],
      otNumber: params.otNumber,
      creadoPor: params.solicitadoPorNombre,
    });
  }
  return consumir;
}
