import { useState } from 'react';
import type { Presentacion, UnidadStock } from '@ags/shared';
import { HoverTooltip } from '../ui/HoverTooltip';
import { unidadesService } from '../../services/firebaseService';
import { fmtCant, stockPorPresentacion, type StockPorPresentacion } from '../../utils/stockPorPresentacion';

/** Unidades por artículo ya consultadas en hover (2 min): pasar el mouse dos veces no vuelve a leer. */
const cache = new Map<string, { t: number; unidades: UnidadStock[] }>();
const VIGENCIA_MS = 120_000;

/**
 * Badge chico en la fila del listado de artículos: marca los que tienen presentaciones
 * (N° de parte alternativos del mismo artículo). En hover muestra la lista con sus factores.
 * Espejo de EquivalenciaBadge, en índigo para distinguirlo del ⇄ de equivalencia (legacy).
 * El cartel va por HoverTooltip (2026-09-16): dentro de la tabla se recortaba.
 *
 * Stock por presentación (2026-10-02): con `articuloId`, al pasar el mouse trae
 * las unidades y muestra cuánto entró en cada envase y el total expresado en
 * cada uno, siempre en unidades de la presentación más chica.
 */
export function PresentacionesBadge({ presentaciones, articuloId, baseCodigo }: {
  presentaciones: Presentacion[];
  articuloId?: string;
  baseCodigo?: string;
}) {
  const activas = (presentaciones ?? []).filter(p => p.activo !== false && p.codigoParte);
  const [stock, setStock] = useState<StockPorPresentacion | null>(null);
  const [cargando, setCargando] = useState(false);
  if (activas.length === 0) return null;

  const cargar = () => {
    if (!articuloId || cargando) return;
    const c = cache.get(articuloId);
    if (c && Date.now() - c.t < VIGENCIA_MS) { setStock(stockPorPresentacion(c.unidades, activas)); return; }
    setCargando(true);
    unidadesService.getByArticulo(articuloId)
      .then(us => { cache.set(articuloId, { t: Date.now(), unidades: us }); setStock(stockPorPresentacion(us, activas)); })
      .catch(() => {})
      .finally(() => setCargando(false));
  };

  return (
    <HoverTooltip
      maxWidth={380}
      contenido={
        <>
          <span className="block font-semibold mb-0.5">Presentaciones (N° de parte)</span>
          {activas.map((p, i) => {
            const fila = stock?.filas.find(f => f.codigoParte === p.codigoParte);
            return (
              <span key={`${p.codigoParte}:${i}`} className="block whitespace-nowrap">
                {p.codigoParte} · ×{p.factor}{p.descripcion ? ` — ${p.descripcion}` : ''}
                {fila && (
                  <span className="text-slate-300">
                    {' · '}{fila.unidadesBase > 0 ? `${fmtCant(fila.unidadesBase)} u. (${fmtCant(fila.unidadesBase / p.factor)} env.)` : 'sin stock en este envase'}
                  </span>
                )}
              </span>
            );
          })}
          {stock && (
            <span className="block mt-1 pt-1 border-t border-white/20">
              {stock.sueltas > 0 && <span className="block">Sueltas{baseCodigo ? ` (${baseCodigo})` : ''}: {fmtCant(stock.sueltas)} u.</span>}
              <span className="block font-semibold">Total en stock: {fmtCant(stock.total)} u.</span>
              {stock.total > 0 && stock.filas.map(f => (
                <span key={f.codigoParte} className="block text-slate-300">= {fmtCant(f.totalEnEnvases)} × {f.codigoParte}</span>
              ))}
            </span>
          )}
          {cargando && <span className="block mt-1 text-slate-400">Calculando stock…</span>}
        </>
      }
    >
      <span
        className="inline-flex items-center justify-center h-5 px-1.5 gap-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[9px] font-mono cursor-help select-none"
        data-testid="presentaciones-badge"
        onMouseEnter={cargar}
      >
        <span>#</span><span>{activas.length}</span>
      </span>
    </HoverTooltip>
  );
}
