import { type FC, useMemo, useRef, useEffect } from 'react';
import type { Ingeniero, AgendaEntry, ZoomLevel } from '@ags/shared';
import { AgendaWeekBlock } from './AgendaWeekBlock';
import { groupDaysByWeek, groupWeeksByMonth, formatDateKey } from '../../utils/agendaDateUtils';

interface AgendaGridProps {
  ingenieros: Ingeniero[];
  visibleDays: Date[];
  zoom: ZoomLevel;
  entries: AgendaEntry[];
  selectedCellKey: string | null;
  onCellClick: (ingenieroId: string, fecha: string, quarter: 1 | 2 | 3 | 4) => void;
  onEntryClick: (entries: AgendaEntry[], primary: AgendaEntry) => void;
  onZoomChange: (zoom: ZoomLevel) => void;
  onWeekClick: (weekStart: Date) => void;
}

const ZOOM_ORDER: ZoomLevel[] = ['week', '2weeks', 'month', '2months', 'year'];

export const AgendaGrid: FC<AgendaGridProps> = ({
  ingenieros, visibleDays, zoom, entries, selectedCellKey,
  onCellClick, onEntryClick, onZoomChange, onWeekClick,
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const weeks = useMemo(() => groupDaysByWeek(visibleDays), [visibleDays]);

  // Ctrl+Scroll zoom
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const idx = ZOOM_ORDER.indexOf(zoom);
      if (e.deltaY < 0 && idx > 0) onZoomChange(ZOOM_ORDER[idx - 1]);
      else if (e.deltaY > 0 && idx < ZOOM_ORDER.length - 1) onZoomChange(ZOOM_ORDER[idx + 1]);
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [zoom, onZoomChange]);

  const emptyState = ingenieros.length === 0 ? (
    <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
      No hay ingenieros activos. Agrega ingenieros desde Stock &gt; Ingenieros.
    </div>
  ) : null;

  const wb = (week: { weekStart: Date; days: Date[] }, borderless?: boolean) => (
    <AgendaWeekBlock
      key={formatDateKey(week.weekStart)}
      weekStart={week.weekStart}
      weekDays={week.days}
      ingenieros={ingenieros}
      entries={entries}
      zoom={zoom}
      borderless={borderless}
      selectedCellKey={selectedCellKey}
      onCellClick={onCellClick}
      onEntryClick={onEntryClick}
      onWeekClick={onWeekClick}
    />
  );

  // ── Views 1 & 2 (1S, 2S): vertical stack ──
  if (zoom === 'week' || zoom === '2weeks') {
    return (
      <div ref={gridRef} className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
        {weeks.map(w => wb(w))}
        {emptyState}
      </div>
    );
  }

  // ── Views 3+ group weeks by month ──
  const monthGroups = groupWeeksByMonth(weeks);

  // ── View 3 (1M): week cards in 4-col grid per month ──
  if (zoom === 'month') {
    return (
      <div ref={gridRef} className="flex-1 overflow-y-auto p-2 space-y-3">
        {monthGroups.map(group => (
          <div key={group.monthKey}>
            <h3 className="text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1 px-1">
              {group.label}
            </h3>
            <div className="grid grid-cols-4 gap-1.5">
              {group.weeks.map(w => wb(w))}
            </div>
          </div>
        ))}
        {emptyState}
      </div>
    );
  }

  // ── Views 4 & 5 (2M, Año): month blocks containing week sub-blocks ──
  const monthCols = zoom === 'year' ? 'grid-cols-4' : 'grid-cols-3';

  return (
    <div ref={gridRef} className={`flex-1 overflow-y-auto p-2 grid ${monthCols} gap-2 auto-rows-min content-start`}>
      {monthGroups.map(group => (
        <div key={group.monthKey} className="border border-slate-300 rounded bg-white">
          <div className="bg-slate-100 border-b border-slate-200 px-2 py-0.5">
            <span className={`${zoom === 'year' ? 'text-[8px]' : 'text-[9px]'} font-bold text-slate-600 uppercase tracking-wide`}>
              {group.label}
            </span>
          </div>
          <div className="flex flex-col">
            {group.weeks.map(w => wb(w, true))}
          </div>
        </div>
      ))}
      {emptyState}
    </div>
  );
};
