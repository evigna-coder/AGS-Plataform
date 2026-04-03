import { useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import type { Importacion, ItemImportacion } from '@ags/shared';
import {
  createBatch,
  docRef,
  batchAudit,
  deepCleanForFirestore,
  getCreateTrace,
  getUpdateTrace,
  getCurrentUserTrace,
} from '../services/firebase';
import { calcularCostoConGastos } from '../utils/calcularProrrateo';

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
      const monedaOC = imp.items?.[0]?.moneda ?? 'USD';
      const monedaCosto: 'ARS' | 'USD' | null =
        monedaOC === 'ARS' ? 'ARS' : monedaOC === 'USD' ? 'USD' : null;

      const totalGastosEnMonedaOC = (imp.gastos ?? [])
        .filter(g => g.moneda === monedaOC)
        .reduce((sum, g) => sum + g.monto, 0);

      const valorTotalImportacion = recepciones.reduce(
        (sum, r) => sum + (r.item.precioUnitario ?? 0) * r.cantidadReal,
        0,
      );

      const batch = createBatch();
      const userTrace = getCurrentUserTrace();

      for (const rec of recepciones) {
        const costoUnitario = calcularCostoConGastos({
          precioUnitario: rec.item.precioUnitario ?? 0,
          cantidadRecibida: rec.cantidadReal,
          valorTotalImportacion,
          totalGastosEnMonedaOC,
        });

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
            monedaCosto,
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
