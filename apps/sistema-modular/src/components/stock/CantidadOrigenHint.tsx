interface Props {
  /** Unidades base disponibles en el origen (o en las unidades tildadas). */
  disponible: number;
  /** true si la cifra sale de las unidades tildadas y no de todo el origen. */
  deSeleccion: boolean;
  onMaximo: () => void;
}

/**
 * Debajo de la cantidad de un movimiento (2026-10-01): cuánto hay en el origen
 * elegido y un atajo "Máx" para mover todo (vaciar una posición de una vez).
 */
export function CantidadOrigenHint({ disponible, deSeleccion, onMaximo }: Props) {
  return (
    <p className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
      <span>Disponible {deSeleccion ? 'en lo tildado' : 'en el origen'}: <span className="font-semibold text-slate-700 tabular-nums">{disponible}</span></span>
      <button type="button" onClick={onMaximo} disabled={disponible <= 0}
        className="px-1.5 py-px rounded border border-teal-300 text-teal-700 font-medium hover:bg-teal-50 disabled:opacity-40">
        Máx
      </button>
    </p>
  );
}
