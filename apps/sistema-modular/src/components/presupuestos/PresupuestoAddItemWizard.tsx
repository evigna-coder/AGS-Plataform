import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PresupuestoItem, CategoriaPresupuesto, ConceptoServicio, Articulo, Disponibilidad } from '@ags/shared';
import { MONEDA_SIMBOLO } from '@ags/shared';
import { Button } from '../ui/Button';
import { MoneyInput } from '../ui/MoneyInput';
import { findCategoriaIvaDefaultId } from '../../utils/categoriaIva';
import { matchesSearch } from '../../utils/searchTerms';
import { computeStockAmplio } from '../../services/stockAmplioService';
import { articulosService } from '../../services/firebaseService';

interface Props {
  conceptosServicio: ConceptoServicio[];
  categoriasPresupuesto: CategoriaPresupuesto[];
  moneda?: string;
  onAdd: (item: Partial<PresupuestoItem>) => void;
  onClose: () => void;
}

type Step = 'buscar' | 'cantidad' | 'precio';
const STEP_TITLE: Record<Step, string> = { buscar: 'Articulo / servicio', cantidad: 'Cantidad', precio: 'Precio unitario' };

interface Resultado {
  tipo: 'concepto' | 'articulo';
  refId: string;
  codigo: string | null;
  descripcion: string;
  precio: number;
  categoriaPresupuestoId?: string | null;
}

const lbl = 'block text-[10px] font-mono font-medium text-slate-500 mb-1 uppercase tracking-wide';
const ctrl = 'w-full border border-[#E5E5E5] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-700';

