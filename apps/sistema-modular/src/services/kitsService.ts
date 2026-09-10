import { Timestamp } from 'firebase/firestore';
import type { Articulo, TipoMovimiento, TipoOrigenDestino, UbicacionStock } from '@ags/shared';
import {
  createBatch, docRef, batchAudit, deepCleanForFirestore,
  getCreateTrace, getUpdateTrace, logBusinessEvent,
} from './firebase';
import { unidadesService } from './stockService';
import { costeoKitConsumido, participacionEfectiva, validarParticipacion, costoComponente } from '../utils/kitProrrateo';

/**
 * Kits de compra 1→N (2026-08-25; diseño lockeado 2026-07-29, caso G1312-68730 /
 * G1313-68709).
 *
 * El kit es un artículo REAL de stock: la OC, la recepción, el costeo y la
 * reserva no saben nada de kits. La explosión en componentes es esta acción
 * manual — el análogo de `equivalenciasService.desagregarUnidades` pero 1→N
 * artículos distintos, no una conversión de código.
 *
 * Decisiones:
 * - Costo y factor (2026-09-10, reemplaza el "sin prorrateo" de julio): el
 *   FACTOR se hereda del kit consumido (propiedad del embarque) y el VALOR se
 *   reparte por `participacionPct` — la suma de los componentes es lo que costó
 *   el kit. Ver utils/kitProrrateo.ts. Los componentes quedan vinculados a la
 *   importación del kit (`importacionNumero` + `origenKit`) para que la
 *   confirmación del costeo definitivo también los re-estampe.
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
    const bomCrudo = (kit.kitComponentes ?? []).filter(c => c.articuloId && (c.cantidadPorKit ?? 0) > 0);
    if (bomCrudo.length === 0) throw new Error(`El artículo ${kit.codigo} no tiene componentes de kit cargados`);
    const validez = validarParticipacion(bomCrudo);
    if (!validez.ok) throw new Error(`${validez.motivo} Corregí los componentes del kit desde la ficha del artículo.`);
    const bom = participacionEfectiva(bomCrudo);
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
    const consumos: Array<[typeof candidatas[number], number]> = [];
    for (const u of candidatas) {
      if (restante <= 0) break;
      const qty = u.cantidad ?? 1;
      const aDeducir = Math.min(qty, restante);
      consumos.push([u, aDeducir]);
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
    // Costo y factor del kit que sale, ponderados por lo que se toma de cada
    // unidad; el componente hereda el factor y recibe su parte del valor.
    const costeo = costeoKitConsumido(consumos);
    let componentesCreados = 0;
    for (const c of bom) {
      const cantidadTotal = c.cantidadPorKit * params.cantidadKits;
      const unidadId = crypto.randomUUID();
      const pct = c.participacionPct ?? 0;
      const costoUnitario = costoComponente(costeo.costoUnitario, pct, c.cantidadPorKit);
      const costoUnitarioReal = costoComponente(costeo.costoUnitarioReal, pct, c.cantidadPorKit);
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
        costoUnitario,
        costoUnitarioReal,
        monedaCosto: costoUnitario != null ? costeo.monedaCosto : null,
        factorImportacion: costeo.factorImportacion,
        factorImportacionReal: costeo.factorImportacionReal,
        costeoConfirmadoAt: costoUnitarioReal != null ? costeo.costeoConfirmadoAt : null,
        importacionNumero: costeo.importacionNumero,
        origenKit: { articuloId: kit.id, articuloCodigo: kit.codigo, participacionPct: pct, cantidadPorKit: c.cantidadPorKit },
        observaciones: `Alta por explosión de kit ${kit.codigo} (${pct}% del valor)`,
        activo: true,
        ...getCreateTrace(),
        createdAt: now,
        updatedAt: now,
      });
      batch.set(docRef('unidades', unidadId), unidadPayload);
      batchAudit(batch, { action: 'create', collection: 'unidades_stock', documentId: unidadId, after: unidadPayload });
      // Última referencia del artículo componente (last-wins, como el ingreso de
      // importación): con esto el presupuesto y la reposición tienen número.
      if (costoUnitario != null) {
        batch.update(docRef('articulos', c.articuloId), deepCleanForFirestore({
          ultimoCostoImportacion: costoUnitarioReal ?? costoUnitario,
          ultimoFactorImportacion: costeo.factorImportacionReal ?? costeo.factorImportacion ?? null,
          ultimoCostoMoneda: costeo.monedaCosto ?? 'USD',
          ...getUpdateTrace(),
          updatedAt: nowIso,
        }));
      }

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
        componentes: bom.map(c => `${c.articuloCodigo} ×${c.cantidadPorKit * params.cantidadKits} (${c.participacionPct ?? 0}%)`),
        costoKit: costeo.costoUnitario, factorKit: costeo.factorImportacion, moneda: costeo.monedaCosto,
      },
    });
    return { kitsConsumidos: params.cantidadKits, componentesCreados };
  },
};
