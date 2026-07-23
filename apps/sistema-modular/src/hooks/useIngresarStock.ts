import { useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import type { Importacion, ItemImportacion, Articulo } from '@ags/shared';
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
  cantidadReal: number;
  nroLote?: string | null; // si el artículo se maneja por lote
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
      const articuloIds = Array.from(
        new Set((imp.items ?? []).map(i => i.articuloId).filter(Boolean) as string[]),
      );
      const arts = await Promise.all(articuloIds.map(id => articulosService.getById(id).catch(() => null)));
      const articulosById = new Map<string, Articulo>();
      arts.forEach(a => { if (a) articulosById.set(a.id, a); });

      const costeo = computeCosteoImportacion({
        items: imp.items ?? [],
        articulosById,
        gastos: imp.gastos ?? [],
        monedaBase: monedaEmbarque,
        fleteDeclarado: imp.fleteDeclarado ?? 0,
        seguroDeclarado: imp.seguroDeclarado ?? 0,
        tipoCambio: imp.tipoCambio ?? null,
        paseEurUsd: imp.paseEurUsd ?? null,
      });
      const lineaByItemId = new Map(costeo.lineas.map(l => [l.itemId, l]));
      const nowIso = new Date().toISOString();
      // Último costo por artículo (denormalizado, last-wins) para escribir en el catálogo.
      const ultimoCostoByArticulo = new Map<string, { costo: number; factor: number }>();

      const batch = createBatch();
      const userTrace = getCurrentUserTrace();

      for (const rec of recepciones) {
        const linea = lineaByItemId.get(rec.item.id);
        const cantBase = rec.item.cantidadPedida || 0;
        const costoUnitario = linea && cantBase > 0
          ? linea.costoComputable / cantBase
          : (rec.item.precioUnitario ?? 0);
        const factorImportacion = linea?.factor ?? null;
        if (rec.item.articuloId) {
          ultimoCostoByArticulo.set(rec.item.articuloId, { costo: costoUnitario, factor: factorImportacion ?? 0 });
        }

        // Cómo se materializan las unidades físicas:
        //  - con series → un doc por serie (cantidad 1).
        //  - sin series pero con lote → un solo doc agrupado (cantidad = N).
        //  - sin trazabilidad → un doc por unidad (cantidad 1).
        const loteId = rec.nroLote?.trim() || null;
        const unidadesACrear: { nroSerie: string | null; nroLote: string | null; cantidad: number }[] =
          rec.nrosSerie.length > 0
            ? rec.nrosSerie.map(s => ({ nroSerie: s, nroLote: loteId, cantidad: 1 }))
            : loteId
              ? [{ nroSerie: null, nroLote: loteId, cantidad: rec.cantidadReal }]
              : Array.from({ length: rec.cantidadReal }, () => ({ nroSerie: null, nroLote: null, cantidad: 1 }));

        for (const u of unidadesACrear) {
          const unidadId = crypto.randomUUID();
          const movId = crypto.randomUUID();

          const unidadPayload = deepCleanForFirestore({
            articuloId: rec.item.articuloId ?? '',
            articuloCodigo: rec.item.articuloCodigo ?? '',
            articuloDescripcion: rec.item.descripcion,
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
            articuloDescripcion: rec.item.descripcion,
            cantidad: u.cantidad,
            nroSerie: u.nroSerie ?? null,
            nroLote: u.nroLote ?? null,
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
        const recibidoAcumulado = (prevRecibidoByItemId.get(rec.item.id) ?? 0) + rec.cantidadReal;
        if (rec.item.requerimientoId && recibidoAcumulado >= rec.item.cantidadPedida) {
          batch.update(
            docRef('requerimientos_compra', rec.item.requerimientoId),
            deepCleanForFirestore({
              estado: 'comprado',
              updatedAt: Timestamp.now(),
              ...getUpdateTrace(),
            }),
          );
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
      const updatedItems = itemsBase.map(it => {
        const rec = recepciones.find(r => r.item.id === it.id);
        return rec ? { ...it, cantidadRecibida: (it.cantidadRecibida ?? 0) + rec.cantidadReal } : it;
      });
      const recepcionCompleta = updatedItems.length > 0 &&
        updatedItems.every(it => (it.cantidadRecibida ?? 0) >= (it.cantidadPedida || 0));

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
                recByItemOC.set(rec.item.itemOCId, (recByItemOC.get(rec.item.itemOCId) ?? 0) + rec.cantidadReal);
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
