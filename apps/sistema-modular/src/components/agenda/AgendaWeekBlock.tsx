import { memo, useMemo, useRef } from 'react';
import type { Ingeniero, AgendaEntry, ZoomLevel } from '@ags/shared';
import { AgendaGridRow } from './AgendaGridRow';
import type { SelectionRange } from '../../utils/agendaDateUtils';
import {
  buildWeekdayColumns,
  formatDayHeader,
  formatDateKey,
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
  selectionRange: SelectionRange | null;
  onCellClick: (ingenieroId: string, fecha: string, quarter: 1 | 2 | 3 | 4, shiftKey?: boolean) => void;
  onEntryClick: (entries: AgendaEntry[], primary: AgendaEntry) => void;
  onWeekClick: (weekStart: Date) => void;
  onCellContextMenu?: (ingenieroId: string, fecha: string, quarter: 1|2|3|4, e: React.MouseEvent) => void;
  feriados?: Set<string>;
  onToggleFeriado?: (fecha: string) => void;
}

const ZOOM_SIZES: Record<ZoomLevel, { eng: string; cell: string; row: string }> = {
  week: { eng: '140px', cell: '24px', row: '26px' },
  '2weeks': { eng: '120px', cell: '14px', row: '22px' },
  month: { eng: '80px', cell: '16px', row: '16px' },
  '2months': { eng: '60px', cell: '3px', row: '10px' },
  year: { eng: '50px', cell: '2px', row: '6px' },
};

export const AgendaWeekBlock = memo<AgendaWeekBlockProps>(({
  weekStart, weekDays, ingenieros, entries, zoom, borderless, selectedCellKey, selectionRange,
  onCellClick, onEntryClick, onWeekClick, onCellContextMenu, feriados, onToggleFeriado,
}) => {
  const columns = useMemo(() => buildWeekdayColumns(weekDays), [weekDays]);
  const sizes = ZOOM_SIZES[zoom];
  const showText = zoom === 'week' || zoom === '2weeks';
  const compact = zoom !== 'week' && zoom !== '2weeks';

  const gridTemplate = compact
    ? `${sizes.eng} repeat(${columns.length}, ${sizes.cell})`
    : `${sizes.eng} repeat(${columns.length}, minmax(${sizes.cell}, 1fr))`;

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

  // Stable per-engineer entry arrays — only updates the engineer whose entries changed.
  // This prevents sibling rows from re-rendering when an unrelated entry changes.
  const engEntriesRef = useRef(new Map<string, AgendaEntry[]>());
  const entriesByEngineer = useMemo(() => {
    const newMap = new Map<string, AgendaEntry[]>();
    for (const ing of ingenieros) {
      const filtered = entries.filter(e => e.ingenieroId === ing.id);
      const prev = engEntriesRef.current.get(ing.id);
      // Reuse stable reference if this engineer's entries haven't changed
      if (prev && prev.length === filtered.length &&
          filtered.every((e, i) => e.id === prev[i].id && e.updatedAt === prev[i].updatedAt && e.estadoAgenda === prev[i].estadoAgenda)) {
        newMap.set(ing.id, prev);
      } else {
        newMap.set(ing.id, filtered);
      }
    }
    engEntriesRef.current = newMap;
    return newMap;
  }, [ingenieros, entries]);

  const weekNum = getISOWeek(weekStart);

  const engineerRows = useMemo(() => ingenieros.map(ing => (
    <AgendaGridRow
      key={ing.id}
      ingeniero={ing}
      columns={columns}
      engineerEntries={entriesByEngineer.get(ing.id) || []}
      showText={showText}
      compact={compact}
      selectedCellKey={selectedCellKey}
      selectionRange={selectionRange}
      rowHeight={sizes.row}
      feriados={feriados}
      onCellClick={onCellClick}
      onEntryClick={onEntryClick}
      onCellContextMenu={onCellContextMenu}
    />
  )), [ingenieros, columns, entriesByEngineer, showText, compact, selectedCellKey, selectionRange,
      sizes.row, feriados, onCellClick, onEntryClick, onCellContextMenu]);

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
  const canDrillDown = zoom === 'month';

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
              const dk = formatDateKey(dh.date);
              const isFeriado = feriados?.has(dk);
              return (
                <div
                  key={dh.colStart}
                  className={`text-center border-b border-slate-100 border-r border-r-slate-300 select-none ${isFeriado ? 'bg-red-100' : dh.isToday ? 'bg-teal-50' : 'bg-slate-50'}`}
                  style={{ gridColumn: `span ${dh.span}` }}
                  onContextMenu={(e) => { e.preventDefault(); onToggleFeriado?.(dk); }}
                >
                  <span className={`text-[7px] ${isFeriado ? 'text-red-500' : dh.isToday ? 'text-teal-600' : 'text-slate-400'}`}>
                    <span className="uppercase">{info.dayName}</span> <span className="font-semibold">{info.dayNumber}</span>
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
              const dk = formatDateKey(dh.date);
              const isFeriado = feriados?.has(dk);
              return (
                <div
                  key={dh.colStart}
                  className={`text-center border-b border-slate-200 border-r-2 border-r-slate-300 py-0.5 select-none
                    ${isFeriado ? 'bg-red-100 border-b-2 border-b-red-400' : dh.isToday ? 'bg-teal-50 border-b-2 border-b-teal-400' : 'bg-slate-50'}
                  `}
                  style={{ gridColumn: `span ${dh.span}` }}
                  onContextMenu={(e) => { e.preventDefault(); onToggleFeriado?.(dk); }}
                >
                  <span className={`text-[8px] ${isFeriado ? 'text-red-500' : 'text-slate-400'} uppercase`}>{info.dayName}</span>
                  <span className={`text-[10px] font-semibold ml-0.5 ${isFeriado ? 'text-red-600' : dh.isToday ? 'text-teal-600' : 'text-slate-600'}`}>
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
});
