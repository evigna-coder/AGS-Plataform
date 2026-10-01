import type { GastoComex } from '@ags/shared';
import { CampoNumero } from './CampoNumero';
import { usd } from '../../utils/presupuestoComex';

interface Props {
  gastos: GastoComex[];
  onChange: (gastos: GastoComex[]) => void;
  gastosBancarios: number;
  onGastosBancarios: (n: number) => void;
  costoFinancieroPct: number;
  onCostoFinancieroPct: (n: number) => void;
}

/** Gastos del presupuesto de comex (2026-10-01): lista editable + bancarios + % financiero. */
export function GastosComexEditor({ gastos, onChange, gastosBancarios, onGastosBancarios, costoFinancieroPct, onCostoFinancieroPct }: Props) {
  const set = (id: string, patch: Partial<GastoComex>) => onChange(gastos.map(g => (g.id === id ? { ...g, ...patch } : g)));
  const total = gastos.reduce((a, g) => a + (g.monto || 0), 0);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
      <p className="text-[10px] font-mono uppercase tracking-wide text-slate-500">Gastos</p>
      {gastos.map(g => (
        <div key={g.id} className="flex items-end gap-2">
          <input value={g.concepto} onChange={e => set(g.id, { concepto: e.target.value })} placeholder="Concepto"
            className="flex-1 min-w-0 text-xs border border-slate-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500" />
          <CampoNumero label="" sufijo="USD" ancho="w-36" value={g.monto} onChange={v => set(g.id, { monto: v })} />
          <button type="button" onClick={() => onChange(gastos.filter(x => x.id !== g.id))}
            className="pb-1.5 text-slate-400 hover:text-red-600 text-xs" title="Quitar">✕</button>
        </div>
      ))}
      <div className="flex items-center justify-between pt-1">
        <button type="button" onClick={() => onChange([...gastos, { id: crypto.randomUUID(), concepto: '', monto: 0 }])}
          className="text-[11px] text-teal-700 hover:underline">+ Gasto</button>
        <span className="text-[11px] text-slate-500">Total gastos <span className="font-mono font-semibold text-slate-800">{usd(total)}</span></span>
      </div>
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
        {/* Bancarios ahora es un renglón de la lista (2026-10-01); el campo aparte
            solo aparece en presupuestos viejos que lo tenían cargado. */}
        {gastosBancarios > 0
          ? <CampoNumero label="Gastos bancarios (anterior)" sufijo="USD" value={gastosBancarios} onChange={onGastosBancarios} />
          : <span />}
        <CampoNumero label="Costo financiero s/ IVA + adic. + Gs" sufijo="%" value={costoFinancieroPct} onChange={onCostoFinancieroPct} />
      </div>
    </div>
  );
}
