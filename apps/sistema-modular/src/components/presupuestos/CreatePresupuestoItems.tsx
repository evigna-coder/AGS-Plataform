import { useState } from 'react';
import type { PresupuestoItem, CategoriaPresupuesto, ConceptoServicio, MonedaPresupuesto } from '@ags/shared';
import { MONEDA_SIMBOLO } from '@ags/shared';
import { Button } from '../ui/Button';
import { AddItemModal } from './AddItemModal';

interface Props {
  items: PresupuestoItem[];
  onAdd: (item: PresupuestoItem) => void;
  onRemove: (id: string) => void;
  categoriasPresupuesto: CategoriaPresupuesto[];
  conceptosServicio: ConceptoServicio[];
  moneda: MonedaPresupuesto;
}

export const CreatePresupuestoItems = ({ items, onAdd, onRemove, categoriasPresupuesto, conceptosServicio, moneda }: Props) => {
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState<Partial<PresupuestoItem>>({
    descripcion: '', cantidad: 1, unidad: 'unidad', precioUnitario: 0,
    categoriaPresupuestoId: undefined, codigoProducto: null, conceptoServicioId: null,
  });
  const sym = MONEDA_SIMBOLO[moneda] || '$';
  const fmtMoney = (n: number) => `${sym} ${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  const totalItems = items.reduce((s, i) => s + (i.subtotal || 0), 0);

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
    setShowAdd(false);
    setNewItem({ descripcion: '', cantidad: 1, unidad: 'unidad', precioUnitario: 0,
      categoriaPresupuestoId: undefined, codigoProducto: null, conceptoServicioId: null });
  };

  const openAdd = () => {
    setNewItem({ descripcion: '', cantidad: 1, unidad: 'unidad', precioUnitario: 0,
      categoriaPresupuestoId: undefined, codigoProducto: null, conceptoServicioId: null });
    setShowAdd(true);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-xs font-semibold text-slate-700">Items del presupuesto</h3>
        <Button size="sm" variant="outline" onClick={openAdd}>+ Agregar item</Button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-4 bg-slate-50 rounded-lg border border-dashed border-slate-200">
          <p className="text-xs text-slate-400 mb-2">Sin items agregados</p>
          <Button size="sm" onClick={openAdd}>Agregar primer item</Button>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
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

      {showAdd && (
        <AddItemModal
          newItem={newItem}
          setNewItem={setNewItem}
          categoriasPresupuesto={categoriasPresupuesto}
          conceptosServicio={conceptosServicio}
          moneda={moneda}
          onAdd={handleAdd}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
};
