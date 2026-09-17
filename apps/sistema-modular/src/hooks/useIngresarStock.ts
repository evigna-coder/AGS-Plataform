import { useState } from 'react';
import { requerimientosDeItem } from '../utils/conciliarRequerimientosOC';
import { Timestamp } from 'firebase/firestore';
import type { Importacion, ItemImportacion, Articulo, PresentacionUsada } from '@ags/shared';
import { factorDeItem, pendienteDeItem } from '../utils/importacionRecepcion';
import { resolverItemsImportacion } from '../utils/resolverItemsImportacion';
import {
  createBatch,
  docRef,
  batchAudit,
  deepCleanForFirestore,
  getCreateTrace,
  getUpdateTrace,
  getCurrentUserTrace,
} from '../services/firebase';
import { articulosService } from '../services/firebaseService';
import { importacionesService } from '../services/importacionesService';
import { computeCosteoImportacion } from '../utils/costeoImportacion';

export interface RecepcionItem {
  item: ItemImportacion;
  posicionId: string;
  posicionNombre: string;
  nrosSerie: string[];     // one per unit; empty array if no serial required
  /** Cantidad recibida EN EL ENVASE `presentacion` (null = unidad base). */
  cantidadReal: number;
  /** Envase con el que se recibe (2026-09-16); puede no ser el de la OC. El stock entra en unidades base. */
  presentacion?: PresentacionUsada | null;
  nroLote?: string | null; // si el artículo se maneja por lote
}

/**
 * Envase en que está expresada la línea de la OC para esta recepción. Si el
 * ítem ya trae envase, ese. Si no lo trae y el usuario recibe con uno, se mira
 * la cantidad: coincide con lo pendiente en envases y no en unidades base →
 * la OC estaba en ese envase (precio por envase, recibido 1 = pedido 1).
 */
export function interpretarEnvaseOC(rec: RecepcionItem): { factorItem: number; presentacionItem: PresentacionUsada | null } {
  const propio = rec.item.presentacion ?? null;
  if (propio || !rec.presentacion || !(rec.presentacion.factor > 1)) {
    return { factorItem: factorDeItem(rec.item), presentacionItem: propio };
  }
  const pend = pendienteDeItem(rec.item);
  const coincideEnBase = Math.abs(rec.cantidadReal * rec.presentacion.factor - pend) < 1e-6;
  const coincideEnEnvase = Math.abs(rec.cantidadReal - pend) < 1e-6;
  if (coincideEnEnvase && !coincideEnBase) return { factorItem: rec.presentacion.factor, presentacionItem: rec.presentacion };
  return { factorItem: 1, presentacionItem: null };
}

