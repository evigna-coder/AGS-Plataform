import type { Posta } from '@ags/shared';
import { getSimplifiedEstadoLabel, LEAD_AREA_LABELS } from '@ags/shared';

interface LeadTimelineProps {
  postas: Posta[];
}

export const LeadTimeline = ({ postas }: LeadTimelineProps) => {
  if (postas.length === 0) {
    return <p className="text-xs text-slate-400 italic">Sin movimientos registrados</p>;
  }

  // Sort explícito por fecha desc — no asumir que postas viene chronological.
  // Antes: [...postas].reverse() — divergía con portal-ingeniero (que sí ordenaba)
  // cuando postas se insertaban fuera de orden estricto (timestamps distintos cross-app).
  const sorted = [...postas].sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <div className="space-y-3">
      {sorted.map((p, i) => {
        const isComentario = p.estadoAnterior === p.estadoNuevo;
        const isDerivacion = p.deUsuarioId !== p.aUsuarioId;
        return (
          <div key={p.id || i} className="flex gap-3 items-start">
            <div className="flex flex-col items-center">
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${isComentario ? 'bg-amber-400' : 'bg-teal-400'}`} />
              {i < sorted.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1" />}
            </div>
            <div className="flex-1 min-w-0 pb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-slate-700">{p.deUsuarioNombre}</span>
                {isDerivacion && (
                  <>
                    <span className="text-[10px] text-slate-400">→</span>
                    <span className="text-xs font-medium text-slate-700">{p.aUsuarioNombre}</span>
                  </>
                )}
              </div>
              {!isComentario && (
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                    {getSimplifiedEstadoLabel(p.estadoAnterior)} → {getSimplifiedEstadoLabel(p.estadoNuevo)}
                  </span>
                  {p.aArea && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-600">
                      → {LEAD_AREA_LABELS[p.aArea]}
                    </span>
                  )}
                </div>
              )}
              {p.accionRequerida && (
                <p className="text-[11px] mt-0.5 text-amber-700 font-medium">
                  Acción: {p.accionRequerida}
                </p>
              )}
              {p.comentario && (
                <p className={`text-[11px] mt-1 ${isComentario ? 'text-slate-700' : 'text-slate-500'}`}>
                  {isComentario && <span className="text-[10px] font-medium text-amber-600 mr-1">Obs:</span>}
                  {p.comentario}
                </p>
              )}
              <p className="text-[10px] text-slate-400 mt-0.5">
                {new Date(p.fecha).toLocaleString('es-AR')}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
