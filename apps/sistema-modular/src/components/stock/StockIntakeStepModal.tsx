import { useEffect, useRef, useState } from 'react';
import { Button } from '../ui/Button';
import type { CondicionUnidad, Presentacion, PresentacionUsada } from '@ags/shared';
import { cantidadEnUnidadBase } from '@ags/shared';
import type { UbicOption } from '../../hooks/useStockIntake';
import { matchesSearch } from '../../utils/searchTerms';

const CONDICIONES: CondicionUnidad[] = ['nuevo', 'bien_de_uso', 'reacondicionado', 'vendible', 'scrap'];
const CONDICION_LABELS: Record<CondicionUnidad, string> = {
  nuevo: 'Nuevo', bien_de_uso: 'Bien de uso', reacondicionado: 'Reacondicionado', vendible: 'Vendible', scrap: 'Scrap',
};

interface Draft {
  articulo: {
    codigo: string;
    descripcion: string;
    requiereNumeroSerie?: boolean;
    presentaciones?: Presentacion[] | null;
  };
  step: string;
  cantidad: number;
  /** Envase recibido; null = unidad base (Fase 2 presentaciones, 2026-08-13). */
  presentacion: PresentacionUsada | null;
  condicion: CondicionUnidad;
  series: string[];
  serieInput: string;
  lote: string;
  /** Patrón asociado al artículo; si viene, el renglón da de alta un LOTE de patrón. */
  patron?: { codigoArticulo: string; descripcion: string; unidadesPorUnidadDeCompra?: number | null; componentes?: unknown[] } | null;
  vencimiento?: string;
}

interface Props {
  draft: Draft;
  ubicOptions: UbicOption[];
  error: string;
  onPatch: (p: any) => void;
  onAdvance: (payload?: { ubic?: UbicOption }) => void;
  onCancel: () => void;
}

const STEP_TITLE: Record<string, string> = {
  cantidad: 'Cantidad', condicion: 'Condición', ubicacion: 'Ubicación', serie: 'Nº de serie', lote: 'Nº de lote',
};

