import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { Articulo } from '@ags/shared';
import { useStockAmplio } from '../../hooks/useStockAmplio';
import { StockAmplioIndicator } from '../../components/stock/StockAmplioIndicator';
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

  const atpNeto =
    stockAmplio !== null
      ? stockAmplio.disponible + stockAmplio.enTransito - stockAmplio.reservado - stockAmplio.comprometido
      : null;
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
        <td className="px-3 py-2" colSpan={5}>
          <StockAmplioIndicator
            stockAmplio={stockAmplio}
            loading={loading}
            source={source}
            onShowBreakdown={stockAmplio ? () => setDrawerOpen(true) : undefined}
          />
        </td>
        <td className="px-3 py-2 text-right whitespace-nowrap">
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
