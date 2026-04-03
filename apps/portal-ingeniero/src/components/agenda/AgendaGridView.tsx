import { Link } from 'react-router-dom';
import type { AgendaEntry } from '@ags/shared';
import { ESTADO_AGENDA_COLORS } from '@ags/shared';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatWeekLabel(ws: Date): string {
  const end = addDays(ws, 6);
  const sm = ws.toLocaleDateString('es-AR', { month: 'short' });
  const em = end.toLocaleDateString('es-AR', { month: 'short' });
  return sm === em
    ? `${ws.getDate()} – ${end.getDate()} ${sm}`
    : `${ws.getDate()} ${sm} – ${end.getDate()} ${em}`;
}

function isToday(dateStr: string): boolean {
  return formatDate(new Date()) === dateStr;
}

// Small chip shown inside each grid cell
function EntryChip({ entry }: { entry: AgendaEntry }) {
  const statusColor = ESTADO_AGENDA_COLORS[entry.estadoAgenda] ?? 'bg-slate-100 text-slate-600';
  return (
    <Link
      to={`/ordenes-trabajo/${entry.otNumber}`}
      className={`block rounded px-1.5 py-1 text-[10px] font-semibold leading-tight hover:opacity-80 transition-opacity ${statusColor}`}
      title={`${entry.clienteNombre}${entry.sistemaNombre ? ` · ${entry.sistemaNombre}` : ''}`}
    >
      <span className="truncate block">OT-{entry.otNumber}</span>
      {entry.clienteNombre && (
        <span className="font-normal opacity-80 truncate block">{entry.clienteNombre}</span>
      )}
    </Link>
  );
}

interface Props {
  ingenieros: { id: string; nombre: string }[];
  entries: AgendaEntry[];
  weeks: Date[];
  currentWeekStr: string;
}

export default function AgendaGridView({ ingenieros, entries, weeks, currentWeekStr }: Props) {
  // Build lookup: ingenieroId → dateStr → entries[]
  const byEngDate = new Map<string, Map<string, AgendaEntry[]>>();
  for (const e of entries) {
    if (!byEngDate.has(e.ingenieroId)) byEngDate.set(e.ingenieroId, new Map());
    const dateMap = byEngDate.get(e.ingenieroId)!;
    // Entry spans fechaInicio→fechaFin; add to each day in the span
    let cur = new Date(e.fechaInicio);
    const end = new Date(e.fechaFin);
    while (cur <= end) {
      const dk = formatDate(cur);
      if (!dateMap.has(dk)) dateMap.set(dk, []);
      dateMap.get(dk)!.push(e);
      cur = addDays(cur, 1);
    }
  }

  // Only show weeks that have at least one entry
  const weeksWithEntries = weeks.filter(ws => {
    for (let i = 0; i < 5; i++) {
      const dk = formatDate(addDays(ws, i));
      for (const eng of ingenieros) {
        if (byEngDate.get(eng.id)?.has(dk)) return true;
      }
    }
    return false;
  });

  if (weeksWithEntries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <p className="text-sm">No hay visitas programadas</p>
      </div>
    );
  }

  const ENG_COL = '110px';
  const DAY_COL = 'minmax(72px, 1fr)';
  const gridCols = `${ENG_COL} repeat(5, ${DAY_COL})`;

  return (
    <div className="space-y-6">
      {weeksWithEntries.map(ws => {
        const wsStr = formatDate(ws);
        const isCurrent = wsStr === currentWeekStr;
        // Weekday dates (Mon–Fri)
        const days = Array.from({ length: 5 }, (_, i) => {
          const d = addDays(ws, i);
          return { d, dk: formatDate(d), label: `${WEEKDAYS[i]} ${d.getDate()}` };
        });

        return (
          <div key={wsStr}>
            {/* Week label */}
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${isCurrent ? 'text-teal-700' : 'text-slate-400'}`}>
                {isCurrent ? 'Esta semana' : formatWeekLabel(ws)}
              </span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {/* Grid */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              {/* Header row */}
              <div className="grid border-b border-slate-200 bg-slate-50" style={{ gridTemplateColumns: gridCols }}>
                <div className="px-2 py-1.5" />
                {days.map(({ dk, label }) => (
                  <div
                    key={dk}
                    className={`px-2 py-1.5 text-center border-l border-slate-200 ${isToday(dk) ? 'bg-teal-50' : ''}`}
                  >
                    <span className={`text-[10px] font-semibold ${isToday(dk) ? 'text-teal-700' : 'text-slate-500'}`}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Engineer rows — only show engineers that have entries this week */}
              {ingenieros.map((eng, rowIdx) => {
                const dateMap = byEngDate.get(eng.id);
                const hasAny = days.some(({ dk }) => dateMap?.has(dk));
                if (!hasAny) return null;
                const isLast = rowIdx === ingenieros.length - 1;
                return (
                  <div
                    key={eng.id}
                    className={`grid ${isLast ? '' : 'border-b border-slate-100'}`}
                    style={{ gridTemplateColumns: gridCols }}
                  >
                    {/* Engineer name */}
                    <div className="px-2 py-2 flex items-start">
                      <span className="text-[11px] font-medium text-slate-700 leading-tight">{eng.nombre}</span>
                    </div>
                    {/* Day cells */}
                    {days.map(({ dk }) => {
                      const cellEntries = dateMap?.get(dk) ?? [];
                      return (
                        <div
                          key={dk}
                          className={`border-l border-slate-100 px-1 py-1 space-y-1 min-h-[36px] ${isToday(dk) ? 'bg-teal-50/40' : ''}`}
                        >
                          {cellEntries.map(e => <EntryChip key={e.id} entry={e} />)}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