/** Wizard de carga rápida: buscador unificado (servicios + artículos) → cantidad → precio. */
export const PresupuestoAddItemWizard: React.FC<Props> = ({ conceptosServicio, categoriasPresupuesto, moneda, onAdd, onClose }) => {
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [step, setStep] = useState<Step>('buscar');
  const [search, setSearch] = useState('');
  const [sel, setSel] = useState<Resultado | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const [precio, setPrecio] = useState<number | null>(null);
  const [descuento, setDescuento] = useState(0);
  const [factor, setFactor] = useState<number | null>(null);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const sym = MONEDA_SIMBOLO[(moneda as keyof typeof MONEDA_SIMBOLO) || 'USD'] || '$';

  useEffect(() => { articulosService.getAll().then(setArticulos).catch(() => {}); }, []);
  useEffect(() => {
    const t = setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select?.(); }, 30);
    return () => clearTimeout(t);
  }, [step]);

  // Catálogo unificado (servicios + artículos).
  const catalogo = useMemo<Resultado[]>(() => [
    ...conceptosServicio.filter(c => c.activo).map(c => ({
      tipo: 'concepto' as const, refId: c.id, codigo: c.codigo ?? null,
      descripcion: c.descripcion, precio: c.valorBase * c.factorActualizacion,
      categoriaPresupuestoId: c.categoriaPresupuestoId ?? null,
    })),
    ...articulos.map(a => ({
      tipo: 'articulo' as const, refId: a.id, codigo: a.codigo ?? null,
      descripcion: a.descripcion, precio: a.precioReferencia ?? 0,
    })),
  ], [conceptosServicio, articulos]);

  const term = search.trim();
  const filtered = term
    ? catalogo.filter(r => matchesSearch(term, r.codigo, r.descripcion))
    : [];

  // Resetear el resaltado al cambiar la búsqueda.
  useEffect(() => { setHighlightIdx(0); }, [term]);
  const moveHighlight = (delta: number) => {
    setHighlightIdx(prev => {
      const next = Math.max(0, Math.min(filtered.length - 1, prev + delta));
      listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' });
      return next;
    });
  };

  const selectResultado = (r: Resultado) => {
    setSel(r);
    if (r.precio) setPrecio(r.precio);
    setStep('cantidad');
  };
  const selectLibre = () => {
    if (!search.trim()) return;
    setSel({ tipo: 'concepto', refId: '', codigo: null, descripcion: search.trim(), precio: 0 });
    setStep('cantidad');
  };

  const finish = async () => {
    if (!sel) return;
    const catDefault = findCategoriaIvaDefaultId(categoriasPresupuesto);
    const base: Partial<PresupuestoItem> = {
      descripcion: sel.descripcion,
      codigoProducto: sel.codigo,
      cantidad: cantidad || 1,
      precioUnitario: precio ?? 0,
      descuento: descuento || 0,
      factor: factor ?? null,
      categoriaPresupuestoId: sel.categoriaPresupuestoId || catDefault,
    };
    if (sel.tipo === 'concepto') {
      onAdd({ ...base, conceptoServicioId: sel.refId || null, itemRequiereImportacion: false });
    } else {
      // Artículo de stock: disponibilidad automática por ATP.
      let disponibilidad: Disponibilidad = 'post_facturacion';
      let etaDiasEstimados: number | null = null;
      try {
        const stock = await computeStockAmplio(sel.refId);
        const atp = (stock as { atp?: number }).atp ?? 0;
        disponibilidad = atp > 0 ? 'stock' : 'a_importar';
        etaDiasEstimados = atp > 0 ? 0 : 30;
      } catch { /* defaults */ }
      onAdd({ ...base, stockArticuloId: sel.refId, disponibilidad, etaDiasEstimados });
    }
    onClose();
  };

  const stepNum = ['buscar', 'cantidad', 'precio'].indexOf(step) + 1;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30" onMouseDown={onClose}>
      <div className={`bg-white rounded-xl shadow-2xl w-full p-4 ${step === 'buscar' ? 'max-w-2xl' : 'max-w-sm'}`} onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <p className="text-[10px] font-mono text-teal-700 uppercase tracking-widest">{STEP_TITLE[step]}</p>
            {sel && <p className="text-xs text-slate-400 font-mono truncate max-w-[220px]">{sel.codigo || sel.descripcion}</p>}
          </div>
          <span className="text-[10px] text-slate-300 font-mono">paso {stepNum} de 3</span>
        </div>

        {step === 'buscar' && (
          <div>
            <label className={lbl}>Buscar servicio o articulo</label>
            <input ref={inputRef} className={ctrl + ' mb-2'} placeholder="Codigo o descripcion..."
              value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'ArrowDown') { e.preventDefault(); moveHighlight(1); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); moveHighlight(-1); }
                else if (e.key === 'Enter') { e.preventDefault(); if (filtered[highlightIdx]) selectResultado(filtered[highlightIdx]); else selectLibre(); }
                else if (e.key === 'Escape') onClose();
              }} />
            <div ref={listRef} className="border border-slate-200 rounded-md max-h-72 overflow-y-auto divide-y divide-slate-50">
              {filtered.length === 0 && term && (
                <button onClick={selectLibre} className="w-full text-left px-3 py-1.5 text-xs text-slate-500 hover:bg-teal-50">
                  Usar "{search.trim()}" como descripcion libre
                </button>
              )}
              {filtered.map((r, i) => (
                <button key={`${r.tipo}-${r.refId}`} onClick={() => selectResultado(r)}
                  onMouseEnter={() => setHighlightIdx(i)}
                  className={`w-full text-left px-3 py-1.5 text-xs flex items-start justify-between gap-3 ${i === highlightIdx ? 'bg-teal-50' : 'hover:bg-teal-50/50'}`}>
                  <span className="flex items-start gap-1.5 min-w-0">
                    <span className={`shrink-0 mt-0.5 text-[9px] font-medium px-1 py-0.5 rounded ${r.tipo === 'concepto' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {r.tipo === 'concepto' ? 'Servicio' : 'Articulo'}
                    </span>
                    <span className="text-slate-700">{r.descripcion}</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0 whitespace-nowrap">{r.codigo}{r.precio ? ` · ${sym}${r.precio}` : ''}</span>
                </button>
              ))}
            </div>
            {filtered.length > 0 && (
              <p className="text-[10px] text-slate-300 font-mono mt-1.5">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''} · ↑↓ para navegar · Enter para elegir</p>
            )}
          </div>
        )}

        {step === 'cantidad' && (
          <div>
            <label className={lbl}>Cantidad</label>
            <input ref={inputRef} type="number" min={1} className={ctrl} value={cantidad}
              onChange={e => setCantidad(Number(e.target.value) || 0)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setStep('precio'); } if (e.key === 'Escape') onClose(); }} />
          </div>
        )}

        {step === 'precio' && (
          <div className="space-y-3">
            <div>
              <label className={lbl}>Precio unitario ({sym})</label>
              <MoneyInput value={precio} onChange={setPrecio} autoFocus className={ctrl} onEnter={() => void finish()} placeholder="0.00" />
            </div>
            <div>
              <label className={lbl}>Descuento %</label>
              <input type="number" min={0} max={100} step={0.5} className={ctrl} value={descuento || ''}
                placeholder="0"
                onChange={e => setDescuento(Number(e.target.value) || 0)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void finish(); } if (e.key === 'Escape') onClose(); }} />
              {descuento > 0 && precio != null && (
                <p className="text-[10px] font-mono text-slate-400 mt-1">
                  Neto: {sym}{((precio * (cantidad || 1)) * (1 - descuento / 100)).toFixed(2)}
                </p>
              )}
            </div>
            <div>
              <label className={lbl}>Factor de venta <span className="text-slate-300 normal-case">(referencia, opcional)</span></label>
              <input type="number" min={0} step={0.01} className={ctrl} value={factor ?? ''}
                placeholder="Ej: 1.45"
                onChange={e => setFactor(e.target.value === '' ? null : Number(e.target.value))}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void finish(); } if (e.key === 'Escape') onClose(); }} />
              <p className="text-[10px] font-mono text-slate-400 mt-1">Multiplicador sobre el FOB. No se muestra en el presupuesto.</p>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mt-4">
          <button onClick={onClose} className="text-[11px] text-slate-400 hover:text-slate-600">Cancelar (Esc)</button>
          {step === 'cantidad' && <Button size="sm" onClick={() => setStep('precio')}>Siguiente (Enter ↵)</Button>}
          {step === 'precio' && <Button size="sm" onClick={() => void finish()}>Agregar (Enter ↵)</Button>}
        </div>
      </div>
    </div>,
    document.body,
  );
};
