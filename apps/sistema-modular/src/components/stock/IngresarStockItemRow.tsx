import { useState } from 'react';
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
  // Con recepciones parciales (I3), la referencia es lo PENDIENTE (pedido − acumulado).
  const yaRecibido = item.cantidadRecibida ?? 0;
  const pendiente = Math.max(0, item.cantidadPedida - yaRecibido);
  const cantMismatch = state.cantidadReal !== pendiente;
  const valido = rowValido(articulo, state);

  // El bloque de series ocupa el doble que la fila entera. Se despliega cuando el
  // articulo lo exige o cuando alguien quiere cargarlas igual — para el resto de
  // los renglones, que son la mayoria, no ocupa nada (2026-08-20).
  const [serieAbierta, setSerieAbierta] = useState(false);
  const mostrarSeries = requiereSerie || serieAbierta || !!state.serialesText;

  return (
    <div className={`border-b last:border-b-0 border-slate-100 px-2 py-1.5 transition-colors ${state.verificado ? (valido ? 'bg-teal-50/40' : 'bg-amber-50/40') : ''}`}>
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={state.verificado} onChange={e => onChange({ verificado: e.target.checked })}
          className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 shrink-0" />

        {/* Articulo: descripcion y codigo sin card ni titulos de campo. */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-800 truncate" title={item.descripcion}>{item.descripcion}</p>
          <div className="flex items-center gap-1.5">
            {item.articuloCodigo && <span className="text-[10px] text-slate-400 font-mono">{item.articuloCodigo}</span>}
            {requiereSerie && <span className="text-[9px] px-1 rounded bg-sky-100 text-sky-700">serie</span>}
            {requiereLote && <span className="text-[9px] px-1 rounded bg-violet-100 text-violet-700">lote</span>}
            <span className="text-[10px] text-slate-400 font-mono">
              {yaRecibido > 0 ? `pend. ${pendiente}` : `ped. ${item.cantidadPedida}`} {item.unidadMedida}
            </span>
          </div>
        </div>

        <div className="w-16 shrink-0">
          <input type="number" min={0} value={state.cantidadReal} aria-label="Cantidad recibida"
            onChange={e => { const n = parseInt(e.target.value, 10); onChange({ cantidadReal: isNaN(n) || n < 0 ? 0 : n }); }}
            className={`${inputClass} text-center ${cantMismatch ? 'border-amber-400' : ''}`} />
        </div>

        <div className="w-52 shrink-0">
          <SearchableSelect value={state.posicionId} onChange={onPosicion} options={posicionOptions}
            placeholder="Posicion..." size="sm" />
        </div>

        {requiereLote && (
          <div className="w-28 shrink-0">
            <input value={state.nroLote} onChange={e => onChange({ nroLote: e.target.value })}
              className={inputClass} placeholder="Lote" aria-label="N de lote" />
          </div>
        )}

        {!requiereSerie && (
          <button type="button" onClick={() => setSerieAbierta(v => !v)}
            className="text-[10px] text-slate-400 hover:text-teal-600 shrink-0 w-14 text-right"
            title="Cargar numeros de serie (opcional)">
            {mostrarSeries ? 'ocultar' : '+ serie'}
          </button>
        )}
      </div>

      {mostrarSeries && (
        <div className="mt-1.5 pl-6">
          <label className={labelClass}>
            N° de serie {requiereSerie ? <span className={seriesOk ? 'text-teal-600' : 'text-amber-600'}>({seriesCount}/{state.cantidadReal})</span> : '(opcional)'}
          </label>
          <textarea value={state.serialesText} onChange={e => onChange({ serialesText: e.target.value })} rows={2}
            placeholder={requiereSerie ? 'Uno por línea (obligatorio)' : 'Opcional — uno por línea'}
            className={`${inputClass} resize-none ${requiereSerie && !seriesOk ? 'border-amber-400' : ''}`} />
        </div>
      )}

      {/* Los avisos van abajo y solo cuando hay algo que avisar: antes cada fila
          reservaba el lugar del error aunque estuviera bien. */}
      {(cantMismatch || (state.verificado && !state.posicionId)) && (
        <p className="text-[10px] text-amber-600 mt-0.5 pl-6">
          {cantMismatch && <>Cantidad ≠ {yaRecibido > 0 ? 'pendiente' : 'pedido'} ({pendiente}). </>}
          {state.verificado && !state.posicionId && <>Falta la posición destino.</>}
        </p>
      )}
    </div>
  );
};
