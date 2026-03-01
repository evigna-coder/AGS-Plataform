import { Link } from 'react-router-dom';
import type { PresupuestoItem, CategoriaPresupuesto } from '@ags/shared';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';

const categoriaOptions = (cats: CategoriaPresupuesto[]) => [
  { value: '', label: 'Sin categoria' },
  ...cats.filter(c => c.activo).map(c => ({ value: c.id, label: c.nombre })),
];

interface AddItemModalProps {
  newItem: Partial<PresupuestoItem>;
  setNewItem: (v: Partial<PresupuestoItem>) => void;
  categoriasPresupuesto: CategoriaPresupuesto[];
  onAdd: () => void;
  onClose: () => void;
}

export const AddItemModal = ({ newItem, setNewItem, categoriasPresupuesto, onAdd, onClose }: AddItemModalProps) => {
  const subtotal = (newItem.cantidad || 0) * (newItem.precioUnitario || 0);
  const categoria = categoriasPresupuesto.find(c => c.id === newItem.categoriaPresupuestoId);

  const taxPreview = () => {
    if (!categoria) return null;
    let iva = 0, ganancias = 0, iibb = 0;
    if (categoria.incluyeIva && categoria.porcentajeIva) {
      iva = categoria.ivaReduccion && categoria.porcentajeIvaReduccion
        ? subtotal * (categoria.porcentajeIvaReduccion / 100)
        : subtotal * (categoria.porcentajeIva / 100);
    }
    if (categoria.incluyeGanancias && categoria.porcentajeGanancias) {
      ganancias = (subtotal + iva) * (categoria.porcentajeGanancias / 100);
    }
    if (categoria.incluyeIIBB && categoria.porcentajeIIBB) {
      iibb = (subtotal + iva) * (categoria.porcentajeIIBB / 100);
    }
    const total = subtotal + iva + ganancias + iibb;
    return (
      <div className="mt-2 bg-indigo-50 p-3 rounded-lg text-xs">
        <p className="font-semibold text-slate-700 mb-1">Calculo con "{categoria.nombre}":</p>
        <div className="space-y-0.5 text-slate-600">
          <p>Subtotal: ${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
          {iva > 0 && (
            <p>IVA ({categoria.ivaReduccion && categoria.porcentajeIvaReduccion ? categoria.porcentajeIvaReduccion : categoria.porcentajeIva}%): ${iva.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
          )}
          {ganancias > 0 && (
            <p>Ganancias ({categoria.porcentajeGanancias}%): ${ganancias.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
          )}
          {iibb > 0 && (
            <p>IIBB ({categoria.porcentajeIIBB}%): ${iibb.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
          )}
          <p className="font-semibold text-indigo-700 mt-1">Total: ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card compact className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-sm font-semibold text-slate-900 tracking-tight mb-3">Agregar item</h3>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Descripcion *</label>
            <textarea
              value={newItem.descripcion}
              onChange={(e) => setNewItem({ ...newItem, descripcion: e.target.value })}
              rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
              placeholder="Descripcion del item..."
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Cantidad *</label>
              <input
                type="number" min="0" step="0.01"
                value={newItem.cantidad || ''}
                onChange={(e) => setNewItem({ ...newItem, cantidad: Number(e.target.value) || 0 })}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Unidad</label>
              <input
                value={newItem.unidad || 'unidad'}
                onChange={(e) => setNewItem({ ...newItem, unidad: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Precio unit. *</label>
              <input
                type="number" min="0" step="0.01"
                value={newItem.precioUnitario || ''}
                onChange={(e) => setNewItem({ ...newItem, precioUnitario: Number(e.target.value) || 0 })}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Categoria (reglas tributarias)</label>
            <SearchableSelect
              value={newItem.categoriaPresupuestoId || ''}
              onChange={(v) => setNewItem({ ...newItem, categoriaPresupuestoId: v || undefined })}
              options={categoriaOptions(categoriasPresupuesto)}
              placeholder="Seleccionar categoria..."
            />
            <Link to="/presupuestos/categorias" className="text-[11px] text-indigo-600 hover:underline mt-0.5 inline-block">
              Gestionar categorias →
            </Link>
            {newItem.categoriaPresupuestoId && taxPreview()}
          </div>
          {newItem.cantidad && newItem.precioUnitario && !newItem.categoriaPresupuestoId && (
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-xs font-semibold text-slate-700">
                Subtotal: ${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Seleccione una categoria para ver impuestos</p>
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={onAdd}>Agregar</Button>
        </div>
      </Card>
    </div>
  );
};
