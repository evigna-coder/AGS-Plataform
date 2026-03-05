import { type FC } from 'react';
import type { AgendaEntry, ZoomLevel } from '@ags/shared';
import { ESTADO_AGENDA_COLORS } from '@ags/shared';

interface AgendaEntryChipProps {
  entry: AgendaEntry;
  startCol: number; // 1-indexed grid column start
  endCol: number;   // 1-indexed grid column end (exclusive)
  zoom: ZoomLevel;
  onClick: () => void;
}

export const AgendaEntryChip: FC<AgendaEntryChipProps> = ({
  entry,
  startCol,
  endCol,
  zoom,
  onClick,
}) => {
  const colorClass = ESTADO_AGENDA_COLORS[entry.estadoAgenda] || 'bg-slate-200 text-slate-700';
  const showText = zoom === 'week';
  const showShortText = zoom === '2weeks';
  const isCancelled = entry.estadoAgenda === 'cancelado';

  return (
    <div
      className={`rounded-md cursor-pointer transition-shadow hover:shadow-md flex items-center overflow-hidden ${colorClass} ${isCancelled ? 'opacity-50' : ''}`}
      style={{
        gridColumn: `${startCol} / ${endCol}`,
        gridRow: 1,
        height: '28px',
        margin: '8px 2px 0',
        zIndex: 5,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={`OT-${entry.otNumber} | ${entry.clienteNombre} | ${entry.tipoServicio}`}
    >
      {showText && (
        <span className={`text-[10px] font-medium px-1.5 truncate ${isCancelled ? 'line-through' : ''}`}>
          OT-{entry.otNumber} | {entry.clienteNombre}
        </span>
      )}
      {showShortText && (
        <span className={`text-[9px] font-medium px-1 truncate ${isCancelled ? 'line-through' : ''}`}>
          {entry.otNumber}
        </span>
      )}
    </div>
  );
};
