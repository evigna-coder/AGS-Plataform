import type { PosicionComex } from '@ags/shared';
import { CampoNumero } from './CampoNumero';
import { usd, type ResultadoPosicion } from '../../utils/presupuestoComex';

interface Props {
  indice: number;
  posicion: PosicionComex;
  resultado: ResultadoPosicion | undefined;
  onChange: (patch: Partial<PosicionComex>) => void;
  onQuitar?: () => void;
}

const inputCls = 'w-full text-xs border border-slate-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500';
const lbl = 'block text-[10px] font-mono uppercase tracking-wide text-slate-500 mb-0.5';

/**
 * Una posición arancelaria del presupuesto de comex (2026-10-01): lo que se
 * declara junto con su CIF y alícuotas, y debajo los gravámenes calculados.
 * Ej.: un cromatógrafo y su detector declarado aparte son dos tarjetas.
 */
export function PosicionComexCard({ indice, posicion: p, resultado: r, onChange, onQuitar }: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono uppercase tracking-wide text-teal-700 bg-teal-50 border border-teal-200 rounded px-1.5 py-0.5">Posición {indice + 1}</span>
        {onQuitar && (
          <button type="button" onClick={onQuitar} className="ml-auto text-[11px] text-slate-400 hover:text-red-600">Quitar</button>
        )}
      </div>
      <div className="grid grid-cols-[1fr_160px] gap-3">
        <label><span className={lbl}>Descripción</span>
          <input className={inputCls} value={p.descripcion} placeholder="Ej: Cromatógrafo gaseoso 7890B"
            onChange={e => onChange({ descripcion: e.target.value })} /></label>
        <label><span className={lbl}>Posición arancelaria</span>
          <input className={`${inputCls} font-mono`} value={p.ncm ?? ''} placeholder="9027.20.11"
            onChange={e => onChange({ ncm: e.target.value || null })} /></label>
      </div>
      <div className="grid grid-cols-5 gap-3 items-end">
        <CampoNumero label="CIF" sufijo="USD" value={p.cif} onChange={v => onChange({ cif: v })} />
        <CampoNumero label="Derechos" sufijo="%" value={p.derechosPct} onChange={v => onChange({ derechosPct: v })} />
        <CampoNumero label="Estadística" sufijo="%" value={p.estadisticaPct} onChange={v => onChange({ estadisticaPct: v })} />
        <CampoNumero label="Ganancias" sufijo="%" value={p.gananciasPct} onChange={v => onChange({ gananciasPct: v })} />
        <CampoNumero label="IIBB" sufijo="%" value={p.iibbPct} onChange={v => onChange({ iibbPct: v })} />
      </div>
      <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-slate-700">
        <input type="checkbox" checked={p.ivaReducido} onChange={e => onChange({ ivaReducido: e.target.checked })}
          className="w-3.5 h-3.5 accent-teal-600" />
        IVA con reducción <span className="text-slate-400">(10,5 % + adicional 10 %; sin reducción 21 % + 20 %)</span>
      </label>
      {r && (
        <div className="grid grid-cols-4 gap-x-4 gap-y-1 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-[11px]">
          <Dato l="Base imponible" v={r.baseImponible} />
          <Dato l="Derechos" v={r.derechos} />
          <Dato l={`IVA ${r.ivaPct} %`} v={r.iva} />
          <Dato l={`IVA adic. ${r.ivaAdicionalPct} %`} v={r.ivaAdicional} />
          <Dato l="Estadística" v={r.estadistica} />
          <Dato l="Ganancias" v={r.ganancias} />
          <Dato l="IIBB" v={r.iibb} />
          <Dato l="Total gravámenes" v={r.totalGravamenes} fuerte />
        </div>
      )}
    </div>
  );
}

function Dato({ l, v, fuerte }: { l: string; v: number; fuerte?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-500">{l}</span>
      <span className={`font-mono tabular-nums ${fuerte ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>{usd(v)}</span>
    </div>
  );
}
