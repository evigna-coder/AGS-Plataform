import { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';
import type { useMovimientoLoteForm } from '../../hooks/useMovimientoLoteForm';

const lbl = 'block text-[11px] font-medium text-slate-500 mb-1';

/** Editor de la línea en curso (artículo → cantidad/unidades) + lista de líneas agregadas. */
export const MovimientoLoteLineas: React.FC<{ h: ReturnType<typeof useMovimientoLoteForm> }> = ({ h }) => {
  const [err, setErr] = useState<string | null>(null);
  const disabled = !h.origen;

  const onAdd = () => setErr(h.addLinea());

  return (
    <div className="space-y-3">
      <label className={lbl}>Artículos del movimiento</label>

      {/* Draft: primero el artículo, después cantidad/unidades */}
      <div className="rounded-lg border border-slate-200 p-3 space-y-2 bg-slate-50/40">
        <SearchableSelect
          value={h.draftArticuloId}
          onChange={v => { h.setDraftArticuloId(v); setErr(null); }}
          options={h.articulos.filter(a => !h.yaEnLineas.has(a.id)).map(a => ({ value: a.id, label: `${a.codigo} — ${a.descripcion}` }))}
          disabled={disabled}
          placeholder={disabled ? 'Primero elegí el origen' : 'Buscar artículo por código o descripción...'}
        />

        {h.draftArticuloId && (
          h.draftRequiereSerie ? (
            <div>
              <p className="text-[10px] text-slate-500 mb-1">
                Unidades (n° de serie) — {h.draftUnidadIds.length} seleccionada{h.draftUnidadIds.length !== 1 ? 's' : ''}
              </p>
              {h.draftUnidades.length === 0 ? (
                <p className="text-[11px] text-slate-400">Sin stock de este artículo en el origen elegido.</p>
              ) : (
                <div className="border border-slate-200 rounded max-h-36 overflow-y-auto bg-white">
                  {h.draftUnidades.map(u => {
                    const checked = h.draftUnidadIds.includes(u.id);
                    return (
                      <label key={u.id} className={`flex items-center gap-2 px-2.5 py-1.5 text-xs cursor-pointer hover:bg-slate-50 border-b border-slate-50 last:border-0 ${checked ? 'bg-teal-50/60' : ''}`}>
                        <input type="checkbox" checked={checked} onChange={() => h.toggleDraftUnidad(u.id)} className="w-3.5 h-3.5 accent-teal-600" />
                        <span className="font-mono text-slate-700 flex-1">{u.nroSerie ? `S/N: ${u.nroSerie}` : u.nroLote ? `Lote: ${u.nroLote}` : '(sin S/N ni lote)'}</span>
                        <span className="text-[10px] text-slate-400 capitalize">{u.condicion.replace('_', ' ')}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <div className="w-28">
                <label className={lbl}>Cantidad</label>
                <Input inputSize="sm" type="number" value={String(h.draftCantidad)}
                  onFocus={e => e.currentTarget.select()}
                  onChange={e => h.setDraftCantidad(Number(e.target.value) || 0)} />
              </div>
              <span className="text-[11px] text-slate-400 pb-2">{h.draftStock} disponible{h.draftStock !== 1 ? 's' : ''} en el origen</span>
            </div>
          )
        )}

        <div className="flex items-center justify-between">
          {err ? <p className="text-[11px] text-red-600">{err}</p> : <span />}
          <Button size="sm" variant="outline" onClick={onAdd} disabled={disabled || !h.draftArticuloId}>+ Agregar artículo</Button>
        </div>
      </div>

      {/* Líneas agregadas */}
      {h.lineas.length > 0 && (
        <div className="border border-slate-200 rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-wider">
                <th className="text-left px-2 py-1.5">Código</th>
                <th className="text-left px-2 py-1.5">Descripción</th>
                <th className="text-right px-2 py-1.5 w-14">Cant.</th>
                <th className="text-left px-2 py-1.5">Unidades</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {h.lineas.map(l => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-2 py-1.5 font-mono text-teal-700 font-semibold">{l.articuloCodigo}</td>
                  <td className="px-2 py-1.5 text-slate-700 truncate max-w-[180px]">{l.articuloDescripcion}</td>
                  <td className="px-2 py-1.5 text-right font-semibold">{l.cantidad}</td>
                  <td className="px-2 py-1.5 text-slate-400 font-mono truncate max-w-[140px]">{l.detalleUnidades}</td>
                  <td className="px-2 py-1.5 text-center">
                    <button onClick={() => h.removeLinea(l.id)} className="text-slate-300 hover:text-red-500 text-sm leading-none">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
