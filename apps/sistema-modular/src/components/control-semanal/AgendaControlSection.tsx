import type { AgendaEntry } from '@ags/shared';
import { ESTADO_AGENDA_LABELS } from '@ags/shared';
import type { AgendaControlEstado, AgendaControlRow } from '../../hooks/useControlSemanal';
import { StatusBadge } from '../ui/StatusBadge';
import { EmptyState } from '../ui/EmptyState';

interface Props {
  rows: AgendaControlRow[];
  tareasSinOT: AgendaEntry[];
  kpis: { agendadas: number; cerradas: number; sinCierreAdmin: number; sinRealizar: number };
  onOpenOT: (otNumber: string) => void;
}

const thClass = 'px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';

const ESTADO_UI: Record<AgendaControlEstado, { label: string; color: string }> = {
  cerrada:          { label: '✓ Cerrada',        color: 'bg-emerald-100 text-emerald-700' },
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

export const AgendaControlSection: React.FC<Props> = ({ rows, tareasSinOT, kpis, onOpenOT }) => (
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
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className={thClass}>Fecha</th>
              <th className={thClass}>OT</th>
              <th className={thClass}>Cliente</th>
              <th className={thClass}>Ingeniero</th>
              <th className={thClass}>Agenda</th>
              <th className={thClass}>Estado</th>
              <th className={thClass}>Motivo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ entry, ot, estado, motivos }) => {
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
                  <td className="px-3 py-2 text-xs text-slate-600 truncate max-w-[180px]">{entry.clienteNombre || '—'}</td>
                  <td className="px-3 py-2 text-xs text-slate-500 truncate max-w-[120px] whitespace-nowrap">
                    {ot?.ingenieroAsignadoNombre || entry.ingenieroNombre || <span className="text-slate-300">—</span>}
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}

    {tareasSinOT.length > 0 && (
      <div className="bg-white rounded-xl border border-slate-200 p-3">
        <p className="text-[10px] font-mono uppercase tracking-wide text-slate-400 mb-1.5">
          Tareas sin OT ({tareasSinOT.length}) — solo informativo
        </p>
        <ul className="space-y-0.5">
          {tareasSinOT.map(t => (
            <li key={t.id} className="text-[10px] text-slate-500">
              {fmtFecha(t.fechaInicio)} · {t.titulo || t.tipoServicio || 'Tarea'}
              {t.clienteNombre ? ` · ${t.clienteNombre}` : ''}
              {t.ingenieroNombre ? ` · ${t.ingenieroNombre}` : ''}
            </li>
          ))}
        </ul>
      </div>
    )}
  </section>
);