export function useIngresarStock() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ingresarStock = async (imp: Importacion, recepciones: RecepcionItem[]): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      // Releer la importación para acumular sobre lo ÚLTIMO persistido (protege
      // contra un modal abierto con datos viejos o dos pestañas — mitiga M9) y
      // rechazar el ingreso si la recepción ya quedó cerrada.
      const fresh = await importacionesService.getById(imp.id).catch(() => null);
      if (fresh?.stockIngresado) {
        setError('La recepción de esta importación ya está cerrada (ingresada o cerrada incompleta).');
        return false;
      }
      const itemsBase = fresh?.items ?? imp.items ?? [];
      const prevRecibidoByItemId = new Map(itemsBase.map(it => [it.id, it.cantidadRecibida ?? 0]));

      // Costeo completo del embarque (CIF + gravámenes + factor), en USD.
      // El costo por unidad = costoComputable de la línea / cantidad costeada (cantidadPedida).
      const monedaEmbarque = imp.items?.[0]?.moneda ?? 'USD';
      // Catálogo + OC para resolver artículo base y envase de cada ítem
      // (2026-09-16), igual que el modal: el costeo por línea necesita el
      // artículo BASE (posición arancelaria) aunque la OC haya usado el
      // N° de parte del envase.
      const { ordenesCompraService } = await import('../services/presupuestosService');
      const [catalogo, ocOrigen] = await Promise.all([
        articulosService.getAll().catch(() => [] as Articulo[]),
        imp.ordenCompraId ? ordenesCompraService.getById(imp.ordenCompraId).catch(() => null) : Promise.resolve(null),
      ]);
      const articulosById = new Map<string, Articulo>(catalogo.map(a => [a.id, a]));
      const itemsResueltos = resolverItemsImportacion(itemsBase, catalogo, ocOrigen?.items ?? null);
      const resueltoById = new Map(itemsResueltos.map(it => [it.id, it]));

      const costeo = computeCosteoImportacion({
        items: itemsResueltos,
        articulosById,
        gastos: imp.gastos ?? [],
        monedaBase: monedaEmbarque,
        fleteDeclarado: imp.fleteDeclarado ?? 0,
        seguroDeclarado: imp.seguroDeclarado ?? 0,
        monedaFlete: imp.monedaFleteDeclarado ?? null,
        monedaSeguro: imp.monedaSeguroDeclarado ?? null,
        tipoCambio: imp.tipoCambio ?? null,
        paseEurUsd: imp.paseEurUsd ?? null,
        // Sin esto un embarque courier se costeaba como régimen general al
        // ingresar (estadística + IIBB + financiero de percepciones que no
        // existen): las unidades quedaban ~9% sobrevaluadas vs el panel.
        esCourier: imp.esCourier ?? null,
        // Según despacho (2026-09-16): si están cargados, el factor que queda
        // en las unidades ya es el real.
        derechosDespacho: imp.derechosDespacho ?? null,
        estadisticaDespacho: imp.estadisticaDespacho ?? null,
      });
      const lineaByItemId = new Map(costeo.lineas.map(l => [l.itemId, l]));
      const nowIso = new Date().toISOString();
      // Último costo por artículo (denormalizado, last-wins) para escribir en el catálogo.
      const ultimoCostoByArticulo = new Map<string, { costo: number; factor: number }>();

      const batch = createBatch();
      const userTrace = getCurrentUserTrace();

      for (const rec of recepciones) {
        const linea = lineaByItemId.get(rec.item.id);
        // Presentaciones (2026-09-16): lo pedido está en el envase de la OC y lo
        // recibido en el envase elegido al ingresar; el stock y el costo van por
        // unidad BASE. Comprado 2 × kit(×1000), recibido 20 × caja(×100) = 2.000 u.
        const factorRec = rec.presentacion?.factor && rec.presentacion.factor > 0 ? rec.presentacion.factor : 1;
        // OC sin envase declarado (2026-09-17, caso JAS041): "1 × 5181-3376" con
        // el precio del pack de 1000. Si al recibir se elige un envase y la
        // cantidad tipeada coincide con lo pedido EN ENVASES (1 = 1) y no en
        // unidades base (10 ≠ 1), la OC estaba expresada en ese envase: el
        // precio de la línea es por envase y se divide por el factor. Antes el
        // costo por unidad base quedaba como el del pack entero.
        const { factorItem } = interpretarEnvaseOC(rec);
        const unidadesBase = Math.round(rec.cantidadReal * factorRec * 1000) / 1000;
        const recibidoEnEnvaseOC = Math.round((unidadesBase / factorItem) * 1000) / 1000;
        const cantBase = (rec.item.cantidadPedida || 0) * factorItem;
        const costoUnitario = linea && cantBase > 0
          ? linea.costoComputable / cantBase
          : (rec.item.precioUnitario ?? 0) / factorItem;
        const factorImportacion = linea?.factor ?? null;
        if (rec.item.articuloId) {
          ultimoCostoByArticulo.set(rec.item.articuloId, { costo: costoUnitario, factor: factorImportacion ?? 0 });
        }

        // Cómo se materializan las unidades físicas:
        //  - con series → un doc por serie (cantidad 1).
        //  - sin series pero con lote → un solo doc agrupado (cantidad = N).
        //  - sin trazabilidad → un doc por unidad (cantidad 1); si la cantidad
        //    tiene decimales (2026-09-04: 0,5 L de reactivo), un solo doc con
        //    esa cantidad — no hay "media unidad" que crear por separado.
        //  - por envase (factor > 1) → un solo doc con todas las unidades base
        //    (2026-09-16): 20 cajas de 100 son un doc de 2.000, no 2.000 docs.
        const loteId = rec.nroLote?.trim() || null;
        const unidadesACrear: { nroSerie: string | null; nroLote: string | null; cantidad: number }[] =
          rec.nrosSerie.length > 0
            ? rec.nrosSerie.map(s => ({ nroSerie: s, nroLote: loteId, cantidad: 1 }))
            : loteId || factorRec > 1 || !Number.isInteger(unidadesBase)
              ? [{ nroSerie: null, nroLote: loteId, cantidad: unidadesBase }]
              : Array.from({ length: unidadesBase }, () => ({ nroSerie: null, nroLote: null, cantidad: 1 }));

        for (const u of unidadesACrear) {
          const unidadId = crypto.randomUUID();
          const movId = crypto.randomUUID();

          // Descripción del ARTÍCULO base (2026-09-17): la del ítem es la del
          // envase de la OC ("5,000/pk") y contaminaba la fila del base.
          const artDesc = (rec.item.articuloId ? articulosById.get(rec.item.articuloId)?.descripcion : null) || rec.item.descripcion;
          const unidadPayload = deepCleanForFirestore({
            articuloId: rec.item.articuloId ?? '',
            articuloCodigo: rec.item.articuloCodigo ?? '',
            articuloDescripcion: artDesc,
            importacionItemId: rec.item.id,
            nroSerie: u.nroSerie,
            nroLote: u.nroLote,
            cantidad: u.cantidad,
            condicion: 'nuevo' as const,
            estado: 'disponible' as const,
            ubicacion: {
              tipo: 'posicion' as const,
              referenciaId: rec.posicionId,
              referenciaNombre: rec.posicionNombre,
            },
            costoUnitario,
            monedaCosto: 'USD' as const,
            factorImportacion,
            presentacion: rec.presentacion ?? null,
            importacionNumero: imp.numero,
            ordenCompraNumero: imp.ordenCompraNumero ?? null,
            despachoImportacionNumero: imp.despachoNumero ?? null,
            observaciones: `Ingreso por importación (OC ${imp.ordenCompraNumero})`,
            activo: true,
            ...getCreateTrace(),
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          });

          batch.set(docRef('unidades', unidadId), unidadPayload);
          batchAudit(batch, {
            action: 'create',
            collection: 'unidades_stock',
            documentId: unidadId,
            after: unidadPayload as Record<string, unknown>,
          });

          const movPayload = deepCleanForFirestore({
            tipo: 'ingreso' as const,
            unidadId,
            articuloId: rec.item.articuloId ?? '',
            articuloCodigo: rec.item.articuloCodigo ?? '',
            articuloDescripcion: artDesc,
            cantidad: u.cantidad,
            nroSerie: u.nroSerie ?? null,
            nroLote: u.nroLote ?? null,
            // Rastro de la conversión: "20 × 5183-2067 ×100 = 2.000".
            presentacion: rec.presentacion ?? null,
            origenTipo: 'proveedor' as const,
            origenId: imp.id,
            origenNombre: imp.proveedorNombre,
            destinoTipo: 'posicion' as const,
            destinoId: rec.posicionId,
            destinoNombre: rec.posicionNombre,
            motivo: `Ingreso por importación (OC ${imp.ordenCompraNumero})`,
            creadoPor: userTrace?.name ?? '',
            ...getCreateTrace(),
            createdAt: Timestamp.now(),
          });

          batch.set(docRef('movimientosStock', movId), movPayload);
          batchAudit(batch, {
            action: 'create',
            collection: 'movimientos_stock',
            documentId: movId,
            after: movPayload as Record<string, unknown>,
          });
        }

        // Auto-close linked requerimiento cuando el ACUMULADO entre recepciones
        // cubre lo pedido (I3 — la segunda tanda del faltante también lo cierra).
        // 'comprado' (enum EstadoRequerimiento) — antes escribía 'completado', que no
        // existe en el enum y dejaba el req contando como comprometido en el ATP.
        const recibidoAcumulado = (prevRecibidoByItemId.get(rec.item.id) ?? 0) + recibidoEnEnvaseOC;
        if (recibidoAcumulado >= rec.item.cantidadPedida - 1e-6) {
          // Todos los vinculados: principal + conciliación múltiple (2026-09-10).
          for (const reqId of requerimientosDeItem(rec.item)) {
            batch.update(
              docRef('requerimientos_compra', reqId),
              deepCleanForFirestore({
                estado: 'comprado',
                updatedAt: Timestamp.now(),
                ...getUpdateTrace(),
              }),
            );
          }
        }
      }

      // Denormalizar el último costo/factor en cada artículo del catálogo (last-wins).
      for (const [articuloId, { costo, factor }] of ultimoCostoByArticulo) {
        batch.update(
          docRef('articulos', articuloId),
          deepCleanForFirestore({
            ultimoCostoImportacion: costo,
            ultimoFactorImportacion: factor || null,
            ultimoCostoMoneda: 'USD',
            ultimoCostoFecha: nowIso,
            updatedAt: Timestamp.now(),
            ...getUpdateTrace(),
          }),
        );
      }

      // Acumular lo recibido por ítem (I3: recepciones parciales múltiples) y marcar
      // la importación como ingresada SOLO cuando todo lo pedido entró. Mientras haya
      // faltante la importación admite nuevas recepciones (o el cierre incompleto manual).
      // `cantidadRecibida` se acumula EN EL ENVASE DE LA OC (misma unidad que cantidadPedida).
      const recibidoOCDe = (rec: RecepcionItem) => {
        const fRec = rec.presentacion?.factor && rec.presentacion.factor > 0 ? rec.presentacion.factor : 1;
        return Math.round((rec.cantidadReal * fRec / interpretarEnvaseOC(rec).factorItem) * 1000) / 1000;
      };
      const updatedItems = itemsBase.map(it => {
        const rec = recepciones.find(r => r.item.id === it.id);
        // Se persiste la resolución (base + envase) para que la impo quede consistente;
        // si la OC se interpretó en el envase recibido, ese envase queda en el ítem.
        const res = resueltoById.get(it.id) ?? it;
        const envaseOC = rec ? interpretarEnvaseOC(rec).presentacionItem : null;
        const normalizado = { ...it, articuloId: res.articuloId ?? it.articuloId ?? null,
          articuloCodigo: res.articuloCodigo ?? it.articuloCodigo ?? null, presentacion: envaseOC ?? res.presentacion ?? it.presentacion ?? null };
        return rec ? { ...normalizado, cantidadRecibida: (it.cantidadRecibida ?? 0) + recibidoOCDe(rec) } : normalizado;
      });
      const recepcionCompleta = updatedItems.length > 0 &&
        updatedItems.every(it => (it.cantidadRecibida ?? 0) >= (it.cantidadPedida || 0) - 1e-6);

      batch.update(
        docRef('importaciones', imp.id),
        deepCleanForFirestore({
          stockIngresado: recepcionCompleta,
          items: updatedItems,
          factorEmbarque: costeo.factorEmbarque,
          updatedAt: Timestamp.now(),
          ...getUpdateTrace(),
        }),
      );

      // Reconciliar la OC de origen (UAT 2026-07-16): acumular cantidadRecibida por
      // item y, si con este embarque la OC queda completa, marcarla 'recibida'.
      // Sin esto la OC importada quedaba 'embarcada' para siempre y el visor de
      // entregas no podía agruparla como unidad de entrega.
      if (imp.ordenCompraId) {
        try {
          const { ordenesCompraService } = await import('../services/presupuestosService');
          const oc = await ordenesCompraService.getById(imp.ordenCompraId);
          if (oc && oc.estado !== 'cancelada') {
            const recByItemOC = new Map<string, number>();
            for (const rec of recepciones) {
              if (rec.item.itemOCId) {
                // En el envase de la OC (el ítem de la impo hereda el mismo).
                recByItemOC.set(rec.item.itemOCId, (recByItemOC.get(rec.item.itemOCId) ?? 0) + recibidoOCDe(rec));
              }
            }
            const itemsOC = (oc.items ?? []).map(it => {
              const recibidoAhora = recByItemOC.get(it.id) ?? 0;
              if (!recibidoAhora) return it;
              const previa = it.cantidadRecibida ?? 0;
              // Tope en lo pedido: un sobrante físico no infla la OC.
              return { ...it, cantidadRecibida: Math.min(it.cantidad, previa + recibidoAhora) };
            });
            const completa = itemsOC.length > 0 && itemsOC.every(it => (it.cantidadRecibida ?? 0) >= it.cantidad);
            batch.update(
              docRef('ordenes_compra', oc.id),
              deepCleanForFirestore({
                items: itemsOC,
                ...(completa ? { estado: 'recibida' as const, fechaRecepcion: nowIso } : {}),
                updatedAt: Timestamp.now(),
                ...getUpdateTrace(),
              }),
            );
          }
        } catch (ocErr) {
          console.warn('[useIngresarStock] no se pudo reconciliar la OC del embarque:', ocErr);
        }
      }

      await batch.commit();

      // ── Calificación de proveedores (2026-08-12): al completarse la recepción
      // del EMBARQUE, una calificación pendiente por actor (vendedor + agente de
      // carga + despachante si están cargados). Best-effort, idempotente por
      // origenKey — no afecta el ingreso.
      if (recepcionCompleta) {
        try {
          const { calificacionesService } = await import('../services/calificacionesService');
          await calificacionesService.crearPendientesDesdeImportacion({ ...imp, items: updatedItems });
        } catch (calErr) {
          console.warn('[useIngresarStock] ingreso OK, falló la calificación pendiente:', calErr);
        }
      }

      // ── Auto-reserva post-ingreso (UAT 2026-07-16): si hay presupuestos aceptados
      // esperando estos artículos (requerimientos vinculados a ppto), reservar lo
      // pendiente con el stock recién ingresado. Best-effort — no afecta el ingreso.
      try {
        const { reservasService } = await import('../services/stockService');
        const { requerimientosService } = await import('../services/importacionesService');
        const artIds = Array.from(new Set(recepciones.map(r => r.item.articuloId).filter(Boolean) as string[]));
        for (const articuloId of artIds) {
          const reqsArticulo = await requerimientosService.getByArticulo(articuloId).catch(() => []);
          const pptoIds = Array.from(new Set(
            reqsArticulo.filter(r => r.presupuestoId && r.estado !== 'cancelado').map(r => r.presupuestoId as string),
          ));
          for (const pptoId of pptoIds) {
            await reservasService.reservarPendientesParaPresupuesto({
              presupuestoId: pptoId,
              articuloId,
              solicitadoPorNombre: userTrace?.name ?? 'Sistema',
            }).catch(err => console.warn(`[useIngresarStock] auto-reserva ppto ${pptoId} falló:`, err));
          }
        }
      } catch (resErr) {
        console.warn('[useIngresarStock] ingreso OK, falló la auto-reserva post-ingreso:', resErr);
      }

      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al ingresar stock');
      return false;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Cierra la recepción con faltantes (decisión del usuario: el proveedor no manda
   * el remanente). Marca la importación como terminada (`stockIngresado: true`)
   * dejando el faltante asentado en `notaRecepcionIncompleta`. Los requerimientos
   * del faltante quedan abiertos a propósito (el material sigue debiéndose).
   */
  const cerrarIncompleta = async (imp: Importacion, notaFaltante: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const stamp = new Date().toLocaleDateString('es-AR');
      await importacionesService.update(imp.id, {
        stockIngresado: true,
        recepcionCerradaIncompleta: true,
        notaRecepcionIncompleta: `Recepción cerrada incompleta (${stamp}).\n${notaFaltante}`.trim(),
      });
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cerrar la recepción');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { ingresarStock, cerrarIncompleta, loading, error };
}
