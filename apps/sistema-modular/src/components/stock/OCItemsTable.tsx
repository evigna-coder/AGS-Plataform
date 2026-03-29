import type { ItemOC } from '@ags/shared';
import { Card } from '../ui/Card';

const MONEDA_SYM: Record<string, string> = { ARS: '$', USD: 'U$S', EUR: '\u20AC' };

interface Props {
  items: ItemOC[];
  moneda: string;
  readOnly?: boolean;
}

export const OCItemsTable: React.FC<Props> = ({ items, moneda }) => {
  const sym = MONEDA_SYM[moneda] || '$';

  const fmtNum = (val: number | null | undefined) => {
    if (val == null) return '-';
    return val.toLocaleString('es-AR', { minimumFractionDigits: 2 });
  };

  const total = items.reduce((s, i) => s + i.cantidad * (i.precioUnitario || 0), 0);

  return (
    <Card title={`Items (${items.length})`} compact>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">Sin items</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider w-10">#</th>
                <th className="px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider">Descripcion</th>
                <th className="px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider w-24">Codigo</th>
                <th className="px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider w-20">Cantidad</th>
                <th className="px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider w-20">Recibida</th>
                <th className="px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider w-28">Precio unit.</th>
                <th className="px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider w-28">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, idx) => {
                const lineSubtotal = item.cantidad * (item.precioUnitario || 0);
                const isPartial = item.cantidadRecibida > 0 && item.cantidadRecibida < item.cantidad;
                const isComplete = item.cantidadRecibida >= item.cantidad;
                return (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-xs text-slate-400">{idx + 1}</td>
                    <td className="px-3 py-2 text-xs text-slate-700">{item.descripcion}</td>
                    <td className="px-3 py-2 text-xs text-slate-500 font-mono">{item.articuloCodigo || '-'}</td>
                    <td className="px-3 py-2 text-xs text-slate-700 text-center tabular-nums">{item.cantidad}</td>
                    <td className="px-3 py-2 text-center tabular-nums">
                      <span className={`text-xs ${isComplete ? 'text-green-600 font-medium' : isPartial ? 'text-amber-600' : 'text-slate-500'}`}>
                        {item.cantidadRecibida}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700 text-center tabular-nums">
                      {item.precioUnitario != null ? `${sym} ${fmtNum(item.precioUnitario)}` : '-'}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-900 font-medium text-center tabular-nums">
                      {item.precioUnitario != null ? `${sym} ${fmtNum(lineSubtotal)}` : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50">
                <td colSpan={6} className="px-3 py-2 text-xs font-medium text-slate-700 text-center">Total</td>
                <td className="px-3 py-2 text-sm font-semibold text-slate-900 text-center tabular-nums">
                  {sym} {fmtNum(total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Card>
  );
};
