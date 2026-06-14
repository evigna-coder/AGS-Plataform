import type { CosteoImportacion } from '../../utils/costeoImportacion';

interface Props {
  costeo: CosteoImportacion;
}

const fmt = (n: number, m: string) => `${m} ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const th = 'text-[9px] font-mono uppercase tracking-wide text-slate-400 py-1.5 px-2';

/** Detalle por artículo (posición arancelaria + tributos) + desglose total. Todo en la moneda de la importación. */
export const ImportacionCosteoPanel: React.FC<Props> = ({ costeo }) => {
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
      {/* Detalle por artículo: posición arancelaria + alícuotas (para verificar la definición) */}
      <div className="border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50">
            <tr>
              <th className={`${th} text-left`}>Artículo / posición</th>
              <th className={`${th} text-center`}>Derechos</th>
              <th className={`${th} text-center`}>Estadíst.</th>
              <th className={`${th} text-center`}>IVA</th>
              <th className={`${th} text-center`}>Factor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {costeo.lineas.length === 0 ? (
              <tr><td colSpan={5} className="text-center text-[11px] text-slate-400 py-3">Sin artículos en el embarque</td></tr>
            ) : costeo.lineas.map(l => (
              <tr key={l.itemId}>
                <td className="px-2 py-1.5">
                  <div className="text-slate-700">
                    {l.articuloCodigo ? <span className="font-mono text-slate-500 mr-1">{l.articuloCodigo}</span> : null}
                    {l.descripcion}
                  </div>
                  <div className="text-[10px] mt-0.5">
                    {l.posicionArancelaria
                      ? <span className="font-mono text-slate-400">NCM {l.posicionArancelaria}</span>
                      : <span className="text-amber-600">⚠ sin posición arancelaria</span>}
                    {l.sinTratamiento && <span className="text-amber-600 ml-2">⚠ sin tratamiento (defaults)</span>}
                  </div>
                </td>
                <td className="px-2 py-1.5 text-center font-mono text-slate-700">{l.derechoPct}%</td>
                <td className="px-2 py-1.5 text-center font-mono text-slate-700">{l.estadisticaPct}%</td>
                <td className="px-2 py-1.5 text-center font-mono text-slate-700">{l.ivaPct}%</td>
                <td className="px-2 py-1.5 text-center font-mono font-semibold text-teal-700">{l.factor.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Desglose total (en moneda de la importación) */}
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
        <div className="flex justify-between text-[11px] pt-1 border-t border-slate-300">
          <span className="text-slate-500">Erogación total (lo que se paga, incl. IVA)</span>
          <span className="font-mono text-slate-700">{fmt(costeo.costoTotal, m)}</span>
        </div>
        {costeo.costoTotalARS != null && (
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>Equivalente en ARS (TC {costeo.tipoCambio})</span>
            <span className="font-mono">{fmt(costeo.costoTotalARS, 'ARS')}</span>
          </div>
        )}
      </div>

      {/* Factor de importación (costo para stock — sin IVA/percepciones recuperables) */}
      <div className="bg-teal-50/60 border border-teal-200 rounded-lg px-3 py-2 space-y-1">
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-500">Costo financiero (3% s/ IVA + adic. + ganancias)</span>
          <span className="font-mono text-slate-700">{fmt(costeo.costoFinanciero, m)}</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-500">Costo computable (para stock)</span>
          <span className="font-mono text-slate-700">{fmt(costeo.costoComputable, m)}</span>
        </div>
        <div className="flex justify-between text-sm pt-1 border-t border-teal-200">
          <span className="font-semibold text-teal-800">Factor de importación del embarque</span>
          <span className="font-mono font-bold text-teal-700">{costeo.factorEmbarque.toFixed(3)}</span>
        </div>
      </div>
    </div>
  );
};
