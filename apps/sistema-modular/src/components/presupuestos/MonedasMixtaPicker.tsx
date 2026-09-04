import type { MonedaCuota } from '@ags/shared';

const TODAS: MonedaCuota[] = ['ARS', 'USD', 'EUR'];

interface Props {
  value: MonedaCuota[];
  onChange: (v: MonedaCuota[]) => void;
}

/**
 * Monedas involucradas en un contrato MIXTO (2026-09-04). Casi siempre pesos y
 * dólares: cada ítem del contrato lleva una porción en cada una, en la misma
 * línea, y el PDF las muestra en columnas separadas. El orden de los chips es
 * el orden de las columnas; la primera es la principal.
 */
export function MonedasMixtaPicker({ value, onChange }: Props) {
  const toggle = (m: MonedaCuota) => {
    if (value.includes(m)) {
      if (value.length <= 2) return; // un mixto son al menos dos monedas
      onChange(value.filter(x => x !== m));
    } else {
      onChange([...value, m]);
    }
  };
  return (
    <div className="mt-1.5">
      <div className="flex items-center gap-1">
        {TODAS.map(m => {
          const on = value.includes(m);
          return (
            <button key={m} type="button" onClick={() => toggle(m)}
              className={`px-2 py-0.5 rounded-md border text-[10px] font-mono font-semibold transition-colors ${
                on ? 'bg-teal-700 border-teal-700 text-white' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
              {m}
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-slate-400 mt-1">
        Cada servicio lleva su parte en {value.join(' y ')} en la misma línea.
      </p>
    </div>
  );
}
