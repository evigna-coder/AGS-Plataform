import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Disponibilidad, PresupuestoItem, CategoriaPresupuesto, ConceptoServicio, Articulo } from '@ags/shared';
import { MONEDA_SIMBOLO } from '@ags/shared';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';
import { PresupuestoDisponibilidadFields } from './PresupuestoDisponibilidadFields';
import { PresupuestoTaxPreview } from './PresupuestoTaxPreview';
import { computeStockAmplio } from '../../services/stockAmplioService';
import { atpFromStockAmplio } from '../../services/atpHelpers';
import { articulosService } from '../../services/firebaseService';
import { findCategoriaIvaDefaultId } from '../../utils/categoriaIva';

interface Props {
  conceptosServicio: ConceptoServicio[];
  categoriasPresupuesto: CategoriaPresupuesto[];
  moneda?: string;
  /** Mismo contrato que el wizard: el parent completa defaults y agrega. */
  onAdd: (item: Partial<PresupuestoItem>) => void;
  /**
   * true = formulario EMBEBIDO siempre visible (pedido 2026-07-30: la carga
   * completa es el modo por defecto, sin botón). Al agregar, se limpia y queda
   * listo para el próximo item. false/omitido = modal (requiere onClose).
   */
  inline?: boolean;
  onClose?: () => void;
}

const ITEM_INICIAL: Partial<PresupuestoItem> = { cantidad: 1, unidad: 'unidad' };
const lbl = 'text-[11px] font-medium text-slate-400 mb-0.5 block';
const inp = 'w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs';

/**
 * "Carga completa" de un item: TODOS los campos visibles en un solo formulario
 * (código, descripción, cantidad, precio, dto, factor, categoría con preview de
 * impuestos y disponibilidad). Convive con la carga rápida (wizard).
 */
