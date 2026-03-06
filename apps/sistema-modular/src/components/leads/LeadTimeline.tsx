import type { Posta } from '@ags/shared';
import { LEAD_ESTADO_LABELS } from '@ags/shared';

interface LeadTimelineProps {
  postas: Posta[];
}

export const LeadTimeline = ({ postas }: LeadTimelineProps) => {
  if (postas.length === 0) {
    return <p className="text-xs text-slate-400 italic">Sin movimientos registrados</p>;
  }

  return (
    <div className="space-y-3">
      {postas.map((p, i) => (
        <div key={p.id || i} className="flex gap-3 items-start">
          <div className="flex flex-col items-center">
            <div className="w-2 h-2 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
            {i < postas.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1" />}
          </div>
          <div className="flex-1 min-w-0 pb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-slate-700">{p.deUsuarioNombre}</span>
              <span className="text-[10px] text-slate-400">→</span>
              <span className="text-xs font-medium text-slate-700">{p.aUsuarioNombre}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                {LEAD_ESTADO_LABELS[p.estadoAnterior]} → {LEAD_ESTADO_LABELS[p.estadoNuevo]}
              </span>
            </div>
            {p.comentario && <p className="text-[11px] text-slate-500 mt-1">{p.comentario}</p>}
            <p className="text-[10px] text-slate-400 mt-0.5">
              {new Date(p.fecha).toLocaleString('es-AR')}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};
