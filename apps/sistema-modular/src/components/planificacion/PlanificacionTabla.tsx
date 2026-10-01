import { Fragment } from 'react';
import { fmtCantidad, labelMes, type FilaPlan } from '../../utils/planificacionInsumos';

interface Props {
  meses: string[];
  filas: FilaPlan[];
  onVerDetalle: (fila: FilaPlan) => void;
}

const th = 'px-3 py-2 text-left text-[10px] font-mono uppercase tracking-wide text-slate-400 whitespace-nowrap';

/** Color del stock proyectado: rojo bajo cero, ámbar bajo el mínimo. */
function claseStock(stockFin: number, minimo: number): string {
  if (stockFin < 0) return 'text-red-600 font-semibold';
  if (minimo > 0 && stockFin < minimo) return 'text-amber-600 font-medium';
  return 'text-slate-700';
}

/**
 * Tabla artículo × mes de la Planificación de insumos. Por mes se ve la
 * demanda prevista y el stock proyectado a fin de mes; a la derecha, cuánto
 * comprar para no quebrar en el horizonte. Click en la fila abre el detalle.
 */
export function PlanificacionTabla({ meses, filas, onVerDetalle }: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-auto h-full">
      <table className="tabla-compacta w-full">
        <thead className="sticky top-0 z-10">
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className={th}>Código</th>
            <th className={th}>Descripción</th>
            <th className={`${th} text-center`}>Hoy</th>
            {meses.map(m => (
              <th key={m} className={`${th} text-center border-l border-slate-200`} colSpan={2}>{labelMes(m)}</th>
            ))}
            <th className={`${th} text-center border-l border-slate-200`}>Comprar</th>
          </tr>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th colSpan={3}></th>
            {meses.map(m => (
              <Fragment key={m}>
                <th className={`${th} text-center border-l border-slate-100 font-normal`}>Dem.</th>
                <th className={`${th} text-center font-normal`}>Stock</th>
              </Fragment>
            ))}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filas.map(f => (
            <tr key={f.articuloId} onClick={() => onVerDetalle(f)}
              className="border-b border-slate-100 hover:bg-slate-50/60 cursor-pointer" title="Ver de dónde sale cada número">
              <td className="px-3 py-1.5 text-xs font-mono text-slate-700 whitespace-nowrap">
                {f.codigo}
                {f.grupo && <span className="ml-1.5 text-[9px] font-mono uppercase tracking-wide text-slate-400">{f.grupo}</span>}
              </td>
              <td className="px-3 py-1.5 text-xs text-slate-700 truncate max-w-[260px]">{f.descripcion}</td>
              <td className="px-3 py-1.5 text-xs text-center text-slate-700 whitespace-nowrap">
                {fmtCantidad(f.stockInicial)}
                {f.stockMinimo > 0 && <span className="text-[10px] text-slate-400"> / mín {f.stockMinimo}</span>}
                {/* Kits (2026-09-30): parte del stock está dentro de kits sin explotar. */}
                {f.stockEnKits > 0 && (
                  <span className="block text-[9px] text-violet-600" title={f.kits.filter(k => k.disponibles > 0).map(k => `${k.disponibles} × ${k.kitCodigo} (${k.cantidadPorKit} c/u)`).join(' · ')}>
                    {fmtCantidad(f.stockEnKits)} en kits
                  </span>
                )}
              </td>
              {f.meses.map(c => (
                <Fragment key={c.mes}>
                  <td className="px-2 py-1.5 text-xs text-center text-slate-500 border-l border-slate-100">
                    {c.demanda > 0 ? fmtCantidad(c.demanda) : <span className="text-slate-300">·</span>}
                    {c.ingresos > 0 && <span className="text-[10px] text-teal-600 ml-1" title="Ingresos previstos">+{fmtCantidad(c.ingresos)}</span>}
                  </td>
                  <td className={`px-2 py-1.5 text-xs text-center ${claseStock(c.stockFin, f.stockMinimo)}`}>
                    {fmtCantidad(c.stockFin)}
                  </td>
                </Fragment>
              ))}
              <td className="px-3 py-1.5 text-center border-l border-slate-100 whitespace-nowrap">
                {f.comprar > 0 ? (
                  <span className="text-xs font-semibold text-red-600" title={f.mesQuiebre ? `Quiebra en ${labelMes(f.mesQuiebre)}` : undefined}>
                    {f.comprar}
                    {f.mesQuiebre && <span className="block text-[9px] font-normal text-red-400">{labelMes(f.mesQuiebre)}</span>}
                    {/* Viene en kit: la compra real se hace en kits. Varios kits = opciones, no elige. */}
                    {f.kits.map(k => (
                      <span key={k.kitId} className="block text-[9px] font-normal text-violet-600" title={`Viene en el kit ${k.kitCodigo}: ${k.cantidadPorKit} por kit`}>
                        ≈ {k.comprarKits} kit{k.comprarKits === 1 ? '' : 's'} {k.kitCodigo}
                      </span>
                    ))}
                  </span>
                ) : <span className="text-xs text-slate-300">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
