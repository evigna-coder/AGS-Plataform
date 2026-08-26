import { Timestamp } from 'firebase/firestore';
import type { Articulo, TipoMovimiento, TipoOrigenDestino, UbicacionStock } from '@ags/shared';
import {
  createBatch, docRef, batchAudit, deepCleanForFirestore,
  getCreateTrace, getUpdateTrace, logBusinessEvent,
} from './firebase';
import { unidadesService } from './stockService';

/**
 * Kits de compra 1→N (2026-08-25; diseño lockeado 2026-07-29, caso G1312-68730 /
 * G1313-68709).
 *
 * El kit es un artículo REAL de stock: la OC, la recepción, el costeo y la
 * reserva no saben nada de kits. La explosión en componentes es esta acción
 * manual — el análogo de `equivalenciasService.desagregarUnidades` pero 1→N
 * artículos distintos, no una conversión de código.
 *
 * Decisiones lockeadas:
 * - SIN prorrateo de costo: el costo/importación queda en las unidades kit
 *   consumidas; los componentes nacen con `costoUnitario: null`.
 * - Componentes sin serie/lote: nace UNA unidad agrupada por componente
 *   (cantidad = cantidadPorKit × kits), en la MISMA ubicación del kit.
 * - Validar todo ANTES de escribir; el batch es atómico (patrón
 *   patronesConsumirHelpers). 1 MovimientoStock por componente + 1 por el kit.
 */
export const kitsService = {
  async explotarKit(params: {
    articuloKit: Articulo;
    /** Cuántos kits explotar (unidades del artículo kit a consumir). */
    cantidadKits: number;
    /** Ubicación de la que salen los kits — y donde nacen los componentes. */
    ubicacion: UbicacionStock;
    solicitadoPorNombre: string;
  }): Promise<{ kitsConsumidos: number; componentesCreados: number }> {
    const kit = params.articuloKit;
    const bom = (kit.kitComponentes ?? []).filter(c => c.articuloId && (c.cantidadPorKit ?? 0) > 0);
    if (bom.length === 0) throw new Error(`El artículo ${kit.codigo} no tiene componentes de kit cargados`);
    if (!Number.isInteger(params.cantidadKits) || params.cantidadKits < 1) {
      throw new Error('La cantidad de kits debe ser un entero mayor a 0');
    }

    // ── Validar TODO antes de escribir ──
    const todas = await unidadesService.getByArticulo(kit.id);
    const candidatas = todas
      .filter(u => u.estado === 'disponible' && u.activo !== false
        && u.ubicacion.referenciaId === params.ubicacion.referenciaId)
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')); // FIFO
    const disponibles = candidatas.reduce((s, u) => s + (u.cantidad ?? 1), 0);
    if (disponibles < params.cantidadKits) {
      throw new Error(`Stock insuficiente del kit en ${params.ubicacion.referenciaNombre}: ${disponibles} disponible(s), ${params.cantidadKits} pedido(s)`);
    }

    const now = Timestamp.now();
    const nowIso = now.toDate().toISOString();
    const batch = createBatch();

    // ── Consumir las unidades kit (FIFO; doc completo → 'consumido', parcial → decrementa) ──
    let restante = params.cantidadKits;
    for (const u of candidatas) {
      if (restante <= 0) break;
      const qty = u.cantidad ?? 1;
      const aDeducir = Math.min(qty, restante);
      batch.update(docRef('unidades', u.id), deepCleanForFirestore(aDeducir >= qty
        ? { estado: 'consumido', ...getUpdateTrace(), updatedAt: nowIso }
        : { cantidad: qty - aDeducir, ...getUpdateTrace(), updatedAt: nowIso }));
      batchAudit(batch, {
        action: 'update', collection: 'unidades_stock', documentId: u.id,
        after: { accion: 'explosion_kit', kit: kit.codigo, aDeducir },
      });
      restante -= aDeducir;
    }

    // Movimiento del kit consumido.
    batch.set(docRef('movimientosStock', crypto.randomUUID()), deepCleanForFirestore({
      tipo: 'transferencia' as TipoMovimiento,
      subtipo: 'explosion_kit' as const,
      articuloId: kit.id,
      articuloCodigo: kit.codigo,
      articuloDescripcion: kit.descripcion,
      cantidad: params.cantidadKits,
      origenTipo: params.ubicacion.tipo as TipoOrigenDestino,
      origenId: params.ubicacion.referenciaId,
      origenNombre: params.ubicacion.referenciaNombre,
      destinoTipo: params.ubicacion.tipo as TipoOrigenDestino,
      destinoId: params.ubicacion.referenciaId,
      destinoNombre: params.ubicacion.referenciaNombre,
      motivo: `Explosión de ${params.cantidadKits} kit(s) ${kit.codigo} en ${bom.length} componente(s)`,
      creadoPor: params.solicitadoPorNombre,
      ...getCreateTrace(),
      createdAt: now,
    }));

    // ── Alta de componentes: una unidad agrupada + un movimiento por componente ──
    let componentesCreados = 0;
    for (const c of bom) {
      const cantidadTotal = c.cantidadPorKit * params.cantidadKits;
      const unidadId = crypto.randomUUID();
      const unidadPayload = deepCleanForFirestore({
        articuloId: c.articuloId,
        articuloCodigo: c.articuloCodigo,
        articuloDescripcion: c.articuloDescripcion,
        nroSerie: null,
        nroLote: null,
        cantidad: cantidadTotal,
        condicion: 'nuevo' as const,
        estado: 'disponible' as const,
        ubicacion: params.ubicacion,
        // Decisión lockeada: sin prorrateo — el costo queda en el kit consumido.
        costoUnitario: null,
        observaciones: `Alta por explosión de kit ${kit.codigo}`,
        activo: true,
        ...getCreateTrace(),
        createdAt: now,
        updatedAt: now,
      });
      batch.set(docRef('unidades', unidadId), unidadPayload);
      batchAudit(batch, { action: 'create', collection: 'unidades_stock', documentId: unidadId, after: unidadPayload });

      batch.set(docRef('movimientosStock', crypto.randomUUID()), deepCleanForFirestore({
        tipo: 'ingreso' as TipoMovimiento,
        subtipo: 'explosion_kit' as const,
        unidadId,
        articuloId: c.articuloId,
        articuloCodigo: c.articuloCodigo,
        articuloDescripcion: c.articuloDescripcion,
        cantidad: cantidadTotal,
        origenTipo: params.ubicacion.tipo as TipoOrigenDestino,
        origenId: params.ubicacion.referenciaId,
        origenNombre: `Kit ${kit.codigo}`,
        destinoTipo: params.ubicacion.tipo as TipoOrigenDestino,
        destinoId: params.ubicacion.referenciaId,
        destinoNombre: params.ubicacion.referenciaNombre,
        motivo: `Ingreso por explosión de kit ${kit.codigo} (${c.cantidadPorKit} × ${params.cantidadKits} kit(s))`,
        creadoPor: params.solicitadoPorNombre,
        ...getCreateTrace(),
        createdAt: now,
      }));
      componentesCreados += cantidadTotal;
    }

    await batch.commit();

    logBusinessEvent({
      eventName: 'kit.explotado',
      collection: 'unidades',
      documentId: kit.id,
      details: {
        kit: kit.codigo,
        kits: params.cantidadKits,
        ubicacion: params.ubicacion.referenciaNombre,
        componentes: bom.map(c => `${c.articuloCodigo} ×${c.cantidadPorKit * params.cantidadKits}`),
      },
    });
    return { kitsConsumidos: params.cantidadKits, componentesCreados };
  },
};
