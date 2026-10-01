import type { CategoriaEquipo, TableCatalogEntry, TableProject } from '@ags/shared';
import { ModelosPicker } from './ModelosPicker';
import { tableDiff } from '../../utils/tableCatalogCoverage';

interface Props {
  entry: TableCatalogEntry;
  setMeta: (key: keyof TableCatalogEntry, value: unknown) => void;
  project: TableProject | null;
  categorias: CategoriaEquipo[];
  /** Tipos de servicio del catálogo (con protocolo). */
  servicios: string[];
}

/** Aviso cuando la tabla no tiene lo mismo que el proyecto, con atajo para igualarla. */
function DiffWithProject({ label, diff, onUse }: { label: string; diff: { faltan: string[]; sobran: string[] }; onUse: () => void }) {
  if (!diff.faltan.length && !diff.sobran.length) return null;
  return (
    <div className="mb-2 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-[11px] text-amber-800">
      Distinto al proyecto
      {diff.faltan.length > 0 && <> · le faltan {diff.faltan.length}</>}
      {diff.sobran.length > 0 && <> · tiene {diff.sobran.length} de más</>}
      <button type="button" onClick={onUse} className="ml-2 font-semibold underline hover:text-amber-950">Usar los {label} del proyecto</button>
    </div>
  );
}

/**
 * Tipos de servicio y modelos de la tabla. Los servicios salen del catálogo real;
 * un valor que la tabla tiene pero ya no existe en el catálogo se muestra en rojo
 * (en campo no va a coincidir con ningún servicio).
 */
export function EditorCoverageFields({ entry, setMeta, project, categorias, servicios }: Props) {
  const propios = entry.tipoServicio ?? [];
  const fuera = propios.filter(s => !servicios.includes(s));
  const opciones = [...servicios, ...fuera];
  const refServ = project?.tipoServicio ?? [];
  const refMod = project?.modelos ?? [];

  return (
    <>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-2">
          Tipos de servicio <span className="ml-1 font-normal text-slate-400">(uno o más)</span>
        </label>
        <DiffWithProject label="servicios" diff={tableDiff(entry, 'tipoServicio', refServ)} onUse={() => setMeta('tipoServicio', [...refServ])} />
        <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
          {opciones.map(st => {
            const selected = propios.includes(st);
            const huerfano = fuera.includes(st);
            return (
              <label key={st} className="flex items-start gap-2 cursor-pointer group">
                <input type="checkbox" checked={selected}
                  onChange={() => setMeta('tipoServicio', selected ? propios.filter(s => s !== st) : [...propios, st])}
                  className="mt-0.5 accent-teal-600 shrink-0" />
                <span className={`text-xs leading-tight ${huerfano ? 'text-rose-600' : 'text-slate-700 group-hover:text-slate-900'}`}
                  title={huerfano ? 'No existe en el catálogo de tipos de servicio: en campo no coincide con ninguna OT.' : undefined}>
                  {st}{huerfano && ' (fuera del catálogo)'}
                </span>
              </label>
            );
          })}
        </div>
        {propios.length === 0 && (
          <p className="text-[10px] text-slate-400 mt-1 italic">Sin asignar — aparecerá en todos los servicios.</p>
        )}
      </div>

      {entry.sysType && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">
            Modelos de equipo <span className="ml-1 font-normal text-slate-400">(uno o más)</span>
          </label>
          <DiffWithProject label="modelos" diff={tableDiff(entry, 'modelos', refMod)} onUse={() => setMeta('modelos', [...refMod])} />
          <ModelosPicker selected={entry.modelos ?? []} onChange={next => setMeta('modelos', next)} categorias={categorias}
            emptyMessage="Sin asignar — aparecerá para todos los modelos de este tipo de sistema." />
        </div>
      )}
    </>
  );
}
