import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { Articulo } from '@ags/shared';
import { useStockAmplio } from '../../hooks/useStockAmplio';
import { atpNetoFromStockAmplio } from '../../services/atpHelpers';
import { StockAmplioBreakdownDrawer } from '../../components/stock/StockAmplioBreakdownDrawer';

interface Props {
  articulo: Articulo;
  /** When true, hides rows where comprometido === 0 (soloComprometido filter). */
  hideIfNotComprometido: boolean;
  /** Display name for marca — passed from page to avoid per-row lookup. */
  marcaNombre?: string;
}

export function PlanificacionRow({ articulo, hideIfNotComprometido, marcaNombre }: Props) {
  const { stockAmplio, loading, source } = useStockAmplio(articulo.id);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Apply soloComprometido filter — hide if comprometido is 0 and filter is active
  if (hideIfNotComprometido && stockAmplio && stockAmplio.comprometido === 0) {
    return null;
  }

  const atpNeto = stockAmplio !== null ? atpNetoFromStockAmplio(stockAmplio) : null;
  const needsReq = atpNeto !== null && atpNeto < 0;

  return (
    <>
      <tr className="border-b border-slate-100 hover:bg-slate-50/50">
        <td className="px-3 py-2 text-xs font-mono text-slate-700 whitespace-nowrap">
          {articulo.codigo}
        </td>
        <td className="px-3 py-2 text-xs text-slate-700 truncate max-w-[280px]">
          {articulo.descripcion}
        </td>
        <td className="px-3 py-2 text-[10px] text-slate-400 whitespace-nowrap">
          {marcaNombre ?? '—'}
        </td>
        {stockAmplio === null ? (
          <td className="px-3 py-2 text-[10px] text-slate-400 text-center" colSpan={5}>
            {loading ? 'Cargando…' : '—'}
          </td>
        ) : (
          <>
            <td className="px-3 py-2 text-sm text-slate-700 text-center">{stockAmplio.disponible}</td>
            <td className="px-3 py-2 text-sm text-slate-700 text-center">{stockAmplio.enTransito}</td>
            <td className="px-3 py-2 text-sm text-slate-700 text-center">{stockAmplio.reservado}</td>
            <td className="px-3 py-2 text-sm text-slate-700 text-center">{stockAmplio.comprometido}</td>
            <td
              className={`px-3 py-2 text-sm text-center border-l border-slate-100 ${atpNeto !== null && atpNeto < 0 ? 'text-red-600 font-semibold' : 'text-slate-900 font-medium'}`}
              title={atpNeto !== null && atpNeto < 0 ? 'ATP negativo — requiere importación, crear requerimiento' : 'ATP neto'}
            >
              {atpNeto}
              {source === 'computed' && (
                <span className="text-[10px] text-slate-400 italic ml-1" title="Calculado en cliente — esperando sync server-side">~</span>
              )}
            </td>
          </>
        )}
        <td className="px-3 py-2 text-right whitespace-nowrap">
          {stockAmplio && (
            <button
              onClick={() => setDrawerOpen(true)}
              className="text-[10px] font-medium text-teal-700 hover:text-teal-900 px-1.5 py-0.5 rounded hover:bg-teal-50"
            >
              Ver detalle
            </button>
          )}
          {needsReq && (
            <button
              onClick={() =>
                navigate('/stock/requerimientos/nuevo', {
                  state: { prefillArticuloId: articulo.id, from: pathname },
                })
              }
              className="text-[10px] font-medium text-indigo-600 hover:text-indigo-800 px-1.5 py-0.5 rounded hover:bg-indigo-50"
            >
              Crear req.
            </button>
          )}
        </td>
      </tr>
      {stockAmplio && (
        <StockAmplioBreakdownDrawer
          articuloCodigo={articulo.codigo}
          articuloDescripcion={articulo.descripcion}
          stockAmplio={stockAmplio}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </>
  );
}
