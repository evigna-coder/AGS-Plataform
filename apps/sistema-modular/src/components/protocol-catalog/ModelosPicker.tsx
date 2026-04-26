import type { CategoriaEquipo } from '@ags/shared';

interface Props {
  selected: string[];
  onChange: (next: string[]) => void;
  categorias: CategoriaEquipo[];
  /** Mensaje cuando no hay nada seleccionado. Si no se pasa, no se muestra nada. */
  emptyMessage?: string;
  className?: string;
  /** Clase Tailwind para altura máxima del scroll. Default: max-h-60. */
  maxHeight?: string;
}

export function ModelosPicker({
  selected,
  onChange,
  categorias,
  emptyMessage,
  className,
  maxHeight = 'max-h-60',
}: Props) {
  const grupos = categorias
    .filter(c => (c.modelos ?? []).length > 0)
    .map(c => ({
      categoria: c.nombre,
      modelos: (c.modelos ?? []).filter((v, i, a) => a.indexOf(v) === i).sort(),
    }))
    .filter(g => g.modelos.length > 0);

  if (grupos.length === 0) return null;

  const toggle = (modelo: string) => {
    onChange(selected.includes(modelo)
      ? selected.filter(m => m !== modelo)
      : [...selected, modelo]);
  };

  return (
    <div className={className}>
      <div className={`space-y-3 ${maxHeight} overflow-y-auto pr-1`}>
        {grupos.map(g => (
          <div key={g.categoria}>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{g.categoria}</p>
            <div className="space-y-1.5 pl-1">
              {g.modelos.map(modelo => {
                const isSel = selected.includes(modelo);
                return (
                  <label key={modelo} className="flex items-start gap-2 cursor-pointer group">
                    <input type="checkbox" checked={isSel} onChange={() => toggle(modelo)}
                      className="mt-0.5 accent-blue-600 shrink-0" />
                    <span className="text-xs text-slate-700 group-hover:text-slate-900 leading-tight">{modelo}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {emptyMessage && selected.length === 0 && (
        <p className="text-[10px] text-slate-400 mt-1 italic">{emptyMessage}</p>
      )}
    </div>
  );
}
