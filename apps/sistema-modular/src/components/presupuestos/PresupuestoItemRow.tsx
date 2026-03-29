import type { PresupuestoItem, CategoriaPresupuesto } from '@ags/shared';
import { SearchableSelect } from '../ui/SearchableSelect';

interface PresupuestoItemRowProps {
  item: PresupuestoItem;
  categoriasPresupuesto: CategoriaPresupuesto[];
  fmtMoney: (n: number) => string;
  taxes: { totalImpuestos: number };
  onUpdateItem: (itemId: string, field: keyof PresupuestoItem, value: any) => void;
  onRemoveItem: (itemId: string) => void;
}

const categoriaOptions = (cats: CategoriaPresupuesto[]) => [
  { value: '', label: 'Sin categoria' },
  ...cats.filter(c => c.activo).map(c => ({ value: c.id, label: c.nombre })),
];

export const PresupuestoItemRow = ({ item, categoriasPresupuesto, fmtMoney, taxes, onUpdateItem, onRemoveItem }: PresupuestoItemRowProps) => (
  <tr>
    <td className="px-2 py-2">
      <input value={item.codigoProducto || ''} onChange={e => onUpdateItem(item.id, 'codigoProducto', e.target.value || null)}
        className="w-full outline-none bg-transparent text-xs text-slate-500" placeholder="Part #" />
    </td>
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
    <td className="px-2 py-2">
      <input type="number" min="0" max="100" step="0.5" value={item.descuento || 0}
        onChange={e => onUpdateItem(item.id, 'descuento', Number(e.target.value) || 0)}
        className="w-full outline-none text-center bg-transparent text-xs" />
    </td>
    <td className="px-2 py-2 text-right text-xs font-semibold text-slate-700">
      {fmtMoney(item.subtotal)}
    </td>
    <td className="px-2 py-2">
      <SearchableSelect value={item.categoriaPresupuestoId || ''}
        onChange={(v) => onUpdateItem(item.id, 'categoriaPresupuestoId', v || undefined)}
        options={categoriaOptions(categoriasPresupuesto)} placeholder="Categoria..." />
      {taxes.totalImpuestos > 0 && (
        <span className="text-[10px] text-slate-400 mt-0.5 block">Imp: {fmtMoney(taxes.totalImpuestos)}</span>
      )}
    </td>
    <td className="text-left">
      <button onClick={() => onRemoveItem(item.id)} className="text-red-400 hover:text-red-600 font-medium">&times;</button>
    </td>
  </tr>
);
