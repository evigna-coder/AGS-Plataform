import type { Articulo } from '@ags/shared';

interface Props {
  filtered: Articulo[];
  /** Texto tipeado ya trimmeado — si no hay resultados, habilita la carga libre. */
  term: string;
  search: string;
  activeIndex: number;
  /** Refs de las filas: el buscador las usa para scrollear con ↑↓. */
  itemRefs: React.MutableRefObject<(HTMLButtonElement | null)[]>;
  onSelect: (a: Articulo) => void;
  onLibre: () => void;
  onHover: (idx: number) => void;
}

/** Resultados del buscador del wizard de OC (extraído 2026-09-03, budget 250). */
export function OCWizardResultados({
  filtered, term, search, activeIndex, itemRefs, onSelect, onLibre, onHover,
}: Props) {
  return (
    <div className="border border-slate-200 rounded-md max-h-56 overflow-y-auto divide-y divide-slate-50">
      {filtered.length === 0 && term && (
        <button onClick={onLibre}
          className="w-full text-left px-3 py-1.5 text-xs text-slate-500 hover:bg-teal-50">
          Usar "{search.trim()}" como descripcion libre
        </button>
      )}
      {filtered.map((a, idx) => (
        <button key={a.id} ref={el => { itemRefs.current[idx] = el; }}
          onClick={() => onSelect(a)} onMouseEnter={() => onHover(idx)}
          className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between gap-2 ${
            idx === activeIndex ? 'bg-teal-50' : 'hover:bg-teal-50'}`}>
          <span className="text-slate-700 truncate">{a.descripcion}</span>
          <span className="text-[10px] font-mono text-teal-700 shrink-0">{a.codigo}</span>
        </button>
      ))}
    </div>
  );
}
