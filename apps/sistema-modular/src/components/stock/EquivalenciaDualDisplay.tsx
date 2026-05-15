import { useEffect, useState } from 'react';
import { unidadesService } from '../../services/firebaseService';
import { Button } from '../ui/Button';
import { useEquivalenciaDual } from '../../hooks/useEquivalenciaDual';
import type { Articulo } from '@ags/shared';

interface Props {
  articulo: Articulo | null;
  onDesagregarClick: (origenArticulo: Articulo) => void;
  refreshKey?: number;
}

/**
 * Resolves stock disponible for an artículo.
 * Prefers denormalized resumenStock?.disponible (Phase 9 STKP-02) for speed;
 * falls back to a live count query when unavailable.
 */
async function resolveStock(art: Articulo): Promise<number> {
  if (art.resumenStock?.disponible != null) {
    return art.resumenStock.disponible;
  }
  const units = await unidadesService.getAll({ articuloId: art.id, estado: 'disponible', activoOnly: true });
  return units.length;
}

/**
 * Dual-display card showing both sides of a compra↔uso equivalencia.
 *
 * Row ordering rule (m4 fix):
 * - mode='origen': origen row FIRST (this article), then destino row (calculated potencial).
 * - mode='destino': destino row FIRST (this article), then origen row beneath.
 *
 * M5 fix: handles mode='loading' BEFORE mode='none' to prevent flicker
 * null → loading → destino during the in-flight findOrigenDeDestino window.
 */
export function EquivalenciaDualDisplay({ articulo, onDesagregarClick, refreshKey }: Props) {
  const dual = useEquivalenciaDual(articulo);
  const [stockOrigen, setStockOrigen] = useState<number | null>(null);
  const [stockDestino, setStockDestino] = useState<number | null>(null);

  useEffect(() => {
    // Only fetch stock when both sides are resolved
    if (dual.mode !== 'origen' && dual.mode !== 'destino') return;
    const origen = dual.origenArticulo;
    const destino = dual.destinoArticulo;

    let cancelled = false;
    Promise.all([
      origen ? resolveStock(origen) : Promise.resolve(0),
      destino ? resolveStock(destino) : Promise.resolve(0),
    ]).then(([o, d]) => {
      if (!cancelled) {
        setStockOrigen(o);
        setStockDestino(d);
      }
    });

    return () => { cancelled = true; };
  }, [dual.mode, dual.origenArticulo?.id, dual.destinoArticulo?.id, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // M5 fix: check 'loading' BEFORE 'none' — prevents flicker null → loading → destino
  if (dual.mode === 'loading') {
    return (
      <div
        className="text-xs text-slate-500 italic py-1"
        data-testid="equivalencia-dual-loading"
      >
        Cargando equivalencia…
      </div>
    );
  }
  if (dual.mode === 'none') return null;
  if (dual.error) {
    return <p className="text-rose-600 text-xs">{dual.error}</p>;
  }

  const origen = dual.origenArticulo!;
  const destino = dual.destinoArticulo;
  const factor = dual.factor;
  const so = stockOrigen ?? 0;
  const sd = stockDestino ?? 0;
  const potencialesDelOrigen = so * factor;
  const equivalentesDelDestino = factor > 0 ? sd / factor : 0;

  const handleCTA = () => onDesagregarClick(origen);

  // Reusable rows declared once; ordering below by mode (m4 fix).
  const origenRow = (
    <div className="flex items-start gap-2 text-xs flex-wrap" data-testid="dual-row-origen">
      <span className="font-mono text-slate-900">+ {so}</span>
      <span className="font-mono text-slate-900">× {origen.codigo}</span>
      <span className="text-slate-500">sin desagregar</span>
      {destino && (
        <span className="text-[10px] text-slate-500 italic">
          (= {potencialesDelOrigen} × {destino.codigo} potenciales)
        </span>
      )}
      {so > 0 && destino && (
        <Button
          size="sm"
          variant="primary"
          onClick={handleCTA}
          data-testid="desagregar-ahora-cta"
        >
          Desagregar ahora
        </Button>
      )}
    </div>
  );

  const destinoRow = destino && (
    <div className="flex items-start gap-2 text-xs flex-wrap" data-testid="dual-row-destino">
      <span className="font-mono text-slate-900">{destino.codigo}</span>
      <span className="font-mono text-teal-700">× {sd}</span>
      <span className="text-slate-500">disponibles</span>
      {dual.mode === 'destino' && equivalentesDelDestino > 0 && (
        <span className="text-[10px] text-slate-500 italic">
          └─ (≈ {equivalentesDelDestino.toFixed(2)} × {origen.codigo} equivalentes)
        </span>
      )}
    </div>
  );

  return (
    <div
      className="rounded-md border border-teal-200 bg-teal-50/30 px-3 py-2.5 space-y-2"
      data-testid="equivalencia-dual-display"
    >
      <p className="text-[9px] font-mono font-semibold text-teal-700/70 uppercase tracking-widest">
        Equivalencia compra ↔ uso (factor ×{factor})
      </p>

      {/* Row ordering by mode (m4 fix): article the user is looking at sits on top */}
      {dual.mode === 'origen' ? (
        <>
          {origenRow}
          {destinoRow}
        </>
      ) : (
        <>
          {destinoRow}
          {origenRow}
        </>
      )}
    </div>
  );
}
