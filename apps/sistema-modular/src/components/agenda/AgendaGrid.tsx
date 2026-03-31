import { type FC, useMemo, useRef, useEffect, useCallback } from 'react';
import type { Ingeniero, AgendaEntry, ZoomLevel } from '@ags/shared';
import { AgendaWeekBlock } from './AgendaWeekBlock';
import type { SelectionRange } from '../../utils/agendaDateUtils';
import { groupDaysByWeek, groupWeeksByMonth, formatDateKey } from '../../utils/agendaDateUtils';
import { endOfWeek } from 'date-fns';

interface AgendaGridProps {
  ingenieros: Ingeniero[];
  visibleDays: Date[];
  zoom: ZoomLevel;
  entries: AgendaEntry[];
  selectedCellKey: string | null;
  selectionRange: SelectionRange | null;
  onCellClick: (ingenieroId: string, fecha: string, quarter: 1 | 2 | 3 | 4, shiftKey?: boolean) => void;
  onEntryClick: (entries: AgendaEntry[], primary: AgendaEntry) => void;
  onZoomChange: (zoom: ZoomLevel) => void;
  onWeekClick: (weekStart: Date) => void;
  onCellContextMenu?: (ingenieroId: string, fecha: string, quarter: 1|2|3|4, e: React.MouseEvent) => void;
  feriados?: Set<string>;
  onToggleFeriado?: (fecha: string) => void;
}

const ZOOM_ORDER: ZoomLevel[] = ['week', '2weeks', 'month', '2months', 'year'];

export const AgendaGrid: FC<AgendaGridProps> = ({
  ingenieros, visibleDays, zoom, entries, selectedCellKey, selectionRange,
  onCellClick, onEntryClick, onZoomChange, onWeekClick, onCellContextMenu,
  feriados, onToggleFeriado,
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

  // Pre-filter entries per week so memo works (stable reference when week's entries don't change)
  const entriesByWeek = useMemo(() => {
    const map = new Map<string, AgendaEntry[]>();
    for (const week of weeks) {
      const wStart = formatDateKey(week.weekStart);
      const wEnd = formatDateKey(endOfWeek(week.weekStart, { weekStartsOn: 1 }));
      const filtered = entries.filter(e => e.fechaFin >= wStart && e.fechaInicio <= wEnd);
      map.set(wStart, filtered);
    }
    return map;
  }, [weeks, entries]);

  const wb = useCallback((week: { weekStart: Date; days: Date[] }, borderless?: boolean) => {
    const wKey = formatDateKey(week.weekStart);
    return (
      <AgendaWeekBlock
        key={wKey}
        weekStart={week.weekStart}
        weekDays={week.days}
        ingenieros={ingenieros}
        entries={entriesByWeek.get(wKey) || []}
        zoom={zoom}
        borderless={borderless}
        selectedCellKey={selectedCellKey}
        selectionRange={selectionRange}
        onCellClick={onCellClick}
        onEntryClick={onEntryClick}
        onWeekClick={onWeekClick}
        onCellContextMenu={onCellContextMenu}
        feriados={feriados}
        onToggleFeriado={onToggleFeriado}
      />
    );
  }, [ingenieros, entriesByWeek, zoom, selectedCellKey, selectionRange, onCellClick, onEntryClick, onWeekClick, onCellContextMenu, feriados, onToggleFeriado]);

  // ── Views 1 & 2 (1S, 2S): vertical stack ──
  if (zoom === 'week' || zoom === '2weeks') {
    return (
      <div ref={gridRef} className="h-full overflow-y-auto p-2 flex flex-col gap-2">
        {weeks.map(w => wb(w))}
        {emptyState}
      </div>
    );
  }

  // ── Views 3+ group weeks by month ──
  const monthGroups = groupWeeksByMonth(weeks);

  // ── View 3 (1M): month rows with vertical label + weeks side by side ──
  if (zoom === 'month') {
    return (
      <div ref={gridRef} className="h-full overflow-auto p-2 space-y-1.5">
        {monthGroups.map(group => (
          <div key={group.monthKey} className="flex gap-1.5">
            {/* Vertical month label */}
            <div className="flex items-center justify-center w-5 shrink-0 rounded bg-slate-800">
              <span className="text-[9px] font-bold text-white uppercase tracking-widest whitespace-nowrap"
                style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}>
                {group.label.split(' ')[0]}
              </span>
            </div>
            {/* Weeks row */}
            <div className="flex gap-1.5">
              {group.weeks.map(w => (
                <div key={formatDateKey(w.weekStart)} className="shrink-0">
                  {wb(w)}
                </div>
              ))}
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
    <div ref={gridRef} className={`h-full overflow-y-auto p-2 grid ${monthCols} gap-2 auto-rows-min content-start`}>
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
