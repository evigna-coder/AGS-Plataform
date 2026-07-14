import { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { PresupuestoItem, CategoriaPresupuesto, ConceptoServicio, MonedaPresupuesto } from '@ags/shared';
import { MONEDA_SIMBOLO } from '@ags/shared';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';
import { articulosService } from '../../services/firebaseService';
import { findCategoriaIvaDefaultId } from '../../utils/categoriaIva';
import { PresupuestoAddItemWizard } from './PresupuestoAddItemWizard';

interface ArticuloCatalog { id: string; codigo: string; descripcion: string }

// ─── Main component ─────────────────────────────────────────────────────────

interface Props {
  items: PresupuestoItem[];
  onAdd: (item: PresupuestoItem) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: keyof PresupuestoItem, value: any) => void;
  categoriasPresupuesto: CategoriaPresupuesto[];
  conceptosServicio: ConceptoServicio[];
  moneda: MonedaPresupuesto;
}

const MONEDA_OPTIONS: { value: 'USD' | 'ARS' | 'EUR'; label: string }[] = [
  { value: 'USD', label: 'USD' },
  { value: 'ARS', label: 'ARS' },
  { value: 'EUR', label: 'EUR' },
];

const EMPTY_ITEM: Partial<PresupuestoItem> = {
  descripcion: '', cantidad: 1, unidad: 'unidad', precioUnitario: 0,
  categoriaPresupuestoId: undefined, codigoProducto: null, conceptoServicioId: null,
  servicioCode: null, moneda: null, stockArticuloId: null, factor: null,
};

