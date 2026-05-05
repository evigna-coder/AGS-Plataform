import { useEffect, useMemo, useState } from 'react';
import { SearchableSelect } from '../ui/SearchableSelect';
import { articulosService } from '../../services/stockService';
import type { Articulo, FichaPropiedad, ItemFicha } from '@ags/shared';

export interface ParteInput {
  /** ID local — solo para keys de React, no se persiste. */
  tempId: string;
  articuloId: string | null;
  articuloCodigo: string | null;
  descripcion: string;
  serie: string | null;
}

export interface ElegibleItem {
  ficha: FichaPropiedad;
  item: ItemFicha;
  /** Identificador único combinando ficha+item (para el set de selección). */
  key: string;
}

export type ItemMode = 'completo' | 'partes';

interface Props {
  /** Items que pueden incluirse en el remito (de la ficha actual + otras fichas activas del mismo cliente). */
  elegibles: ElegibleItem[];
  /** Si solo se permite "completo" (modo devolución al cliente). */
  onlyCompleto?: boolean;
  selectedKeys: Set<string>;
  onToggleItem: (key: string) => void;
  modeByKey: Map<string, ItemMode>;
  onChangeMode: (key: string, mode: ItemMode) => void;
  partesByKey: Map<string, ParteInput[]>;
  onChangePartes: (key: string, partes: ParteInput[]) => void;
  /** ID de la ficha "principal" — los items de otras fichas se etiquetan con su número. */
  currentFichaId: string;
}

function emptyParte(): ParteInput {
  return {
    tempId: crypto.randomUUID(),
    articuloId: null,
    articuloCodigo: null,
    descripcion: '',
    serie: null,
  };
}

export function RemitoItemPicker({
  elegibles, onlyCompleto, selectedKeys, onToggleItem, modeByKey, onChangeMode,
  partesByKey, onChangePartes, currentFichaId,
}: Props) {
  const [articulos, setArticulos] = useState<Articulo[]>([]);

  useEffect(() => {
    if (onlyCompleto) return; // no necesitamos catalogo si no hay partes
    void articulosService.getAll({ activoOnly: true }).then(setArticulos);
  }, [onlyCompleto]);

  const articuloOptions = useMemo(
    () => articulos.map(a => ({ value: a.id, label: `${a.codigo} — ${a.descripcion}` })),
    [articulos],
  );

  const updateParte = (key: string, tempId: string, patch: Partial<ParteInput>) => {
    const list = partesByKey.get(key) ?? [];
    onChangePartes(key, list.map(p => p.tempId === tempId ? { ...p, ...patch } : p));
  };

  const addParte = (key: string) => {
    const list = partesByKey.get(key) ?? [];
    onChangePartes(key, [...list, emptyParte()]);
  };

  const removeParte = (key: string, tempId: string) => {
    const list = partesByKey.get(key) ?? [];
    onChangePartes(key, list.filter(p => p.tempId !== tempId));
  };

  const handleArticuloPick = (key: string, tempId: string, articuloId: string) => {
    const art = articulos.find(a => a.id === articuloId);
    const current = (partesByKey.get(key) ?? []).find(p => p.tempId === tempId);
    if (!art) {
      updateParte(key, tempId, { articuloId: null, articuloCodigo: null });
      return;
    }
    updateParte(key, tempId, {
      articuloId: art.id,
      articuloCodigo: art.codigo,
      // solo completamos descripción si el usuario aún no la tocó
      descripcion: current?.descripcion?.trim() ? current.descripcion : art.descripcion,
    });
  };

  if (elegibles.length === 0) {
    return <p className="text-xs text-slate-400 px-3 py-2">No hay items elegibles del cliente.</p>;
  }

  return (
    <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
      {elegibles.map(({ ficha: f, item, key }) => {
        const selected = selectedKeys.has(key);
        const mode = modeByKey.get(key) ?? 'completo';
        const partes = partesByKey.get(key) ?? [];
        const showPartes = selected && !onlyCompleto && mode === 'partes';

        return (
          <div key={key} className={`px-3 py-2 ${selected ? 'bg-teal-50/30' : ''}`}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={selected} onChange={() => onToggleItem(key)} />
              <div className="flex-1 min-w-0 text-sm">
                <span className="font-mono text-teal-700">{item.subId}</span>
                <span className="text-slate-500"> · {item.articuloDescripcion || item.descripcionLibre || 'Item'}</span>
                {item.serie && <span className="text-slate-400 font-mono"> · S/N {item.serie}</span>}
                {f.id !== currentFichaId && (
                  <span className="text-[10px] text-slate-400 ml-2">(otra ficha: {f.numero})</span>
                )}
              </div>
              {selected && !onlyCompleto && (
                <div className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wide">
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); onChangeMode(key, 'completo'); }}
                    className={`px-2 py-0.5 rounded ${mode === 'completo' ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  >
                    Completo
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); onChangeMode(key, 'partes'); }}
                    className={`px-2 py-0.5 rounded ${mode === 'partes' ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  >
                    Por partes
                  </button>
                </div>
              )}
            </label>

            {showPartes && (
              <div className="mt-2 ml-6 space-y-1.5">
                {partes.length === 0 && (
                  <p className="text-[11px] text-amber-700">Agregá al menos una parte.</p>
                )}
                {partes.map(p => (
                  <div key={p.tempId} className="grid grid-cols-[1.4fr_1.6fr_0.8fr_auto] gap-1.5 items-start">
                    <SearchableSelect
                      value={p.articuloId ?? ''}
                      onChange={(v) => handleArticuloPick(key, p.tempId, v)}
                      options={articuloOptions}
                      placeholder="Catálogo (opcional)"
                      size="sm"
                    />
                    <input
                      type="text"
                      value={p.descripcion}
                      onChange={(e) => updateParte(key, p.tempId, { descripcion: e.target.value })}
                      placeholder="Descripción de la parte *"
                      className="border border-slate-300 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-teal-700"
                    />
                    <input
                      type="text"
                      value={p.serie ?? ''}
                      onChange={(e) => updateParte(key, p.tempId, { serie: e.target.value || null })}
                      placeholder="N° serie"
                      className="border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-700"
                    />
                    <button
                      type="button"
                      onClick={() => removeParte(key, p.tempId)}
                      className="text-red-400 hover:text-red-600 text-base leading-none px-1 self-center"
                      title="Quitar parte"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addParte(key)}
                  className="text-[11px] text-teal-700 hover:underline"
                >
                  + Agregar parte
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
