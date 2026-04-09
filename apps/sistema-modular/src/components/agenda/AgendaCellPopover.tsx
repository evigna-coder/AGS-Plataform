import { type FC } from 'react';
import type { AgendaEntry } from '@ags/shared';
import { ESTADO_AGENDA_LABELS, ESTADO_AGENDA_COLORS } from '@ags/shared';

const Q: Record<number, string> = { 1: 'AM1', 2: 'AM2', 3: 'PM1', 4: 'PM2' };

const BORDER: Record<string, string> = {
  pendiente: 'border-l-slate-400',
  tentativo: 'border-l-amber-400',
  confirmado: 'border-l-blue-500',
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
  const showAbove = vh - cellRect.bottom < 160;
  const w = 360;
  const left = Math.min(Math.max(8, cellRect.left - 40), vw - w - 8);

  const style: React.CSSProperties = {
    position: 'fixed',
    left,
    width: w,
    zIndex: 9999,
    ...(showAbove
      ? { bottom: vh - cellRect.top + 4 }
      : { top: cellRect.bottom + 4 }),
  };

  return (
    <div
      style={style}
      className="bg-white border border-slate-200 rounded-lg shadow-xl"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="p-1.5 space-y-1">
        {entries.map(entry => (
          <div
            key={entry.id}
            className={`rounded-md border border-slate-100 border-l-[3px] ${BORDER[entry.estadoAgenda] ?? 'border-l-slate-400'} px-2.5 py-1.5 flex items-center gap-3`}
          >
            {/* Left: OT + client + details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {entry.otNumber ? (
                  <>
                    <span className="text-[11px] font-bold text-teal-600 shrink-0">OT {entry.otNumber}</span>
                    {entry.clienteNombre && (
                      <span className="text-[11px] text-slate-700 font-medium truncate">{entry.clienteNombre}</span>
                    )}
                  </>
                ) : (
                  <span className="text-[11px] font-bold text-slate-700 truncate">{entry.titulo || 'Tarea'}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 truncate">
                {entry.tipoServicio && <span>{entry.tipoServicio}</span>}
                {entry.sistemaNombre && <><span className="text-slate-200">&middot;</span><span>{entry.sistemaNombre}</span></>}
                {entry.equipoModelo && <><span className="text-slate-200">&middot;</span><span>{entry.equipoModelo}</span></>}
                {entry.establecimientoNombre && <><span className="text-slate-200">&middot;</span><span>{entry.establecimientoNombre}</span></>}
              </div>
            </div>
            {/* Right: quarter + estado */}
            <div className="flex flex-col items-end gap-0.5 shrink-0">
              <span className={`text-[9px] font-medium px-1.5 py-px rounded-full leading-tight ${ESTADO_AGENDA_COLORS[entry.estadoAgenda] || 'bg-slate-200 text-slate-700'}`}>
                {ESTADO_AGENDA_LABELS[entry.estadoAgenda]}
              </span>
              <span className="text-[9px] text-slate-400">
                {Q[entry.quarterStart]}–{Q[entry.quarterEnd]}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
