import type { EntornoDispositivo } from '@ags/shared';
import { vmsDeEntorno } from '@ags/shared';
import { EntornoCard } from './EntornoCard';

/**
 * Configuración de una computadora: sus sistemas operativos y el software de
 * cada uno (2026-08-23).
 *
 * La lista es PLANA y las máquinas virtuales se reconocen por `anfitrionId`.
 * Se dibujan indentadas debajo de su anfitrión, así que se lee como un árbol
 * sin que el dato lo sea — y recorrer todo el software de un equipo es un
 * `flatMap`, no una recursión.
 */

interface Props {
  entornos: EntornoDispositivo[];
  sugerencias: string[];
  onChange: (entornos: EntornoDispositivo[]) => void;
}

export const EntornosEditor: React.FC<Props> = ({ entornos, sugerencias, onChange }) => {
  const anfitriones = entornos.filter(e => e.tipo !== 'virtual');

  const addAnfitrion = () => onChange([
    ...entornos,
    { id: crypto.randomUUID(), nombre: '', tipo: 'anfitrion', anfitrionId: null, software: [] },
  ]);

  const addVM = (anfitrionId: string) => onChange([
    ...entornos,
    { id: crypto.randomUUID(), nombre: '', tipo: 'virtual', anfitrionId, software: [] },
  ]);

  const patch = (id: string, cambios: Partial<EntornoDispositivo>) =>
    onChange(entornos.map(e => (e.id === id ? { ...e, ...cambios } : e)));

  /** Quitar un anfitrión se lleva sus VMs: sin él no tienen dónde correr. */
  const remove = (id: string) =>
    onChange(entornos.filter(e => e.id !== id && e.anfitrionId !== id));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <label className="block text-[11px] font-medium text-slate-500">Configuración</label>
          <p className="text-[10px] text-slate-400">
            Sistemas operativos y software instalado. Una máquina virtual va adentro de su anfitrión.
          </p>
        </div>
        <button type="button" onClick={addAnfitrion}
          className="text-[11px] font-medium text-teal-700 hover:underline shrink-0">
          + Sistema operativo
        </button>
      </div>

      {anfitriones.length === 0 ? (
        <p className="text-[11px] text-slate-400 border border-dashed border-slate-200 rounded-lg py-4 text-center">
          Sin configuración cargada.
        </p>
      ) : (
        <div className="space-y-2">
          {anfitriones.map(host => (
            <div key={host.id} className="space-y-2">
              <EntornoCard
                entorno={host}
                sugerencias={sugerencias}
                onChange={c => patch(host.id, c)}
                onRemove={() => remove(host.id)}
                onAddVM={() => addVM(host.id)}
              />
              {vmsDeEntorno(entornos, host.id).map(vm => (
                <EntornoCard
                  key={vm.id}
                  entorno={vm}
                  sugerencias={sugerencias}
                  anidado
                  onChange={c => patch(vm.id, c)}
                  onRemove={() => remove(vm.id)}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
