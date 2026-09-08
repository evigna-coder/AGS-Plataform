import { useEffect, useState } from 'react';
import type { Certificacion, ItemCertificacion } from '@ags/shared';
import { itemsDeCertificacion } from '@ags/shared';
import { certificacionesService } from '../services/certificacionesService';
import { cargarOTsDelPresupuesto, type PresupuestoRef } from '../utils/otsDelPresupuestoFetch';

export interface LoteDelPresupuesto {
  cert: Certificacion;
  /** Solo los ítems del lote que son OTs de ESTE presupuesto. */
  items: ItemCertificacion[];
}

/**
 * Certificaciones que tocan a un presupuesto (2026-09-08): los lotes del
 * cliente que incluyen alguna OT del presupuesto. Es el equivalente a la OC
 * para los clientes que certifican en vez de emitirla: desde el presupuesto
 * se ve qué se pidió, qué papel volvió y qué falta.
 */
export function usePresupuestoCertificaciones(pres: PresupuestoRef & { clienteId?: string | null }) {
  const [lotes, setLotes] = useState<LoteDelPresupuesto[]>([]);
  const [otsSinLote, setOtsSinLote] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const key = `${pres.numero}|${pres.clienteId ?? ''}|${(pres.otsVinculadasNumbers ?? []).join(',')}|${pres.otVinculadaNumber ?? ''}`;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [{ numeros }, certs] = await Promise.all([
          cargarOTsDelPresupuesto(pres),
          pres.clienteId ? certificacionesService.getAll({ clienteId: pres.clienteId }).catch(() => []) : Promise.resolve([]),
        ]);
        const set = new Set(numeros);
        const out: LoteDelPresupuesto[] = [];
        const enLote = new Set<string>();
        for (const cert of certs) {
          const items = itemsDeCertificacion(cert).filter(i => set.has(i.otNumber));
          if (items.length === 0) continue;
          items.forEach(i => enLote.add(i.otNumber));
          out.push({ cert, items });
        }
        if (cancelled) return;
        setLotes(out);
        setOtsSinLote(numeros.filter(n => !enLote.has(n)));
      } catch (err) {
        console.error('[usePresupuestoCertificaciones]', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { lotes, otsSinLote, loading };
}