export function PresupuestoAddItemCompleto({ conceptosServicio, categoriasPresupuesto, moneda, onAdd, inline, onClose }: Props) {
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [item, setItem] = useState<Partial<PresupuestoItem>>(ITEM_INICIAL);
  const [seleccion, setSeleccion] = useState('');
  const [disponibilidadTouched, setDisponibilidadTouched] = useState(false);
  const [atpHint, setAtpHint] = useState<{ atp: number } | null>(null);
  const prevArticuloId = useRef<string | null | undefined>(undefined);

  useEffect(() => { articulosService.getAll().then(setArticulos).catch(() => {}); }, []);

  const reset = () => {
    setItem(ITEM_INICIAL);
    setSeleccion('');
    setDisponibilidadTouched(false);
    setAtpHint(null);
    prevArticuloId.current = undefined;
  };

  // Disponibilidad auto-default por ATP al vincular un artículo (mismo criterio que el wizard).
  useEffect(() => {
    const artId = item.stockArticuloId ?? null;
    if (artId === prevArticuloId.current) return;
    prevArticuloId.current = artId;
    if (disponibilidadTouched) return;
    if (!artId) { setAtpHint(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const stock = await computeStockAmplio(artId);
        if (cancelled) return;
        const atp = atpFromStockAmplio(stock);
        setAtpHint({ atp });
        setItem(prev => ({ ...prev, disponibilidad: atp > 0 ? 'stock' : 'a_importar', etaDiasEstimados: atp > 0 ? 0 : 30 }));
      } catch {
        if (!cancelled) { setAtpHint(null); setItem(prev => ({ ...prev, disponibilidad: 'a_importar', etaDiasEstimados: 30 })); }
      }
    })();
    return () => { cancelled = true; };
  }, [item.stockArticuloId, disponibilidadTouched]);

  // Buscador unificado servicios + artículos (prefill; los campos quedan editables abajo).
  const searchOptions = useMemo(() => [
    { value: '', label: '— Sin vincular (carga manual) —' },
    ...conceptosServicio.filter(c => c.activo).map(c => ({
      value: `con:${c.id}`, label: `🛠 ${c.codigo ? `${c.codigo} — ` : ''}${c.descripcion}`,
    })),
    ...articulos.map(a => ({
      value: `art:${a.id}`, label: `📦 ${a.codigo} — ${a.descripcion}`, linkedCode: a.codigo ?? undefined,
    })),
  ], [conceptosServicio, articulos]);

  const applySeleccion = (v: string) => {
    setSeleccion(v);
    if (v.startsWith('con:')) {
      const c = conceptosServicio.find(x => x.id === v.slice(4));
      if (!c) return;
      setItem(prev => ({ ...prev,
        descripcion: c.descripcion, precioUnitario: c.valorBase * c.factorActualizacion,
        codigoProducto: c.codigo || prev.codigoProducto || null,
        categoriaPresupuestoId: c.categoriaPresupuestoId || prev.categoriaPresupuestoId || findCategoriaIvaDefaultId(categoriasPresupuesto),
        conceptoServicioId: c.id, stockArticuloId: null, itemRequiereImportacion: false,
      }));
    } else if (v.startsWith('art:')) {
      const a = articulos.find(x => x.id === v.slice(4));
      if (!a) return;
      setItem(prev => ({ ...prev,
        stockArticuloId: a.id, conceptoServicioId: null,
        codigoProducto: a.codigo || prev.codigoProducto || null,
        descripcion: prev.descripcion || a.descripcion,
        precioUnitario: prev.precioUnitario || a.precioReferencia || 0,
        categoriaPresupuestoId: prev.categoriaPresupuestoId || findCategoriaIvaDefaultId(categoriasPresupuesto),
      }));
    } else {
      setItem(prev => ({ ...prev, conceptoServicioId: null, stockArticuloId: null, itemRequiereImportacion: false }));
    }
  };

  const base = (item.cantidad || 0) * (item.precioUnitario || 0);
  const subtotal = item.descuento ? base * (1 - item.descuento / 100) : base;
  const categoria = categoriasPresupuesto.find(c => c.id === item.categoriaPresupuestoId);
  const sym = MONEDA_SIMBOLO[(moneda as keyof typeof MONEDA_SIMBOLO) || 'USD'] || '$';
  const puedeAgregar = !!item.descripcion?.trim() && (item.cantidad || 0) > 0;

  const handleAgregar = () => {
    if (!puedeAgregar) return;
    onAdd(item);
    if (inline) reset();
    else onClose?.();
  };

  const campos = (
    <div className="space-y-3">
      <div>
        <label className={lbl}>Vincular servicio o artículo (opcional, precarga los campos)</label>
        <SearchableSelect value={seleccion} onChange={applySeleccion} options={searchOptions}
          placeholder="Buscar servicio o artículo…" />
      </div>
      <div className={inline ? 'grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3' : 'space-y-3'}>
        <div>
          <label className={lbl}>Código artículo</label>
          <input value={item.codigoProducto || ''} onChange={e => setItem(prev => ({ ...prev, codigoProducto: e.target.value }))}
            className={inp} placeholder="Ej: G1312-60067" />
        </div>
        <div>
          <label className={lbl}>Descripcion *</label>
          <textarea value={item.descripcion || ''} onChange={e => setItem(prev => ({ ...prev, descripcion: e.target.value }))}
            rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs" placeholder="Descripcion del item..." />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className={lbl}>Cantidad *</label>
          <input type="number" min="0" step="0.01" value={item.cantidad || ''} onFocus={e => e.currentTarget.select()}
            onChange={e => setItem(prev => ({ ...prev, cantidad: Number(e.target.value) || 0 }))} className={inp} />
        </div>
        <div>
          <label className={lbl}>Unidad</label>
          <input value={item.unidad || 'unidad'} onChange={e => setItem(prev => ({ ...prev, unidad: e.target.value }))} className={inp} />
        </div>
        <div>
          <label className={lbl}>Precio unit. *</label>
          <input type="number" min="0" step="0.01" value={item.precioUnitario || ''} onFocus={e => e.currentTarget.select()}
            onChange={e => setItem(prev => ({ ...prev, precioUnitario: Number(e.target.value) || 0 }))} className={inp} />
        </div>
        <div>
          <label className={lbl}>Dto %</label>
          <input type="number" min="0" max="100" step="0.5" value={item.descuento || ''} onFocus={e => e.currentTarget.select()}
            onChange={e => setItem(prev => ({ ...prev, descuento: Number(e.target.value) || 0 }))} className={inp} placeholder="0" />
        </div>
      </div>
      <div className={inline ? 'grid grid-cols-1 md:grid-cols-2 gap-3' : 'space-y-3'}>
        <div>
          <label className={lbl}>Factor de venta <span className="text-slate-300">(referencia interna, no va al PDF)</span></label>
          <input type="number" min="0" step="0.01" value={item.factor ?? ''}
            onChange={e => setItem(prev => ({ ...prev, factor: e.target.value === '' ? null : Number(e.target.value) }))}
            className={inp} placeholder="Ej: 1.45 (multiplicador sobre FOB)" />
        </div>
        <div>
          <label className={lbl}>Categoria (reglas tributarias)</label>
          <SearchableSelect value={item.categoriaPresupuestoId || ''} onChange={v => setItem(prev => ({ ...prev, categoriaPresupuestoId: v || undefined }))}
            options={[{ value: '', label: 'Sin categoria' }, ...categoriasPresupuesto.filter(c => c.activo).map(c => ({ value: c.id, label: c.nombre }))]}
            placeholder="Seleccionar categoria..." />
        </div>
      </div>
      {categoria && <PresupuestoTaxPreview categoria={categoria} subtotal={subtotal} sym={sym} />}
      {!categoria && subtotal > 0 && (
        <div className="bg-slate-50 p-3 rounded-lg">
          <p className="text-xs font-semibold text-slate-700">Subtotal: {sym} {subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Seleccione una categoria para ver impuestos</p>
        </div>
      )}
      <div className="border-t border-slate-200 pt-3">
        <PresupuestoDisponibilidadFields
          disponibilidad={(item.disponibilidad as Disponibilidad | null | undefined) ?? null}
          etaDiasEstimados={item.etaDiasEstimados ?? null}
          onChange={next => {
            setItem(prev => ({ ...prev, disponibilidad: next.disponibilidad, etaDiasEstimados: next.etaDiasEstimados }));
            setDisponibilidadTouched(true);
          }}
          variant={inline ? 'row' : 'modal'}
          atpHint={atpHint}
        />
      </div>
    </div>
  );

  if (inline) {
    return (
      <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/60">
        <p className="text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-wide mb-2">Agregar item</p>
        {campos}
        <div className="flex justify-end gap-2 mt-3">
          <Button variant="outline" size="sm" onClick={reset}>Limpiar</Button>
          <Button size="sm" onClick={handleAgregar} disabled={!puedeAgregar}>Agregar</Button>
        </div>
      </div>
    );
  }

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <Card compact className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-sm font-semibold text-slate-900 tracking-tight mb-3">Agregar item — carga completa</h3>
        {campos}
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleAgregar} disabled={!puedeAgregar}>Agregar</Button>
        </div>
      </Card>
    </div>,
    document.body,
  );
}
