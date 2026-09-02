import type { AgendaControlEstado, OTArrastreRow } from '../../hooks/useControlSemanal';
import { StatusBadge } from '../ui/StatusBadge';
import { DiasTrabado } from './DiasTrabado';

interface Props {
  rows: OTArrastreRow[];
  onOpenOT: (otNumber: string) => void;
  /** Saca la OT del control de esta semana (misma marca que las entregas). */
  onExcluir?: (otNumber: string) => void;
  excluidas?: number;
  onVerExcluidas?: () => void;
}

const thClass = 'px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';

const ESTADO_UI: Record<AgendaControlEstado, { label: string; color: string }> = {
  cerrada:          { label: '✓ Cierre admin',   color: 'bg-emerald-100 text-emerald-700' },
  sin_cierre_admin: { label: 'Sin cierre admin', color: 'bg-amber-100 text-amber-700' },
  sin_realizar:     { label: 'Sin realizar',     color: 'bg-red-100 text-red-700' },
  ot_no_encontrada: { label: 'OT no encontrada', color: 'bg-slate-200 text-slate-500' },
};

const fmtFecha = (iso: string | null) => {
  if (!iso) return '—';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    .toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' });
};

/**
 * Sección 1c — OTs que vienen arrastrando de semanas anteriores (2026-09-02).
 *
 * La sección 1 se arma con la agenda de la semana visible: una OT que quedó
 * abierta hace tres semanas desaparecía de la foto y nadie la volvía a ver.
 * Van acá, aparte, para no ensuciar el trabajo de la semana, y ordenadas por
 * antigüedad — lo más trabado arriba.
 */
export const OTArrastreSection: React.FC<Props> = ({
  rows, onOpenOT, onExcluir, excluidas, onVerExcluidas,
}) => (
  <section className="space-y-2">
    <div className="flex items-center justify-between">
      <p className="text-[10px] font-mono uppercase tracking-wide text-slate-500">
        1c · OTs que arrastran de semanas anteriores
        {rows.length > 0 && <span className="ml-2 text-red-600 font-semibold">{rows.length}</span>}
      </p>
      {!!excluidas && excluidas > 0 && onVerExcluidas && (
        <button onClick={onVerExcluidas} className="text-[10px] text-slate-400 hover:text-slate-600 hover:underline">
          {excluidas} sacada{excluidas === 1 ? '' : 's'} de esta semana
        </button>
      )}
    </div>

    {rows.length === 0 ? (
      <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
        No queda ninguna OT abierta de semanas anteriores.
      </p>
    ) : (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="tabla-compacta w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className={thClass}>Agendada</th>
              <th className={thClass}>OT</th>
              <th className={thClass}>Cliente</th>
              <th className={thClass}>Ingeniero</th>
              <th className={thClass}>Estado</th>
              <th className={thClass}>Trabada</th>
              <th className={thClass}>Motivo</th>
              <th className={thClass} />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ ot, fechaAgenda, establecimientoNombre, estado, motivos, diasTrabado, desdeQue }) => {
              const ui = ESTADO_UI[estado];
              return (
                <tr key={ot.otNumber} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2 text-[10px] text-slate-400 whitespace-nowrap">
                    {fmtFecha(fechaAgenda)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button
                      onClick={() => onOpenOT(ot.otNumber)}
                      className="text-xs font-semibold text-teal-700 hover:text-teal-900 hover:underline"
                      title="Abrir la OT"
                    >
                      {ot.otNumber}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600 truncate max-w-[180px]"
                    title={ot.razonSocial || ''}>
                    {ot.razonSocial || '—'}
                    {establecimientoNombre && (
                      <span className="text-slate-400"> ({establecimientoNombre})</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500 truncate max-w-[120px] whitespace-nowrap">
                    {ot.ingenieroAsignadoNombre || <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <StatusBadge label={ui.label} colorClass={ui.color} />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <DiasTrabado dias={diasTrabado} desdeQue={desdeQue} />
                  </td>
                  <td className="px-3 py-2 text-[10px] text-slate-500">
                    {motivos.length === 0
                      ? <span className="text-slate-300">—</span>
                      : motivos.map((m, i) => (
                        <p key={i} className={estado === 'sin_realizar' ? 'text-red-600' : 'text-amber-600'}>{m}</p>
                      ))}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {onExcluir && (
                      <button onClick={() => onExcluir(ot.otNumber)}
                        title="Sacar del control de esta semana. No toca la agenda ni la OT."
                        className="text-[10px] text-slate-300 hover:text-red-600 hover:underline">
                        sacar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </section>
);
