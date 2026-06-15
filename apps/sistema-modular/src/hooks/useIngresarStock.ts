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
import { computeCosteoImportacion } from '../utils/costeoImportacion';

export interface RecepcionItem {
  item: ItemImportacion;
  posicionId: string;
  posicionNombre: string;
  nrosSerie: string[];     // one per unit; empty array if no serial required
  cantidadReal: number;
}

export function useIngresarStock() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ingresarStock = async (imp: Importacion, recepciones: RecepcionItem[]): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
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

        // One entry per serial; if no serials given, one null entry per unit
        const seriesOrNulls: (string | null)[] =
          rec.nrosSerie.length > 0
            ? rec.nrosSerie
            : Array.from({ length: rec.cantidadReal }, () => null);

        for (const nroSerie of seriesOrNulls) {
          const unidadId = crypto.randomUUID();
          const movId = crypto.randomUUID();

          const unidadPayload = deepCleanForFirestore({
            articuloId: rec.item.articuloId ?? '',
            articuloCodigo: rec.item.articuloCodigo ?? '',
            articuloDescripcion: rec.item.descripcion,
            nroSerie,
            nroLote: null,
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
            observaciones: `Ingreso por importación ${imp.numero}`,
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
            cantidad: 1,
            origenTipo: 'proveedor' as const,
            origenId: imp.id,
            origenNombre: imp.proveedorNombre,
            destinoTipo: 'posicion' as const,
            destinoId: rec.posicionId,
            destinoNombre: rec.posicionNombre,
            motivo: `Ingreso por importación ${imp.numero}`,
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

        // Auto-close linked requerimiento if quantity fulfilled
        if (rec.item.requerimientoId && rec.cantidadReal >= rec.item.cantidadPedida) {
          batch.update(
            docRef('requerimientos_compra', rec.item.requerimientoId),
            deepCleanForFirestore({
              estado: 'completado',
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

      // Mark importacion done and update cantidadRecibida on each item
      const updatedItems = (imp.items ?? []).map(it => {
        const rec = recepciones.find(r => r.item.id === it.id);
        return rec ? { ...it, cantidadRecibida: rec.cantidadReal } : it;
      });

      batch.update(
        docRef('importaciones', imp.id),
        deepCleanForFirestore({
          stockIngresado: true,
          items: updatedItems,
          factorEmbarque: costeo.factorEmbarque,
          updatedAt: Timestamp.now(),
          ...getUpdateTrace(),
        }),
      );

      await batch.commit();
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al ingresar stock');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { ingresarStock, loading, error };
}
