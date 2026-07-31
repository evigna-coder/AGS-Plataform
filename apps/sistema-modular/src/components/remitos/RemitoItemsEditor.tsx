import { useMemo } from 'react';
import type { RemitoItem, UnidadStock } from '@ags/shared';
import { SearchableSelect } from '../ui/SearchableSelect';

interface Props {
  items: RemitoItem[];
  unidades: UnidadStock[];
  maxCantidad: Record<string, number>;
  onAdd: (unidadId: string) => void;
  onAddManual: () => void;
  onUpdate: (id: string, patch: Partial<RemitoItem>) => void;
  onRemove: (id: string) => void;
}

const inp = 'w-full border border-slate-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal-400';

/**
 * Editor inline de items del remito (rework 2026-07-31): buscador de unidades
 * disponibles + tabla editable con cantidad, N° de serie y observaciones por
 * línea. Todo dentro del mismo modal — sin pantalla externa.
 */
export function RemitoItemsEditor({ items, unidades, maxCantidad, onAdd, onAddManual, onUpdate, onRemove }: Props) {
  // No ofrecer unidades ya agregadas. La UBICACIÓN en el label ES elegir de
  // dónde sale el artículo (misma pieza en dos depósitos = dos opciones).
  const opciones = useMemo(() => {
    const usadas = new Set(items.map(i => i.unidadId).filter(Boolean));
    return unidades
      .filter(u => !usadas.has(u.id))
      .map(u => ({
        value: u.id,
        label: `${u.articuloCodigo} — ${u.articuloDescripcion}${u.nroSerie ? ` · S/N ${u.nroSerie}` : ''}${u.nroLote ? ` · Lote ${u.nroLote}` : ''} (${u.cantidad ?? 1} disp. · ${u.ubicacion?.referenciaNombre || 'sin ubicación'})`,
        linkedCode: u.articuloCodigo ?? undefined,
      }));
  }, [unidades, items]);

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="block text-[11px] font-medium text-slate-500 mb-1">
            Agregar artículo del stock <span className="text-slate-300">(la ubicación indica de qué depósito sale)</span>
          </label>
          <SearchableSelect
            value=""
            onChange={v => v && onAdd(v)}
            options={opciones}
            placeholder="Buscar por código, descripción o serie…"
          />
        </div>
        <button onClick={onAddManual} title="Ítem que no está en stock — no genera movimiento"
          className="shrink-0 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">
          + Ítem manual
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-slate-400 py-2">Sin artículos — buscá arriba para agregar.</p>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-2 py-1.5 text-left text-[10px] font-mono text-slate-500 uppercase">Artículo</th>
                <th className="px-2 py-1.5 text-center text-[10px] font-mono text-slate-500 uppercase w-16">Cant.</th>
                <th className="px-2 py-1.5 text-left text-[10px] font-mono text-slate-500 uppercase w-32">N° serie</th>
                <th className="px-2 py-1.5 text-left text-[10px] font-mono text-slate-500 uppercase">Observaciones</th>
                <th className="px-2 py-1.5 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map(it => {
                const max = maxCantidad[it.id];
                return (
                  <tr key={it.id}>
                    <td className="px-2 py-1.5">
                      {it.unidadId ? (
                        <>
                          <span className="block font-mono font-semibold text-teal-800">{it.articuloCodigo || '—'}</span>
                          <span className="block text-[10px] text-slate-500 truncate max-w-[220px]" title={it.articuloDescripcion ?? ''}>
                            {it.articuloDescripcion}
                          </span>
                        </>
                      ) : (
                        // Ítem manual: código y descripción editables; no mueve stock.
                        <div className="space-y-1">
                          <input value={it.articuloCodigo ?? ''} onChange={e => onUpdate(it.id, { articuloCodigo: e.target.value })}
                            placeholder="Código (opcional)" className={`${inp} font-mono`} />
                          <input value={it.articuloDescripcion ?? ''} onChange={e => onUpdate(it.id, { articuloDescripcion: e.target.value })}
                            placeholder="Descripción *" className={inp} />
                          <span className="block text-[9px] text-amber-600">Manual — no descuenta stock</span>
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" min={1} {...(max ? { max } : {})} value={it.cantidad}
                        onChange={e => {
                          const v = Math.max(1, Number(e.target.value) || 1);
                          onUpdate(it.id, { cantidad: max ? Math.min(v, max) : v });
                        }}
                        className={`${inp} text-center`} />
                      {max != null && max > 1 && <span className="block text-[9px] text-slate-400 text-center">máx {max}</span>}
                    </td>
                    <td className="px-2 py-1.5">
                      <input value={it.serie ?? ''} onChange={e => onUpdate(it.id, { serie: e.target.value || null })}
                        placeholder="—" className={`${inp} font-mono`} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input value={it.observaciones ?? ''} onChange={e => onUpdate(it.id, { observaciones: e.target.value || null })}
                        placeholder="Opcional" className={inp} />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button onClick={() => onRemove(it.id)} title="Quitar"
                        className="text-red-400 hover:text-red-600 text-sm leading-none">×</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
