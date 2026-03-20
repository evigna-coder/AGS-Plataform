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
      <div className="bg-indigo-50 p-2 rounded-lg text-[11px] mt-1">
        <p className="font-semibold text-slate-700 mb-0.5">"{categoria.nombre}":</p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-slate-600">
          <span>Sub: {fmtMoney(itemSubtotal)}</span>
          {iva > 0 && <span>IVA {categoria.ivaReduccion && categoria.porcentajeIvaReduccion ? categoria.porcentajeIvaReduccion : categoria.porcentajeIva}%: {fmtMoney(iva)}</span>}
          {ganancias > 0 && <span>Gan {categoria.porcentajeGanancias}%: {fmtMoney(ganancias)}</span>}
          {iibb > 0 && <span>IIBB {categoria.porcentajeIIBB}%: {fmtMoney(iibb)}</span>}
          <span className="font-semibold text-indigo-700">Total: {fmtMoney(total)}</span>
        </div>
      </div>
    );
  };

  const conceptoOptions = conceptosServicio.filter(c => c.activo).map(c => ({
    value: c.id,
    label: `${c.descripcion} — ${MONEDA_SIMBOLO[c.moneda]} ${(c.valorBase * c.factorActualizacion).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
  }));

  const categoriaOptions = [
    { value: '', label: 'Sin categoria' },
    ...categoriasPresupuesto.filter(c => c.activo).map(c => ({ value: c.id, label: c.nombre })),
  ];

  const lbl = "text-[11px] font-medium text-slate-400 mb-0.5 block";

  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-700 mb-2">Items del presupuesto</h3>

      {/* Items table */}
      {items.length > 0 && (
        <div className="border border-slate-200 rounded-lg overflow-hidden mb-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-[11px] font-medium text-slate-400 tracking-wider py-1.5 px-3 text-left">Descripcion</th>
                <th className="text-[11px] font-medium text-slate-400 tracking-wider py-1.5 px-2 text-left w-24">Producto</th>
                <th className="text-[11px] font-medium text-slate-400 tracking-wider py-1.5 px-2 text-center w-12">Cant.</th>
                <th className="text-[11px] font-medium text-slate-400 tracking-wider py-1.5 px-2 text-right w-20">P. Unit.</th>
                <th className="text-[11px] font-medium text-slate-400 tracking-wider py-1.5 px-2 text-right w-20">Subtotal</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map(item => (
                <tr key={item.id}>
                  <td className="px-3 py-1.5 text-xs text-slate-700 truncate max-w-[200px]">{item.descripcion}</td>
                  <td className="px-2 py-1.5 text-xs text-slate-500">{item.codigoProducto || '—'}</td>
                  <td className="px-2 py-1.5 text-xs text-center">{item.cantidad} {item.unidad !== 'unidad' ? item.unidad : ''}</td>
                  <td className="px-2 py-1.5 text-xs text-right">{fmtMoney(item.precioUnitario)}</td>
                  <td className="px-2 py-1.5 text-xs text-right font-semibold text-slate-700">{fmtMoney(item.subtotal)}</td>
                  <td className="text-center">
                    <button onClick={() => onRemove(item.id)} className="text-red-400 hover:text-red-600 font-medium">&times;</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t border-slate-200">
              <tr>
                <td colSpan={4} className="px-3 py-1.5 text-right text-[11px] font-medium text-slate-400">Total</td>
                <td className="px-2 py-1.5 text-right text-xs font-semibold text-indigo-700">{fmtMoney(totalItems)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Inline add item form */}
      <div className="border border-dashed border-slate-300 rounded-lg p-3 bg-slate-50/50 space-y-2">
        <p className="text-[11px] font-semibold text-slate-500 tracking-wider uppercase">Nuevo item</p>

        {/* Concepto picker */}
        {conceptoOptions.length > 0 && (
          <div>
            <label className={lbl}>Seleccionar del catalogo</label>
            <SearchableSelect value="" onChange={handleSelectConcepto} options={[{ value: '', label: 'Carga manual...' }, ...conceptoOptions]} placeholder="Buscar concepto..." />
          </div>
        )}

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <div>
            <label className={lbl}>Descripcion *</label>
            <input value={newItem.descripcion || ''} onChange={e => setNewItem({ ...newItem, descripcion: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white" placeholder="Descripcion del item..." />
          </div>
          <div>
            <label className={lbl}>Cod. producto</label>
            <input value={newItem.codigoProducto || ''} onChange={e => setNewItem({ ...newItem, codigoProducto: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white w-32" placeholder="G1312-60067" />
          </div>
        </div>

        <div className="grid grid-cols-5 gap-2">
          <div>
            <label className={lbl}>Cantidad *</label>
            <input type="number" min="0" step="0.01" value={newItem.cantidad || ''} onChange={e => setNewItem({ ...newItem, cantidad: Number(e.target.value) || 0 })}
              className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white" />
          </div>
          <div>
            <label className={lbl}>Unidad</label>
            <input value={newItem.unidad || 'unidad'} onChange={e => setNewItem({ ...newItem, unidad: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white" />
          </div>
          <div>
            <label className={lbl}>Precio unit. *</label>
            <input type="number" min="0" step="0.01" value={newItem.precioUnitario || ''} onChange={e => setNewItem({ ...newItem, precioUnitario: Number(e.target.value) || 0 })}
              className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white" />
          </div>
          <div>
            <label className={lbl}>Dto %</label>
            <input type="number" min="0" max="100" step="0.5" value={newItem.descuento || ''} onChange={e => setNewItem({ ...newItem, descuento: Number(e.target.value) || 0 })}
              className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white" placeholder="0" />
          </div>
          <div className="flex items-end">
            <Button size="sm" onClick={handleAdd} className="w-full">+ Agregar</Button>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <div className="flex-1">
            <label className={lbl}>Categoria (reglas tributarias)</label>
            <SearchableSelect value={newItem.categoriaPresupuestoId || ''} onChange={v => setNewItem({ ...newItem, categoriaPresupuestoId: v || undefined })}
              options={categoriaOptions} placeholder="Seleccionar categoria..." />
            <Link to="/presupuestos/categorias" className="text-[11px] text-indigo-600 hover:underline mt-0.5 inline-block">Gestionar categorias →</Link>
          </div>
          {itemSubtotal > 0 && !newItem.categoriaPresupuestoId && (
            <div className="flex-1 bg-white p-2 rounded-lg border border-slate-200 mt-4">
              <p className="text-xs font-semibold text-slate-700">Subtotal: {fmtMoney(itemSubtotal)}</p>
              <p className="text-[11px] text-slate-400">Seleccione categoria para ver impuestos</p>
            </div>
          )}
        </div>

        {taxPreview()}
      </div>
    </div>
  );
};
