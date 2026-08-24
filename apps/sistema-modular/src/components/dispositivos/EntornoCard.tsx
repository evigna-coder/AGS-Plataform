import type { EntornoDispositivo, SoftwareDispositivo } from '@ags/shared';

/**
 * Un sistema operativo con su software (2026-08-23).
 *
 * Se usa igual para el anfitrión y para una máquina virtual; la diferencia es
 * la sangría y el chip. Los nombres de software ya cargados en OTROS
 * dispositivos se ofrecen como sugerencia (`sugerencias`): sin eso el mismo
 * producto termina escrito de tres formas y la búsqueda "¿quién tiene
 * ChemStation?" deja de encontrarlo.
 */

interface Props {
  entorno: EntornoDispositivo;
  /** Nombres de software vistos en otros dispositivos, para el autocompletado. */
  sugerencias: string[];
  anidado?: boolean;
  onChange: (patch: Partial<EntornoDispositivo>) => void;
  onRemove: () => void;
  onAddVM?: () => void;
}

const lbl = 'block text-[10px] font-mono uppercase tracking-wide text-slate-400 mb-1';
const inputCls = 'w-full border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500';

export const EntornoCard: React.FC<Props> = ({ entorno, sugerencias, anidado, onChange, onRemove, onAddVM }) => {
  const software = entorno.software ?? [];

  const setSoftware = (lista: SoftwareDispositivo[]) => onChange({ software: lista });

  const addSoftware = () => setSoftware([
    ...software,
    { id: crypto.randomUUID(), nombre: '', version: '' },
  ]);

  const updateSoftware = (id: string, patch: Partial<SoftwareDispositivo>) =>
    setSoftware(software.map(sw => (sw.id === id ? { ...sw, ...patch } : sw)));

  const removeSoftware = (id: string) => setSoftware(software.filter(sw => sw.id !== id));

  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-2.5 ${anidado ? 'ml-5 border-l-2 border-l-teal-300' : ''}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-[9px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded-full shrink-0 ${
          entorno.tipo === 'virtual' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600'}`}>
          {entorno.tipo === 'virtual' ? 'Máquina virtual' : 'Anfitrión'}
        </span>
        <input
          value={entorno.nombre}
          onChange={e => onChange({ nombre: e.target.value })}
          placeholder={entorno.tipo === 'virtual' ? 'Ej: Windows 7' : 'Ej: Windows 10'}
          className="flex-1 min-w-0 border-0 border-b border-transparent hover:border-slate-200 focus:border-teal-500 text-xs font-medium text-slate-800 focus:outline-none bg-transparent py-0.5"
        />
        {onAddVM && (
          <button type="button" onClick={onAddVM}
            className="text-[10px] text-teal-700 hover:underline shrink-0"
            title="Agregar una máquina virtual que corre dentro de este sistema">
            + VM
          </button>
        )}
        <button type="button" onClick={onRemove}
          className="text-[10px] text-slate-400 hover:text-red-600 shrink-0"
          title={entorno.tipo === 'virtual' ? 'Quitar la máquina virtual' : 'Quitar el sistema operativo y sus máquinas virtuales'}>
          ✕
        </button>
      </div>

      {software.length > 0 && (
        <div className="space-y-1 mb-1.5">
          <div className="flex gap-2 px-0.5">
            <span className={`${lbl} flex-1 mb-0`}>Software</span>
            <span className={`${lbl} w-28 mb-0`}>Versión</span>
            <span className="w-4" />
          </div>
          {software.map(sw => (
            <div key={sw.id} className="flex gap-2 items-center">
              <input
                value={sw.nombre}
                onChange={e => updateSoftware(sw.id, { nombre: e.target.value })}
                list="ags-software-sugerencias"
                placeholder="Ej: ChemStation"
                className={`${inputCls} flex-1`}
              />
              <input
                value={sw.version ?? ''}
                onChange={e => updateSoftware(sw.id, { version: e.target.value })}
                placeholder="Ej: B.04.03"
                className={`${inputCls} w-28 font-mono`}
              />
              <button type="button" onClick={() => removeSoftware(sw.id)}
                className="text-[10px] text-slate-400 hover:text-red-600 w-4 shrink-0">✕</button>
            </div>
          ))}
        </div>
      )}

      <button type="button" onClick={addSoftware}
        className="text-[10px] text-teal-700 hover:underline">
        + Software
      </button>

      {/* Una sola lista de sugerencias para todos los inputs de la pantalla. */}
      <datalist id="ags-software-sugerencias">
        {sugerencias.map(n => <option key={n} value={n} />)}
      </datalist>
    </div>
  );
};
