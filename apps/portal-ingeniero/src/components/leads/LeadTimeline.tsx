import type { Posta } from '@ags/shared';
import { getSimplifiedEstadoLabel, LEAD_AREA_LABELS } from '@ags/shared';

interface Props {
  postas: Posta[];
}

export default function LeadTimeline({ postas }: Props) {
  if (postas.length === 0) {
    return <p className="text-xs text-slate-400 text-center py-4">Sin actividad registrada</p>;
  }

  const sorted = [...postas].sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <div className="space-y-0">
      {sorted.map((p, i) => {
        const isComment = p.estadoAnterior === p.estadoNuevo;
        const fecha = new Date(p.fecha).toLocaleDateString('es-AR', {
          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
        });

        return (
          <div key={p.id || i} className="flex gap-3 pb-4 last:pb-0">
            <div className="flex flex-col items-center">
              <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${isComment ? 'bg-amber-400' : 'bg-teal-500'}`} />
              {i < sorted.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-slate-400">{fecha}</p>
              {isComment ? (
                <p className="text-[11px] text-slate-600 mt-0.5">
                  <span className="font-medium">{p.deUsuarioNombre}</span> agregó comentario
                </p>
              ) : (
                <p className="text-[11px] text-slate-600 mt-0.5">
                  <span className="font-medium">{p.deUsuarioNombre}</span>
                  {p.aUsuarioNombre && (
                    <>
                      {' → '}
                      <span className="font-medium">{p.aUsuarioNombre}</span>
                    </>
                  )}
                  {' · '}
                  <span className="text-slate-400">
                    {getSimplifiedEstadoLabel(p.estadoAnterior)} → {getSimplifiedEstadoLabel(p.estadoNuevo)}
                  </span>
                  {p.aArea && (
                    <span className="text-[10px] font-medium text-teal-500 ml-1">
                      → {LEAD_AREA_LABELS[p.aArea]}
                    </span>
                  )}
                </p>
              )}
              {p.accionRequerida && (
                <p className="text-[11px] text-amber-700 font-medium mt-0.5">
                  Acción: {p.accionRequerida}
                </p>
              )}
              {p.comentario && (
                <p className="text-[11px] text-slate-500 mt-0.5 italic">{p.comentario}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
