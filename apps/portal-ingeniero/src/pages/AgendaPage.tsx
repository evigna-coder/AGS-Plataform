import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import AgendaEntryCard from '../components/agenda/AgendaEntryCard';
import AgendaGridView from '../components/agenda/AgendaGridView';
import { useAgenda } from '../hooks/useAgenda';
import type { AgendaEntry } from '@ags/shared';

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDayLabel(d: Date): string {
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

function formatWeekLabel(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  const startMonth = weekStart.toLocaleDateString('es-AR', { month: 'short' });
  const endMonth = end.toLocaleDateString('es-AR', { month: 'short' });
  if (startMonth === endMonth) return `${weekStart.getDate()} – ${end.getDate()} ${startMonth}`;
  return `${weekStart.getDate()} ${startMonth} – ${end.getDate()} ${endMonth}`;
}

function isToday(d: Date): boolean {
  const today = new Date();
  return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
}

// ── List view (for non-admin or "Mis OTs" toggle) ──

interface WeekBlockProps {
  weekStart: Date;
  entriesForDay: (date: string) => AgendaEntry[];
  isCurrentWeek: boolean;
}

function WeekBlock({ weekStart, entriesForDay, isCurrentWeek }: WeekBlockProps) {
  const days = Array.from({ length: 7 }).map((_, i) => {
    const day = addDays(weekStart, i);
    const dayStr = formatDate(day);
    return { day, dayStr, dayEntries: entriesForDay(dayStr), dayIndex: i };
  });

  if (!days.some(d => d.dayEntries.length > 0)) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className={`text-[11px] font-bold uppercase tracking-wider ${isCurrentWeek ? 'text-teal-700' : 'text-slate-400'}`}>
          {isCurrentWeek ? 'Esta semana' : formatWeekLabel(weekStart)}
        </span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>
      <div className="space-y-3">
        {days.map(({ day, dayStr, dayEntries, dayIndex }) => {
          if (dayEntries.length === 0) return null;
          const today = isToday(day);
          return (
            <div key={dayStr}>
              <div className="flex items-center gap-2 mb-1.5">
                {today && <div className="w-2 h-2 rounded-full bg-teal-500 shrink-0" />}
                <span className={`text-[11px] font-semibold ${today ? 'text-teal-700' : 'text-slate-500'}`}>
                  {DAY_NAMES[dayIndex]} {formatDayLabel(day)}
                </span>
                {today && <span className="text-[9px] font-medium text-teal-500 uppercase">Hoy</span>}
              </div>
              <div className="space-y-2 ml-1">
                {dayEntries.map(e => <AgendaEntryCard key={e.id} entry={e} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Page ──

export default function AgendaPage() {
  const { loading, weekStart, entriesForDay, loadMore, weeksAhead, entries,
          isAdmin, showMine, toggleShowMine, ingenieros } = useAgenda();

  const weeks: Date[] = [];
  for (let i = -1; i < weeksAhead; i++) weeks.push(addDays(weekStart, i * 7));

  const currentWeekStr = formatDate(weekStart);
  const showGrid = isAdmin && !showMine;

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Agenda"
        subtitle={`${entries.length} servicio(s) programado(s)`}
        actions={isAdmin ? (
          <button
            onClick={toggleShowMine}
            className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-colors ${
              showMine
                ? 'bg-teal-600 text-white border-teal-600'
                : 'bg-white text-slate-600 border-slate-300 hover:border-teal-400 hover:text-teal-600'
            }`}
          >
            Mis OTs
          </button>
        ) : undefined}

      />

      <div className="flex-1 overflow-y-auto px-4 pb-8 pt-2">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : showGrid ? (
          <>
            <AgendaGridView
              ingenieros={ingenieros}
              entries={entries}
              weeks={weeks}
              currentWeekStr={currentWeekStr}
            />
            <div className="text-center py-4">
              <button onClick={loadMore} className="text-xs text-teal-600 hover:text-teal-700 font-medium hover:underline">
                Cargar más semanas
              </button>
            </div>
          </>
        ) : entries.length === 0 ? (
          <EmptyState message="No hay visitas programadas" />
        ) : (
          <>
            {weeks.map(ws => (
              <WeekBlock
                key={formatDate(ws)}
                weekStart={ws}
                entriesForDay={entriesForDay}
                isCurrentWeek={formatDate(ws) === currentWeekStr}
              />
            ))}
            <div className="text-center py-4">
              <button onClick={loadMore} className="text-xs text-teal-600 hover:text-teal-700 font-medium hover:underline">
                Cargar más semanas
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
