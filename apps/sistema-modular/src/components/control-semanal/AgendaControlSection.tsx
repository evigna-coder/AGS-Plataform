import type { AgendaEntry } from '@ags/shared';
import { ESTADO_AGENDA_LABELS } from '@ags/shared';
import type { AgendaControlEstado, AgendaControlRow } from '../../hooks/useControlSemanal';
import { StatusBadge } from '../ui/StatusBadge';
import { EmptyState } from '../ui/EmptyState';

interface Props {
  rows: AgendaControlRow[];
  kpis: { agendadas: number; cerradas: number; sinCierreAdmin: number; sinRealizar: number };
  onOpenOT: (otNumber: string) => void;
  /** Saca la OT del control de esta semana (se recoordinó y cierra en otra). */
  onExcluir?: (otNumber: string) => void;
  /** Cuántas se sacaron a mano, para poder reponerlas. */
  excluidas?: number;
  onVerExcluidas?: () => void;
}

const thClass = 'px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';

const ESTADO_UI: Record<AgendaControlEstado, { label: string; color: string }> = {
  // 'Cerrada' = cierre ADMINISTRATIVO hecho. El cierre técnico solo cae en
  // 'sin_cierre_admin' (2026-08-18): antes contaba como cerrada y tapaba
  // justo lo que este control tiene que encontrar.
  cerrada:          { label: '✓ Cierre admin',    color: 'bg-emerald-100 text-emerald-700' },
  sin_cierre_admin: { label: 'Sin cierre admin',  color: 'bg-amber-100 text-amber-700' },
  sin_realizar:     { label: 'Sin realizar',      color: 'bg-red-100 text-red-700' },
  ot_no_encontrada: { label: 'OT no encontrada',  color: 'bg-slate-200 text-slate-500' },
};

const fmtFecha = (iso: string) => {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    .toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' });
};

const Kpi = ({ label, value, tone }: { label: string; value: number; tone: string }) => (
  <div className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 flex items-center justify-between gap-2">
    <p className="text-[9px] font-mono text-slate-400 uppercase tracking-wide">{label}</p>
    <p className={`text-base font-black leading-none ${tone}`}>{value}</p>
  </div>
);

