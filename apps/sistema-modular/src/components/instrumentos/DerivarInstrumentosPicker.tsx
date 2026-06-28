import { useMemo } from 'react';
import { SearchableSelect } from '../ui/SearchableSelect';
import type { InstrumentoPatron } from '@ags/shared';

/** Resumen de una línea: "Nombre · Marca Modelo · S/N 123". */
export function instrumentoResumen(i: InstrumentoPatron): string {
  return [
    i.nombre,
    [i.marca, i.modelo].filter(Boolean).join(' '),
    i.serie ? `S/N ${i.serie}` : null,
  ].filter(Boolean).join(' · ');
}

interface Props {
  seleccionados: InstrumentoPatron[];
  disponibles: InstrumentoPatron[];
  seedId: string;
  onAdd: (instrumento: InstrumentoPatron) => void;
  onRemove: (id: string) => void;
}

export function DerivarInstrumentosPicker({ seleccionados, disponibles, seedId, onAdd, onRemove }: Props) {
  const opciones = useMemo(() => {
    const yaElegidos = new Set(seleccionados.map(i => i.id));
    return disponibles
      .filter(i => !yaElegidos.has(i.id))
      .map(i => ({ value: i.id, label: instrumentoResumen(i) }));
  }, [disponibles, seleccionados]);

  const handleAdd = (id: string) => {
    const inst = disponibles.find(i => i.id === id);
    if (inst) onAdd(inst);
  };

  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 space-y-2">
      <p className="text-[11px] font-mono uppercase tracking-wide text-slate-500">
        Instrumentos a derivar ({seleccionados.length})
      </p>

      <ul className="space-y-1">
        {seleccionados.map(i => (
          <li key={i.id} className="flex items-center justify-between gap-2 text-xs bg-white border border-slate-200 rounded-md px-2.5 py-1.5">
            <span className="truncate text-slate-700">{instrumentoResumen(i)}</span>
            {i.id !== seedId && (
              <button
                onClick={() => onRemove(i.id)}
                className="shrink-0 text-slate-400 hover:text-red-600"
                title="Quitar del remito"
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>

      <SearchableSelect
        value=""
        onChange={handleAdd}
        options={opciones}
        placeholder="Agregar otro instrumento al remito…"
      />
    </div>
  );
}
