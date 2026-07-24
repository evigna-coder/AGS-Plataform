import type { Presentacion } from '@ags/shared';

/**
 * Badge chico en la fila del listado de artículos: marca los que tienen presentaciones
 * (N° de parte alternativos del mismo artículo). En hover muestra la lista con sus factores.
 * Espejo de EquivalenciaBadge, en índigo para distinguirlo del ⇄ de equivalencia (legacy).
 */
export function PresentacionesBadge({ presentaciones }: { presentaciones: Presentacion[] }) {
  const activas = (presentaciones ?? []).filter(p => p.activo !== false && p.codigoParte);
  if (activas.length === 0) return null;

  return (
    <span
      className="group relative inline-flex items-center justify-center h-5 px-1.5 gap-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[9px] font-mono cursor-help select-none"
      data-testid="presentaciones-badge"
    >
      <span>#</span><span>{activas.length}</span>
      <span
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-max max-w-[280px]
          invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity duration-150
          bg-slate-800 text-white text-[10px] rounded px-2 py-1.5 shadow-lg z-50 text-left leading-relaxed"
      >
        <span className="block font-semibold mb-0.5">Presentaciones (N° de parte)</span>
        {activas.map((p, i) => (
          <span key={`${p.codigoParte}:${i}`} className="block whitespace-nowrap">
            {p.codigoParte} · ×{p.factor}{p.descripcion ? ` — ${p.descripcion}` : ''}
          </span>
        ))}
      </span>
    </span>
  );
}
