const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface Props {
  weekStart: Date;
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  viewMode: 'week' | 'day';
  onToggleView: (m: 'week' | 'day') => void;
}

export default function WeekHeader({ weekStart, selectedDate, onSelectDate, onPrev, onNext, onToday, viewMode, onToggleView }: Props) {
  const today = formatDate(new Date());
  const selectedStr = formatDate(selectedDate);
  const weekEnd = addDays(weekStart, 6);

  const monthLabel = weekStart.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
    + ' – ' + weekEnd.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-2">
      {/* Navigation bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button onClick={onPrev} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button onClick={onToday} className="px-2 py-1 text-[11px] font-medium text-teal-600 hover:bg-teal-50 rounded-lg">
            Hoy
          </button>
          <button onClick={onNext} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <span className="text-xs font-medium text-slate-600">{monthLabel}</span>
        <div className="flex bg-slate-100 rounded-lg p-0.5">
          <button
            onClick={() => onToggleView('week')}
            className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${viewMode === 'week' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
          >
            Semana
          </button>
          <button
            onClick={() => onToggleView('day')}
            className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${viewMode === 'day' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
          >
            Día
          </button>
        </div>
      </div>

      {/* Day selector row */}
      <div className="grid grid-cols-7 gap-1">
        {DAY_NAMES.map((name, i) => {
          const day = addDays(weekStart, i);
          const dayStr = formatDate(day);
          const isToday = dayStr === today;
          const isSelected = dayStr === selectedStr;
          return (
            <button
              key={i}
              onClick={() => onSelectDate(day)}
              className={`flex flex-col items-center py-1.5 rounded-lg text-center transition-colors ${
                isSelected ? 'bg-teal-600 text-white' : isToday ? 'bg-teal-50 text-teal-700' : 'hover:bg-slate-50 text-slate-600'
              }`}
            >
              <span className="text-[10px] font-medium">{name}</span>
              <span className={`text-sm font-semibold ${isSelected ? 'text-white' : ''}`}>{day.getDate()}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
