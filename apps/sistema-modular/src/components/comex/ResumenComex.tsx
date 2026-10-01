import { usd, type ResultadoComex } from '../../utils/presupuestoComex';

interface Props {
  r: ResultadoComex;
  tipoCambio?: number | null;
}

/**
 * Resumen del presupuesto de comex (2026-10-01): los mismos renglones que la
 * planilla (valor, no recuperables, costo financiero, costo total) más el
 * factor y lo que se paga en aduana.
 */
export function ResumenComex({ r, tipoCambio }: Props) {
  const Fila = ({ l, v, sub, fuerte }: { l: string; v: number; sub?: boolean; fuerte?: boolean }) => (
    <div className={`flex justify-between gap-3 ${sub ? 'pl-3 text-[11px] text-slate-500' : 'text-xs text-slate-700'} ${fuerte ? 'font-semibold text-slate-900' : ''}`}>
      <span>{l}</span><span className="font-mono tabular-nums">{usd(v)}</span>
    </div>
  );
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="space-y-1">
        <Fila l="Valor (CIF)" v={r.valorCif} />
        <Fila l="Derechos + estadística + IIBB + gastos" v={r.noRecuperable} />
        <Fila l="Derechos y estadística" v={r.derechos + r.estadistica} sub />
        <Fila l="IIBB" v={r.iibb} sub />
        <Fila l="Gastos" v={r.totalGastos} sub />
        {r.gastosBancarios > 0 && <Fila l="Gastos bancarios" v={r.gastosBancarios} sub />}
        <Fila l="Costo financiero" v={r.costoFinanciero} />
      </div>
      <div className="pt-2 border-t border-slate-200 space-y-1">
        <div className="flex justify-between items-baseline">
          <span className="text-sm font-semibold text-slate-900">Costo total</span>
          <span className="font-mono text-base font-bold text-teal-700 tabular-nums">{usd(r.costoTotal)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Factor de importación</span>
          <span className="font-mono font-semibold text-teal-700">{r.factor ? r.factor.toFixed(4) : '—'}</span>
        </div>
        {tipoCambio ? (
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>Equivalente en ARS (TC {tipoCambio})</span>
            <span className="font-mono">ARS {(r.costoTotal * tipoCambio).toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span>
          </div>
        ) : null}
      </div>
      <div className="pt-2 border-t border-slate-100 space-y-1">
        <Fila l="A pagar en aduana (gravámenes)" v={r.totalGravamenes} />
        <Fila l="IVA + IVA adicional + Ganancias (recuperables)" v={r.iva + r.ivaAdicional + r.ganancias} sub />
        <Fila l="Erogación total" v={r.erogacion} />
      </div>
    </div>
  );
}
