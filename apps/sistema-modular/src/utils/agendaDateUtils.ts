import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  addDays,
  startOfMonth,
  endOfMonth,
  format,
  eachDayOfInterval,
  isToday,
  isWeekend,
  isSameDay,
  parseISO,
  getDay,
  getISOWeek,
} from 'date-fns';
import { es } from 'date-fns/locale';
import type { ZoomLevel, AgendaEntry } from '@ags/shared';

/** Monday of the week containing `date`. */
export function getMonday(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

/** All 7 days (Mon-Sun) of the week starting at `weekStart`. */
export function getWeekDays(weekStart: Date): Date[] {
  return eachDayOfInterval({
    start: weekStart,
    end: endOfWeek(weekStart, { weekStartsOn: 1 }),
  });
}

/** Format date as 'YYYY-MM-DD'. */
export function formatDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/** Display info for a day header. */
export function formatDayHeader(date: Date) {
  return {
    dayName: format(date, 'EEE', { locale: es }),
    dayNumber: format(date, 'd'),
    monthName: format(date, 'MMM', { locale: es }),
    monthNameFull: format(date, 'MMMM', { locale: es }).toUpperCase(),
    isToday: isToday(date),
    isWeekend: isWeekend(date),
    dayOfWeek: getDay(date),
    isoWeek: getISOWeek(date),
  };
}

/** Format week range for display: "3 - 9 Mar 2026". */
export function formatWeekRange(weekStart: Date): string {
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const startMonth = format(weekStart, 'MMM', { locale: es });
  const endMonth = format(weekEnd, 'MMM', { locale: es });
  const year = format(weekEnd, 'yyyy');
  if (startMonth === endMonth) {
    return `${format(weekStart, 'd')} - ${format(weekEnd, 'd')} ${startMonth} ${year}`;
  }
  return `${format(weekStart, 'd')} ${startMonth} - ${format(weekEnd, 'd')} ${endMonth} ${year}`;
}

/** Visible date range based on zoom level. */
export function getVisibleRange(anchor: Date, zoom: ZoomLevel): [Date, Date] {
  const monday = getMonday(anchor);
  switch (zoom) {
    case 'week':
      return [monday, endOfWeek(monday, { weekStartsOn: 1 })];
    case '2weeks':
      // Show 4 weeks to fill screen
      return [monday, endOfWeek(addWeeks(monday, 3), { weekStartsOn: 1 })];
    case 'month': {
      // Show full year
      const y = anchor.getFullYear();
      const yearStart = new Date(y, 0, 1);
      const yearEnd = new Date(y, 11, 31);
      return [getMonday(yearStart), endOfWeek(yearEnd, { weekStartsOn: 1 })];
    }
    case '2months': {
      // Show ~3 months
      const ms = startOfMonth(anchor);
      const nme = endOfMonth(addDays(endOfMonth(addDays(endOfMonth(anchor), 1)), 1));
      return [getMonday(ms), endOfWeek(nme, { weekStartsOn: 1 })];
    }
    case 'year': {
      const y = anchor.getFullYear();
      const yearStart = new Date(y, 0, 1);
      const yearEnd = new Date(y, 11, 31);
      return [getMonday(yearStart), endOfWeek(yearEnd, { weekStartsOn: 1 })];
    }
  }
}

/** All days in the visible range. */
export function getVisibleDays(anchor: Date, zoom: ZoomLevel): Date[] {
  const [start, end] = getVisibleRange(anchor, zoom);
  return eachDayOfInterval({ start, end });
}

/**
 * Group visible days into weeks. Each week is Mon-Sun (7 days).
 * Returns array of { weekStart, days: Date[] }
 */
export function groupDaysByWeek(days: Date[]): { weekStart: Date; days: Date[] }[] {
  const weeks: { weekStart: Date; days: Date[] }[] = [];
  let currentWeek: Date[] = [];
  let currentWeekStart: Date | null = null;

  for (const day of days) {
    const mon = getMonday(day);
    if (!currentWeekStart || !isSameDay(mon, currentWeekStart)) {
      if (currentWeek.length > 0 && currentWeekStart) {
        weeks.push({ weekStart: currentWeekStart, days: currentWeek });
      }
      currentWeek = [day];
      currentWeekStart = mon;
    } else {
      currentWeek.push(day);
    }
  }
  if (currentWeek.length > 0 && currentWeekStart) {
    weeks.push({ weekStart: currentWeekStart, days: currentWeek });
  }

  return weeks;
}

/** Group weeks by month (using Monday's month to determine grouping). */
export function groupWeeksByMonth(
  weeks: { weekStart: Date; days: Date[] }[],
): { monthKey: string; label: string; weeks: { weekStart: Date; days: Date[] }[] }[] {
  const groups: { monthKey: string; label: string; weeks: { weekStart: Date; days: Date[] }[] }[] = [];

  for (const week of weeks) {
    const mk = format(week.weekStart, 'yyyy-MM');
    const label = format(week.weekStart, 'MMMM yyyy', { locale: es }).toUpperCase();

    if (groups.length > 0 && groups[groups.length - 1].monthKey === mk) {
      groups[groups.length - 1].weeks.push(week);
    } else {
      groups.push({ monthKey: mk, label, weeks: [week] });
    }
  }

  return groups;
}

/** Column descriptor for the per-week grid (weekdays only, 4 quarters each). */
export type GridColumn = {
  type: 'quarter';
  date: Date;
  dateKey: string;
  quarter: 1 | 2 | 3 | 4;
  dayIdx: number;
  isToday: boolean;
};

/**
 * Build columns for a single week block (Mon-Fri, skip weekends).
 * 5 weekdays x 4 quarters = 20 columns.
 */
export function buildWeekdayColumns(weekDays: Date[]): GridColumn[] {
  const cols: GridColumn[] = [];
  let dayIdx = 0;
  for (const day of weekDays) {
    if (isWeekend(day)) continue;
    const dk = formatDateKey(day);
    for (const q of [1, 2, 3, 4] as const) {
      cols.push({ type: 'quarter', date: day, dateKey: dk, quarter: q, dayIdx, isToday: isToday(day) });
    }
    dayIdx++;
  }
  return cols;
}

/**
 * Calculates the column start/end in the columns array
 * for a given agenda entry within a specific week's columns.
 */
export function calculateEntryColumns(
  entry: AgendaEntry,
  columns: GridColumn[],
): { startIdx: number; endIdx: number } | null {
  const entryStart = parseISO(entry.fechaInicio);
  const entryEnd = parseISO(entry.fechaFin);

  let startIdx = -1;
  let endIdx = -1;

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    // Check start
    if (startIdx === -1) {
      if (isSameDay(col.date, entryStart) && col.quarter === entry.quarterStart) {
        startIdx = i;
      } else if (col.date > entryStart) {
        startIdx = i;
      }
    }
    // Check end
    if (isSameDay(col.date, entryEnd) && col.quarter === entry.quarterEnd) {
      endIdx = i;
    } else if (col.date < entryEnd) {
      endIdx = i;
    } else if (isSameDay(col.date, entryEnd) && col.quarter <= entry.quarterEnd) {
      endIdx = i;
    }
  }

  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) return null;
  return { startIdx, endIdx };
}