export const CreatePresupuestoItems = ({ items, onAdd, onRemove, onUpdate, categoriasPresupuesto, conceptosServicio, moneda }: Props) => {
  const [newItem, setNewItem] = useState<Partial<PresupuestoItem>>({ ...EMPTY_ITEM, categoriaPresupuestoId: findCategoriaIvaDefaultId(categoriasPresupuesto), moneda: moneda === 'MIXTA' ? 'USD' : null });
  const [articulosCatalog, setArticulosCatalog] = useState<ArticuloCatalog[]>([]);
  const [showWizard, setShowWizard] = useState(false);
  const cantidadRef = useRef<HTMLInputElement>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  // Las categorías cargan async: el default del useState inicial corre con [] y queda sin
  // categoría. Aplicamos el default IVA 21% una vez que el catálogo está disponible (sin
  // pisar una elección posterior del usuario).
  const defaultCatApplied = useRef(false);
  useEffect(() => {
    if (defaultCatApplied.current || categoriasPresupuesto.length === 0) return;
    defaultCatApplied.current = true;
    const def = findCategoriaIvaDefaultId(categoriasPresupuesto);
    if (def) setNewItem(prev => (prev.categoriaPresupuestoId ? prev : { ...prev, categoriaPresupuestoId: def }));
  }, [categoriasPresupuesto]);
  const isMixta = moneda === 'MIXTA';
  const symFor = (m: string) => MONEDA_SIMBOLO[m] || '$';
  const sym = isMixta ? '' : (MONEDA_SIMBOLO[moneda] || '$');
  const fmtMoney = (n: number, m?: string | null) => `${m ? symFor(m) : sym} ${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

  // Per-currency totals for MIXTA mode
  const totalsByCurrency = useMemo(() => {
    if (!isMixta) return null;
    const map: Record<string, number> = {};
    items.forEach(i => {
      const m = i.moneda || 'USD';
      map[m] = (map[m] || 0) + (i.subtotal || 0);
    });
    return map;
  }, [items, isMixta]);

  const totalItems = items.reduce((s, i) => s + (i.subtotal || 0), 0);

  // Load articles catalog once
  useEffect(() => {
    articulosService.getAll({ activoOnly: true }).then(arts => {
      setArticulosCatalog(arts.map(a => ({ id: a.id, codigo: a.codigo, descripcion: a.descripcion })));
    }).catch(() => setArticulosCatalog([]));
  }, []);

  const itemBase = (newItem.cantidad || 0) * (newItem.precioUnitario || 0);
  const itemSubtotal = newItem.descuento ? itemBase * (1 - newItem.descuento / 100) : itemBase;

  const handleAdd = () => {
    if (!newItem.descripcion || !newItem.cantidad || !newItem.precioUnitario) {
      alert('Complete descripcion, cantidad y precio unitario');
      return;
    }
    const base = (newItem.cantidad || 0) * (newItem.precioUnitario || 0);
    const subtotal = newItem.descuento ? base * (1 - newItem.descuento / 100) : base;
    onAdd({
      id: `item-${Date.now()}`,
      descripcion: newItem.descripcion,
      cantidad: newItem.cantidad || 1,
      unidad: newItem.unidad || 'unidad',
      precioUnitario: newItem.precioUnitario || 0,
      descuento: newItem.descuento || 0,
      categoriaPresupuestoId: newItem.categoriaPresupuestoId,
      factor: newItem.factor ?? null,
      codigoProducto: newItem.codigoProducto || null,
      conceptoServicioId: newItem.conceptoServicioId || null,
      servicioCode: newItem.servicioCode || null,
      stockArticuloId: newItem.stockArticuloId || null,
      subtotal,
      ...(isMixta ? { moneda: newItem.moneda || 'USD' } : {}),
    });
    setNewItem({ ...EMPTY_ITEM, categoriaPresupuestoId: findCategoriaIvaDefaultId(categoriasPresupuesto), moneda: isMixta ? (newItem.moneda || 'USD') : null });
    // Volver el foco al buscador (abierto y listo para tipear) — cargar N ítems seguidos
    // sin tocar el mouse. El click programático abre el dropdown, que auto-enfoca su input.
    requestAnimationFrame(() => {
      searchWrapRef.current?.querySelector<HTMLElement>('[role="combobox"]')?.click();
    });
  };

  const addFromWizard = (p: Partial<PresupuestoItem>) => {
    const cantidad = p.cantidad || 1;
    const precioUnitario = p.precioUnitario || 0;
    const descuento = p.descuento || 0;
    const base = cantidad * precioUnitario;
    onAdd({
      id: `item-${Date.now()}`,
      descripcion: p.descripcion || '',
      cantidad,
      unidad: p.unidad || 'unidad',
      precioUnitario,
      descuento,
      categoriaPresupuestoId: p.categoriaPresupuestoId,
      factor: p.factor ?? null,
      codigoProducto: p.codigoProducto ?? null,
      conceptoServicioId: p.conceptoServicioId ?? null,
      servicioCode: null,
      stockArticuloId: p.stockArticuloId ?? null,
      subtotal: descuento ? base * (1 - descuento / 100) : base,
      ...(isMixta ? { moneda: 'USD' } : {}),
    });
  };

  const handleSelectArticulo = (art: ArticuloCatalog) => {
    setNewItem(prev => ({
      ...prev,
      stockArticuloId: art.id,
      // Buscador unificado: elegir artículo desvincula un servicio previo.
      conceptoServicioId: null,
      servicioCode: null,
      codigoProducto: art.codigo,
      descripcion: art.descripcion,
    }));
  };

  const handleSelectConcepto = (conceptoId: string) => {
    const concepto = conceptosServicio.find(c => c.id === conceptoId);
    if (!concepto) return;
    const precio = concepto.valorBase * concepto.factorActualizacion;
    setNewItem(prev => ({
      ...prev,
      descripcion: concepto.descripcion,
      precioUnitario: precio,
      categoriaPresupuestoId: concepto.categoriaPresupuestoId || prev.categoriaPresupuestoId,
      conceptoServicioId: concepto.id,
      servicioCode: concepto.codigo || null,
      codigoProducto: concepto.codigo || prev.codigoProducto || null,
      // Buscador unificado: elegir servicio desvincula un artículo previo.
      stockArticuloId: null,
    }));
  };

  // Buscador UNIFICADO: servicios + artículos en un mismo campo. Los valores se
  // prefijan `srv:`/`art:` para enrutar al handler correcto. Al elegir, mover el foco
  // a Cantidad (rAF: corre antes del re-focus interno del SearchableSelect, que respeta
  // el input ya enfocado).
  const focusCantidad = () => requestAnimationFrame(() => cantidadRef.current?.focus());
  const handleUnifiedSelect = (v: string) => {
    if (!v) { setNewItem(prev => ({ ...prev, conceptoServicioId: null, servicioCode: null, stockArticuloId: null })); return; }
    if (v.startsWith('srv:')) { handleSelectConcepto(v.slice(4)); focusCantidad(); return; }
    if (v.startsWith('art:')) {
      const art = articulosCatalog.find(a => a.id === v.slice(4));
      if (art) { handleSelectArticulo(art); focusCantidad(); }
    }
  };

  // Enter en cualquier campo de la fila de carga → agregar el ítem.
  const onEnterAdd = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }
  };

  const categoria = categoriasPresupuesto.find(c => c.id === newItem.categoriaPresupuestoId);

  const taxPreview = () => {
    if (!categoria || !itemSubtotal) return null;
    let iva = 0, ganancias = 0, iibb = 0;
    if (categoria.incluyeIva && categoria.porcentajeIva) {
      iva = categoria.ivaReduccion && categoria.porcentajeIvaReduccion
        ? itemSubtotal * (categoria.porcentajeIvaReduccion / 100)
        : itemSubtotal * (categoria.porcentajeIva / 100);
    }
    if (categoria.incluyeGanancias && categoria.porcentajeGanancias) ganancias = (itemSubtotal + iva) * (categoria.porcentajeGanancias / 100);
    if (categoria.incluyeIIBB && categoria.porcentajeIIBB) iibb = (itemSubtotal + iva) * (categoria.porcentajeIIBB / 100);
    const total = itemSubtotal + iva + ganancias + iibb;
    return (
      <div className="bg-teal-50 p-2 rounded-lg text-[11px]">
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-slate-600">
          <span className="font-semibold text-slate-700">"{categoria.nombre}"</span>
          <span>Sub: {fmtMoney(itemSubtotal)}</span>
          {iva > 0 && <span>IVA {categoria.ivaReduccion && categoria.porcentajeIvaReduccion ? categoria.porcentajeIvaReduccion : categoria.porcentajeIva}%: {fmtMoney(iva)}</span>}
          {ganancias > 0 && <span>Gan {categoria.porcentajeGanancias}%: {fmtMoney(ganancias)}</span>}
          {iibb > 0 && <span>IIBB {categoria.porcentajeIIBB}%: {fmtMoney(iibb)}</span>}
          <span className="font-semibold text-teal-700">Total: {fmtMoney(total)}</span>
        </div>
      </div>
    );
  };

  const searchOptions = [
    { value: '', label: 'Carga manual...' },
    ...conceptosServicio.filter(c => c.activo).map(c => ({
      value: `srv:${c.id}`,
      label: `Servicio · ${c.codigo ? c.codigo + ' — ' : ''}${c.descripcion} — ${MONEDA_SIMBOLO[c.moneda]} ${(c.valorBase * c.factorActualizacion).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
      linkedCode: c.codigo || undefined,
    })),
    ...articulosCatalog.map(a => ({
      value: `art:${a.id}`,
      label: `Artículo · [${a.codigo || '—'}] ${a.descripcion}`,
      linkedCode: a.codigo || undefined,
    })),
  ];
  const searchValue = newItem.stockArticuloId ? `art:${newItem.stockArticuloId}` : (newItem.conceptoServicioId ? `srv:${newItem.conceptoServicioId}` : '');
  // Hay un servicio/artículo elegido del buscador → código y descripción vienen dados.
  const haySeleccion = !!newItem.stockArticuloId || !!newItem.conceptoServicioId;

  const categoriaOptions = [
    { value: '', label: 'Sin categoria' },
    ...categoriasPresupuesto.filter(c => c.activo).map(c => ({ value: c.id, label: c.nombre })),
  ];

  const lbl = "text-[10px] font-mono font-medium text-slate-500 mb-0.5 block uppercase tracking-wide";

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wide">Agregar items</span>
        <Button size="sm" variant="outline" onClick={() => setShowWizard(true)}>⚡ Carga rapida</Button>
      </div>
      {showWizard && (
        <PresupuestoAddItemWizard
          conceptosServicio={conceptosServicio}
          categoriasPresupuesto={categoriasPresupuesto}
          moneda={moneda}
          onAdd={addFromWizard}
          onClose={() => setShowWizard(false)}
        />
      )}

      {/* Row 1: Buscador UNIFICADO (servicios + artículos) */}
      {searchOptions.length > 1 && (
        <div ref={searchWrapRef}>
          <label className={lbl}>Buscar servicio o artículo</label>
          <SearchableSelect value={searchValue} onChange={handleUnifiedSelect} options={searchOptions}
            placeholder="Buscar por código o descripción (servicios y artículos)..." />
        </div>
      )}

      {/* Row 2: Código + Descripción en la misma línea */}
      <div className="grid grid-cols-[140px_1fr] gap-2.5">
        <div>
          <label className={lbl}>Código</label>
          {/* Con selección del buscador: bloqueado y gris (se completa solo; escribir acá
              confundía porque antes este campo ERA el buscador de artículos). En carga
              manual queda editable. */}
          <input value={newItem.codigoProducto || ''}
            onChange={e => setNewItem(prev => ({ ...prev, codigoProducto: e.target.value }))} onKeyDown={onEnterAdd}
            disabled={haySeleccion} tabIndex={-1}
            className={`w-full border border-[#E5E5E5] rounded-md px-2.5 py-1.5 text-xs ${haySeleccion ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'}`}
            placeholder="Usá el buscador de arriba ↑" />
        </div>
        <div>
          <label className={lbl}>Descripcion *</label>
          <input value={newItem.descripcion || ''} onChange={e => setNewItem({ ...newItem, descripcion: e.target.value })} onKeyDown={onEnterAdd}
            disabled={haySeleccion}
            className={`w-full border border-[#E5E5E5] rounded-md px-2.5 py-1.5 text-xs ${haySeleccion ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'}`}
            placeholder="Descripcion del item (o elegí arriba)..." />
        </div>
      </div>

      {/* Row 3: Cant, Unidad, Precio, Dto, [Moneda], Categoría, Agregar */}
      <div className={`grid ${isMixta ? 'grid-cols-[60px_75px_90px_50px_70px_70px_1fr_auto]' : 'grid-cols-[60px_75px_90px_50px_70px_1fr_auto]'} gap-2.5 items-end`}>
        <div>
          <label className={lbl}>Cant. *</label>
          <input ref={cantidadRef} type="number" min="0" step="0.01" value={newItem.cantidad || ''} onChange={e => setNewItem({ ...newItem, cantidad: Number(e.target.value) || 0 })} onKeyDown={onEnterAdd}
            className="w-full border border-[#E5E5E5] rounded-md px-2 py-1.5 text-xs bg-white text-center" />
        </div>
        <div>
          <label className={lbl}>Unidad</label>
          {/* tabIndex -1: casi nunca se toca — Tab salta de Cantidad directo a Precio.
              Sigue editable con click si hace falta. */}
          <input value={newItem.unidad || 'unidad'} onChange={e => setNewItem({ ...newItem, unidad: e.target.value })} onKeyDown={onEnterAdd}
            tabIndex={-1}
            className="w-full border border-[#E5E5E5] rounded-md px-2 py-1.5 text-xs bg-white" />
        </div>
        <div>
          <label className={lbl}>Precio unit. *</label>
          <input type="number" min="0" step="0.01" value={newItem.precioUnitario || ''} onChange={e => setNewItem({ ...newItem, precioUnitario: Number(e.target.value) || 0 })} onKeyDown={onEnterAdd}
            className="w-full border border-[#E5E5E5] rounded-md px-2 py-1.5 text-xs bg-white" />
        </div>
        <div>
          <label className={lbl}>Dto %</label>
          <input type="number" min="0" max="100" step="0.5" value={newItem.descuento || ''} onChange={e => setNewItem({ ...newItem, descuento: Number(e.target.value) || 0 })} onKeyDown={onEnterAdd}
            className="w-full border border-[#E5E5E5] rounded-md px-2 py-1.5 text-xs bg-white text-center" placeholder="0" />
        </div>
        <div>
          <label className={lbl} title="Multiplicador sobre FOB — referencia interna, no se muestra en el PDF">Factor</label>
          <input type="number" min="0" step="0.01" value={newItem.factor ?? ''} onChange={e => setNewItem({ ...newItem, factor: e.target.value === '' ? null : Number(e.target.value) })} onKeyDown={onEnterAdd}
            className="w-full border border-[#E5E5E5] rounded-md px-2 py-1.5 text-xs bg-white text-center" placeholder="1.45" />
        </div>
        {isMixta && (
          <div>
            <label className={lbl}>Moneda</label>
            <select value={newItem.moneda || 'USD'} onChange={e => setNewItem({ ...newItem, moneda: e.target.value as 'USD' | 'ARS' | 'EUR' })}
              className="w-full border border-[#E5E5E5] rounded-md px-2 py-1.5 text-xs bg-white">
              {MONEDA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className={lbl}>Categoria <Link to="/presupuestos/categorias" className="text-teal-700 hover:underline">→</Link></label>
          <SearchableSelect value={newItem.categoriaPresupuestoId || ''} onChange={v => setNewItem({ ...newItem, categoriaPresupuestoId: v || undefined })}
            options={categoriaOptions} placeholder="Sin cat." />
        </div>
        <Button size="sm" onClick={handleAdd}>+ Agregar</Button>
      </div>

      {taxPreview()}

      {/* Items table */}
      {items.length > 0 && (
        <div className="border border-[#E5E5E5] rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#F0F0F0]">
                <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wider py-2 px-3 text-center w-24">Codigo</th>
                <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wider py-2 px-3 text-center">Descripcion</th>
                <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wider py-2 px-2 text-center w-14">Cant.</th>
                {isMixta && <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wider py-2 px-2 text-center w-14">Mon.</th>}
                <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wider py-2 px-2 text-center w-20">P.Unit.</th>
                <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wider py-2 px-2 text-center w-14">Dto %</th>
                <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wider py-2 px-2 text-center w-14" title="Factor de venta — referencia interna, no se muestra en el PDF">Factor</th>
                <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wider py-2 px-2 text-center w-20">Subtotal</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map(item => (
                <tr key={item.id}>
                  <td className="px-2 py-1 text-xs text-slate-500 font-mono">{item.servicioCode || item.codigoProducto || '—'}</td>
                  <td className="px-2 py-1">
                    <input value={item.descripcion}
                      onChange={e => onUpdate(item.id, 'descripcion', e.target.value)}
                      className="w-full outline-none bg-transparent text-xs text-slate-700" />
                  </td>
                  <td className="px-1 py-1">
                    <input type="number" min="0" step="0.01" value={item.cantidad}
                      onChange={e => onUpdate(item.id, 'cantidad', Number(e.target.value) || 0)}
                      className="w-full outline-none bg-transparent text-xs text-center" />
                  </td>
                  {isMixta && <td className="px-2 py-1 text-[10px] text-center font-mono text-slate-500">{item.moneda || 'USD'}</td>}
                  <td className="px-1 py-1">
                    <input type="number" min="0" step="0.01" value={item.precioUnitario}
                      onChange={e => onUpdate(item.id, 'precioUnitario', Number(e.target.value) || 0)}
                      className="w-full outline-none bg-transparent text-xs text-right font-mono" />
                  </td>
                  <td className="px-1 py-1">
                    <input type="number" min="0" max="100" step="0.5" value={item.descuento || 0}
                      onChange={e => onUpdate(item.id, 'descuento', Number(e.target.value) || 0)}
                      className="w-full outline-none bg-transparent text-xs text-center" />
                  </td>
                  <td className="px-1 py-1">
                    <input type="number" min="0" step="0.01" value={item.factor ?? ''} placeholder="—"
                      onChange={e => onUpdate(item.id, 'factor', e.target.value === '' ? null : Number(e.target.value))}
                      className="w-full outline-none bg-transparent text-xs text-center text-slate-500" />
                  </td>
                  <td className="px-2 py-1 text-xs text-center font-mono font-semibold text-teal-700">{fmtMoney(item.subtotal, isMixta ? item.moneda : null)}</td>
                  <td className="text-center">
                    <button onClick={() => onRemove(item.id)} className="text-red-400 hover:text-red-600 font-medium">&times;</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-[#F0F0F0] border-t border-[#E5E5E5]">
              {isMixta && totalsByCurrency ? (
                Object.entries(totalsByCurrency).map(([m, total]) => (
                  <tr key={m}>
                    <td colSpan={7} className="px-3 py-1 text-right text-[9px] font-mono font-semibold text-slate-500 uppercase">Total {m}</td>
                    <td className="px-2 py-1 text-center text-xs font-mono font-semibold text-teal-700">{fmtMoney(total, m)}</td>
                    <td></td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-3 py-1.5 text-center text-[9px] font-mono font-semibold text-slate-500 uppercase">Total</td>
                  <td className="px-2 py-1.5 text-center text-xs font-mono font-semibold text-teal-700">{fmtMoney(totalItems)}</td>
                  <td></td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};
