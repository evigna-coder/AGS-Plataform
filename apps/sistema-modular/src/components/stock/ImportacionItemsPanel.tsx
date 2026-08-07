import { useMemo } from 'react';
import type { Articulo, Importacion } from '@ags/shared';
import { computeCosteoImportacion } from '../../utils/costeoImportacion';

interface Props {
  imp: Importacion;
  articulosById: Map<string, Articulo>;
}

const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const th = 'text-[9px] font-mono uppercase tracking-wide text-slate-400 py-1 px-2';

/**
 * Detalle de artículos de una importación, desplegable desde el listado
 * (2026-08-07): factor individual, posición arancelaria, cantidad y valor.
 *
 * El costeo se recomputa con el mismo motor del modal — el factor por artículo
 * no se persiste (solo `factorEmbarque` en la importación y `factorImportacion`
 * en cada unidad de stock, que es la verdad del lote ya ingresado).
 *
 * El rótulo de la columna de valor sale de la CONDICIÓN DE VENTA de la orden
 * (incoterm): EXW, FOB, CIF, etc. — decisión del dueño 2026-08-07.
 */
export function ImportacionItemsPanel({ imp, articulosById }: Props) {
  const monedaEmbarque = imp.items?.[0]?.moneda || 'USD';
  const costeo = useMemo(() => computeCosteoImportacion({
    items: imp.items ?? [],
    articulosById,
    gastos: imp.gastos ?? [],
    monedaBase: monedaEmbarque,
    fleteDeclarado: imp.fleteDeclarado ?? 0,
    seguroDeclarado: imp.seguroDeclarado ?? 0,
    tipoCambio: imp.tipoCambio,
    paseEurUsd: imp.paseEurUsd,
    esCourier: imp.esCourier,
  }), [imp, articulosById, monedaEmbarque]);

  const rotuloValor = `Valor ${imp.incoterm || 'FOB'}`;

  if (costeo.lineas.length === 0) {
    return <p className="text-[11px] text-slate-400 px-4 py-3">Esta importación no tiene artículos cargados.</p>;
  }

  return (
    <div className="px-4 py-2.5 bg-slate-50/70 border-t border-slate-100">
      <div className="flex items-center gap-3 mb-1.5">
        <p className="text-[10px] font-mono uppercase tracking-wide text-slate-500">
          Artículos ({costeo.lineas.length})
        </p>
        {imp.esCourier && (
          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700">courier</span>
        )}
        <span className="text-[10px] text-slate-400">
          Factor del embarque <span className="font-mono font-semibold text-teal-700">{costeo.factorEmbarque.toFixed(3)}</span>
        </span>
      </div>
      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50">
            <tr>
              <th className={`${th} text-left`}>Artículo</th>
              <th className={`${th} text-left`}>Posición (NCM)</th>
              <th className={`${th} text-right`}>Cant.</th>
              <th className={`${th} text-right`}>{rotuloValor}</th>
              <th className={`${th} text-right`}>Factor</th>
              <th className={`${th} text-right`}>Costo unit. (USD)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {costeo.lineas.map(l => {
              const item = (imp.items ?? []).find(i => i.id === l.itemId);
              const cant = item?.cantidadPedida ?? 0;
              const costoUnit = cant > 0 ? l.costoComputable / cant : 0;
              return (
                <tr key={l.itemId}>
                  <td className="px-2 py-1">
                    {l.articuloCodigo && <span className="font-mono text-slate-500 mr-1">{l.articuloCodigo}</span>}
                    <span className="text-slate-700">{l.descripcion}</span>
                  </td>
                  <td className="px-2 py-1 font-mono text-[11px] text-slate-500">
                    {l.posicionArancelaria ?? <span className="text-amber-600">sin posición</span>}
                  </td>
                  <td className="px-2 py-1 text-right font-mono text-slate-700">{cant}</td>
                  <td className="px-2 py-1 text-right font-mono text-slate-700">{fmt(l.fob)}</td>
                  <td className="px-2 py-1 text-right font-mono font-semibold text-teal-700">{l.factor.toFixed(3)}</td>
                  <td className="px-2 py-1 text-right font-mono text-slate-700">{fmt(costoUnit)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
