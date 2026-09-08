interface LoadingStateProps {
  message?: string;
  /** Filas fantasma a dibujar. */
  rows?: number;
}

/**
 * Estado de carga (rediseñado 2026-09-07): filas fantasma que laten en vez
 * del texto "Cargando…". Ocupa el lugar de la lista, así la pantalla no
 * salta cuando llegan los datos y se percibe más rápida.
 */
export const LoadingState: React.FC<LoadingStateProps> = ({ message = 'Cargando…', rows = 4 }) => (
  <div className="py-6 px-4" role="status" aria-label={message}>
    <div className="animate-pulse space-y-2.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-2.5 w-16 rounded bg-slate-200" />
          <div className="h-2.5 flex-1 rounded bg-slate-100" style={{ maxWidth: `${70 - i * 9}%` }} />
          <div className="h-2.5 w-12 rounded bg-slate-100" />
        </div>
      ))}
    </div>
    <p className="text-[10px] font-mono uppercase tracking-wide text-slate-400 mt-3 text-center">{message}</p>
  </div>
);
