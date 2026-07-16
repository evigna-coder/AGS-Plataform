import { useEffect, useRef, useState } from 'react';
import { cotizacionesService, type CotizacionDolar } from '../../services/cotizacionesService';

interface Props {
  /** Valor actual del tipo de cambio (parseado); undefined/0 = vacío. */
  current: number | undefined;
  /** Setea el tipo de cambio en el form del caller. */
  onApply: (v: number) => void;
  /**
   * Creación: si el campo está vacío cuando llega la cotización, precargarla
   * automáticamente (UAT 2026-07-15: "que tome solo el BNA comprador").
   * En edición dejarlo en false — no ensuciar un ppto existente en silencio.
   */
  autoFillIfEmpty?: boolean;
}

/**
 * Línea de referencia "BNA comprador $X — aplicar" para acompañar un input de
 * tipo de cambio. La cotización es referencial (dolarapi/pizarra BNA, cache 10');
 * si la fuente no responde, no renderiza nada y el campo sigue manual.
 */
export const BnaTipoCambioHint = ({ current, onApply, autoFillIfEmpty = false }: Props) => {
  const [cotiz, setCotiz] = useState<CotizacionDolar | null>(null);
  const autoFilled = useRef(false);
  const currentRef = useRef(current);
  currentRef.current = current;
  const onApplyRef = useRef(onApply);
  onApplyRef.current = onApply;

  useEffect(() => {
    let alive = true;
    cotizacionesService.oficial().then(c => {
      if (!alive || !c) return;
      setCotiz(c);
      if (autoFillIfEmpty && !autoFilled.current && !currentRef.current) {
        autoFilled.current = true;
        onApplyRef.current(c.compra);
      }
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!cotiz) return null;
  const fmt = cotiz.compra.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div className="flex items-center gap-1.5 mt-0.5">
      <span className="text-[10px] text-slate-400" title={cotiz.fecha ? `Actualizado: ${new Date(cotiz.fecha).toLocaleString('es-AR')}` : undefined}>
        BNA comprador: ${fmt}
      </span>
      {current !== cotiz.compra && (
        <button type="button" onClick={() => onApply(cotiz.compra)}
          className="text-[10px] text-teal-700 hover:underline">
          aplicar
        </button>
      )}
    </div>
  );
};
