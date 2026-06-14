import type { ItemImportacion } from '@ags/shared';
import type { CosteoImportacion } from '../../utils/costeoImportacion';

interface Props {
  items: ItemImportacion[];
  costeo: CosteoImportacion;
  monedaOC: string;
}

const fmt = (n: number, m: string) => `${m} ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Artículos del embarque (read-only) + desglose del costeo en la moneda de la importación. */
export const ImportacionCosteoPanel: React.FC<Props> = ({ items, costeo, monedaOC }) => {
  const m = costeo.moneda;
  const lineas: [string, number][] = [
    ['Valor en aduana (CIF)', costeo.cifTotal],
    ['Derechos de importación', costeo.derechos],
    ['Tasa de estadística', costeo.estadistica],
    ['IVA', costeo.iva],
    ['IVA adicional', costeo.ivaAdicional],
    ['Ganancias', costeo.ganancias],
    ['Ingresos brutos', costeo.iibb],
    ['Gastos reales (flete/seguro local, agente, despachante…)', costeo.gastosReales],
  ];

  return (
    <div className="space-y-3">
      {/* Artículos del embarque */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left text-[9px] font-mono uppercase tracking-wide text-slate-400 py-1.5 px-2">Artículo</th>
              <th className="text-right text-[9px] font-mono uppercase tracking-wide text-slate-400 py-1.5 px-2 w-16">Cant.</th>
              <th className="text-right text-[9px] font-mono uppercase tracking-wide text-slate-400 py-1.5 px-2 w-24">P. unit.</th>
              <th className="text-right text-[9px] font-mono uppercase tracking-wide text-slate-400 py-1.5 px-2 w-28">FOB</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {items.length === 0 ? (
              <tr><td colSpan={4} className="text-center text-[11px] text-slate-400 py-3">Sin artículos en el embarque</td></tr>
            ) : items.map(it => (
              <tr key={it.id}>
                <td className="px-2 py-1 text-slate-700">
                  {it.articuloCodigo ? <span className="font-mono text-slate-500 mr-1">{it.articuloCodigo}</span> : null}
                  {it.descripcion}
                </td>
                <td className="px-2 py-1 text-right font-mono text-slate-600">{it.cantidadPedida}</td>
                <td className="px-2 py-1 text-right font-mono text-slate-600">{fmt(it.precioUnitario ?? 0, it.moneda ?? monedaOC)}</td>
                <td className="px-2 py-1 text-right font-mono text-slate-700">{fmt((it.precioUnitario ?? 0) * (it.cantidadPedida ?? 0), it.moneda ?? monedaOC)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Desglose costeo (en moneda de la importación) */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 space-y-1">
        {lineas.map(([label, val]) => (
          <div key={label} className="flex justify-between text-[11px]">
            <span className="text-slate-500">{label}</span>
            <span className="font-mono text-slate-700">{fmt(val, m)}</span>
          </div>
        ))}
        <div className="flex justify-between text-[11px] pt-1 border-t border-slate-200">
          <span className="text-slate-500">Total gravámenes</span>
          <span className="font-mono text-slate-700">{fmt(costeo.totalGravamenes, m)}</span>
        </div>
        <div className="flex justify-between text-xs pt-1 border-t border-slate-300">
          <span className="font-semibold text-slate-700">Costo total estimado</span>
          <span className="font-mono font-semibold text-teal-700">{fmt(costeo.costoTotal, m)}</span>
        </div>
        {costeo.costoTotalARS != null && (
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>Equivalente en ARS (TC {costeo.tipoCambio})</span>
            <span className="font-mono">{fmt(costeo.costoTotalARS, 'ARS')}</span>
          </div>
        )}
      </div>
    </div>
  );
};
