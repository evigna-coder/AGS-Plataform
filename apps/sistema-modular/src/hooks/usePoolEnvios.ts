import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GastoEnvio, Presupuesto } from '@ags/shared';
import { gastosEnvioService } from '../services/gastosEnvioService';
import { clientesService } from '../services/firebaseService';
import { ledgerPoolEnvios, resumenPoolEnvios, type PresupuestoPool } from '../utils/poolEnvios';
import { hoyLocalISODate } from '../utils/formatFecha';

/**
 * Pool de envíos para la pantalla de Entregas (2026-09-23): entradas (envío
 * contemplado en presupuestos aceptados) y salidas (gastos por viaje), libro
 * con saldo acumulado y resumen del mes.
 */
export function usePoolEnvios() {
  const [pptos, setPptos] = useState<PresupuestoPool[]>([]);
  const [gastos, setGastos] = useState<GastoEnvio[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, g, clientes] = await Promise.all([
        gastosEnvioService.getPresupuestosConEnvio().catch(err => { console.error('[usePoolEnvios] presupuestos:', err); return [] as Presupuesto[]; }),
        gastosEnvioService.getAll().catch(err => { console.error('[usePoolEnvios] gastos:', err); return [] as GastoEnvio[]; }),
        clientesService.getAll(true).catch(() => [] as Array<{ id: string; razonSocial?: string; nombre?: string }>),
      ]);
      const nombre = new Map((clientes as Array<{ id: string; razonSocial?: string; nombre?: string }>).map(c => [c.id, c.razonSocial ?? c.nombre ?? c.id]));
      setPptos(p.map(x => ({ ...x, clienteNombre: nombre.get(x.clienteId) ?? null })));
      setGastos(g);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const ledger = useMemo(() => ledgerPoolEnvios(pptos, gastos), [pptos, gastos]);
  const resumen = useMemo(() => resumenPoolEnvios(ledger, hoyLocalISODate()), [ledger]);

  const registrar = useCallback(async (data: Omit<GastoEnvio, 'id' | 'createdAt' | 'updatedAt'>) => {
    const id = await gastosEnvioService.create(data);
    await load();
    return id;
  }, [load]);

  const eliminar = useCallback(async (id: string) => {
    await gastosEnvioService.delete(id);
    await load();
  }, [load]);

  return { ledger, resumen, gastos, loading, reload: load, registrar, eliminar };
}
