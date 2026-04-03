import { useState, useCallback } from 'react';
import { articulosService, unidadesService } from '../services/stockService';
import { requerimientosService } from '../services/importacionesService';
import type { Presupuesto } from '@ags/shared';

export function useGenerarRequerimientos() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generados, setGenerados] = useState(0);

  const generarParaPresupuesto = useCallback(async (presupuesto: Presupuesto): Promise<number> => {
    setLoading(true);
    setError(null);
    setGenerados(0);
    let count = 0;

    try {
      const itemsConStock = presupuesto.items?.filter(i => i.stockArticuloId) ?? [];
      if (itemsConStock.length === 0) {
        setError('Este presupuesto no tiene ítems vinculados a artículos de stock.');
        return 0;
      }

      for (const item of itemsConStock) {
        // Check duplicates
        const existing = await requerimientosService.getAll({
          presupuestoId: presupuesto.id,
          articuloId: item.stockArticuloId!,
        }).catch(() => []);
        if (existing.length > 0) continue;

        const articulo = await articulosService.getById(item.stockArticuloId!).catch(() => null);
        const unidades = await unidadesService.getAll({
          articuloId: item.stockArticuloId!,
          estado: 'disponible',
        }).catch(() => []);

        const qtyDisponible = unidades.length;
        const stockMinimo = articulo?.stockMinimo ?? 0;
        const qtyResultante = qtyDisponible - item.cantidad;

        // Manual trigger: generate req if stock is insufficient OR simply if stock < cantidad
        if (qtyResultante < stockMinimo || qtyDisponible < item.cantidad) {
          const qtyReq = Math.max(
            stockMinimo - qtyResultante,
            item.cantidad - qtyDisponible,
            1,
          );
          await requerimientosService.create({
            articuloId: item.stockArticuloId ?? null,
            articuloCodigo: articulo?.codigo ?? null,
            articuloDescripcion: articulo?.descripcion ?? item.descripcion,
            cantidad: qtyReq,
            unidadMedida: articulo?.unidadMedida ?? 'unidad',
            motivo: `Generado manualmente desde presupuesto ${presupuesto.numero}`,
            origen: 'presupuesto',
            origenRef: presupuesto.id,
            estado: 'pendiente',
            presupuestoId: presupuesto.id,
            presupuestoNumero: presupuesto.numero ?? null,
            proveedorSugeridoId: articulo?.proveedorIds?.[0] ?? null,
            proveedorSugeridoNombre: null,
            ordenCompraId: null,
            ordenCompraNumero: null,
            solicitadoPor: 'Manual',
            fechaSolicitud: new Date().toISOString(),
            fechaAprobacion: null,
            urgencia: 'media',
            notas: null,
          });
          count++;
        }
      }

      setGenerados(count);
      return count;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error generando requerimientos';
      setError(msg);
      console.error('[useGenerarRequerimientos]', err);
      return 0;
    } finally {
      setLoading(false);
    }
  }, []);

  return { generarParaPresupuesto, loading, error, generados };
}
