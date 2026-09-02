import { useMemo } from 'react';
import type { ModuloSistema, Sistema } from '@ags/shared';
import { SearchableSelect } from '../../ui/SearchableSelect';

interface Props {
  sistemas: Sistema[];
  /** Ids seleccionados, en orden de selección (define el orden de los grupos). */
  seleccionados: string[];
  /** Sistemas que ya tienen items en el contrato — no se vuelven a ofrecer. */
  yaCargados: Set<string>;
  modulosPorSistema: Map<string, ModuloSistema[]>;
  onChange: (ids: string[]) => void;
}

const labelCls = 'block text-[11px] font-medium text-slate-500 mb-1';

/**
 * Selector de VARIOS equipos para una misma carga de servicios (2026-09-02).
 * Antes el modal cargaba un sistema por vez; en un contrato los equipos suelen
 * compartir el mismo alcance de servicio, así que se eligen todos juntos y los
 * servicios se cargan una sola vez.
 */
export function SistemasMultiPicker({
  sistemas, seleccionados, yaCargados, modulosPorSistema, onChange,
}: Props) {
  const byId = useMemo(() => new Map(sistemas.map(s => [s.id, s])), [sistemas]);

  const options = useMemo(
    () => sistemas
      .filter(s => !yaCargados.has(s.id) && !seleccionados.includes(s.id))
      .map(s => ({
        value: s.id,
        label: `${s.nombre}${s.codigoInternoCliente ? ` — ${s.codigoInternoCliente}` : ''}`,
      })),
    [sistemas, yaCargados, seleccionados],
  );

  return (
    <div>
      <label className={labelCls}>
        Equipos *
        {seleccionados.length > 1 && (
          <span className="ml-2 font-normal text-teal-700">
            los servicios que cargues abajo se replican a los {seleccionados.length}
          </span>
        )}
      </label>
      <SearchableSelect
        value=""
        onChange={id => { if (id) onChange([...seleccionados, id]); }}
        options={options}
        placeholder={seleccionados.length === 0 ? 'Buscar equipo…' : 'Agregar otro equipo…'}
      />
      {seleccionados.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {seleccionados.map(id => {
            const s = byId.get(id);
            const mods = modulosPorSistema.get(id);
            return (
              <span key={id}
                className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full border border-teal-200 bg-teal-50 text-teal-800">
                <span className="font-medium">{s?.nombre ?? id}</span>
                {s?.codigoInternoCliente && (
                  <span className="font-mono text-[10px] text-teal-600">{s.codigoInternoCliente}</span>
                )}
                <span className="text-[10px] text-teal-600">
                  {mods === undefined ? '…' : `${mods.length} mód.`}
                </span>
                <button type="button" title="Quitar de esta carga"
                  onClick={() => onChange(seleccionados.filter(x => x !== id))}
                  className="text-teal-500 hover:text-red-600 leading-none text-sm">×</button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
