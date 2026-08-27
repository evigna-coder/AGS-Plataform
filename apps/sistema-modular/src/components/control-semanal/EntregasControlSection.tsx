import { OT_ESTADO_COLORS, OT_ESTADO_LABELS, MONEDA_SIMBOLO } from '@ags/shared';
import type { Presupuesto, WorkOrder } from '@ags/shared';
import { StatusBadge } from '../ui/StatusBadge';

interface Props {
  entregas: WorkOrder[];
  /** Establecimiento por OT — solo con nombre si el cliente tiene varios (2026-08-20). */
  establecimientoPorOT?: Map<string, string | null>;
  /** numero de ppto → doc, para la columna Valor (2026-08-27). */
  presupuestoPorNumero?: Map<string, Presupuesto>;
  onOpenOT: (otNumber: string) => void;
  onOpenPresupuestoNumero?: (numero: string) => void;
  /** Saca la entrega del control de esta semana (se trasladó a la siguiente). */
  onExcluir?: (otNumber: string) => void;
  excluidas?: number;
  onVerExcluidas?: () => void;
}

const thClass = 'px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';

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
export const EntregasControlSection: React.FC<Props> = ({ entregas, establecimientoPorOT, presupuestoPorNumero, onOpenOT, onOpenPresupuestoNumero, onExcluir, excluidas, onVerExcluidas }) => {
  if (entregas.length === 0) return null;
  const fmtValor = (num: string) => {
    const p = presupuestoPorNumero?.get(num);
    if (!p || p.total == null) return null;
    const sym = MONEDA_SIMBOLO[p.moneda] || p.moneda || '$';
    return `${sym} ${p.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  };
  return (
    <section className="space-y-2">
      <p className="text-[10px] font-mono uppercase tracking-wide text-slate-500">
        1b · Entregas de partes y alquileres pendientes ({entregas.length}) — no se agendan: figuran acá hasta entregarse
      </p>
      <div className="bg-white rounded-xl border border-orange-200 shadow-sm overflow-x-auto">
        <table className="tabla-compacta w-full">
          <thead>
            <tr className="bg-orange-50/60 border-b border-orange-100">
              <th className={thClass}>OT</th>
              <th className={thClass}>Cliente</th>
              <th className={thClass}>Servicio</th>
              <th className={thClass}>Presupuesto</th>
              <th className={`${thClass} text-right`}>Valor</th>
              <th className={thClass}>Estado</th>
              <th className={thClass}>Creada</th>
              <th className={thClass} />
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
                <td className="px-3 py-2 text-xs text-slate-600 truncate max-w-[200px]"
                  title={establecimientoPorOT?.get(ot.otNumber)
                    ? `${ot.razonSocial} (${establecimientoPorOT.get(ot.otNumber)})`
                    : (ot.razonSocial || '')}>
                  {ot.razonSocial || '—'}
                  {establecimientoPorOT?.get(ot.otNumber) && (
                    <span className="text-slate-400"> ({establecimientoPorOT.get(ot.otNumber)})</span>
                  )}
                </td>
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
                {/* Valor del ppto (2026-08-27): las entregas/alquileres se controlan
                    también por la plata que representan. Varios pptos → uno por línea. */}
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {(ot.budgets ?? []).map(num => fmtValor(num)).filter(Boolean).length === 0
                    ? <span className="text-[10px] text-slate-300">—</span>
                    : (ot.budgets ?? []).map(num => {
                        const v = fmtValor(num);
                        return v && <div key={num} className="text-[10px] font-mono text-slate-600 tabular-nums">{v}</div>;
                      })}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <StatusBadge
                    label={OT_ESTADO_LABELS[ot.estadoAdmin ?? 'CREADA'] ?? ot.estadoAdmin ?? 'Creada'}
                    colorClass={OT_ESTADO_COLORS[ot.estadoAdmin ?? 'CREADA'] ?? 'bg-slate-100 text-slate-500'}
                  />
                </td>
                <td className="px-3 py-2 text-[10px] text-slate-400 whitespace-nowrap">{fmtFecha(ot.createdAt)}</td>
                {/* Quitar (2026-08-19): la entrega figura en TODAS las semanas
                    hasta concretarse. Si no se hizo y se trasladó, la foto de la
                    semana que pasó tiene que quedar limpia. Sigue en las demás. */}
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {onExcluir && (
                    <button onClick={() => onExcluir(ot.otNumber)}
                      title="Sacar del control de esta semana — la entrega se trasladó. Sigue figurando en las demás."
                      className="text-[10px] text-slate-300 hover:text-red-600 hover:underline">
                      Quitar
                    </button>
                  )}
                </td>
              </tr>
            ))}
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
    </section>
  );
};
