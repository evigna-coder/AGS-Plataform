import { useCallback, useEffect, useState } from 'react';
import type { Presupuesto, PresupuestoItem, RequerimientoCompra, Importacion, UnidadStock } from '@ags/shared';
import { presupuestosService } from '../services/presupuestosService';
import { unidadesService } from '../services/stockService';
import { requerimientosService, importacionesService } from '../services/importacionesService';
import { ordenesCompraService } from '../services/presupuestosService';
import { clientesService } from '../services/clientesService';
import { buildEntregaRows } from '../utils/entregasResolver';
import type { EntregaRow } from '../utils/entregasResolver';
import { deepCleanForFirestore } from '../services/firebase';

type EstadoPresupuestoActivo = 'aceptado' | 'en_ejecucion' | 'finalizado';
const ESTADOS_ACTIVOS: EstadoPresupuestoActivo[] = ['aceptado', 'en_ejecucion', 'finalizado'];

/** Campos del item editables inline desde /entregas. */
export type EntregaItemPatch = Partial<
  Pick<PresupuestoItem, 'otNumeroVinculada' | 'fechaComprometida' | 'entregadoManual' | 'disponibilidad'>
>;

interface UseEntregasReturn {
  rows: EntregaRow[];
  loading: boolean;
  error: Error | null;
  reload: () => Promise<void>;
  /** Patch parcial de un item del presupuesto (OT#, fecha comprometida, entregado, disponibilidad). */
  updateItem: (presupuestoId: string, itemId: string, patch: EntregaItemPatch) => Promise<void>;
}

export function useEntregas(): UseEntregasReturn {
  const [rows, setRows] = useState<EntregaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Cargar presupuestos por estado en paralelo, luego flatten.
      const [pptosBuckets, reqs, ocs, imps, clientes, unidades] = await Promise.all([
        Promise.all(ESTADOS_ACTIVOS.map(e => presupuestosService.getAll({ estado: e }))),
        requerimientosService.getAll().catch(() => [] as RequerimientoCompra[]),
        ordenesCompraService.getAll().catch(() => [] as any[]),
        importacionesService.getAll().catch(() => [] as Importacion[]),
        clientesService.getAll().catch(() => [] as any[]),
        // Stock de HOY (2026-08-13): una sola lectura de unidades para toda la
        // grilla, en vez de una consulta por fila.
        unidadesService.getAll({ activoOnly: true }).catch(() => [] as UnidadStock[]),
      ]);
      const presupuestos = pptosBuckets.flat() as Presupuesto[];

      const clienteNombreById = new Map<string, string>(
        clientes.map((c: any) => [c.id as string, ((c.razonSocial ?? c.nombre ?? c.id) as string)]),
      );

      // Normalizar OC shape para el resolver (id + numero + items[{id, requerimientoId}])
      const ocsForResolver = ocs.map((oc: any) => ({
        id: oc.id as string,
        numero: oc.numero as string,
        estado: (oc.estado ?? null) as string | null,
        items: ((oc.items ?? []) as any[]).map((it: any) => ({
          id: it.id as string,
          requerimientoId: (it.requerimientoId ?? null) as string | null,
        })),
      }));

      // Stock real por artículo: lo LIBRE en estante y lo ya RESERVADO para
      // cada presupuesto. Se excluye lo parado en un remito (ya salió) y lo que
      // vive en un minikit o con un ingeniero (no está para entregar en mostrador).
      const stockLibrePorArticulo = new Map<string, number>();
      const stockReservadoPorPptoArticulo = new Map<string, number>();
      for (const u of unidades as UnidadStock[]) {
        if (u.activo === false || !u.articuloId) continue;
        const cant = u.cantidad ?? 1;
        if (u.estado === 'disponible' && u.ubicacion?.tipo !== 'remito') {
          stockLibrePorArticulo.set(u.articuloId, (stockLibrePorArticulo.get(u.articuloId) ?? 0) + cant);
        } else if (u.estado === 'reservado' && u.reservadoParaPresupuestoId) {
          const k = `${u.reservadoParaPresupuestoId}:${u.articuloId}`;
          stockReservadoPorPptoArticulo.set(k, (stockReservadoPorPptoArticulo.get(k) ?? 0) + cant);
        }
      }

      const built = buildEntregaRows({
        presupuestos,
        requerimientos: reqs as RequerimientoCompra[],
        ordenesCompra: ocsForResolver,
        importaciones: imps as Importacion[],
        clienteNombreById,
        stockLibrePorArticulo,
        stockReservadoPorPptoArticulo,
      });

      setRows(built);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('[useEntregas] load failed', e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const updateItem = useCallback(async (
    presupuestoId: string,
    itemId: string,
    patch: EntregaItemPatch,
  ) => {
    const pres = await presupuestosService.getById(presupuestoId);
    if (!pres) throw new Error('Presupuesto no encontrado');
    const newItems: PresupuestoItem[] = (pres.items ?? []).map((it: PresupuestoItem) =>
      it.id === itemId ? { ...it, ...patch } : it,
    );
    // presupuestosService.update usa writes desde './firebase' (convención repo — fix Electron keyboard router).
    // Envolvemos con deepCleanForFirestore para strip undefined en campos opcionales de PresupuestoItem.
    await presupuestosService.update(presupuestoId, deepCleanForFirestore({ items: newItems }) as Partial<Presupuesto>);
    await load();
  }, [load]);

  return { rows, loading, error, reload: load, updateItem };
}