/** Cell occupation info for a single entry within a column. */
export interface CellOccupation {
  entry: AgendaEntry;
  isStart: boolean;
  isEnd: boolean;
}

/**
 * Build a map of columnIndex → CellOccupation[] for one engineer.
 * Multiple entries can occupy the same cell.
 */
export function buildCellOccupationMap(
  entries: AgendaEntry[],
  columns: GridColumn[],
  ingenieroId: string,
): Map<number, CellOccupation[]> {
  const map = new Map<number, CellOccupation[]>();
  const engEntries = entries.filter(e => e.ingenieroId === ingenieroId);

  for (const entry of engEntries) {
    const span = calculateEntryColumns(entry, columns);
    if (!span) continue;
    for (let i = span.startIdx; i <= span.endIdx; i++) {
      const occ: CellOccupation = { entry, isStart: i === span.startIdx, isEnd: i === span.endIdx };
      const existing = map.get(i);
      if (existing) existing.push(occ);
      else map.set(i, [occ]);
    }
  }
  return map;
}

/** Navigate to previous period. */
export function navigatePrev(anchor: Date, zoom: ZoomLevel): Date {
  switch (zoom) {
    case 'week': return subWeeks(anchor, 1);
    case '2weeks': return subWeeks(anchor, 4);
    case 'month': return new Date(anchor.getFullYear() - 1, 0, 1);
    case '2months': return startOfMonth(subWeeks(anchor, 12));
    case 'year': return new Date(anchor.getFullYear() - 1, 0, 1);
  }
}

