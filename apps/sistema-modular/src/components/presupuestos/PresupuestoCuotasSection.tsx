import { useState } from 'react';
import type { PresupuestoCuota, MonedaPresupuesto } from '@ags/shared';
import { MONEDA_SIMBOLO } from '@ags/shared';
import { Button } from '../ui/Button';

interface Props {
  cuotas: PresupuestoCuota[];
  onChange: (cuotas: PresupuestoCuota[]) => void;
  /** Totals per currency for MIXTA, or single total for normal mode */
  totalsByCurrency: Record<string, number>;
  moneda: MonedaPresupuesto;
}

const lbl = 'text-[10px] font-mono font-medium text-slate-500 mb-0.5 block uppercase tracking-wide';

export const PresupuestoCuotasSection: React.FC<Props> = ({ cuotas, onChange, totalsByCurrency, moneda }) => {
  const [collapsed, setCollapsed] = useState(cuotas.length === 0);
  const [cantCuotas, setCantCuotas] = useState(cuotas.length || 12);

  const fmtMoney = (n: number, m: string) => `${MONEDA_SIMBOLO[m] || '$'} ${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

  const handleGenerate = () => {
    const generated: PresupuestoCuota[] = [];
    for (const [currency, total] of Object.entries(totalsByCurrency)) {
      if (total <= 0) continue;
      const montoPorCuota = Math.round((total / cantCuotas) * 100) / 100;
      const remainder = Math.round((total - montoPorCuota * cantCuotas) * 100) / 100;
      for (let i = 0; i < cantCuotas; i++) {
        generated.push({
          numero: i + 1,
          moneda: currency as 'USD' | 'ARS' | 'EUR',
          monto: i === 0 ? montoPorCuota + remainder : montoPorCuota,
          descripcion: `Cuota ${i + 1}/${cantCuotas}`,
        });
      }
    }
    onChange(generated);
    setCollapsed(false);
  };

  const handleCuotaChange = (idx: number, field: keyof PresupuestoCuota, value: any) => {
    const updated = [...cuotas];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange(updated);
  };

  const handleRemoveCuota = (idx: number) => {
    onChange(cuotas.filter((_, i) => i !== idx));
  };

  const handleAddCuota = () => {
    const defaultMoneda = moneda === 'MIXTA' ? 'USD' : (moneda as 'USD' | 'ARS' | 'EUR');
    onChange([...cuotas, {
      numero: cuotas.length + 1,
      moneda: defaultMoneda,
      monto: 0,
      descripcion: `Cuota ${cuotas.length + 1}`,
    }]);
  };

  // Group cuotas by currency for subtotals
  const cuotaTotals: Record<string, number> = {};
  cuotas.forEach(c => { cuotaTotals[c.moneda] = (cuotaTotals[c.moneda] || 0) + c.monto; });

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-1.5 text-[10px] font-mono font-semibold text-teal-700/70 uppercase tracking-widest hover:text-teal-700"
      >
        <svg className={`w-3 h-3 transition-transform ${collapsed ? '' : 'rotate-90'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        Plan de cuotas {cuotas.length > 0 && `(${cuotas.length})`}
      </button>

      {!collapsed && (
        <div className="space-y-2">
          {/* Generator */}
          <div className="flex items-end gap-2">
            <div>
              <label className={lbl}>Cantidad de cuotas</label>
              <input type="number" min="1" max="60" value={cantCuotas}
                onChange={e => setCantCuotas(Number(e.target.value) || 1)}
                className="w-20 border border-[#E5E5E5] rounded-md px-2 py-1.5 text-xs bg-white text-center" />
            </div>
            <Button size="sm" variant="outline" onClick={handleGenerate}>
              Generar cuotas iguales
            </Button>
            <Button size="sm" variant="outline" onClick={handleAddCuota}>
              + Cuota manual
            </Button>
          </div>

          {/* Cuotas table */}
          {cuotas.length > 0 && (
            <div className="border border-[#E5E5E5] rounded-md overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#F0F0F0]">
                    <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase py-2 px-2 text-center w-10">#</th>
                    <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase py-2 px-2 text-center w-16">Moneda</th>
                    <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase py-2 px-2 text-center w-24">Monto</th>
                    <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase py-2 px-2 text-center">Descripción</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cuotas.map((c, idx) => (
                    <tr key={idx}>
                      <td className="px-2 py-1 text-center text-xs text-slate-500">{c.numero}</td>
                      <td className="px-2 py-1 text-center">
                        <select value={c.moneda} onChange={e => handleCuotaChange(idx, 'moneda', e.target.value)}
                          className="border border-slate-200 rounded px-1 py-0.5 text-[10px] bg-white">
                          <option value="USD">USD</option>
                          <option value="ARS">ARS</option>
                          <option value="EUR">EUR</option>
                        </select>
                      </td>
                      <td className="px-2 py-1 text-center">
                        <input type="number" min="0" step="0.01" value={c.monto}
                          onChange={e => handleCuotaChange(idx, 'monto', Number(e.target.value) || 0)}
                          className="w-full border border-slate-200 rounded px-2 py-0.5 text-xs text-right font-mono" />
                      </td>
                      <td className="px-2 py-1">
                        <input value={c.descripcion || ''} onChange={e => handleCuotaChange(idx, 'descripcion', e.target.value)}
                          className="w-full border border-slate-200 rounded px-2 py-0.5 text-xs" placeholder="Cuota 1/12" />
                      </td>
                      <td className="text-center">
                        <button onClick={() => handleRemoveCuota(idx)} className="text-red-400 hover:text-red-600">&times;</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-[#F0F0F0] border-t border-[#E5E5E5]">
                  {Object.entries(cuotaTotals).map(([m, total]) => (
                    <tr key={m}>
                      <td colSpan={2} className="px-2 py-1 text-right text-[9px] font-mono font-semibold text-slate-500 uppercase">Total {m}</td>
                      <td className="px-2 py-1 text-right text-xs font-mono font-semibold text-teal-700">{fmtMoney(total, m)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  ))}
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
