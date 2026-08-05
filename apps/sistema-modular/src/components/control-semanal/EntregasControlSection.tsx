import type { WorkOrder } from '@ags/shared';
import { OT_ESTADO_LABELS } from '@ags/shared';
import { StatusBadge } from '../ui/StatusBadge';

interface Props {
  entregas: WorkOrder[];
  onOpenOT: (otNumber: string) => void;
  onOpenPresupuestoNumero?: (numero: string) => void;
}

const thClass = 'px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';

const ESTADO_BADGE: Record<string, string> = {
  CREADA: 'bg-slate-100 text-slate-500',
  ASIGNADA: 'bg-blue-100 text-blue-600',
  COORDINADA: 'bg-violet-100 text-violet-600',
  EN_CURSO: 'bg-amber-100 text-amber-600',
};

// createdAt viene como string ISO en OTs nuevas, pero en docs legacy puede ser
// Timestamp de Firestore o faltar — tolerar cualquier forma sin romper.
const fmtFecha = (v: unknown) => {
  let d: Date | null = null;
  if (typeof v === 'string') {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  } else if (v instanceof Date) {
    d = v;
  } else if (v && typeof (v as { toDate?: unknown }).toDate === 'function') {
    d = (v as { toDate: () => Date }).toDate();
  }
  if (!d || isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
};

/**
 * Entregas de partes pendientes (2026-08-04). Las entregas NUNCA se agendan,
 * así que la sección 1 (agenda vs cierre) no las ve: esta lista las mantiene
 * a la vista TODAS las semanas hasta que se entreguen (cierre técnico).
 */
export const EntregasControlSection: React.FC<Props> = ({ entregas, onOpenOT, onOpenPresupuestoNumero }) => {
  if (entregas.length === 0) return null;
  return (
    <section className="space-y-2">
      <p className="text-[10px] font-mono uppercase tracking-wide text-slate-500">
        1b · Entregas de partes pendientes ({entregas.length}) — no se agendan: figuran acá hasta entregarse
      </p>
      <div className="bg-white rounded-xl border border-orange-200 shadow-sm overflow-x-auto">
        <table className="tabla-compacta w-full">
          <thead>
            <tr className="bg-orange-50/60 border-b border-orange-100">
              <th className={thClass}>OT</th>
              <th className={thClass}>Cliente</th>
              <th className={thClass}>Servicio</th>
              <th className={thClass}>Presupuesto</th>
              <th className={thClass}>Estado</th>
              <th className={thClass}>Creada</th>
            </tr>
          </thead>
          <tbody>
            {entregas.map(ot => (
              <tr key={ot.otNumber} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-2 whitespace-nowrap">
                  <button
                    onClick={() => onOpenOT(ot.otNumber)}
                    className="text-xs font-semibold text-teal-700 hover:text-teal-900 hover:underline"
                    title="Abrir la OT"
                  >
                    OT-{ot.otNumber}
                  </button>
                </td>
                <td className="px-3 py-2 text-xs text-slate-600 truncate max-w-[200px]">{ot.razonSocial || '—'}</td>
                <td className="px-3 py-2 text-[10px] text-slate-500 truncate max-w-[180px]">{ot.tipoServicio || '—'}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {(ot.budgets ?? []).length === 0
                    ? <span className="text-[10px] text-slate-300">—</span>
                    : (ot.budgets ?? []).map(num => (
                      <button
                        key={num}
                        onClick={() => onOpenPresupuestoNumero?.(num)}
                        className="text-[10px] font-mono text-teal-700 hover:underline mr-1.5"
                        title="Abrir el presupuesto"
                      >
                        {num}
                      </button>
                    ))}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <StatusBadge
                    label={OT_ESTADO_LABELS[ot.estadoAdmin ?? 'CREADA'] ?? ot.estadoAdmin ?? 'Creada'}
                    colorClass={ESTADO_BADGE[ot.estadoAdmin ?? 'CREADA'] ?? 'bg-slate-100 text-slate-500'}
                  />
                </td>
                <td className="px-3 py-2 text-[10px] text-slate-400 whitespace-nowrap">{fmtFecha(ot.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
