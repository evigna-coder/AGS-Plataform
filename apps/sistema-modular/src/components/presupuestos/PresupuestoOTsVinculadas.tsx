import React from 'react';
import { useTabs } from '../../contexts/TabsContext';

interface Props {
  /** Lista de OT numbers vinculadas al presupuesto (array nuevo). */
  otsVinculadasNumbers?: string[] | null;
  /** Campo legacy singular — se muestra si no hay array. */
  otVinculadaNumber?: string | null;
}

/**
 * Shows a compact chip list of OTs generated from this presupuesto.
 * Reads the new `otsVinculadasNumbers` array and falls back to the legacy
 * singular `otVinculadaNumber` when the array is missing (presupuestos
 * creados antes del refactor bidireccional).
 */
export const PresupuestoOTsVinculadas: React.FC<Props> = ({ otsVinculadasNumbers, otVinculadaNumber }) => {
  const { navigateInActiveTab } = useTabs();

  const numeros = React.useMemo(() => {
    const list = otsVinculadasNumbers && otsVinculadasNumbers.length > 0
      ? [...otsVinculadasNumbers]
      : otVinculadaNumber ? [otVinculadaNumber] : [];
    // Deduplicate while preserving order
    return Array.from(new Set(list));
  }, [otsVinculadasNumbers, otVinculadaNumber]);

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