export const StockIntakeStepModal: React.FC<Props> = ({ draft, ubicOptions, error, onPatch, onAdvance, onCancel }) => {
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);
  const ubicListRef = useRef<HTMLDivElement | null>(null);
  const [ubicSearch, setUbicSearch] = useState('');
  const [ubicHi, setUbicHi] = useState(0); // índice resaltado en la lista de ubicación

  // Auto-focus en cada paso / cada serie
  useEffect(() => {
    setUbicSearch('');
    setUbicHi(0);
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [draft.step, draft.series.length]);

  // Mantener visible la opción resaltada al navegar con el teclado.
  useEffect(() => {
    const el = ubicListRef.current?.children[ubicHi] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [ubicHi]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); onAdvance(); }
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
  };

  const stepNum = ['cantidad', 'condicion', 'ubicacion', 'serie', 'lote'].indexOf(draft.step) + 1;
  const lbl = 'block text-[10px] font-mono font-medium text-slate-500 mb-1 uppercase tracking-wide';
  const ctrl = 'w-full border border-[#E5E5E5] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-700';

  const filteredUbic = ubicOptions.filter(o => matchesSearch(ubicSearch, o.nombre));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30" onMouseDown={onCancel}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-4" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <p className="text-[10px] font-mono text-teal-700 uppercase tracking-widest">{STEP_TITLE[draft.step]}</p>
            <p className="text-xs text-slate-400 font-mono">{draft.articulo.codigo}</p>
          </div>
          <span className="text-[10px] text-slate-300 font-mono">{draft.step === 'serie' ? `serie ${draft.series.length + 1} de ${draft.cantidad}` : `paso ${stepNum}`}</span>
        </div>

        {draft.step === 'cantidad' && (() => {
          // Envase recibido (Fase 2 presentaciones, 2026-08-13): al pool entran
          // SIEMPRE unidades base, así que recibir 1 envase de 10 da de alta 10.
          // Con N° de serie no se ofrece: cada serie es una unidad física.
          const presentaciones = (draft.articulo.presentaciones ?? [])
            .filter(p => p.activo !== false && p.factor > 0);
          const mostrarEnvases = presentaciones.length > 0 && !draft.articulo.requiereNumeroSerie;
          const base = cantidadEnUnidadBase(draft.cantidad, draft.presentacion);
          return (
            <div className="space-y-3">
              {mostrarEnvases && (
                <div>
                  <label className={lbl}>Envase recibido</label>
                  <select
                    className={ctrl}
                    value={draft.presentacion?.codigoParte ?? ''}
                    onChange={e => {
                      const p = presentaciones.find(x => x.codigoParte === e.target.value);
                      onPatch({ presentacion: p ? { codigoParte: p.codigoParte, factor: p.factor } : null });
                    }}
                  >
                    <option value="">{draft.articulo.codigo} — unidad base (×1)</option>
                    {presentaciones.map(p => (
                      <option key={p.codigoParte} value={p.codigoParte}>
                        {p.codigoParte} — {p.descripcion || 'envase'} (×{p.factor})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className={lbl}>Cantidad {draft.presentacion ? '(envases)' : ''}</label>
                <input ref={inputRef as any} type="number" min={0} step="any" inputMode="decimal" className={ctrl} value={draft.cantidad}
                  onFocus={e => e.currentTarget.select()}
                  onChange={e => onPatch({ cantidad: Number(e.target.value.replace(',', '.')) || 0 })} onKeyDown={onKey} />
                {draft.presentacion && (
                  <p className="text-[11px] text-teal-700 mt-1">
                    Entran <span className="font-semibold">{base}</span> unidad(es) al stock de{' '}
                    <span className="font-mono">{draft.articulo.codigo}</span>
                  </p>
                )}
              </div>
            </div>
          );
        })()}

        {draft.step === 'condicion' && (
          <div>
            <label className={lbl}>Condición</label>
            <select ref={inputRef as any} className={ctrl} value={draft.condicion}
              onChange={e => onPatch({ condicion: e.target.value as CondicionUnidad })} onKeyDown={onKey}>
              {CONDICIONES.map(c => <option key={c} value={c}>{CONDICION_LABELS[c]}</option>)}
            </select>
          </div>
        )}

        {draft.step === 'ubicacion' && (
          <div>
            <label className={lbl}>Ubicación</label>
            <input ref={inputRef as any} className={ctrl + ' mb-2'} placeholder="Buscar ubicación..."
              value={ubicSearch}
              onChange={e => { setUbicSearch(e.target.value); setUbicHi(0); }}
              onKeyDown={e => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setUbicHi(i => Math.min(filteredUbic.length - 1, i + 1)); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setUbicHi(i => Math.max(0, i - 1)); }
                else if (e.key === 'Enter') { e.preventDefault(); const sel = filteredUbic[ubicHi]; if (sel) onAdvance({ ubic: sel }); }
                else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
              }} />
            <div ref={ubicListRef} className="border border-slate-200 rounded-md max-h-56 overflow-y-auto divide-y divide-slate-50">
              {filteredUbic.length === 0 && <p className="text-xs text-slate-400 px-3 py-3 text-center">Sin coincidencias</p>}
              {filteredUbic.map((o, idx) => (
                <button key={o.key} onClick={() => onAdvance({ ubic: o })}
                  onMouseEnter={() => setUbicHi(idx)}
                  className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between ${idx === ubicHi ? 'bg-teal-50' : 'hover:bg-teal-50'} ${o.historica ? 'text-slate-400' : 'text-slate-700'}`}>
                  <span>{o.nombre}{o.historica && <span className="ml-1 text-[10px] italic">· sugerido (sin stock actual)</span>}</span>
                  {o.count > 0 && <span className="text-[10px] font-semibold text-teal-700">{o.count} u.</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {draft.step === 'serie' && (
          <div>
            <label className={lbl}>Nº de serie ({draft.series.length + 1} de {draft.cantidad})</label>
            <input ref={inputRef as any} className={ctrl + ' font-mono'} value={draft.serieInput}
              onChange={e => onPatch({ serieInput: e.target.value })} onKeyDown={onKey} placeholder="Escaneá o tipeá y Enter" />
            {draft.series.length > 0 && <p className="mt-1.5 text-[10px] text-slate-400">Cargadas: {draft.series.join(', ')}</p>}
          </div>
        )}

        {draft.step === 'lote' && (
          <div className="space-y-3">
            <div>
              <label className={lbl}>Nº de lote</label>
              <input ref={inputRef as any} className={ctrl + ' font-mono'} value={draft.lote}
                onChange={e => onPatch({ lote: e.target.value })} onKeyDown={onKey} />
            </div>
            {/* Renglón que entra como patrón (2026-08-18): no va a stock, da de
                alta un lote del patrón. Se avisa acá —con la cuenta hecha— para
                que nadie descubra recién al confirmar que el kit valía 3. */}
            {draft.patron && (
              <>
                <div>
                  <label className={lbl}>Vencimiento del lote</label>
                  <input type="date" className={ctrl} value={draft.vencimiento ?? ''}
                    onChange={e => onPatch({ vencimiento: e.target.value })} />
                </div>
                <div className="bg-teal-50/70 border border-teal-200 rounded-lg px-3 py-2">
                  <p className="text-[11px] text-teal-900 font-medium">
                    Entra como patrón · {draft.patron.codigoArticulo}
                  </p>
                  <p className="text-[10px] text-teal-800/90 mt-0.5">{draft.patron.descripcion}</p>
                  <p className="text-[10px] text-teal-800/90 mt-1">
                    {(draft.patron.componentes?.length ?? 0) > 0
                      ? 'El kit se desglosa por su BOM al consumirse.'
                      : `${cantidadEnUnidadBase(draft.cantidad, draft.presentacion)} × ${draft.patron.unidadesPorUnidadDeCompra ?? 1} = ${cantidadEnUnidadBase(draft.cantidad, draft.presentacion) * (draft.patron.unidadesPorUnidadDeCompra ?? 1)} unidad(es) de patrón`}
                  </p>
                  <p className="text-[10px] text-teal-700/70 mt-1">No se da de alta stock del artículo.</p>
                </div>
              </>
            )}
          </div>
        )}

        {error && <p className="mt-2 text-[11px] text-red-600">{error}</p>}

        <div className="flex justify-between items-center mt-4">
          <button onClick={onCancel} className="text-[11px] text-slate-400 hover:text-slate-600">Cancelar (Esc)</button>
          {draft.step !== 'ubicacion' && (
            <Button size="sm" onClick={() => onAdvance()}>Siguiente (Enter ↵)</Button>
          )}
        </div>
      </div>
    </div>
  );
};
