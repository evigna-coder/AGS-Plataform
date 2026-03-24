import { type FC, useMemo } from 'react';
import type { Ingeniero, AgendaEntry, ZoomLevel } from '@ags/shared';
import { AgendaGridRow } from './AgendaGridRow';
import {
  buildWeekdayColumns,
  buildCellOccupationMap,
  formatDayHeader,
  formatWeekRange,
} from '../../utils/agendaDateUtils';
import { getISOWeek } from 'date-fns';

interface AgendaWeekBlockProps {
  weekStart: Date;
  weekDays: Date[];
  ingenieros: Ingeniero[];
  entries: AgendaEntry[];
  zoom: ZoomLevel;
  borderless?: boolean;
  selectedCellKey: string | null;
  onCellClick: (ingenieroId: string, fecha: string, quarter: 1 | 2 | 3 | 4) => void;
  onEntryClick: (entries: AgendaEntry[], primary: AgendaEntry) => void;
  onWeekClick: (weekStart: Date) => void;
}

const ZOOM_SIZES: Record<ZoomLevel, { eng: string; cell: string; row: string }> = {
  week: { eng: '140px', cell: '24px', row: '26px' },
  '2weeks': { eng: '120px', cell: '14px', row: '22px' },
  month: { eng: '80px', cell: '4px', row: '16px' },
  '2months': { eng: '60px', cell: '3px', row: '10px' },
  year: { eng: '50px', cell: '2px', row: '6px' },
};

export const AgendaWeekBlock: FC<AgendaWeekBlockProps> = ({
  weekStart, weekDays, ingenieros, entries, zoom, borderless, selectedCellKey,
  onCellClick, onEntryClick, onWeekClick,
}) => {
  const columns = useMemo(() => buildWeekdayColumns(weekDays), [weekDays]);
  const sizes = ZOOM_SIZES[zoom];
  const showText = zoom === 'week' || zoom === '2weeks';
  const compact = zoom !== 'week' && zoom !== '2weeks';

  const gridTemplate = `${sizes.eng} repeat(${columns.length}, minmax(${sizes.cell}, 1fr))`;

  const dayHeaders = useMemo(() => {
    if (borderless) return [];
    const headers: Array<{ date: Date; colStart: number; span: number; isToday: boolean }> = [];
    let i = 0;
    while (i < columns.length) {
      const start = i;
      const dk = columns[i].dateKey;
      while (i < columns.length && columns[i].dateKey === dk) i++;
      headers.push({ date: columns[start].date, colStart: start, span: i - start, isToday: columns[start].isToday });
    }
    return headers;
  }, [columns, borderless]);

  const occupationMaps = useMemo(() => {
    const maps = new Map<string, ReturnType<typeof buildCellOccupationMap>>();
    for (const ing of ingenieros) {
      maps.set(ing.id, buildCellOccupationMap(entries, columns, ing.id));
    }
    return maps;
  }, [ingenieros, entries, columns]);

  const weekNum = getISOWeek(weekStart);

  const engineerRows = ingenieros.map(ing => (
    <AgendaGridRow
      key={ing.id}
      ingeniero={ing}
      columns={columns}
      occupation={occupationMaps.get(ing.id) || new Map()}
      showText={showText}
      compact={compact}
      selectedCellKey={selectedCellKey}
      rowHeight={sizes.row}
      onCellClick={onCellClick}
      onEntryClick={onEntryClick}
    />
  ));

  // ── BORDERLESS: inside month containers (views 2M, Año) ──
  if (borderless) {
    return (
      <div className="border-b border-slate-200">
        <div className="grid" style={{ gridTemplateColumns: gridTemplate }}>
          {engineerRows}
        </div>
      </div>
    );
  }

  // ── STANDALONE: individual week cards (views 1S, 2S, 1M) ──
  const canDrillDown = zoom === 'month' || zoom === '2weeks';

  return (
    <div className="border border-slate-200 rounded bg-white shrink-0">
      {/* Week header — clickable to drill down */}
      {zoom === 'month' ? (
        <div
          className={`bg-slate-50 border-b border-slate-100 px-2 py-px flex items-center gap-1 ${canDrillDown ? 'cursor-pointer hover:bg-slate-100 transition-colors' : ''}`}
          onClick={canDrillDown ? () => onWeekClick(weekStart) : undefined}
        >
          <span className="text-[8px] font-semibold text-teal-600">S{weekNum}</span>
          <span className="text-[8px] text-slate-400">{formatWeekRange(weekStart)}</span>
        </div>
      ) : (
        <div
          className={`bg-slate-50 border-b border-slate-200 px-3 py-0.5 flex items-center gap-2 ${canDrillDown ? 'cursor-pointer hover:bg-slate-100 transition-colors' : ''}`}
          onClick={canDrillDown ? () => onWeekClick(weekStart) : undefined}
        >
          <span className="text-[10px] font-semibold text-teal-600">S{weekNum}</span>
          <span className="text-[10px] text-slate-400">{formatWeekRange(weekStart)}</span>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: gridTemplate }}>
        {/* Day headers */}
        {zoom === 'month' ? (
          <>
            <div className="bg-slate-50 border-r border-b border-slate-100" />
            {dayHeaders.map(dh => {
              const info = formatDayHeader(dh.date);
              return (
                <div
                  key={dh.colStart}
                  className={`text-center border-b border-slate-100 border-r border-r-slate-300 select-none ${dh.isToday ? 'bg-teal-50' : 'bg-slate-50'}`}
                  style={{ gridColumn: `span ${dh.span}` }}
                >
                  <span className={`text-[7px] font-semibold ${dh.isToday ? 'text-teal-600' : 'text-slate-400'}`}>
                    {info.dayNumber}
                  </span>
                </div>
              );
            })}
          </>
        ) : (
          <>
            <div className="bg-slate-50 border-r border-b border-slate-200 px-2 flex items-center">
              <span className="text-[9px] font-medium text-slate-400">Ing.</span>
            </div>
            {dayHeaders.map(dh => {
              const info = formatDayHeader(dh.date);
              return (
                <div
                  key={dh.colStart}
                  className={`text-center border-b border-slate-200 border-r-2 border-r-slate-300 py-0.5 select-none
                    ${dh.isToday ? 'bg-teal-50 border-b-2 border-b-teal-400' : 'bg-slate-50'}
                  `}
                  style={{ gridColumn: `span ${dh.span}` }}
                >
                  <span className="text-[8px] text-slate-400 uppercase">{info.dayName}</span>
                  <span className={`text-[10px] font-semibold ml-0.5 ${dh.isToday ? 'text-teal-600' : 'text-slate-600'}`}>
                    {info.dayNumber}
                  </span>
                </div>
              );
            })}
          </>
        )}

        {engineerRows}
      </div>
    </div>
  );
};
