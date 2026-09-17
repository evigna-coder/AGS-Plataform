import { useState, useEffect } from 'react';
import type { Articulo, ItemImportacion, PresentacionUsada } from '@ags/shared';
import { SearchableSelect } from '../ui/SearchableSelect';
import { parseDecimal } from '../../utils/parseDecimal';
import { factorDeItem, pendienteBaseDeItem } from '../../utils/importacionRecepcion';

export interface IngresoItemState {
  verificado: boolean;
  posicionId: string;
  posicionNombre: string;
  /** Cantidad recibida EN LA PRESENTACIÓN elegida (`presentacion`); null = unidad base. */
  cantidadReal: number;
  /** Envase con el que se recibe (2026-09-16): puede diferir del de la OC. */
  presentacion: PresentacionUsada | null;
  serialesText: string;
  nroLote: string;
}

const BASE = '__base__';

/** Series no vacías cargadas (una por línea). */
export function seriesDe(state: IngresoItemState): string[] {
  return state.serialesText.split('\n').map(l => l.trim()).filter(Boolean);
}

/** Unidades BASE que entran al stock con este renglón (cantidad × factor del envase recibido). */
export function unidadesBaseDeState(state: Pick<IngresoItemState, 'cantidadReal' | 'presentacion'>): number {
  const f = state.presentacion?.factor && state.presentacion.factor > 0 ? state.presentacion.factor : 1;
  return state.cantidadReal * f;
}

