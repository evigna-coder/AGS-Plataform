import { useState } from 'react';
import type { PresupuestoItem, CategoriaPresupuesto } from '@ags/shared';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';
import { AddItemModal } from './AddItemModal';

interface PresupuestoTotals {
  subtotal: number;
  iva: number;
  ganancias: number;
  iibb: number;
  totalImpuestos: number;
  total: number;
}

interface PresupuestoItemsTableProps {
  items: PresupuestoItem[];
  categoriasPresupuesto: CategoriaPresupuesto[];
  totals: PresupuestoTotals;
  notasTecnicas: string;
  onAddItem: (item: PresupuestoItem) => void;
  onUpdateItem: (itemId: string, field: keyof PresupuestoItem, value: any) => void;
  onRemoveItem: (itemId: string) => void;
  onNotasTecnicasChange: (v: string) => void;
  calculateItemTaxes: (item: PresupuestoItem) => { iva: number; ganancias: number; iibb: number; totalImpuestos: number };
}

const categoriaOptions = (cats: CategoriaPresupuesto[]) => [
  { value: '', label: 'Sin categoria' },
  ...cats.filter(c => c.activo).map(c => ({ value: c.id, label: c.nombre })),
];

export const PresupuestoItemsTable = ({
  items,
  categoriasPresupuesto,
  totals,
  notasTecnicas,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onNotasTecnicasChange,
  calculateItemTaxes,
}: PresupuestoItemsTableProps) => {
  const [showModal, setShowModal] = useState(false);
  const [newItem, setNewItem] = useState<Partial<PresupuestoItem>>({
    descripcion: '',
    cantidad: 1,
    unidad: 'unidad',
    precioUnitario: 0,
    categoriaPresupuestoId: undefined,
  });

  const handleAdd = () => {
    if (!newItem.descripcion || !newItem.cantidad || !newItem.precioUnitario) {
      alert('Complete descripcion, cantidad y precio unitario');
      return;
    }
    const subtotal = (newItem.cantidad || 0) * (newItem.precioUnitario || 0);
    onAddItem({
      id: `item-${Date.now()}`,
      descripcion: newItem.descripcion,
      cantidad: newItem.cantidad || 1,
      unidad: newItem.unidad || 'unidad',
      precioUnitario: newItem.precioUnitario || 0,
      categoriaPresupuestoId: newItem.categoriaPresupuestoId,
      subtotal,
    });
    setShowModal(false);
  };

  const openModal = () => {
    setNewItem({ descripcion: '', cantidad: 1, unidad: 'unidad', precioUnitario: 0, categoriaPresupuestoId: undefined });
    setShowModal(true);
  };

  return (
    <div className="flex-1 min-w-0 space-y-4">
      <Card compact>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase">Items</h3>
          <Button onClick={openModal} size="sm">+ Agregar</Button>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-xs text-slate-400">Sin items</p>
            <Button className="mt-3" onClick={openModal} size="sm">Agregar primer item</Button>
          </div>
        ) : (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 px-3 text-left">Descripcion</th>
                  <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 px-2 text-center w-16">Cant.</th>
                  <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 px-2 text-left w-20">Unidad</th>
                  <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 px-2 text-right w-24">P. Unit.</th>
                  <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 px-2 text-right w-24">Subtotal</th>
                  <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 px-2 text-left w-28">Categoria</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => {
                  const taxes = calculateItemTaxes(item);
                  return (
                    <tr key={item.id}>
                      <td className="px-3 py-2">
                        <input value={item.descripcion} onChange={e => onUpdateItem(item.id, 'descripcion', e.target.value)}
                          className="w-full outline-none bg-transparent text-xs" placeholder="Descripcion..." />
                      </td>
                      <td className="px-2 py-2">
                        <input type="number" min="0" step="0.01" value={item.cantidad}
                          onChange={e => onUpdateItem(item.id, 'cantidad', Number(e.target.value) || 0)}
                          className="w-full outline-none text-center bg-transparent text-xs" />
                      </td>
                      <td className="px-2 py-2">
                        <input value={item.unidad} onChange={e => onUpdateItem(item.id, 'unidad', e.target.value)}
                          className="w-full outline-none bg-transparent text-xs" />
                      </td>
                      <td className="px-2 py-2">
                        <input type="number" min="0" step="0.01" value={item.precioUnitario}
                          onChange={e => onUpdateItem(item.id, 'precioUnitario', Number(e.target.value) || 0)}
                          className="w-full outline-none text-right bg-transparent text-xs" />
                      </td>
                      <td className="px-2 py-2 text-right text-xs font-semibold text-slate-700">
                        ${item.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-2 py-2">
                        <SearchableSelect value={item.categoriaPresupuestoId || ''}
                          onChange={(v) => onUpdateItem(item.id, 'categoriaPresupuestoId', v || undefined)}
                          options={categoriaOptions(categoriasPresupuesto)} placeholder="Categoria..." />
                        {taxes.totalImpuestos > 0 && (
                          <span className="text-[10px] text-slate-400 mt-0.5 block">
                            Imp: ${taxes.totalImpuestos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </td>
                      <td className="text-center">
                        <button onClick={() => onRemoveItem(item.id)} className="text-red-400 hover:text-red-600 font-medium">&times;</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-right text-[11px] font-medium text-slate-400">Subtotal</td>
                  <td className="px-2 py-2 text-right text-xs font-semibold text-slate-700">
                    ${totals.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </td>
                  <td colSpan={2}></td>
                </tr>
                {totals.iva > 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-1.5 text-right text-[11px] font-medium text-slate-400">IVA</td>
                    <td className="px-2 py-1.5 text-right text-xs text-slate-600">
                      ${totals.iva.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                )}
                {totals.ganancias > 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-1.5 text-right text-[11px] font-medium text-slate-400">Ganancias</td>
                    <td className="px-2 py-1.5 text-right text-xs text-slate-600">
                      ${totals.ganancias.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                )}
                {totals.iibb > 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-1.5 text-right text-[11px] font-medium text-slate-400">IIBB</td>
                    <td className="px-2 py-1.5 text-right text-xs text-slate-600">
                      ${totals.iibb.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                )}
                <tr className="bg-indigo-50">
                  <td colSpan={4} className="px-3 py-2 text-right text-xs font-semibold text-indigo-900">Total</td>
                  <td className="px-2 py-2 text-right text-sm font-semibold text-indigo-700">
                    ${totals.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {/* Notas tecnicas */}
      <Card compact>
        <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3">Notas tecnicas</h3>
        <textarea
          value={notasTecnicas}
          onChange={(e) => onNotasTecnicasChange(e.target.value)}
          rows={3}
          placeholder="Notas tecnicas, observaciones..."
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none bg-white focus:ring-1 focus:ring-indigo-500"
        />
      </Card>

      {showModal && (
        <AddItemModal
          newItem={newItem}
          setNewItem={setNewItem}
          categoriasPresupuesto={categoriasPresupuesto}
          onAdd={handleAdd}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
};
