import React from 'react';
import { useTabs } from '../../contexts/TabsContext';
import { ordenesTrabajoService } from '../../services/firebaseService';
import { otsDelPresupuesto } from '../../hooks/useControlSemanal';
import type { Presupuesto, WorkOrder } from '@ags/shared';

interface Props {
  /** Lista de OT numbers vinculadas al presupuesto (array nuevo). */
  otsVinculadasNumbers?: string[] | null;
  /** Campo legacy singular — se muestra si no hay array. */
  otVinculadaNumber?: string | null;
  /** Número del presupuesto — habilita el join por `budgets` de la OT. */
  presupuestoNumero?: string | null;
}

/**
 * Chips de las OTs de este presupuesto.
 *
 * Resuelve con `otsDelPresupuesto` (2026-08-09), el mismo join que usan el
 * control semanal y los KPIs: campos del presupuesto + OTs cuyo `budgets` lo
 * mencione, descartando los PADRES que tienen hijas y heredando el vínculo a
 * ellas. Antes leía solo `otsVinculadasNumbers`/`otVinculadaNumber` y mostraba
 * el padre (29994, que nunca sale de CREADA) en vez de la hija donde está el
 * trabajo (29994.01) — el padre es solo un agrupador visual.
 */
export const PresupuestoOTsVinculadas: React.FC<Props> = ({ otsVinculadasNumbers, otVinculadaNumber, presupuestoNumero }) => {
  const { navigateInActiveTab } = useTabs();
  const [ots, setOts] = React.useState<WorkOrder[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    ordenesTrabajoService.getAll()
      .then((data: WorkOrder[]) => { if (!cancelled) setOts(data); })
      .catch((err: unknown) => console.error('[PresupuestoOTsVinculadas] cargar OTs:', err));
    return () => { cancelled = true; };
  }, []);

  const numeros = React.useMemo(() => {
    const pres = {
      numero: presupuestoNumero ?? '',
      otsVinculadasNumbers: otsVinculadasNumbers ?? null,
      otVinculadaNumber: otVinculadaNumber ?? null,
    } as Presupuesto;
    return [...otsDelPresupuesto(pres, ots)].sort((a, b) => a.localeCompare(b));
  }, [otsVinculadasNumbers, otVinculadaNumber, presupuestoNumero, ots]);

  if (numeros.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap px-3 py-1.5 border-t border-slate-100 bg-slate-50/40">
      <span className="text-[10px] uppercase tracking-wide text-slate-400 font-mono">
        OT{numeros.length > 1 ? 's' : ''} vinculada{numeros.length > 1 ? 's' : ''}:
      </span>
      {numeros.map(num => (
        <button
          key={num}
          onClick={() => navigateInActiveTab(`/ordenes-trabajo/${num}`)}
          className="text-[10px] font-mono text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-1.5 py-0.5 rounded transition-colors"
          title={`Ir a OT ${num}`}
        >
          {num}
        </button>
      ))}
    </div>
  );
};
