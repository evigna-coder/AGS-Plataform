import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import WeekHeader from '../components/agenda/WeekHeader';
import AgendaEntryCard from '../components/agenda/AgendaEntryCard';
import { useAgenda } from '../hooks/useAgenda';
import type { AgendaEntry } from '@ags/shared';

const DAY_NAMES_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function AgendaPage() {
  const {
    loading, selectedDate, setSelectedDate, viewMode, setViewMode,
    goNext, goPrev, goToday, weekStart, entriesForDay,
  } = useAgenda();

  return (
    <div className="h-full flex flex-col">
      <PageHeader title="Agenda" subtitle="Visitas programadas" />
      <div className="px-4 pt-2 pb-3 shrink-0">
        <WeekHeader
          weekStart={weekStart}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onPrev={goPrev}
          onNext={goNext}
          onToday={goToday}
          viewMode={viewMode}
          onToggleView={setViewMode}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : viewMode === 'day' ? (
          <DayView date={selectedDate} entries={entriesForDay(formatDate(selectedDate))} />
        ) : (
          <WeekView weekStart={weekStart} entriesForDay={entriesForDay} />
        )}
      </div>
    </div>
  );
}

function WeekView({ weekStart, entriesForDay }: { weekStart: Date; entriesForDay: (date: string) => AgendaEntry[] }) {
  const hasAny = Array.from({ length: 7 }).some((_, i) =>
    entriesForDay(formatDate(addDays(weekStart, i))).length > 0
  );

  if (!hasAny) return <EmptyState message="No hay visitas programadas esta semana" />;

  return (
    <div className="space-y-4">
      {Array.from({ length: 7 }).map((_, i) => {
        const day = addDays(weekStart, i);
        const dayStr = formatDate(day);
        const dayEntries = entriesForDay(dayStr);
        if (dayEntries.length === 0) return null;
        return (
          <div key={dayStr}>
            <p className="text-[11px] font-semibold text-slate-400 mb-1.5">
              {DAY_NAMES_FULL[i]} {day.getDate()}/{day.getMonth() + 1}
            </p>
            <div className="space-y-2">
              {dayEntries.map(e => <AgendaEntryCard key={e.id} entry={e} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayView({ date, entries }: { date: Date; entries: AgendaEntry[] }) {
  const label = date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 capitalize mb-2">{label}</p>
      {entries.length === 0 ? (
        <EmptyState message="No hay visitas programadas para este día" />
      ) : (
        <div className="space-y-2">
          {entries.map(e => <AgendaEntryCard key={e.id} entry={e} />)}
        </div>
      )}
    </div>
  );
}
