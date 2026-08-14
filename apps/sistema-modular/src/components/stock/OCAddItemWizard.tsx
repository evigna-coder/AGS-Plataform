import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Articulo, ItemOC, Presentacion, PresentacionUsada } from '@ags/shared';
import { cantidadEnUnidadBase } from '@ags/shared';
import { articulosService } from '../../services/firebaseService';
import { Button } from '../ui/Button';
import { MoneyInput } from '../ui/MoneyInput';
import { articuloMatchesSearch, baseDePresentacion } from '../../utils/articuloSearch';

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
  // Envases del artículo elegido (Fase 2, 2026-08-13): se le compra al proveedor
  // por SU número de parte, pero el stock entra al pool del artículo base.
  const [presentaciones, setPresentaciones] = useState<Presentacion[]>([]);
  const [presentacion, setPresentacion] = useState<PresentacionUsada | null>(null);
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

  const term = search.trim();
  const filtered = term
    // Matchea también los N° de parte de las presentaciones: se compra por el
    // código del envase, pero el stock vive en el artículo base (2026-08-13).
    ? articulos.filter(a => articuloMatchesSearch(term, a)).slice(0, 50)
    : [];

  const selectArticulo = (a: Articulo) => {
    setSel({ articuloId: a.id, articuloCodigo: a.codigo || null, descripcion: a.descripcion || '' });
    if (a.precioReferencia != null) setPrecio(a.precioReferencia);
    const activas = (a.presentaciones ?? []).filter(p => p.activo !== false && p.factor > 0);
    setPresentaciones(activas);
    // Si el usuario buscó por el código de un envase, ese queda preseleccionado
    // — es lo que estaba pidiendo comprar.
    const buscada = activas.find(p => p.codigoParte.toLowerCase().includes(term.toLowerCase()));
    setPresentacion(term && buscada ? { codigoParte: buscada.codigoParte, factor: buscada.factor } : null);
    setStep('cantidad');
  };
  const selectLibre = () => {
    if (!search.trim()) return;
    setSel({ articuloId: null, articuloCodigo: null, descripcion: search.trim() });
    setPresentaciones([]); setPresentacion(null);
    setStep('cantidad');
  };
  const finish = () => {
    if (!sel) return;
    onAdd({
      articuloId: sel.articuloId, articuloCodigo: sel.articuloCodigo, descripcion: sel.descripcion,
      cantidad: cantidad || 1, precioUnitario: precio,
      // Congelado en el ítem: si mañana cambia el factor del catálogo, esta OC
      // no cambia de significado.
      presentacion,
    });
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
          <div className="space-y-3">
            {/* Duplicado sin migrar (2026-08-13): el artículo elegido figura
                como ENVASE de otro. Comprarlo suelto carga el stock en un pool
                separado del que nadie descuenta. */}
            {(() => {
              const inv = baseDePresentacion(articulos, sel?.articuloCodigo ?? null);
              if (!inv) return null;
              return (
                <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
                  <p className="text-[11px] text-amber-900">
                    <span className="font-mono font-semibold">{sel?.articuloCodigo}</span> está declarado como
                    envase de <span className="font-mono font-semibold">{inv.base.codigo}</span> (×{inv.factor}).
                    Comprándolo así, el stock entra a un pool separado.
                  </p>
                  <button
                    type="button"
                    className="mt-1 text-[11px] font-medium text-teal-700 hover:underline"
                    onClick={() => {
                      const envase = sel?.articuloCodigo ?? '';
                      setSel({ articuloId: inv.base.id, articuloCodigo: inv.base.codigo, descripcion: inv.base.descripcion });
                      setPresentaciones((inv.base.presentaciones ?? []).filter(p => p.activo !== false && p.factor > 0));
                      setPresentacion({ codigoParte: envase, factor: inv.factor });
                    }}
                  >
                    Comprar {inv.base.codigo} con el envase {sel?.articuloCodigo} (×{inv.factor})
                  </button>
                </div>
              );
            })()}
            {/* Envase que se le compra al proveedor (2026-08-13). Solo aparece
                si el artículo tiene presentaciones cargadas. */}
            {presentaciones.length > 0 && (
              <div>
                <label className={lbl}>Presentación (N° de parte del proveedor)</label>
                <select
                  className={ctrl}
                  value={presentacion?.codigoParte ?? ''}
                  onChange={e => {
                    const p = presentaciones.find(x => x.codigoParte === e.target.value);
                    setPresentacion(p ? { codigoParte: p.codigoParte, factor: p.factor } : null);
                  }}
                >
                  <option value="">{sel?.articuloCodigo ?? 'Unidad base'} — unidad base (×1)</option>
                  {presentaciones.map(p => (
                    <option key={p.codigoParte} value={p.codigoParte}>
                      {p.codigoParte} — {p.descripcion || 'envase'} (×{p.factor})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className={lbl}>Cantidad {presentacion ? `(envases de ${presentacion.factor})` : ''}</label>
              <input ref={inputRef} type="number" min={0} step="any" inputMode="decimal" className={ctrl} value={cantidad}
                onChange={e => setCantidad(Number(e.target.value.replace(',', '.')) || 0)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setStep('valor'); } if (e.key === 'Escape') onClose(); }} />
              {presentacion && (
                <p className="text-[11px] text-teal-700 mt-1">
                  Ingresa <span className="font-semibold">{cantidadEnUnidadBase(cantidad, presentacion)}</span>
                  {' '}unidad(es) al stock de <span className="font-mono">{sel?.articuloCodigo}</span>
                </p>
              )}
            </div>
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
