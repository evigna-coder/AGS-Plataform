import { type FC, useMemo, useCallback, useEffect, useState } from 'react';
import type { Ingeniero, AgendaEntry, AgendaNota, ZoomLevel } from '@ags/shared';
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
  onWeekClick: (weekStart: Date) => void;
  onCellContextMenu?: (ingenieroId: string, fecha: string, quarter: 1|2|3|4, e: React.MouseEvent) => void;
  feriados?: Set<string>;
  onToggleFeriado?: (fecha: string) => void;
  /** Comentarios de agenda (estilo Excel), por ingeniero+fecha. */
  notas?: AgendaNota[];
  /** Días AGS (no laborables POR INGENIERO): claves `${ingenieroId}_${fecha}`. */
  diasAgs?: Set<string>;
}

export const AgendaGrid: FC<AgendaGridProps> = ({
  ingenieros, visibleDays, zoom, entries, selectedCellKey, selectionRange,
  onCellClick, onEntryClick, onWeekClick, onCellContextMenu,
  feriados, onToggleFeriado, notas, diasAgs,
}) => {
  // Extract selected fecha from cellKey ("ingId:YYYY-MM-DD:quarter") for per-week filtering
  const selectedFecha = selectedCellKey ? selectedCellKey.split(':')[1] : null;
  const weeks = useMemo(() => groupDaysByWeek(visibleDays), [visibleDays]);

  // ── Alto de fila ADAPTATIVO (2026-08-03): en monitores más chicos las vistas
  // 1S/2S/1M generaban scroll vertical — se mide el alto disponible y se
  // reparte entre las filas (con mínimo legible). En pantallas grandes el
  // clamp superior mantiene el tamaño de siempre.
  const [gridEl, setGridEl] = useState<HTMLDivElement | null>(null);
  const [availH, setAvailH] = useState(0);
  useEffect(() => {
    if (!gridEl) return;
    const ro = new ResizeObserver(() => setAvailH(gridEl.clientHeight));
    ro.observe(gridEl);
    setAvailH(gridEl.clientHeight);
    return () => ro.disconnect();
  }, [gridEl]);

  const nIng = Math.max(1, ingenieros.length);
  const rowHeightPx = useMemo(() => {
    if (!availH) return undefined;
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    // Overheads ≈ padding del contenedor + header de semana + header de días
    // + bordes, medidos sobre el layout actual.
    if (zoom === 'week') return clamp(Math.floor((availH - 74) / nIng), 16, 26);
    if (zoom === '2weeks') return clamp(Math.floor((availH - 128) / (nIng * 2)), 12, 22);
    if (zoom === 'month') {
      const rows = Math.max(1, groupWeeksByMonth(weeks).length);
      return clamp(Math.floor((availH - 16 - rows * 36) / (nIng * rows)), 8, 16);
    }
    return undefined; // 2M / Año: grillas panorámicas, quedan como están
  }, [availH, zoom, nIng, weeks]);

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
    const wEnd = formatDateKey(endOfWeek(week.weekStart, { weekStartsOn: 1 }));
    // Only pass selectedCellKey to the week that actually contains the selection
    const weekSelected = selectedFecha ? selectedFecha >= wKey && selectedFecha <= wEnd : false;
    const weekInRange = selectionRange
      ? selectionRange.endFecha >= wKey && selectionRange.startFecha <= wEnd
      : false;
    return (
      <AgendaWeekBlock
        key={wKey}
        weekStart={week.weekStart}
        weekDays={week.days}
        ingenieros={ingenieros}
        entries={entriesByWeek.get(wKey) || []}
        zoom={zoom}
        borderless={borderless}
        selectedCellKey={weekSelected ? selectedCellKey : null}
        selectionRange={weekInRange ? selectionRange : null}
        onCellClick={onCellClick}
        onEntryClick={onEntryClick}
        onWeekClick={onWeekClick}
        onCellContextMenu={onCellContextMenu}
        feriados={feriados}
        onToggleFeriado={onToggleFeriado}
        notas={notas}
        diasAgs={diasAgs}
        rowHeightPx={rowHeightPx}
      />
    );
  }, [ingenieros, entriesByWeek, zoom, selectedFecha, selectedCellKey, selectionRange,
      onCellClick, onEntryClick, onWeekClick, onCellContextMenu, feriados, onToggleFeriado, notas, diasAgs, rowHeightPx]);

  // ── Views 1 & 2 (1S, 2S): vertical stack ──
  if (zoom === 'week' || zoom === '2weeks') {
    return (
      <div ref={setGridEl} className="h-full overflow-y-auto p-2 flex flex-col gap-2">
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
      <div ref={setGridEl} className="h-full overflow-auto p-2 space-y-1.5">
        {monthGroups.map(group => (
          <div key={group.monthKey} className="flex gap-1.5">
            {/* Vertical month label — color alternado por mes (2026-08-03) */}
            <div className={`flex items-center justify-center w-5 shrink-0 rounded ${parseInt(group.monthKey.slice(5, 7), 10) % 2 === 1 ? 'bg-slate-800' : 'bg-teal-700'}`}>
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
    <div ref={setGridEl} className={`h-full overflow-y-auto p-2 grid ${monthCols} gap-2 auto-rows-min content-start`}>
      {monthGroups.map(group => (
        <div key={group.monthKey} className="border border-slate-300 rounded bg-white">
          {/* Header de mes — tinte alternado por mes (2026-08-03) */}
          <div className={`border-b border-slate-200 px-2 py-0.5 ${parseInt(group.monthKey.slice(5, 7), 10) % 2 === 1 ? 'bg-slate-800' : 'bg-teal-700'}`}>
            <span className={`${zoom === 'year' ? 'text-[8px]' : 'text-[9px]'} font-bold text-white uppercase tracking-wide`}>
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
