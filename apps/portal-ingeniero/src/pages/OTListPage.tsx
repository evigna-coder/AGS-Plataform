import { useState } from 'react';
import { useMisOT, type MisOTRange } from '../hooks/useMisOT';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import AgendaEntryCard from '../components/agenda/AgendaEntryCard';

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const RANGE_TABS: { value: MisOTRange; label: string }[] = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'semana', label: 'Esta semana' },
  { value: 'proximas', label: 'Próximas' },
];

function isToday(dayStr: string): boolean {
  const t = new Date();
  return dayStr === t.toISOString().slice(0, 10);
}

function dayLabel(dayStr: string): { name: string; date: string } {
  const d = new Date(dayStr + 'T00:00:00');
  return {
    name: DAY_NAMES[d.getDay()].toUpperCase(),
    date: d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }).toUpperCase().replace('.', ''),
  };
}

export default function OTListPage() {
  const [range, setRange] = useState<MisOTRange>('hoy');
  const { groupedByDay, total, loading } = useMisOT(range);

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Mis OT"
        subtitle={loading ? '...' : `${total} ${total === 1 ? 'visita programada' : 'visitas programadas'}`}
      />

      <div className="shrink-0 bg-white border-b border-slate-100 px-4 pb-3">
        <div className="flex gap-1.5 overflow-x-auto">
          {RANGE_TABS.map(t => (
            <button
              key={t.value}
              onClick={() => setRange(t.value)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                range === t.value
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : groupedByDay.length === 0 ? (
          <EmptyState message={
            range === 'hoy'
              ? 'No tenés visitas para hoy'
              : range === 'semana'
                ? 'Sin visitas esta semana'
                : 'No hay próximas visitas asignadas'
          } />
        ) : (
          <div className="space-y-5">
            {groupedByDay.map(({ day, entries }) => {
              const today = isToday(day);
              const { name, date } = dayLabel(day);
              return (
                <div key={day}>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    {today && <div className="w-2 h-2 rounded-full bg-teal-500 shrink-0" />}
                    <span className={`text-[11px] font-mono font-bold uppercase tracking-wider ${today ? 'text-teal-700' : 'text-slate-400'}`}>
                      {name} {date}
                    </span>
                    {today && (
                      <span className="text-[9px] font-mono font-bold bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded">
                        HOY
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {entries.map(e => <AgendaEntryCard key={e.id} entry={e} />)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