/** Navigate to next period. */
export function navigateNext(anchor: Date, zoom: ZoomLevel): Date {
  switch (zoom) {
    case 'week': return addWeeks(anchor, 1);
    case '2weeks': return addWeeks(anchor, 4);
    case 'month': return new Date(anchor.getFullYear() + 1, 0, 1);
    case '2months': return startOfMonth(addWeeks(anchor, 13));
    case 'year': return new Date(anchor.getFullYear() + 1, 0, 1);
  }
}

/** Selected cell state for keyboard nav and info bar. */
export interface SelectedCell {
  ingenieroId: string;
  ingenieroNombre: string;
  fecha: string;
  quarter: 1 | 2 | 3 | 4;
  entry: AgendaEntry | null;
  allEntries: AgendaEntry[];
}

/** Find all entries occupying a specific cell. */
export function findEntriesAtCell(
  entries: AgendaEntry[], ingenieroId: string, fecha: string, quarter: 1 | 2 | 3 | 4,
): AgendaEntry[] {
  return entries.filter(e => {
    if (e.ingenieroId !== ingenieroId) return false;
    if (fecha < e.fechaInicio || fecha > e.fechaFin) return false;
    if (fecha === e.fechaInicio && quarter < e.quarterStart) return false;
    if (fecha === e.fechaFin && quarter > e.quarterEnd) return false;
    return true;
  });
}

/** Range of selected cells for multi-select (same engineer, contiguous quarters). */
export interface SelectionRange {
  ingenieroId: string;
  ingenieroNombre: string;
  startFecha: string;
  startQuarter: 1 | 2 | 3 | 4;
  endFecha: string;
  endQuarter: 1 | 2 | 3 | 4;
}

/** Normalize a selection range so start <= end. */
export function normalizeRange(r: SelectionRange): SelectionRange {
  const startKey = `${r.startFecha}:${r.startQuarter}`;
  const endKey = `${r.endFecha}:${r.endQuarter}`;
  if (startKey <= endKey) return r;
  return { ...r, startFecha: r.endFecha, startQuarter: r.endQuarter, endFecha: r.startFecha, endQuarter: r.startQuarter };
}

/** Check if a cell (ingeniero + fecha + quarter) is within a selection range. */
export function isCellInRange(
  ingenieroId: string, fecha: string, quarter: 1 | 2 | 3 | 4,
  range: SelectionRange | null,
): boolean {
  if (!range || ingenieroId !== range.ingenieroId) return false;
  const n = normalizeRange(range);
  const cellKey = `${fecha}:${quarter}`;
  const startKey = `${n.startFecha}:${n.startQuarter}`;
  const endKey = `${n.endFecha}:${n.endQuarter}`;
  return cellKey >= startKey && cellKey <= endKey;
}

/** Format range label for display. */
export function formatRangeLabel(anchor: Date, zoom: ZoomLevel): string {
  if (zoom === 'year' || zoom === 'month') return `${anchor.getFullYear()}`;
  const [rangeStart, rangeEnd] = getVisibleRange(anchor, zoom);
  if (zoom === 'week') return formatWeekRange(anchor);
  return `${format(rangeStart, 'd MMM', { locale: es })} - ${format(rangeEnd, 'd MMM yyyy', { locale: es })}`;
}
