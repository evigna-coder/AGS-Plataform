import { useEffect, useRef, useState } from 'react';
import { Button } from '../ui/Button';
import type { CondicionUnidad } from '@ags/shared';
import type { UbicOption } from '../../hooks/useStockIntake';
import { matchesSearch } from '../../utils/searchTerms';

const CONDICIONES: CondicionUnidad[] = ['nuevo', 'bien_de_uso', 'reacondicionado', 'vendible', 'scrap'];
const CONDICION_LABELS: Record<CondicionUnidad, string> = {
  nuevo: 'Nuevo', bien_de_uso: 'Bien de uso', reacondicionado: 'Reacondicionado', vendible: 'Vendible', scrap: 'Scrap',
};

interface Draft {
  articulo: { codigo: string; descripcion: string };
  step: string;
  cantidad: number;
  condicion: CondicionUnidad;
  series: string[];
  serieInput: string;
  lote: string;
}

interface Props {
  draft: Draft;
  ubicOptions: UbicOption[];
  error: string;
  onPatch: (p: any) => void;
  onAdvance: (payload?: { ubic?: UbicOption }) => void;
  onCancel: () => void;
}

const STEP_TITLE: Record<string, string> = {
  cantidad: 'Cantidad', condicion: 'Condición', ubicacion: 'Ubicación', serie: 'Nº de serie', lote: 'Nº de lote',
};

export const StockIntakeStepModal: React.FC<Props> = ({ draft, ubicOptions, error, onPatch, onAdvance, onCancel }) => {
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);
  const ubicListRef = useRef<HTMLDivElement | null>(null);
  const [ubicSearch, setUbicSearch] = useState('');
  const [ubicHi, setUbicHi] = useState(0); // índice resaltado en la lista de ubicación

  // Auto-focus en cada paso / cada serie
  useEffect(() => {
    setUbicSearch('');
    setUbicHi(0);
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [draft.step, draft.series.length]);

  // Mantener visible la opción resaltada al navegar con el teclado.
  useEffect(() => {
    const el = ubicListRef.current?.children[ubicHi] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [ubicHi]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); onAdvance(); }
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
  };

  const stepNum = ['cantidad', 'condicion', 'ubicacion', 'serie', 'lote'].indexOf(draft.step) + 1;
  const lbl = 'block text-[10px] font-mono font-medium text-slate-500 mb-1 uppercase tracking-wide';
  const ctrl = 'w-full border border-[#E5E5E5] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-700';

  const filteredUbic = ubicOptions.filter(o => matchesSearch(ubicSearch, o.nombre));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30" onMouseDown={onCancel}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-4" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <p className="text-[10px] font-mono text-teal-700 uppercase tracking-widest">{STEP_TITLE[draft.step]}</p>
            <p className="text-xs text-slate-400 font-mono">{draft.articulo.codigo}</p>
          </div>
          <span className="text-[10px] text-slate-300 font-mono">{draft.step === 'serie' ? `serie ${draft.series.length + 1} de ${draft.cantidad}` : `paso ${stepNum}`}</span>
        </div>

        {draft.step === 'cantidad' && (
          <div>
            <label className={lbl}>Cantidad</label>
            <input ref={inputRef as any} type="number" min={1} className={ctrl} value={draft.cantidad}
              onChange={e => onPatch({ cantidad: Number(e.target.value) || 0 })} onKeyDown={onKey} />
          </div>
        )}

        {draft.step === 'condicion' && (
          <div>
            <label className={lbl}>Condición</label>
            <select ref={inputRef as any} className={ctrl} value={draft.condicion}
              onChange={e => onPatch({ condicion: e.target.value as CondicionUnidad })} onKeyDown={onKey}>
              {CONDICIONES.map(c => <option key={c} value={c}>{CONDICION_LABELS[c]}</option>)}
            </select>
          </div>
        )}

        {draft.step === 'ubicacion' && (
          <div>
            <label className={lbl}>Ubicación</label>
            <input ref={inputRef as any} className={ctrl + ' mb-2'} placeholder="Buscar ubicación..."
              value={ubicSearch}
              onChange={e => { setUbicSearch(e.target.value); setUbicHi(0); }}
              onKeyDown={e => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setUbicHi(i => Math.min(filteredUbic.length - 1, i + 1)); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setUbicHi(i => Math.max(0, i - 1)); }
                else if (e.key === 'Enter') { e.preventDefault(); const sel = filteredUbic[ubicHi]; if (sel) onAdvance({ ubic: sel }); }
                else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
              }} />
            <div ref={ubicListRef} className="border border-slate-200 rounded-md max-h-56 overflow-y-auto divide-y divide-slate-50">
              {filteredUbic.length === 0 && <p className="text-xs text-slate-400 px-3 py-3 text-center">Sin coincidencias</p>}
              {filteredUbic.map((o, idx) => (
                <button key={o.key} onClick={() => onAdvance({ ubic: o })}
                  onMouseEnter={() => setUbicHi(idx)}
                  className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between ${idx === ubicHi ? 'bg-teal-50' : 'hover:bg-teal-50'} ${o.historica ? 'text-slate-400' : 'text-slate-700'}`}>
                  <span>{o.nombre}{o.historica && <span className="ml-1 text-[10px] italic">· sugerido (sin stock actual)</span>}</span>
                  {o.count > 0 && <span className="text-[10px] font-semibold text-teal-700">{o.count} u.</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {draft.step === 'serie' && (
          <div>
            <label className={lbl}>Nº de serie ({draft.series.length + 1} de {draft.cantidad})</label>
            <input ref={inputRef as any} className={ctrl + ' font-mono'} value={draft.serieInput}
              onChange={e => onPatch({ serieInput: e.target.value })} onKeyDown={onKey} placeholder="Escaneá o tipeá y Enter" />
            {draft.series.length > 0 && <p className="mt-1.5 text-[10px] text-slate-400">Cargadas: {draft.series.join(', ')}</p>}
          </div>
        )}

        {draft.step === 'lote' && (
          <div>
            <label className={lbl}>Nº de lote</label>
            <input ref={inputRef as any} className={ctrl + ' font-mono'} value={draft.lote}
              onChange={e => onPatch({ lote: e.target.value })} onKeyDown={onKey} />
          </div>
        )}

        {error && <p className="mt-2 text-[11px] text-red-600">{error}</p>}

        <div className="flex justify-between items-center mt-4">
          <button onClick={onCancel} className="text-[11px] text-slate-400 hover:text-slate-600">Cancelar (Esc)</button>
          {draft.step !== 'ubicacion' && (
            <Button size="sm" onClick={() => onAdvance()}>Siguiente (Enter ↵)</Button>
          )}
        </div>
      </div>
    </div>
  );
};
