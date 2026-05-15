/**
 * Phase 13 STKE-07 — tiny presentational badge marking rows that have
 * an equivalencia partner (either as origen or destino).
 *
 * Renders a small teal pill with the ⇄ icon. On hover a tooltip bubble
 * shows the full equivalencia detail (origen → destino × factor).
 * Pure CSS / Tailwind — no external library.
 *
 * Usage:
 *   <EquivalenciaBadge origenCodigo="5183-2209" destinoCodigo="5188-5367" factor={10} />
 *   <EquivalenciaBadge />  // generic, shows "Tiene equivalente"
 */

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
    <span
      className="group relative inline-flex items-center justify-center w-5 h-5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-mono cursor-help select-none"
      data-testid="equivalencia-badge"
    >
      ⇄
      {/* Hover tooltip — pure CSS/Tailwind, no library. group + group-hover:visible. */}
      <span
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-max max-w-[220px]
          invisible group-hover:visible opacity-0 group-hover:opacity-100
          transition-opacity duration-150
          bg-slate-800 text-white text-[10px] rounded px-2 py-1 shadow-lg z-50 whitespace-nowrap"
        data-testid="equivalencia-badge-tooltip"
      >
        {tooltipContent}
      </span>
    </span>
  );
}
