import type { Articulo, ItemImportacion } from '@ags/shared';
import { SearchableSelect } from '../ui/SearchableSelect';

export interface IngresoItemState {
  verificado: boolean;
  posicionId: string;
  posicionNombre: string;
  cantidadReal: number;
  serialesText: string;
  nroLote: string;
}

/** Series no vacías cargadas (una por línea). */
export function seriesDe(state: IngresoItemState): string[] {
  return state.serialesText.split('\n').map(l => l.trim()).filter(Boolean);
}

/** ¿La fila está lista para confirmar? (verificada + posición + cantidad + series/lote requeridos). */
export function rowValido(articulo: Articulo | null, state: IngresoItemState): boolean {
  if (!state.verificado) return false;
  if (!state.posicionId) return false;
  if (state.cantidadReal <= 0) return false;
  if (articulo?.requiereNumeroSerie && seriesDe(state).length !== state.cantidadReal) return false;
  if (articulo?.requiereNumeroLote && !state.nroLote.trim()) return false;
  return true;
}

const labelClass = 'block text-[10px] font-medium uppercase tracking-wider text-slate-400 font-mono mb-1';
const inputClass = 'w-full border border-slate-200 rounded px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500';

interface Props {
  item: ItemImportacion;
  articulo: Articulo | null;
  state: IngresoItemState;
  posicionOptions: { value: string; label: string }[];
  onChange: (patch: Partial<IngresoItemState>) => void;
  onPosicion: (posicionId: string) => void;
}

export const IngresarStockItemRow: React.FC<Props> = ({ item, articulo, state, posicionOptions, onChange, onPosicion }) => {
  const requiereSerie = !!articulo?.requiereNumeroSerie;
  const requiereLote = !!articulo?.requiereNumeroLote;
  const seriesCount = seriesDe(state).length;
  const seriesOk = !requiereSerie || seriesCount === state.cantidadReal;
  const cantMismatch = state.cantidadReal !== item.cantidadPedida;
  const valido = rowValido(articulo, state);

  return (
    <div className={`border rounded-lg p-4 transition-colors ${state.verificado ? (valido ? 'border-teal-300 bg-teal-50/40' : 'border-amber-300 bg-amber-50/40') : 'border-slate-200 bg-slate-50'}`}>
      <div className="flex items-start gap-3 mb-3">
        <input type="checkbox" checked={state.verificado} onChange={e => onChange({ verificado: e.target.checked })}
          className="mt-0.5 w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-800">{item.descripcion}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {item.articuloCodigo && <span className="text-[11px] text-slate-400 font-mono">{item.articuloCodigo}</span>}
            {requiereSerie && <span className="text-[10px] px-1 py-0.5 rounded bg-sky-100 text-sky-700">serie</span>}
            {requiereLote && <span className="text-[10px] px-1 py-0.5 rounded bg-violet-100 text-violet-700">lote</span>}
          </div>
        </div>
        <span className="text-[10px] text-slate-400 font-mono shrink-0">Pedido: {item.cantidadPedida} {item.unidadMedida}</span>
      </div>

      <div className={`grid ${requiereLote ? 'grid-cols-4' : 'grid-cols-3'} gap-3`}>
        <div>
          <label className={labelClass}>Cantidad recibida</label>
          <input type="number" min={0} value={state.cantidadReal}
            onChange={e => { const n = parseInt(e.target.value, 10); onChange({ cantidadReal: isNaN(n) || n < 0 ? 0 : n }); }}
            className={`${inputClass} ${cantMismatch ? 'border-amber-400' : ''}`} />
          {cantMismatch && <p className="text-[10px] text-amber-600 mt-0.5">≠ pedido ({item.cantidadPedida})</p>}
        </div>
        <div>
          <label className={labelClass}>Posición destino</label>
          <SearchableSelect value={state.posicionId} onChange={onPosicion} options={posicionOptions} placeholder="Seleccionar..." />
          {!state.posicionId && <p className="text-[10px] text-slate-400 mt-0.5">requerida</p>}
        </div>
        {requiereLote && (
          <div>
            <label className={labelClass}>N° de lote</label>
            <input value={state.nroLote} onChange={e => onChange({ nroLote: e.target.value })} className={inputClass} placeholder="Lote" />
          </div>
        )}
        <div>
          <label className={labelClass}>
            N° de serie {requiereSerie ? <span className={seriesOk ? 'text-teal-600' : 'text-amber-600'}>({seriesCount}/{state.cantidadReal})</span> : '(opcional)'}
          </label>
          <textarea value={state.serialesText} onChange={e => onChange({ serialesText: e.target.value })} rows={2}
            placeholder={requiereSerie ? 'Uno por línea (obligatorio)' : 'Opcional — uno por línea'}
            className={`${inputClass} resize-none ${requiereSerie && !seriesOk ? 'border-amber-400' : ''}`} />
        </div>
      </div>
    </div>
  );
};
