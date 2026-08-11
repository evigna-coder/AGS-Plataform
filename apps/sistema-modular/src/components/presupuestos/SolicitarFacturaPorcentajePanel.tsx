/**
 * Panel del modo "Anticipo por %" de SolicitarFacturaModal (2026-08-11).
 *
 * El modal era 100% por ítems (cantidades enteras contra cada línea): un
 * presupuesto mitad adelantado / mitad diferido no tenía forma de solicitarse
 * desde el ícono — solo vía el esquema de cuotas. Este modo factura un
 * porcentaje del total como línea única ("Anticipo 50% — Presupuesto NNN").
 */
interface Props {
  /** Total del presupuesto (sin impuestos — mismo criterio que la lista). */
  totalPpto: number;
  /** Suma de solicitudes previas no anuladas (ítems o %, da igual: es monto). */
  yaSolicitado: number;
  pct: string;
  onPctChange: (v: string) => void;
  fmtMoney: (n: number) => string;
}

/** % restante por solicitar, capado a [0, 100] y redondeado a 2 decimales. */
export function pctDisponibleDe(totalPpto: number, yaSolicitado: number): number {
  if (totalPpto <= 0) return 0;
  return Math.max(0, Math.round((100 - (yaSolicitado / totalPpto) * 100) * 100) / 100);
}

export function SolicitarFacturaPorcentajePanel({ totalPpto, yaSolicitado, pct, onPctChange, fmtMoney }: Props) {
  const disponible = pctDisponibleDe(totalPpto, yaSolicitado);
  const pctNum = Number(pct) || 0;
  const monto = Math.round(totalPpto * pctNum) / 100;
  const excede = pctNum > disponible + 0.01;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {([
          ['Total presupuesto', fmtMoney(totalPpto)],
          ['Ya solicitado', `${fmtMoney(yaSolicitado)} (${(100 - disponible).toFixed(0)}%)`],
          ['Disponible', `${disponible.toFixed(0)}%`],
        ] as const).map(([label, value]) => (
          <div key={label} className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide">{label}</p>
            <p className="text-sm font-semibold text-slate-800 mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-end gap-3">
        <div>
          <label className="block text-[10px] font-mono font-medium text-slate-500 mb-1 uppercase tracking-wide">
            Porcentaje a facturar *
          </label>
          <div className="flex items-center gap-1">
            <input
              type="number" min={0} max={disponible} step="any" value={pct}
              onChange={e => onPctChange(e.target.value)}
              onFocus={e => e.currentTarget.select()}
              className={`w-24 text-center border rounded-lg px-2 py-1.5 text-sm font-semibold ${excede ? 'border-red-300' : 'border-slate-200'}`}
            />
            <span className="text-sm text-slate-500">%</span>
          </div>
        </div>
        <div className="flex gap-1 pb-0.5">
          {[30, 50].map(p => (
            <button key={p} type="button" onClick={() => onPctChange(String(Math.min(p, disponible)))}
              className="px-2 py-1 text-[11px] font-medium rounded border border-slate-200 text-slate-600 hover:bg-slate-50">
              {p}%
            </button>
          ))}
          <button type="button" onClick={() => onPctChange(String(disponible))}
            className="px-2 py-1 text-[11px] font-medium rounded border border-teal-200 text-teal-700 hover:bg-teal-50">
            Saldo ({disponible.toFixed(0)}%)
          </button>
        </div>
        <div className="flex-1 text-right pb-1">
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide">Monto de la solicitud</p>
          <p className={`text-base font-bold ${excede ? 'text-red-600' : 'text-teal-700'}`}>{fmtMoney(monto)}</p>
        </div>
      </div>

      {excede && (
        <p className="text-[11px] text-red-600">
          Supera el {disponible.toFixed(0)}% disponible — ya hay solicitudes previas por {fmtMoney(yaSolicitado)}.
        </p>
      )}
    </div>
  );
}