/** ¿La fila está lista para confirmar? (verificada + posición + cantidad + series/lote requeridos). */
export function rowValido(articulo: Articulo | null, state: IngresoItemState): boolean {
  if (!state.verificado) return false;
  if (!state.posicionId) return false;
  if (state.cantidadReal <= 0) return false;
  if (articulo?.requiereNumeroSerie && seriesDe(state).length !== unidadesBaseDeState(state)) return false;
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
  const unidadesBase = unidadesBaseDeState(state);
  const seriesOk = !requiereSerie || seriesCount === unidadesBase;
  // Con recepciones parciales (I3), la referencia es lo PENDIENTE (pedido − acumulado),
  // comparado en unidades BASE porque el envase recibido puede no ser el de la OC.
  const yaRecibido = item.cantidadRecibida ?? 0;
  const pendienteOC = Math.max(0, item.cantidadPedida - yaRecibido);
  const pendienteBase = pendienteBaseDeItem(item);
  // OC sin envase y cantidad tipeada = pedido en envases (2026-09-17): la OC se
  // toma en ese envase (ver interpretarEnvaseOC en useIngresarStock).
  const ocEnEnvase = !item.presentacion && !!state.presentacion && state.presentacion.factor > 1
    && Math.abs(state.cantidadReal - pendienteOC) < 1e-6 && Math.abs(unidadesBase - pendienteBase) > 1e-6;
  const cantMismatch = !ocEnEnvase && Math.abs(unidadesBase - pendienteBase) > 1e-6;
  const valido = rowValido(articulo, state);

  // Envases con los que se puede recibir (2026-09-16): las presentaciones
  // activas del artículo + la unidad base. Con N° de serie no aplica (cada
  // serie es una unidad física). El default es el envase de la OC.
  const presentacionesArt = (articulo?.presentaciones ?? []).filter(p => p.activo !== false && p.factor > 0 && p.codigoParte);
  const conEnvases = !requiereSerie && (presentacionesArt.length > 0 || !!item.presentacion);
  const opcionesEnvase = [
    { value: BASE, label: `Unidad base (${item.unidadMedida || 'u'}) ×1` },
    ...presentacionesArt.map(p => ({ value: p.codigoParte, label: `${p.codigoParte} ×${p.factor}${p.descripcion ? ` — ${p.descripcion}` : ''}` })),
    ...(item.presentacion && !presentacionesArt.some(p => p.codigoParte === item.presentacion!.codigoParte)
      ? [{ value: item.presentacion.codigoParte, label: `${item.presentacion.codigoParte} ×${item.presentacion.factor} (OC)` }]
      : []),
  ];
  const elegirEnvase = (v: string) => {
    const p = v === BASE ? null
      : presentacionesArt.find(x => x.codigoParte === v) ?? (item.presentacion?.codigoParte === v ? item.presentacion : null);
    const nueva: PresentacionUsada | null = p ? { codigoParte: p.codigoParte, factor: p.factor } : null;
    // Se conserva lo pendiente en unidades base: cambia el envase, cambia la cantidad tipeada.
    const f = nueva?.factor ?? 1;
    onChange({ presentacion: nueva, cantidadReal: Math.round((pendienteBase / f) * 1000) / 1000 });
  };

  // El bloque de series ocupa el doble que la fila entera. Se despliega cuando el
  // articulo lo exige o cuando alguien quiere cargarlas igual — para el resto de
  // los renglones, que son la mayoria, no ocupa nada (2026-08-20).
  const [serieAbierta, setSerieAbierta] = useState(false);
  const mostrarSeries = requiereSerie || serieAbierta || !!state.serialesText;
  // Cantidad como texto (2026-09-04): `parseInt` truncaba 0,5 → 0 y el
  // type=number rechazaba la coma. Los reactivos de minikit vienen en litros.
  const [cantidadStr, setCantidadStr] = useState(String(state.cantidadReal));
  useEffect(() => {
    setCantidadStr(prev => parseDecimal(prev) === state.cantidadReal ? prev : String(state.cantidadReal));
  }, [state.cantidadReal]);

  const factorItem = factorDeItem(item);
  const pedidoTxt = item.presentacion
    ? `${yaRecibido > 0 ? `pend. ${pendienteOC}` : `ped. ${item.cantidadPedida}`} × ${item.presentacion.codigoParte} (×${factorItem}) = ${pendienteBase} ${item.unidadMedida}`
    : `${yaRecibido > 0 ? `pend. ${pendienteOC}` : `ped. ${item.cantidadPedida}`} ${item.unidadMedida}`;

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
            <span className="text-[10px] text-slate-400 font-mono">{pedidoTxt}</span>
          </div>
        </div>

        <div className="w-16 shrink-0">
          <input type="text" inputMode="decimal" value={cantidadStr} aria-label="Cantidad recibida"
            onFocus={e => e.currentTarget.select()}
            onChange={e => { setCantidadStr(e.target.value); const n = parseDecimal(e.target.value); onChange({ cantidadReal: n < 0 ? 0 : n }); }}
            className={`${inputClass} text-center ${cantMismatch ? 'border-amber-400' : ''}`} />
        </div>

        {conEnvases && (
          <div className="w-44 shrink-0">
            <SearchableSelect value={state.presentacion?.codigoParte ?? BASE} onChange={elegirEnvase} options={opcionesEnvase}
              placeholder="Envase..." size="sm" />
          </div>
        )}

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
            N° de serie {requiereSerie ? <span className={seriesOk ? 'text-teal-600' : 'text-amber-600'}>({seriesCount}/{unidadesBase})</span> : '(opcional)'}
          </label>
          <textarea value={state.serialesText} onChange={e => onChange({ serialesText: e.target.value })} rows={2}
            placeholder={requiereSerie ? 'Uno por línea (obligatorio)' : 'Opcional — uno por línea'}
            className={`${inputClass} resize-none ${requiereSerie && !seriesOk ? 'border-amber-400' : ''}`} />
        </div>
      )}

      {/* Los avisos van abajo y solo cuando hay algo que avisar: antes cada fila
          reservaba el lugar del error aunque estuviera bien. */}
      {(state.presentacion || cantMismatch || (state.verificado && !state.posicionId)) && (
        <p className={`text-[10px] mt-0.5 pl-6 ${cantMismatch || (state.verificado && !state.posicionId) ? 'text-amber-600' : 'text-slate-400'}`}>
          {state.presentacion && <>{state.cantidadReal} × {state.presentacion.codigoParte} (×{state.presentacion.factor}) = <span className="font-mono">{unidadesBase}</span> {item.unidadMedida} al stock. </>}
          {ocEnEnvase && <>La OC se toma en este envase: precio por envase ÷ {state.presentacion!.factor}. </>}
          {cantMismatch && <>≠ {yaRecibido > 0 ? 'pendiente' : 'pedido'} ({pendienteBase} {item.unidadMedida}). </>}
          {state.verificado && !state.posicionId && <>Falta la posición destino.</>}
        </p>
      )}
    </div>
  );
};
