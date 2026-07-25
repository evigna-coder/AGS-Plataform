import { useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';
import type { useMovimientoLoteForm } from '../../hooks/useMovimientoLoteForm';

const lbl = 'block text-[11px] font-medium text-slate-500 mb-1';

/**
 * Editor de la línea en curso — orden: artículo → depósito de origen (solo los que tienen
 * stock de ese artículo) → cantidad/unidades. Más la lista de líneas agregadas.
 */
export const MovimientoLoteLineas: React.FC<{ h: ReturnType<typeof useMovimientoLoteForm> }> = ({ h }) => {
  const [err, setErr] = useState<string | null>(null);
  const onAdd = () => setErr(h.addLinea());

  // Memoizado: evita recrear el array de opciones en cada render (identidad estable para el SearchableSelect).
  const articuloOptions = useMemo(
    () => h.articulos.map(a => ({ value: a.id, label: `${a.codigo} — ${a.descripcion}` })),
    [h.articulos],
  );

  return (
    <div className="space-y-3">
      <label className={lbl}>Artículos del movimiento</label>

      <div className="rounded-lg border border-slate-200 p-3 space-y-2 bg-slate-50/40">
        {/* 1. Artículo */}
        <SearchableSelect
          value={h.draftArticuloId}
          onChange={v => { h.setDraftArticuloId(v); setErr(null); }}
          options={articuloOptions}
          placeholder="Buscar artículo por código o descripción..."
        />

        {/* 2. Depósito de origen (solo los que tienen stock del artículo) */}
        {h.draftArticuloId && (
          h.draftOrigenOptions.length === 0 ? (
            <p className="text-[11px] text-amber-600">Este artículo no tiene stock disponible en ningún depósito.</p>
          ) : (
            <div>
              <label className={lbl}>Depósito de origen</label>
              <SearchableSelect
                value={h.draftOrigenKey}
                onChange={v => { h.setDraftOrigenKey(v); setErr(null); }}
                options={h.draftOrigenOptions.map(o => ({ value: o.key, label: `${o.nombre} — ${o.count} u.` }))}
                placeholder="¿De qué depósito sale?"
              />
            </div>
          )
        )}

        {/* 3. Cantidad / unidades */}
        {h.draftArticuloId && h.draftOrigenKey && (
          h.draftRequiereSerie ? (
            <div>
              <p className="text-[10px] text-slate-500 mb-1">
                Unidades (n° de serie) — {h.draftUnidadIds.length} seleccionada{h.draftUnidadIds.length !== 1 ? 's' : ''}
              </p>
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
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <div className="w-28">
                <label className={lbl}>Cantidad</label>
                <Input inputSize="sm" type="number" value={String(h.draftCantidad)}
                  onFocus={e => e.currentTarget.select()}
                  onChange={e => h.setDraftCantidad(Number(e.target.value) || 0)} />
              </div>
              <span className="text-[11px] text-slate-400 pb-2">{h.draftStock} disponible{h.draftStock !== 1 ? 's' : ''} en el depósito</span>
            </div>
          )
        )}

        <div className="flex items-center justify-between">
          {err ? <p className="text-[11px] text-red-600">{err}</p> : <span />}
          <Button size="sm" variant="outline" onClick={onAdd} disabled={!h.draftArticuloId || !h.draftOrigenKey}>+ Agregar artículo</Button>
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
                <th className="text-left px-2 py-1.5">Origen</th>
                <th className="text-right px-2 py-1.5 w-14">Cant.</th>
                <th className="text-left px-2 py-1.5">Unidades</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {h.lineas.map(l => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-2 py-1.5 font-mono text-teal-700 font-semibold">{l.articuloCodigo}</td>
                  <td className="px-2 py-1.5 text-slate-700 truncate max-w-[160px]">{l.articuloDescripcion}</td>
                  <td className="px-2 py-1.5 text-slate-500 truncate max-w-[140px]">{l.origenNombre}</td>
                  <td className="px-2 py-1.5 text-right font-semibold">{l.cantidad}</td>
                  <td className="px-2 py-1.5 text-slate-400 font-mono truncate max-w-[120px]">{l.detalleUnidades}</td>
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
