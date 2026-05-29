import { useCallback, useEffect, useState } from 'react';
import type { Presupuesto, PresupuestoItem, RequerimientoCompra, Importacion } from '@ags/shared';
import { presupuestosService } from '../services/presupuestosService';
import { requerimientosService, importacionesService } from '../services/importacionesService';
import { ordenesCompraService } from '../services/presupuestosService';
import { clientesService } from '../services/clientesService';
import { buildEntregaRows } from '../utils/entregasResolver';
import type { EntregaRow } from '../utils/entregasResolver';
import { deepCleanForFirestore } from '../services/firebase';

type EstadoPresupuestoActivo = 'aceptado' | 'en_ejecucion' | 'finalizado';
const ESTADOS_ACTIVOS: EstadoPresupuestoActivo[] = ['aceptado', 'en_ejecucion', 'finalizado'];

interface UseEntregasReturn {
  rows: EntregaRow[];
  loading: boolean;
  error: Error | null;
  reload: () => Promise<void>;
  /** Actualiza otNumeroVinculada en el item del presupuesto. */
  updateOtNumero: (presupuestoId: string, itemId: string, otNumero: string | null) => Promise<void>;
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
      const [pptosBuckets, reqs, ocs, imps, clientes] = await Promise.all([
        Promise.all(ESTADOS_ACTIVOS.map(e => presupuestosService.getAll({ estado: e }))),
        requerimientosService.getAll().catch(() => [] as RequerimientoCompra[]),
        ordenesCompraService.getAll().catch(() => [] as any[]),
        importacionesService.getAll().catch(() => [] as Importacion[]),
        clientesService.getAll().catch(() => [] as any[]),
      ]);
      const presupuestos = pptosBuckets.flat() as Presupuesto[];

      const clienteNombreById = new Map<string, string>(
        clientes.map((c: any) => [c.id as string, ((c.razonSocial ?? c.nombre ?? c.id) as string)]),
      );

      // Normalizar OC shape para el resolver (id + numero + items[{id, requerimientoId}])
      const ocsForResolver = ocs.map((oc: any) => ({
        id: oc.id as string,
        numero: oc.numero as string,
        items: ((oc.items ?? []) as any[]).map((it: any) => ({
          id: it.id as string,
          requerimientoId: (it.requerimientoId ?? null) as string | null,
        })),
      }));

      const built = buildEntregaRows({
        presupuestos,
        requerimientos: reqs as RequerimientoCompra[],
        ordenesCompra: ocsForResolver,
        importaciones: imps as Importacion[],
        clienteNombreById,
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

  const updateOtNumero = useCallback(async (
    presupuestoId: string,
    itemId: string,
    otNumero: string | null,
  ) => {
    const pres = await presupuestosService.getById(presupuestoId);
    if (!pres) throw new Error('Presupuesto no encontrado');
    const newItems: PresupuestoItem[] = (pres.items ?? []).map((it: PresupuestoItem) =>
      it.id === itemId ? { ...it, otNumeroVinculada: otNumero ?? null } : it,
    );
    // presupuestosService.update usa writes desde './firebase' (convención repo — fix Electron keyboard router).
    // Envolvemos con deepCleanForFirestore para strip undefined en campos opcionales de PresupuestoItem.
    await presupuestosService.update(presupuestoId, deepCleanForFirestore({ items: newItems }) as Partial<Presupuesto>);
    await load();
  }, [load]);

  return { rows, loading, error, reload: load, updateOtNumero };
}
