import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Articulo, ItemOC } from '@ags/shared';
import { articulosService } from '../../services/firebaseService';
import { Button } from '../ui/Button';
import { MoneyInput } from '../ui/MoneyInput';

interface Props {
  onAdd: (item: Partial<ItemOC>) => void;
  onClose: () => void;
}

type Step = 'articulo' | 'cantidad' | 'valor';
const STEP_TITLE: Record<Step, string> = { articulo: 'Articulo', cantidad: 'Cantidad', valor: 'Valor unitario' };

const lbl = 'block text-[10px] font-mono font-medium text-slate-500 mb-1 uppercase tracking-wide';
const ctrl = 'w-full border border-[#E5E5E5] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-700';

/** Mini-wizard secuencial para agregar un item a la OC: artículo → cantidad → valor (Enter avanza). */
export const OCAddItemWizard: React.FC<Props> = ({ onAdd, onClose }) => {
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [step, setStep] = useState<Step>('articulo');
  const [search, setSearch] = useState('');
  const [sel, setSel] = useState<{ articuloId: string | null; articuloCodigo: string | null; descripcion: string } | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const [precio, setPrecio] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => { articulosService.getAll().then(setArticulos).catch(() => {}); }, []);
  useEffect(() => {
    const t = setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select?.(); }, 30);
    return () => clearTimeout(t);
  }, [step]);

  const term = search.trim().toLowerCase();
  const filtered = term
    ? articulos.filter(a => (a.codigo || '').toLowerCase().includes(term) || (a.descripcion || '').toLowerCase().includes(term)).slice(0, 50)
    : [];

  const selectArticulo = (a: Articulo) => {
    setSel({ articuloId: a.id, articuloCodigo: a.codigo || null, descripcion: a.descripcion || '' });
    if (a.precioReferencia != null) setPrecio(a.precioReferencia);
    setStep('cantidad');
  };
  const selectLibre = () => {
    if (!search.trim()) return;
    setSel({ articuloId: null, articuloCodigo: null, descripcion: search.trim() });
    setStep('cantidad');
  };
  const finish = () => {
    if (!sel) return;
    onAdd({ articuloId: sel.articuloId, articuloCodigo: sel.articuloCodigo, descripcion: sel.descripcion, cantidad: cantidad || 1, precioUnitario: precio });
    onClose();
  };

  const stepNum = ['articulo', 'cantidad', 'valor'].indexOf(step) + 1;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30" onMouseDown={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-4" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <p className="text-[10px] font-mono text-teal-700 uppercase tracking-widest">{STEP_TITLE[step]}</p>
            {sel && <p className="text-xs text-slate-400 font-mono">{sel.articuloCodigo || sel.descripcion}</p>}
          </div>
          <span className="text-[10px] text-slate-300 font-mono">paso {stepNum} de 3</span>
        </div>

        {step === 'articulo' && (
          <div>
            <label className={lbl}>Buscar articulo</label>
            <input ref={inputRef} className={ctrl + ' mb-2'} placeholder="Codigo o descripcion..."
              value={search}
              onChange={e => { setSearch(e.target.value); setActiveIndex(0); }}
              onKeyDown={e => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActiveIndex(i => {
                    const next = Math.min(i + 1, filtered.length - 1);
                    itemRefs.current[next]?.scrollIntoView({ block: 'nearest' });
                    return next < 0 ? 0 : next;
                  });
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActiveIndex(i => {
                    const next = Math.max(i - 1, 0);
                    itemRefs.current[next]?.scrollIntoView({ block: 'nearest' });
                    return next;
                  });
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  const pick = filtered[activeIndex] ?? filtered[0];
                  if (pick) selectArticulo(pick); else selectLibre();
                } else if (e.key === 'Escape') {
                  onClose();
                }
              }} />
            <div className="border border-slate-200 rounded-md max-h-56 overflow-y-auto divide-y divide-slate-50">
              {filtered.length === 0 && term && (
                <button onClick={selectLibre} className="w-full text-left px-3 py-1.5 text-xs text-slate-500 hover:bg-teal-50">
                  Usar "{search.trim()}" como descripcion libre
                </button>
              )}
              {filtered.map((a, idx) => (
                <button key={a.id} ref={el => { itemRefs.current[idx] = el; }}
                  onClick={() => selectArticulo(a)} onMouseEnter={() => setActiveIndex(idx)}
                  className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between gap-2 ${idx === activeIndex ? 'bg-teal-50' : 'hover:bg-teal-50'}`}>
                  <span className="text-slate-700 truncate">{a.descripcion}</span>
                  <span className="text-[10px] font-mono text-teal-700 shrink-0">{a.codigo}</span>
                </button>
              ))}
            </div>
            {filtered.length > 0 && <p className="text-[10px] text-slate-300 mt-1">↑↓ para elegir · Enter para seleccionar</p>}
          </div>
        )}

        {step === 'cantidad' && (
          <div>
            <label className={lbl}>Cantidad</label>
            <input ref={inputRef} type="number" min={1} className={ctrl} value={cantidad}
              onChange={e => setCantidad(Number(e.target.value) || 0)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setStep('valor'); } if (e.key === 'Escape') onClose(); }} />
          </div>
        )}

        {step === 'valor' && (
          <div>
            <label className={lbl}>Valor unitario</label>
            <MoneyInput value={precio} onChange={setPrecio} autoFocus className={ctrl} onEnter={finish} placeholder="0.00" />
          </div>
        )}

        <div className="flex justify-between items-center mt-4">
          <button onClick={onClose} className="text-[11px] text-slate-400 hover:text-slate-600">Cancelar (Esc)</button>
          {step === 'cantidad' && <Button size="sm" onClick={() => setStep('valor')}>Siguiente (Enter ↵)</Button>}
          {step === 'valor' && <Button size="sm" onClick={finish}>Agregar (Enter ↵)</Button>}
        </div>
      </div>
    </div>,
    document.body,
  );
};
