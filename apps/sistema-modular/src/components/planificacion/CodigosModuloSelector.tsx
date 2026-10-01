import { SearchableSelect } from '../ui/SearchableSelect';
import type { ModeloModuloOpcion } from '../../hooks/usePlanificacionInsumos';

interface Props {
  value: string[];
  onChange: (v: string[]) => void;
  modelosModulo: ModeloModuloOpcion[];
}

/**
 * Varios modelos de módulo para un perfil de consumo (2026-10-01): chips con los
 * elegidos y un buscador para sumar más (del catálogo, de equipos o a mano).
 */
export function CodigosModuloSelector({ value, onChange, modelosModulo }: Props) {
  const agregar = (codigo: string) => {
    const c = codigo.trim().toUpperCase().replace(/\s+/g, '');
    if (c && !value.includes(c)) onChange([...value, c]);
  };
  const opciones = modelosModulo
    .filter(m => !value.includes(m.codigo.trim().toUpperCase().replace(/\s+/g, '')))
    .map(m => ({
      value: m.codigo,
      label: `${m.codigo} · ${m.descripcion}`,
      subLabel: [m.marca, m.enEquipos > 0 ? `${m.enEquipos} en equipos` : 'solo catálogo'].filter(Boolean).join(' · '),
    }));
  const descripcion = (c: string) => modelosModulo.find(m => m.codigo.toUpperCase() === c)?.descripcion;

  return (
    <div className="space-y-1.5">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map(c => (
            <span key={c} title={descripcion(c)}
              className="inline-flex items-center gap-1 rounded-md border border-teal-200 bg-teal-50 pl-2 pr-1 py-0.5 text-[11px] font-mono text-teal-800">
              {c}
              <button type="button" onClick={() => onChange(value.filter(x => x !== c))}
                className="text-teal-500 hover:text-red-600 px-0.5" title="Quitar">✕</button>
            </span>
          ))}
        </div>
      )}
      <SearchableSelect value="" onChange={agregar} size="sm" creatable createLabel="Usar código"
        placeholder={value.length ? '+ Agregar otro modelo…' : 'Elegí un modelo (catálogo o cargado en equipos)…'}
        options={opciones} />
    </div>
  );
}
