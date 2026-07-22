import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';
import type { SearchableSelectOption } from '../ui/SearchableSelect';
import type { ItemFichaDraft } from './useFichaItemOptions';

interface Props {
  idx: number;
  draft: ItemFichaDraft;
  options: SearchableSelectOption[];
  /** Equipos (sistemas) del cliente — acotan los módulos 🔧 del selector de artículo. */
  equipoOptions: SearchableSelectOption[];
  onEquipo: (idx: number, value: string) => void;
  /** Selección del combo unificado (mod:/art:/cat:/texto libre). */
  onSeleccion: (idx: number, value: string) => void;
  onField: <K extends keyof ItemFichaDraft>(idx: number, k: K, v: ItemFichaDraft[K]) => void;
  onRemove?: (idx: number) => void;
  errorId?: string;
  errorProblema?: string;
  problemaRequired?: boolean;
  /** En el modal de edición, marca "(nuevo)" los items que todavía no existen en la ficha. */
  markNew?: boolean;
}

/**
 * Campos de UN item dentro de Create/EditFichaModal. El selector unificado
 * ofrece módulos del cliente, stock y catálogo (prefijos 🔧/📦/📇 en el label)
 * y admite texto libre (creatable) que se materializa en "Descripción libre".
 */
export function FichaItemDraftFields({
  idx, draft, options, equipoOptions, onEquipo, onSeleccion, onField, onRemove,
  errorId, errorProblema, problemaRequired, markNew,
}: Props) {
  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-mono uppercase tracking-wide text-slate-500">
          Item #{idx + 1}{markNew && !draft.existingId ? ' (nuevo)' : ''}
        </p>
        {onRemove && (
          <button onClick={() => onRemove(idx)} className="text-[11px] text-red-500 hover:text-red-700">Eliminar</button>
        )}
      </div>
      <div className="space-y-2">
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">
            Equipo (opcional) — acota los módulos del cliente
          </label>
          <SearchableSelect
            value={draft.sistemaId}
            onChange={v => onEquipo(idx, v)}
            options={equipoOptions}
            placeholder="Todos los equipos del cliente"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">
            Artículo — módulos del cliente / stock / catálogo
          </label>
          <SearchableSelect
            value={draft.seleccion}
            onChange={v => onSeleccion(idx, v)}
            options={options}
            placeholder="Buscar módulo, código o descripción…"
            creatable
            createLabel="Usar texto libre"
          />
          {draft.articuloCodigo && !draft.articuloId && !draft.moduloId && (
            <p className="text-[10px] text-slate-400 mt-0.5 font-mono">Código: {draft.articuloCodigo}</p>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Input
            label="Descripción libre (si no está en catálogo)"
            value={draft.descripcionLibre}
            onChange={e => onField(idx, 'descripcionLibre', e.target.value)}
            placeholder="Ej: Bomba cuaternaria G1311A"
          />
          <Input
            label="N° de serie"
            value={draft.serie}
            onChange={e => onField(idx, 'serie', e.target.value)}
          />
        </div>
        {errorId && <p className="text-[10px] text-red-500">{errorId}</p>}
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">
            Problema reportado{problemaRequired ? ' *' : ''}
          </label>
          <textarea
            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs min-h-[50px]"
            value={draft.descripcionProblema}
            onChange={e => onField(idx, 'descripcionProblema', e.target.value)}
            placeholder="Falla observada en este item"
          />
          {errorProblema && <p className="text-[10px] text-red-500 mt-0.5">{errorProblema}</p>}
        </div>
      </div>
    </div>
  );
}
