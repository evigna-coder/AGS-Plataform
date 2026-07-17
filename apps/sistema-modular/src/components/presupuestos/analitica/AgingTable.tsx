import { formatMonto, type BucketAging } from '../../../utils/analitica/presupuestosMetrics';

export interface AgingTableRow {
  id: string;
  numero: string;
  clienteNombre: string;
  responsableNombre: string;
  montoLabel: string;
  dias: number | null;
  /** Columna extra opcional (OTs cerradas / estado de validez). */
  extra?: string;
  extraTone?: 'default' | 'danger';
}

interface Props {
  title: string;
  subtitle?: string;
  extraHeader?: string;
  rows: AgingTableRow[];
  buckets: BucketAging[];
  emptyText: string;
  onRowClick: (id: string) => void;
  onDrilldown?: () => void;
  drilldownLabel?: string;
  /** Destacar el bloque (borde ámbar) — usado por OC adeudadas, el dolor del pedido. */
  accent?: boolean;
}

const thClass = 'px-3 py-2 text-left text-[10px] font-mono uppercase tracking-wide text-slate-400 whitespace-nowrap';

/** Tabla genérica de aging (snapshot HOY) con resumen por buckets. Sirve para 1.3 y 1.4. */
export const AgingTable: React.FC<Props> = ({
  title, subtitle, extraHeader, rows, buckets, emptyText, onRowClick, onDrilldown, drilldownLabel, accent,
}) => (
  <div className={`rounded-xl bg-white border ${accent ? 'border-amber-300' : 'border-slate-200'}`}>
    <div className="flex items-start justify-between gap-2 px-4 pt-4">
      <div>
        <p className="text-[10px] font-mono uppercase tracking-wide text-slate-500">{title}</p>
        {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {onDrilldown && (
        <button type="button" onClick={onDrilldown}
          className="text-[11px] text-teal-600 hover:text-teal-800 hover:underline whitespace-nowrap">
          {drilldownLabel ?? 'Ver en la lista →'}
        </button>
      )}
    </div>

    {rows.length > 0 && (
      <div className="flex gap-2 flex-wrap px-4 pt-3">
        {buckets.map(b => (
          <div key={b.key} className={`rounded-lg border px-2 py-1 ${b.count > 0 ? 'border-slate-200 bg-slate-50' : 'border-slate-100 opacity-50'}`}>
            <p className="text-[9px] font-mono uppercase tracking-wide text-slate-400">{b.label}</p>
            <p className="text-xs font-semibold text-slate-700 tabular-nums">
              {b.count}
              {b.count > 0 && <span className="font-normal text-slate-400"> · {formatMonto(b.monto)}</span>}
            </p>
          </div>
        ))}
      </div>
    )}

    {rows.length === 0 ? (
      <p className="text-xs text-slate-400 px-4 py-6 text-center">{emptyText}</p>
    ) : (
      <div className="overflow-x-auto mt-2 pb-1">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <th className={thClass}>Número</th>
              <th className={thClass}>Cliente</th>
              <th className={thClass}>Responsable</th>
              <th className={`${thClass} text-right`}>Monto</th>
              {extraHeader && <th className={thClass}>{extraHeader}</th>}
              <th className={`${thClass} text-right`}>Días</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map(r => (
              <tr key={r.id} className="hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => onRowClick(r.id)}>
                <td className="px-3 py-1.5 text-xs font-semibold text-teal-600 whitespace-nowrap">{r.numero}</td>
                <td className="px-3 py-1.5 text-xs text-slate-700 truncate max-w-[180px]" title={r.clienteNombre}>{r.clienteNombre}</td>
                <td className="px-3 py-1.5 text-xs text-slate-500 truncate max-w-[110px]" title={r.responsableNombre}>{r.responsableNombre}</td>
                <td className="px-3 py-1.5 text-xs text-slate-900 tabular-nums text-right whitespace-nowrap">{r.montoLabel}</td>
                {extraHeader && (
                  <td className={`px-3 py-1.5 text-[11px] whitespace-nowrap ${r.extraTone === 'danger' ? 'text-red-600' : 'text-slate-500'}`}>
                    {r.extra ?? '—'}
                  </td>
                )}
                <td className={`px-3 py-1.5 text-xs font-semibold tabular-nums text-right ${((r.dias ?? 0) > 30) ? 'text-red-600' : 'text-slate-700'}`}>
                  {r.dias !== null ? `${r.dias}d` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);
