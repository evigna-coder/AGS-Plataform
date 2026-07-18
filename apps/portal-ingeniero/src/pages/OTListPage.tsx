import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useMisOTList, type MisOTRange } from '../hooks/useMisOTList';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import MisOTCard from '../components/ordenes-trabajo/MisOTCard';

const RANGE_TABS: { value: MisOTRange; label: string }[] = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'semana', label: 'Esta semana' },
  { value: 'proximas', label: 'Próximas' },
];

const todayStr = () => new Date().toISOString().slice(0, 10);

function dayLabel(dayStr: string): string {
  if (dayStr === 'sin-fecha') return 'Sin fecha';
  const d = new Date(dayStr + 'T00:00:00');
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: '2-digit' });
}

/** "Mis OT" — lista rediseñada (mockup mix A+B, mobile-first). */
export default function OTListPage() {
  const { usuario } = useAuth();
  const [range, setRange] = useState<MisOTRange>('hoy');
  const { groupedByDay, loading, isAdmin, showMine, verTodas, toggleShowMine } = useMisOTList(range);
  const inicial = (usuario?.displayName || usuario?.email || '?').trim().charAt(0).toUpperCase();
  const fechaHoy = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: '2-digit' });

  return (
    <div className="h-full flex flex-col">
      {/* Banda teal */}
      <div className="shrink-0 bg-gradient-to-br from-teal-700 to-teal-900 text-white px-4 pt-3 pb-5 sm:px-5 md:pt-2.5 md:pb-3">
        <div className="flex items-center justify-between gap-3.5 max-w-5xl mx-auto w-full">
          <div className="md:flex md:items-baseline md:gap-3">
            <h1 className="font-serif text-[28px] md:text-[22px] font-medium leading-none">{verTodas ? 'Todas las OT' : 'Mis OT'}</h1>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] opacity-75 mt-1.5 md:mt-0 capitalize">{fechaHoy}</p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            {isAdmin && (
              <button
                onClick={toggleShowMine}
                className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                  showMine
                    ? 'bg-white text-teal-800 border-white'
                    : 'bg-white/10 text-white border-white/40 hover:bg-white/20'
                }`}
              >
                Mis OTs
              </button>
            )}
            <div className="w-11 h-11 md:w-8 md:h-8 shrink-0 rounded-full bg-white/15 border border-white/35 flex items-center justify-center font-serif text-[19px] md:text-[14px]">
              {inicial}
            </div>
          </div>
        </div>
      </div>

      {/* Rango */}
      <div className="shrink-0 bg-white border-b border-slate-100 px-4 py-2.5">
        <div className="flex gap-1.5 overflow-x-auto max-w-5xl mx-auto w-full">
          {RANGE_TABS.map(t => (
            <button
              key={t.value}
              onClick={() => setRange(t.value)}
              className={`shrink-0 px-3.5 py-1.5 min-h-[36px] rounded-full text-xs font-medium transition-colors ${
                range === t.value
                  ? 'bg-teal-700 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-5xl mx-auto w-full">
          {loading ? (
            <div className="flex justify-center py-12"><Spinner size="lg" /></div>
          ) : groupedByDay.length === 0 ? (
            <EmptyState message={
              range === 'hoy'
                ? (verTodas ? 'No hay OTs para hoy' : 'No tenés OTs para hoy')
                : range === 'semana'
                  ? 'Sin OTs esta semana'
                  : (verTodas ? 'No hay OTs activas' : 'No hay próximas OTs asignadas')
            } />
          ) : (
            <div className="space-y-6">
              {groupedByDay.map(({ day, items }) => {
                const isToday = day === todayStr();
                return (
                  <div key={day}>
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 px-1.5 mb-2.5">
                      {isToday ? 'Hoy' : dayLabel(day)} · {items.length} {items.length === 1 ? 'orden' : 'órdenes'}
                    </p>
                    <div className="space-y-3">
                      {items.map(item => (
                        <MisOTCard key={item.ot.otNumber} item={item} isToday={isToday} showEngineer={verTodas} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
