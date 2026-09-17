/**
 * Phase 13 STKE-07 — tiny presentational badge marking rows that have
 * an equivalencia partner (either as origen or destino).
 *
 * Renders a small teal pill with the ⇄ icon. On hover a tooltip bubble
 * shows the full equivalencia detail (origen → destino × factor).
 * El cartel va por HoverTooltip (2026-09-16): dentro de la tabla se recortaba.
 *
 * Usage:
 *   <EquivalenciaBadge origenCodigo="5183-2209" destinoCodigo="5188-5367" factor={10} />
 *   <EquivalenciaBadge />  // generic, shows "Tiene equivalente"
 */

import { HoverTooltip } from '../ui/HoverTooltip';

interface Props {
  /** Codigo of the origen article (compra side). */
  origenCodigo?: string;
  /** Codigo of the destino article (uso side). */
  destinoCodigo?: string;
  /** Equivalencia factor (× factor). */
  factor?: number;
}

export function EquivalenciaBadge({ origenCodigo, destinoCodigo, factor }: Props) {
  const hasDetail = origenCodigo && destinoCodigo && factor != null;

  const tooltipContent = hasDetail
    ? `${origenCodigo} → ${destinoCodigo} × ${factor}`
    : 'Tiene equivalente';

  return (
    <HoverTooltip contenido={<span data-testid="equivalencia-badge-tooltip" className="whitespace-nowrap">{tooltipContent}</span>} maxWidth={260}>
      <span
        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-mono cursor-help select-none"
        data-testid="equivalencia-badge"
      >
        ⇄
      </span>
    </HoverTooltip>
  );
}
