import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ordenesTrabajoService } from '../../services/firebaseService';
import { OT_ESTADO_LABELS, type OTEstadoAdmin, type WorkOrder } from '@ags/shared';

const ESTADO_COLORS: Record<string, string> = {
  CREADA: 'bg-slate-100 text-slate-600',
  ASIGNADA: 'bg-blue-100 text-blue-700',
  COORDINADA: 'bg-violet-100 text-violet-700',
  EN_CURSO: 'bg-amber-100 text-amber-700',
  CIERRE_TECNICO: 'bg-orange-100 text-orange-700',
  CIERRE_ADMINISTRATIVO: 'bg-cyan-100 text-cyan-700',
  FINALIZADO: 'bg-emerald-100 text-emerald-700',
};

interface Props {
  otIds: string[];
}

/**
 * OTs vinculadas al loaner (recalificaciones y servicios sobre el módulo).
 * Muestra link a la OT + chip del estado administrativo (lectura liviana:
 * un getByOtNumber por número, solo los vinculados — típicamente 2-4).
 */
export function LoanerOTsSection({ otIds }: Props) {
  const { pathname } = useLocation();
  const [ots, setOts] = useState<Map<string, WorkOrder>>(new Map());

  useEffect(() => {
    if (otIds.length === 0) { setOts(new Map()); return; }
    let cancelled = false;
    Promise.all(otIds.map(num =>
      ordenesTrabajoService.getByOtNumber(num).catch(() => null),
    )).then(results => {
      if (cancelled) return;
      const map = new Map<string, WorkOrder>();
      results.forEach(ot => { if (ot) map.set(ot.otNumber, ot); });
      setOts(map);
    });
    return () => { cancelled = true; };
  }, [otIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // Más recientes primero (número descendente, hijas después del padre).
  const ordenadas = [...otIds].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

  return (
    <div className="rounded-xl bg-white border border-slate-200 p-4">
      <span className="text-sm font-semibold text-slate-700">
        Órdenes de trabajo {otIds.length > 0 && <span className="text-slate-400 font-normal">({otIds.length})</span>}
      </span>
      {otIds.length === 0 ? (
        <p className="text-xs text-slate-400 mt-2">Sin OTs vinculadas</p>
      ) : (
        <div className="mt-2 divide-y divide-slate-100">
          {ordenadas.map(num => {
            const ot = ots.get(num);
            const estado = ot?.estadoAdmin as OTEstadoAdmin | undefined;
            return (
              <div key={num} className="flex items-center justify-between gap-2 py-1.5">
                <div className="min-w-0 flex items-center gap-2">
                  <Link to={`/ordenes-trabajo/${num}`} state={{ from: pathname }}
                    className="text-xs font-semibold text-teal-700 hover:underline shrink-0">
                    OT {num}
                  </Link>
                  {ot?.tipoServicio && (
                    <span className="text-[11px] text-slate-400 truncate">{ot.tipoServicio}</span>
                  )}
                </div>
                {estado && (
                  <span className={`shrink-0 inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded-full ${ESTADO_COLORS[estado] ?? 'bg-slate-100 text-slate-600'}`}>
                    {OT_ESTADO_LABELS[estado] ?? estado}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
