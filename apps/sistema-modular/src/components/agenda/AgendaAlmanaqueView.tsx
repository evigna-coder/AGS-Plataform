import { type FC, useMemo } from 'react';
import type { AgendaEntry, Ingeniero } from '@ags/shared';
import { addDays } from 'date-fns';
import { formatDateKey, groupDaysByWeek, formatWeekRange, getMonday } from '../../utils/agendaDateUtils';
import { FlechasLaterales } from './AgendaFlechasLaterales';
import { AgendaAlmanaqueCard } from './AgendaAlmanaqueCard';

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];

const COL_INGENIERO = '110px';
const GRID_COLS = `${COL_INGENIERO} repeat(5, minmax(140px, 1fr))`;

interface Props {
  /** Flechas laterales para moverse de período (2026-09-03). Discretas: aparecen al pasar el mouse. */
  onPrev?: () => void;
  onNext?: () => void;
  /** Días del rango navegado — el mismo que pinta la grilla de planificación. */
  visibleDays: Date[];
  entries: AgendaEntry[];
  ingenieros: Ingeniero[];
  /** '' = todos los ingenieros. */
  ingenieroId: string;
}

/** ingenieroId → fecha → entradas de ese día (una multi-día aparece en cada uno). */
function indexarPorIngenieroYDia(entries: AgendaEntry[]): Map<string, Map<string, AgendaEntry[]>> {
  const idx = new Map<string, Map<string, AgendaEntry[]>>();
  for (const e of entries) {
    if (!idx.has(e.ingenieroId)) idx.set(e.ingenieroId, new Map());
    const porDia = idx.get(e.ingenieroId)!;
    let cur = new Date(`${e.fechaInicio}T12:00:00`);
    const fin = new Date(`${e.fechaFin}T12:00:00`);
    // Ancla al mediodía: sumar días sobre medianoche cruza el DST y repite o
    // saltea una fecha una vez al año.
    while (cur <= fin) {
      const dk = formatDateKey(cur);
      (porDia.get(dk) ?? porDia.set(dk, []).get(dk)!).push(e);
      cur = addDays(cur, 1);
    }
  }
  for (const porDia of idx.values()) {
    for (const lista of porDia.values()) lista.sort((a, b) => a.quarterStart - b.quarterStart);
  }
  return idx;
}

/**
 * Almanaque semanal: una tabla por semana, filas = ingenieros, columnas = Lun a
 * Vie (2026-08-14).
 *
 * Es la vista que los ingenieros ya tienen en el portal, traída al back-office
 * como segunda pestaña. La grilla de planificación divide el día en cuartos y es
 * la herramienta para acomodar y arrastrar; para leer "qué hay esta semana"
 * obliga a descifrar colores y abrir popovers. Acá cada servicio está escrito —
 * OT, cliente, tipo, equipo— y el día es una sola celda.
 *
 * Se pinta sobre las mismas entradas que ya trae `useAgenda`: comparte rango con
 * la grilla y no dispara ninguna lectura nueva.
 */
export const AgendaAlmanaqueView: FC<Props> = ({ visibleDays, entries, ingenieros, ingenieroId, onPrev, onNext }) => {
  const filtradas = useMemo(
    () => (ingenieroId ? entries.filter(e => e.ingenieroId === ingenieroId) : entries),
    [entries, ingenieroId],
  );
  const filas = useMemo(
    () => (ingenieroId ? ingenieros.filter(i => i.id === ingenieroId) : ingenieros),
    [ingenieros, ingenieroId],
  );
  const idx = useMemo(() => indexarPorIngenieroYDia(filtradas), [filtradas]);

  const hoy = formatDateKey(new Date());
  const lunesDeHoy = formatDateKey(getMonday(new Date()));

  const semanas = useMemo(() => groupDaysByWeek(visibleDays), [visibleDays]);

  // Semanas sin NADA agendado se omiten: en un rango largo el scroll quedaba
  // lleno de tablas vacías (mismo criterio que el portal).
  const semanasConDatos = semanas
    .map(({ weekStart }) => ({
      weekStart,
      dias: Array.from({ length: 5 }, (_, i) => {
        const d = addDays(weekStart, i);
        return { dk: formatDateKey(d), label: `${DIAS[i]} ${d.getDate()}` };
      }),
    }))
    .filter(({ dias }) => filas.some(ing => dias.some(({ dk }) => idx.get(ing.id)?.has(dk))));

  const flechas = <FlechasLaterales onPrev={onPrev} onNext={onNext} />;

  if (semanasConDatos.length === 0) {
    return (
      <div className="group relative h-full flex items-center justify-center">
        {flechas}
        <p className="text-sm text-slate-400">No hay nada agendado en este rango.</p>
      </div>
    );
  }

  return (
    <div className="group relative h-full">
    {flechas}
    <div className="h-full overflow-y-auto px-4 py-3 space-y-5">
      {semanasConDatos.map(({ weekStart, dias }) => {
        const esSemanaActual = formatDateKey(weekStart) === lunesDeHoy;
        // Solo los ingenieros con trabajo ESA semana: una fila vacía por cada
        // ingeniero de licencia hacía la tabla el doble de alta sin aportar nada.
        const filasConDatos = filas.filter(ing => dias.some(({ dk }) => idx.get(ing.id)?.has(dk)));
        return (
          <div key={formatDateKey(weekStart)}>
            <div className="flex items-center gap-2 mb-1.5 px-1">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${esSemanaActual ? 'text-teal-700' : 'text-slate-400'}`}>
                {esSemanaActual ? 'Esta semana' : formatWeekRange(weekStart)}
              </span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <div className="border border-slate-200 rounded-xl bg-white overflow-x-auto">
              <div style={{ minWidth: 810 }}>
                <div className="grid border-b border-slate-200 bg-slate-50" style={{ gridTemplateColumns: GRID_COLS }}>
                  <div className="px-2 py-1.5" />
                  {dias.map(({ dk, label }) => (
                    <div key={dk} className={`px-2 py-1.5 text-center border-l border-slate-200 ${dk === hoy ? 'bg-teal-50' : ''}`}>
                      <span className={`text-[10px] font-semibold ${dk === hoy ? 'text-teal-700' : 'text-slate-500'}`}>
                        {label}
                      </span>
                    </div>
                  ))}
                </div>

                {filasConDatos.map((ing, i) => (
                  <div
                    key={ing.id}
                    className={`grid ${i === filasConDatos.length - 1 ? '' : 'border-b border-slate-100'}`}
                    style={{ gridTemplateColumns: GRID_COLS }}
                  >
                    <div className="px-2 py-2 flex items-start">
                      <span className="text-[11px] font-medium text-slate-700 leading-tight">{ing.nombre}</span>
                    </div>
                    {dias.map(({ dk }) => (
                      <div
                        key={dk}
                        className={`border-l border-slate-100 px-1 py-1 space-y-1 min-h-[52px] ${dk === hoy ? 'bg-teal-50/40' : ''}`}
                      >
                        {(idx.get(ing.id)?.get(dk) ?? []).map(e => (
                          <AgendaAlmanaqueCard key={`${e.id}-${dk}`} entry={e} />
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
    </div>
  );
};
