import { type FC } from 'react';
import type { ZoomLevel } from '@ags/shared';
import { formatRangeLabel } from '../../utils/agendaDateUtils';

interface AgendaHeaderProps {
  anchor: Date;
  zoomLevel: ZoomLevel;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

export const AgendaHeader: FC<AgendaHeaderProps> = ({
  anchor,
  zoomLevel,
  onPrev,
  onNext,
  onToday,
}) => {
  const rangeLabel = formatRangeLabel(anchor, zoomLevel);

  return (
    <div className="shrink-0 bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-3">
      {/* Title */}
      <h1 className="text-base font-semibold tracking-tight text-slate-900 shrink-0">Agenda</h1>

      {/* Nav */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          onClick={onPrev}
          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 transition-colors"
          title="Anterior"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>

        <button
          onClick={onToday}
          className="px-2 py-1 rounded-md hover:bg-slate-100 text-[11px] font-medium text-slate-600 transition-colors"
        >
          Hoy
        </button>

        <button
          onClick={onNext}
          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 transition-colors"
          title="Siguiente"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* Range label */}
      <span className="text-xs text-slate-400 truncate min-w-0">{rangeLabel}</span>

      {/* Spacer */}
      <div className="flex-1" />
    </div>
  );
};
