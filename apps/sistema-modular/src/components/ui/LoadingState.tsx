interface LoadingStateProps {
  message?: string;
  /** Filas fantasma a dibujar. */
  rows?: number;
}

/** Barra fantasma con brillo que la recorre (shimmer, 2026-09-29). Sin movimiento, queda gris fijo. */
const barra = 'h-2.5 rounded bg-slate-200 motion-safe:bg-gradient-to-r motion-safe:from-slate-200 motion-safe:via-slate-100 motion-safe:to-slate-200 motion-safe:bg-[length:200%_100%] motion-safe:animate-shimmer';

/**
 * Estado de carga (rediseñado 2026-09-07): filas fantasma en vez del texto
 * "Cargando…". Ocupa el lugar de la lista, así la pantalla no salta cuando
 * llegan los datos y se percibe más rápida. Desde 2026-09-29 con shimmer.
 */
export const LoadingState: React.FC<LoadingStateProps> = ({ message = 'Cargando…', rows = 4 }) => (
  <div className="py-6 px-4" role="status" aria-label={message}>
    <div className="space-y-2.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3" style={{ animationDelay: `${i * 60}ms` }}>
          <div className={`${barra} w-16`} />
          <div className={`${barra} flex-1`} style={{ maxWidth: `${70 - i * 9}%` }} />
          <div className={`${barra} w-12`} />
        </div>
      ))}
    </div>
    <p className="text-[10px] font-mono uppercase tracking-wide text-slate-400 mt-3 text-center">{message}</p>
  </div>
);
