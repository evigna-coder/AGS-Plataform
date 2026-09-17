import type { Presentacion } from '@ags/shared';
import { HoverTooltip } from '../ui/HoverTooltip';

/**
 * Badge chico en la fila del listado de artículos: marca los que tienen presentaciones
 * (N° de parte alternativos del mismo artículo). En hover muestra la lista con sus factores.
 * Espejo de EquivalenciaBadge, en índigo para distinguirlo del ⇄ de equivalencia (legacy).
 * El cartel va por HoverTooltip (2026-09-16): dentro de la tabla se recortaba.
 */
export function PresentacionesBadge({ presentaciones }: { presentaciones: Presentacion[] }) {
  const activas = (presentaciones ?? []).filter(p => p.activo !== false && p.codigoParte);
  if (activas.length === 0) return null;

  return (
    <HoverTooltip
      contenido={
        <>
          <span className="block font-semibold mb-0.5">Presentaciones (N° de parte)</span>
          {activas.map((p, i) => (
            <span key={`${p.codigoParte}:${i}`} className="block whitespace-nowrap">
              {p.codigoParte} · ×{p.factor}{p.descripcion ? ` — ${p.descripcion}` : ''}
            </span>
          ))}
        </>
      }
    >
      <span
        className="inline-flex items-center justify-center h-5 px-1.5 gap-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[9px] font-mono cursor-help select-none"
        data-testid="presentaciones-badge"
      >
        <span>#</span><span>{activas.length}</span>
      </span>
    </HoverTooltip>
  );
}
