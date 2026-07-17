import { useCallback, useEffect, useState } from 'react';
import type { Presupuesto, WorkOrder, SolicitudFacturacion } from '@ags/shared';
import { presupuestosService, ordenesTrabajoService, facturacionService } from '../services/firebaseService';

export interface AnaliticaData {
  presupuestos: Presupuesto[];
  ots: WorkOrder[];
  solicitudes: SolicitudFacturacion[];
  loadedAt: string;
}

/**
 * Datos para /presupuestos/analitica. Fetch ÚNICO al montar (patrón DashboardPage)
 * + `refetch()` manual desde el botón Refrescar. Sin subscribe: la analítica no
 * necesita real-time y ahorra listeners. Los filtros NO re-fetchean — la
 * agregación (utils/analitica/presupuestosMetrics) corre en memoria.
 */
export function useAnaliticaPresupuestos() {
  const [data, setData] = useState<AnaliticaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [presupuestos, ots, solicitudes] = await Promise.all([
        presupuestosService.getAll(),
        ordenesTrabajoService.getAll(),
        facturacionService.getAll(),
      ]);
      setData({ presupuestos, ots, solicitudes, loadedAt: new Date().toISOString() });
    } catch (e) {
      console.error('[useAnaliticaPresupuestos] load:', e);
      setError(e instanceof Error ? e.message : 'Error cargando la analítica');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, refetch: load };
}
