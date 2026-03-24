import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { PresupuestoItem, CategoriaPresupuesto, ConceptoServicio, MonedaPresupuesto } from '@ags/shared';
import { MONEDA_SIMBOLO } from '@ags/shared';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';

interface Props {
  items: PresupuestoItem[];
  onAdd: (item: PresupuestoItem) => void;
  onRemove: (id: string) => void;
  categoriasPresupuesto: CategoriaPresupuesto[];
  conceptosServicio: ConceptoServicio[];
  moneda: MonedaPresupuesto;
}

const EMPTY_ITEM: Partial<PresupuestoItem> = {
  descripcion: '', cantidad: 1, unidad: 'unidad', precioUnitario: 0,
  categoriaPresupuestoId: undefined, codigoProducto: null, conceptoServicioId: null,
  servicioCode: null,
};

export const CreatePresupuestoItems = ({ items, onAdd, onRemove, categoriasPresupuesto, conceptosServicio, moneda }: Props) => {
  const [newItem, setNewItem] = useState<Partial<PresupuestoItem>>({ ...EMPTY_ITEM });
  const sym = MONEDA_SIMBOLO[moneda] || '$';
  const fmtMoney = (n: number) => `${sym} ${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  const totalItems = items.reduce((s, i) => s + (i.subtotal || 0), 0);

  const itemBase = (newItem.cantidad || 0) * (newItem.precioUnitario || 0);
  const itemSubtotal = newItem.descuento ? itemBase * (1 - newItem.descuento / 100) : itemBase;

  const handleAdd = () => {
    if (!newItem.descripcion || !newItem.cantidad || !newItem.precioUnitario) {
      alert('Complete descripcion, cantidad y precio unitario');
      return;
    }
    const subtotal = (newItem.cantidad || 0) * (newItem.precioUnitario || 0);
    onAdd({
      id: `item-${Date.now()}`,
      descripcion: newItem.descripcion,
      cantidad: newItem.cantidad || 1,
      unidad: newItem.unidad || 'unidad',
      precioUnitario: newItem.precioUnitario || 0,
      categoriaPresupuestoId: newItem.categoriaPresupuestoId,
      codigoProducto: newItem.codigoProducto || null,
      conceptoServicioId: newItem.conceptoServicioId || null,
      servicioCode: newItem.servicioCode || null,
      subtotal,
    });
    setNewItem({ ...EMPTY_ITEM });
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
    }));
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

  const conceptoOptions = conceptosServicio.filter(c => c.activo).map(c => ({
    value: c.id,
    label: `${c.codigo ? c.codigo + ' — ' : ''}${c.descripcion} — ${MONEDA_SIMBOLO[c.moneda]} ${(c.valorBase * c.factorActualizacion).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
  }));

  const categoriaOptions = [
    { value: '', label: 'Sin categoria' },
    ...categoriasPresupuesto.filter(c => c.activo).map(c => ({ value: c.id, label: c.nombre })),
  ];

  const lbl = "text-[10px] font-mono font-medium text-slate-500 mb-0.5 block uppercase tracking-wide";

  return (
    <div className="space-y-2.5">
      {/* Row 1: Catálogo selector */}
      {conceptoOptions.length > 0 && (
        <div>
          <label className={lbl}>Catalogo de servicios</label>
          <SearchableSelect value="" onChange={handleSelectConcepto} options={[{ value: '', label: 'Carga manual...' }, ...conceptoOptions]} placeholder="Buscar concepto..." />
        </div>
      )}

      {/* Row 2: Código + Descripción en la misma línea */}
      <div className="grid grid-cols-[110px_1fr] gap-2.5">
        <div>
          <label className={lbl}>Código</label>
          <input value={newItem.codigoProducto || ''} onChange={e => setNewItem({ ...newItem, codigoProducto: e.target.value })}
            className="w-full border border-[#E5E5E5] rounded-md px-2.5 py-1.5 text-xs bg-white" placeholder="MPCC01" />
        </div>
        <div>
          <label className={lbl}>Descripcion *</label>
          <input value={newItem.descripcion || ''} onChange={e => setNewItem({ ...newItem, descripcion: e.target.value })}
            className="w-full border border-[#E5E5E5] rounded-md px-2.5 py-1.5 text-xs bg-white" placeholder="Descripcion del item..." />
        </div>
      </div>

      {/* Row 3: Cant, Unidad, Precio, Dto, Categoría, Agregar */}
      <div className="grid grid-cols-[60px_75px_90px_50px_1fr_auto] gap-2.5 items-end">
        <div>
          <label className={lbl}>Cant. *</label>
          <input type="number" min="0" step="0.01" value={newItem.cantidad || ''} onChange={e => setNewItem({ ...newItem, cantidad: Number(e.target.value) || 0 })}
            className="w-full border border-[#E5E5E5] rounded-md px-2 py-1.5 text-xs bg-white text-center" />
        </div>
        <div>
          <label className={lbl}>Unidad</label>
          <input value={newItem.unidad || 'unidad'} onChange={e => setNewItem({ ...newItem, unidad: e.target.value })}
            className="w-full border border-[#E5E5E5] rounded-md px-2 py-1.5 text-xs bg-white" />
        </div>
        <div>
          <label className={lbl}>Precio unit. *</label>
          <input type="number" min="0" step="0.01" value={newItem.precioUnitario || ''} onChange={e => setNewItem({ ...newItem, precioUnitario: Number(e.target.value) || 0 })}
            className="w-full border border-[#E5E5E5] rounded-md px-2 py-1.5 text-xs bg-white" />
        </div>
        <div>
          <label className={lbl}>Dto %</label>
          <input type="number" min="0" max="100" step="0.5" value={newItem.descuento || ''} onChange={e => setNewItem({ ...newItem, descuento: Number(e.target.value) || 0 })}
            className="w-full border border-[#E5E5E5] rounded-md px-2 py-1.5 text-xs bg-white text-center" placeholder="0" />
        </div>
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
                <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wider py-2 px-3 text-left w-24">Codigo</th>
                <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wider py-2 px-3 text-left">Descripcion</th>
                <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wider py-2 px-2 text-center w-12">Cant.</th>
                <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wider py-2 px-2 text-right w-20">P.Unit.</th>
                <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wider py-2 px-2 text-right w-20">Subtotal</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map(item => (
                <tr key={item.id}>
                  <td className="px-2 py-1.5 text-xs text-slate-500 font-mono">{item.servicioCode || item.codigoProducto || '—'}</td>
                  <td className="px-3 py-1.5 text-xs text-slate-700 truncate max-w-[300px]">{item.descripcion}</td>
                  <td className="px-2 py-1.5 text-xs text-center">{item.cantidad} {item.unidad !== 'unidad' ? item.unidad : ''}</td>
                  <td className="px-2 py-1.5 text-xs text-right font-mono">{fmtMoney(item.precioUnitario)}</td>
                  <td className="px-2 py-1.5 text-xs text-right font-mono font-semibold text-teal-700">{fmtMoney(item.subtotal)}</td>
                  <td className="text-center">
                    <button onClick={() => onRemove(item.id)} className="text-red-400 hover:text-red-600 font-medium">&times;</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-[#F0F0F0] border-t border-[#E5E5E5]">
              <tr>
                <td colSpan={4} className="px-3 py-1.5 text-right text-[9px] font-mono font-semibold text-slate-500 uppercase">Total</td>
                <td className="px-2 py-1.5 text-right text-xs font-mono font-semibold text-teal-700">{fmtMoney(totalItems)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};
