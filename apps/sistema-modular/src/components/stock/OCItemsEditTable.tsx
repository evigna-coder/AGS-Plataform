import type { ItemOC } from '@ags/shared';
import { MoneyInput } from '../ui/MoneyInput';

const MONEDA_SYM: Record<string, string> = { ARS: '$', USD: 'U$S', EUR: '€' };
const IVA_OPCIONES = [21, 10.5, 0];

interface Props {
  items: ItemOC[];
  moneda: string;
  /** Mostrar columna y desglose de IVA (solo OC nacional). */
  showIva?: boolean;
  onAdd: () => void;
  onUpdate: (itemId: string, field: keyof ItemOC, value: unknown) => void;
  onRemove: (itemId: string) => void;
}

/** Tabla editable de items de una OC. Con IVA por item cuando showIva (OC nacional). */
export const OCItemsEditTable: React.FC<Props> = ({ items, moneda, showIva, onAdd, onUpdate, onRemove }) => {
  const sym = MONEDA_SYM[moneda] || '$';
  const fmt = (n: number) => `${sym} ${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  const subtotal = items.reduce((s, i) => s + i.cantidad * (i.precioUnitario || 0), 0);
  const iva = showIva ? items.reduce((s, i) => s + i.cantidad * (i.precioUnitario || 0) * ((i.porcentajeIva ?? 21) / 100), 0) : 0;
  const total = subtotal + iva;
  const footerSpan = showIva ? 7 : 6;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Items</span>
        <button type="button" onClick={onAdd}
          className="text-[11px] font-medium text-teal-600 border border-teal-300 rounded-md px-2 py-1 hover:bg-teal-50">
          + Agregar item
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">No hay items. Haga clic en "+ Agregar item".</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-2 py-1.5 text-center text-[10px] font-medium text-slate-400 tracking-wider w-8">#</th>
                <th className="px-2 py-1.5 text-left text-[10px] font-medium text-slate-400 tracking-wider w-24">Codigo</th>
                <th className="px-2 py-1.5 text-left text-[10px] font-medium text-slate-400 tracking-wider">Descripcion</th>
                <th className="px-2 py-1.5 text-center text-[10px] font-medium text-slate-400 tracking-wider w-20">Cantidad</th>
                <th className="px-2 py-1.5 text-center text-[10px] font-medium text-slate-400 tracking-wider w-24">Unidad</th>
                <th className="px-2 py-1.5 text-center text-[10px] font-medium text-slate-400 tracking-wider w-28">Precio unit.</th>
                {showIva && <th className="px-2 py-1.5 text-center text-[10px] font-medium text-slate-400 tracking-wider w-16">IVA %</th>}
                <th className="px-2 py-1.5 text-center text-[10px] font-medium text-slate-400 tracking-wider w-24">Subtotal</th>
                <th className="px-2 py-1.5 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, idx) => (
                <tr key={item.id}>
                  <td className="px-2 py-1 text-xs text-slate-400">{idx + 1}</td>
                  <td className="px-2 py-1 text-xs font-mono text-slate-500">{item.articuloCodigo || '—'}</td>
                  <td className="px-2 py-1">
                    <input value={item.descripcion} onChange={e => onUpdate(item.id, 'descripcion', e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-500" placeholder="Descripcion del item" />
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" min={1} value={item.cantidad} onChange={e => onUpdate(item.id, 'cantidad', Number(e.target.value))}
                      className="w-full text-xs text-right border border-slate-200 rounded px-2 py-1 tabular-nums focus:outline-none focus:ring-1 focus:ring-teal-500" />
                  </td>
                  <td className="px-2 py-1">
                    <input value={item.unidadMedida} onChange={e => onUpdate(item.id, 'unidadMedida', e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-500" />
                  </td>
                  <td className="px-2 py-1">
                    <MoneyInput value={item.precioUnitario ?? null} onChange={v => onUpdate(item.id, 'precioUnitario', v)}
                      className="w-full text-xs text-right border border-slate-200 rounded px-2 py-1 tabular-nums focus:outline-none focus:ring-1 focus:ring-teal-500" />
                  </td>
                  {showIva && (
                    <td className="px-2 py-1">
                      <select value={item.porcentajeIva ?? 21} onChange={e => onUpdate(item.id, 'porcentajeIva', Number(e.target.value))}
                        className="w-full text-xs border border-slate-200 rounded px-1 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500">
                        {IVA_OPCIONES.map(v => <option key={v} value={v}>{v}%</option>)}
                      </select>
                    </td>
                  )}
                  <td className="px-2 py-1 text-xs text-right text-slate-700 tabular-nums">
                    {(item.cantidad * (item.precioUnitario || 0)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-2 py-1 text-center">
                    <button onClick={() => onRemove(item.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {showIva && (
                <>
                  <tr>
                    <td colSpan={footerSpan} className="px-2 py-1 text-xs text-slate-500 text-right">Neto</td>
                    <td className="px-2 py-1 text-xs text-slate-600 text-right tabular-nums">{fmt(subtotal)}</td>
                    <td></td>
                  </tr>
                  <tr>
                    <td colSpan={footerSpan} className="px-2 py-1 text-xs text-slate-500 text-right">IVA</td>
                    <td className="px-2 py-1 text-xs text-slate-600 text-right tabular-nums">{fmt(iva)}</td>
                    <td></td>
                  </tr>
                </>
              )}
              <tr className="border-t border-slate-200">
                <td colSpan={footerSpan} className="px-2 py-1.5 text-xs font-medium text-slate-700 text-right">Total</td>
                <td className="px-2 py-1.5 text-xs font-semibold text-slate-900 text-right tabular-nums">{fmt(total)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};
