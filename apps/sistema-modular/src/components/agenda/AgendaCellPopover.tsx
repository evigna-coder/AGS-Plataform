import { type FC } from 'react';
import type { AgendaEntry } from '@ags/shared';
import { ESTADO_AGENDA_LABELS, ESTADO_AGENDA_COLORS } from '@ags/shared';

const BORDER: Record<string, string> = {
  pendiente: 'border-l-slate-400',
  tentativo: 'border-l-slate-400',
  tentativo_interior: 'border-l-[#a09a4e]',
  confirmado: 'border-l-blue-500',
  confirmado_interior: 'border-l-[#6d8ec9]',
  en_progreso: 'border-l-teal-500',
  completado: 'border-l-emerald-500',
  cancelado: 'border-l-red-400',
};

interface AgendaCellPopoverProps {
  entries: AgendaEntry[];
  cellRect: DOMRect;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export const AgendaCellPopover: FC<AgendaCellPopoverProps> = ({
  entries,
  cellRect,
  onMouseEnter,
  onMouseLeave,
}) => {
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  // Altura estimada REAL (2026-08-03): ~54px por card + padding. El umbral
  // fijo de 160px cortaba la lista con muchas OTs en las filas de abajo.
  const estimatedH = entries.length * 54 + 16;
  const spaceBelow = vh - cellRect.bottom - 8;
  const spaceAbove = cellRect.top - 8;
  const showAbove = spaceBelow < Math.min(estimatedH, 300) && spaceAbove > spaceBelow;
  const maxH = Math.max(120, (showAbove ? spaceAbove : spaceBelow) - 8);
  const w = Math.min(400, vw - 16);
  const left = Math.min(Math.max(8, cellRect.left - 40), vw - w - 8);

  const style: React.CSSProperties = {
    position: 'fixed',
    left,
    width: w,
    zIndex: 9999,
    maxHeight: maxH,
    ...(showAbove
      ? { bottom: vh - cellRect.top + 4 }
      : { top: cellRect.bottom + 4 }),
  };

  return (
    <div
      style={style}
      // Transparencia leve + blur: la agenda de fondo se sigue viendo (pedido
      // 2026-08-03). overflow-y-auto: si ni arriba entra todo, scrollea.
      className="bg-white/90 backdrop-blur-[2px] border border-slate-200 rounded-lg shadow-xl overflow-y-auto"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="p-1.5 space-y-1">
        {entries.map(entry => (
          <div
            key={entry.id}
            className={`rounded-md border border-slate-100 border-l-[3px] ${
              entry.estadoAgenda !== 'cancelado' && entry.tipoServicio?.toLowerCase().includes('capacitaci')
                ? 'border-l-[#e59a8e]'
                : BORDER[entry.estadoAgenda] ?? 'border-l-slate-400'
            } px-2.5 py-1.5 flex items-start gap-3`}
          >
            {/* 3 renglones (layout coordinación 2026-08-03):
                OT - código cliente - sistema / Cliente / Descripción del servicio */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {entry.otNumber ? (
                  <span className="text-[11px] font-bold text-teal-600 shrink-0">OT {entry.otNumber}</span>
                ) : (
                  <span className="text-[11px] font-bold text-slate-700 truncate">{entry.titulo || 'Tarea'}</span>
                )}
                {entry.equipoAgsId && (
                  <><span className="text-slate-300">–</span>
                  <span className="text-[11px] font-mono font-semibold text-slate-700 shrink-0">{entry.equipoAgsId}</span></>
                )}
                {(entry.sistemaNombre || entry.equipoModelo) && (
                  <><span className="text-slate-300">–</span>
                  <span className="text-[11px] text-slate-500 truncate">{entry.sistemaNombre || entry.equipoModelo}</span></>
                )}
              </div>
              {(entry.clienteNombre || entry.establecimientoNombre) && (
                <div className="text-[11px] text-slate-700 font-medium truncate">
                  {entry.clienteNombre}
                  {entry.clienteNombre && entry.establecimientoNombre && <span className="text-slate-300"> / </span>}
                  {entry.establecimientoNombre && <span className="text-slate-500 font-normal">{entry.establecimientoNombre}</span>}
                </div>
              )}
              {entry.tipoServicio && (
                <div className="text-[10px] text-slate-400 truncate">{entry.tipoServicio}</div>
              )}
            </div>
            {/* Right: estado */}
            <span className={`text-[9px] font-medium px-1.5 py-px rounded-full leading-tight shrink-0 ${ESTADO_AGENDA_COLORS[entry.estadoAgenda] || 'bg-slate-200 text-slate-700'}`}>
              {ESTADO_AGENDA_LABELS[entry.estadoAgenda]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