export const AgendaControlSection: React.FC<Props> = ({ rows, kpis, onOpenOT, onExcluir, excluidas, onVerExcluidas }) => (
  <section className="space-y-2">
    <p className="text-[10px] font-mono uppercase tracking-wide text-slate-500">
      1 · Agenda de la semana vs. cierre de OTs
    </p>

    <div className="grid grid-cols-4 gap-2">
      <Kpi label="Agendadas" value={kpis.agendadas} tone="text-slate-700" />
      <Kpi label="Cerradas" value={kpis.cerradas} tone="text-emerald-600" />
      <Kpi label="Sin cierre admin" value={kpis.sinCierreAdmin} tone="text-amber-600" />
      <Kpi label="Sin realizar" value={kpis.sinRealizar} tone="text-red-600" />
    </div>

    {rows.length === 0 ? (
      <EmptyState message="No hay visitas con OT agendadas en esta semana" />
    ) : (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="tabla-compacta w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className={thClass}>Fecha</th>
              <th className={thClass}>OT</th>
              <th className={thClass}>Cliente</th>
              <th className={thClass}>Ingeniero</th>
              <th className={thClass}>Agenda</th>
              <th className={thClass}>Estado</th>
              <th className={thClass}>Motivo</th>
              <th className={thClass} />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ entry, entries, ingenieros, ot, estado, motivos, establecimientoNombre }) => {
              const ui = ESTADO_UI[estado];
              const grisada = estado === 'ot_no_encontrada';
              return (
                <tr key={entry.id} className={`border-b border-slate-100 last:border-0 ${grisada ? 'bg-slate-50 text-slate-400' : ''}`}>
                  <td className="px-3 py-2 text-[10px] text-slate-400 whitespace-nowrap">
                    {fmtFecha(entry.fechaInicio)}
                    {entry.fechaFin !== entry.fechaInicio && <> – {fmtFecha(entry.fechaFin)}</>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button
                      onClick={() => onOpenOT(entry.otNumber)}
                      className="text-xs font-semibold text-teal-700 hover:text-teal-900 hover:underline"
                      title="Abrir la OT"
                    >
                      {entry.otNumber}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600 truncate max-w-[180px]"
                    title={establecimientoNombre ? `${entry.clienteNombre} (${establecimientoNombre})` : (entry.clienteNombre || '')}>
                    {entry.clienteNombre || '—'}
                    {/* Establecimiento entre parentesis solo si el cliente tiene
                        varios: con uno solo no distingue nada (2026-08-20). */}
                    {establecimientoNombre && (
                      <span className="text-slate-400"> ({establecimientoNombre})</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500 truncate max-w-[120px] whitespace-nowrap">
                    {/* Todos los que la tuvieron (2026-08-19): antes había una
                        fila por ingeniero y la OT salía repetida. */}
                    {ingenieros.length > 0
                      ? ingenieros.join(' · ')
                      : (ot?.ingenieroAsignadoNombre || <span className="text-slate-300">—</span>)}
                    {entries.length > 1 && (
                      <span className="ml-1 text-[9px] text-slate-400">({entries.length} bloques)</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[10px] text-slate-400 whitespace-nowrap">
                    {ESTADO_AGENDA_LABELS[entry.estadoAgenda] ?? entry.estadoAgenda}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <StatusBadge label={ui.label} colorClass={ui.color} />
                  </td>
                  <td className="px-3 py-2 text-[10px] text-slate-500">
                    {motivos.length === 0
                      ? <span className="text-slate-300">—</span>
                      : motivos.map((m, i) => <p key={i} className={estado === 'sin_realizar' ? 'text-red-600' : 'text-amber-600'}>{m}</p>)}
                  </td>
                  {/* Sacar del control (2026-08-19): una visita que se
                      recoordinó cierra en OTRA semana. Para la agenda las dos
                      son ciertas; para el control solo importa la del cierre. */}
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {onExcluir && (
                      <button onClick={() => onExcluir(entry.otNumber)}
                        title="Sacar del control de esta semana — la OT cierra en otra. No toca la agenda."
                        className="text-[10px] text-slate-300 hover:text-red-600 hover:underline">
                        Quitar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {(excluidas ?? 0) > 0 && (
          <div className="px-3 py-1.5 border-t border-slate-100 bg-slate-50/60 text-right">
            <button onClick={onVerExcluidas}
              className="text-[10px] text-slate-400 hover:text-teal-600 hover:underline">
              {excluidas} quitada(s) del control — reponer
            </button>
          </div>
        )}
      </div>
    )}

  </section>
);

/**
 * Pestaña "Tareas sin OT" del control semanal (2026-08-11). Vivía incrustada al
 * pie de la sección de agenda como bloque "solo informativo" — el usuario la
 * quiere aparte para que el control quede solo con lo accionable.
 */
export const TareasSinOTSection: React.FC<{ tareas: AgendaEntry[] }> = ({ tareas }) => (
  <section className="bg-white rounded-xl border border-slate-200 p-4">
    <p className="text-[10px] font-mono uppercase tracking-wide text-slate-400 mb-2">
      Tareas sin OT de la semana ({tareas.length}) — solo informativo
    </p>
    {tareas.length === 0 ? (
      <p className="text-xs text-slate-400 py-4 text-center">Sin tareas sin OT esta semana.</p>
    ) : (
      <ul className="space-y-1">
        {tareas.map(t => (
          <li key={t.id} className="text-xs text-slate-600">
            {fmtFecha(t.fechaInicio)} · <span className="font-medium">{t.titulo || t.tipoServicio || 'Tarea'}</span>
            {t.clienteNombre ? ` · ${t.clienteNombre}` : ''}
            {t.ingenieroNombre ? ` · ${t.ingenieroNombre}` : ''}
          </li>
        ))}
      </ul>
    )}
  </section>
);
