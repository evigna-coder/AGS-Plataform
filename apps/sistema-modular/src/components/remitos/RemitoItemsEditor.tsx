import { useEffect, useMemo, useRef, useState } from 'react';
import type { RemitoItem, UnidadStock } from '@ags/shared';
import { SearchableSelect } from '../ui/SearchableSelect';
import { RemitoPresentacionCell } from './RemitoPresentacionCell';

interface Props {
  items: RemitoItem[];
  unidades: UnidadStock[];
  maxCantidad: Record<string, number>;
  /** Envases por artículo: hacen buscable la unidad por el N° de parte del
   *  envase, no solo por el código base (2026-08-14). */
  presentacionesPorArticulo?: Record<string, { codigoParte: string; factor: number }[]>;
  /** Ids de ítems cuya unidad ya no está disponible (salió en otro remito). */
  itemsUnidadPerdida?: Set<string>;
  onAdd: (unidadId: string) => void;
  onAddManual: () => void;
  onUpdate: (id: string, patch: Partial<RemitoItem>) => void;
  onRemove: (id: string) => void;
  /** Al salir del campo cantidad: capea a la existencia de la unidad y completa
   *  con otras unidades del mismo artículo si se pidió más (2026-08-04). */
  onNormalizeCantidad: (id: string) => void;
}

const inp = 'w-full border border-slate-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal-400';

/**
 * Editor inline de items del remito (rework 2026-07-31): buscador de unidades
 * disponibles + tabla editable con cantidad, N° de serie y observaciones por
 * línea. Todo dentro del mismo modal — sin pantalla externa.
 */
export function RemitoItemsEditor({
  items, unidades, maxCantidad, presentacionesPorArticulo, itemsUnidadPerdida,
  onAdd, onAddManual, onUpdate, onRemove, onNormalizeCantidad,
}: Props) {
  // Flujo de carga rápida (2026-08-04): elegir artículo → foco en la cantidad
  // de la fila nueva con el texto seleccionado → Enter vuelve al buscador.
  const cantidadRefs = useRef(new Map<string, HTMLInputElement>());
  const esperandoFilaNueva = useRef(false);
  const [buscadorFocusToken, setBuscadorFocusToken] = useState(0);

  useEffect(() => {
    if (!esperandoFilaNueva.current || items.length === 0) return;
    esperandoFilaNueva.current = false;
    const inp = cantidadRefs.current.get(items[items.length - 1].id);
    if (inp) { inp.focus(); inp.select(); }
  }, [items]);
  // No ofrecer unidades ya agregadas. La UBICACIÓN en el label ES elegir de
  // dónde sale el artículo (misma pieza en dos depósitos = dos opciones).
  const opciones = useMemo(() => {
    const usadas = new Set(items.map(i => i.unidadId).filter(Boolean));
    return unidades
      .filter(u => !usadas.has(u.id))
      .map(u => {
        // Reservadas incluidas (2026-08-07): se marcan con para quién están,
        // así se entrega la pieza correcta sin tener que liberarla antes.
        const reserva = u.estado === 'reservado'
          ? ` · ⚠ RESERVADO${u.reservadoParaClienteNombre ? ` ${u.reservadoParaClienteNombre}` : ''}${u.reservadoParaPresupuestoNumero ? ` (${u.reservadoParaPresupuestoNumero})` : ''}`
          : '';
        // Envases del artículo (2026-08-14): quien arma el remito tipea el N° de
        // parte con el que se compra o se vende —"5183-2067"— y el stock está
        // guardado con el código base. Sin esto el buscador no devolvía nada y
        // la pieza terminaba cargada como ítem manual, sin descontar stock.
        const envases = presentacionesPorArticulo?.[u.articuloId] ?? [];
        return {
          value: u.id,
          label: `${u.articuloCodigo} — ${u.articuloDescripcion}${u.nroSerie ? ` · S/N ${u.nroSerie}` : ''}${u.nroLote ? ` · Lote ${u.nroLote}` : ''} (${u.cantidad ?? 1} disp. · ${u.ubicacion?.referenciaNombre || 'sin ubicación'})${reserva}`,
          linkedCode: [u.articuloCodigo, ...envases.map(e => e.codigoParte)].filter(Boolean).join(' '),
          subLabel: envases.length > 0
            ? `Envases: ${envases.map(e => `${e.codigoParte} ×${e.factor}`).join(' · ')}`
            : undefined,
        };
      });
  }, [unidades, items, presentacionesPorArticulo]);

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="block text-[11px] font-medium text-slate-500 mb-1">
            Agregar artículo del stock <span className="text-slate-300">(la ubicación indica de qué depósito sale)</span>
          </label>
          <SearchableSelect
            value=""
            onChange={v => { if (v) { esperandoFilaNueva.current = true; onAdd(v); } }}
            options={opciones}
            placeholder="Buscar por código, descripción o serie…"
            autoFocusToken={buscadorFocusToken}
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
                {/* Envase (2026-08-14): el cliente compra por el N° de parte del
                    envase, y ESE es el código y la cantidad que declara el papel. */}
                <th className="px-2 py-1.5 text-left text-[10px] font-mono text-slate-500 uppercase w-40"
                  title="Con qué código y en qué unidad sale impresa la línea. El stock se descuenta igual en unidades del artículo base.">
                  Se entrega como
                </th>
                <th className="px-2 py-1.5 text-center text-[10px] font-mono text-slate-500 uppercase w-24" title="Si el artículo vuelve, queda pendiente de retorno y puede descargarse al cerrar la OT">Destino</th>
                <th className="px-2 py-1.5 text-left text-[10px] font-mono text-slate-500 uppercase w-32">N° serie</th>
                <th className="px-2 py-1.5 text-left text-[10px] font-mono text-slate-500 uppercase">Observaciones</th>
                <th className="px-2 py-1.5 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map(it => {
                const max = maxCantidad[it.id];
                // La unidad de esta línea ya salió en otro remito: si se
                // intenta confirmar, la transacción falla ENTERA y el error
                // nombra este código sin decir dónde está (2026-08-14).
                const perdida = itemsUnidadPerdida?.has(it.id) ?? false;
                return (
                  <tr key={it.id} className={perdida ? 'bg-red-50' : undefined}>
                    <td className="px-2 py-1.5">
                      {it.unidadId ? (
                        <>
                          <span className={`block font-mono font-semibold ${perdida ? 'text-red-700 line-through' : 'text-teal-800'}`}>
                            {it.articuloCodigo || '—'}
                          </span>
                          <span className="block text-[10px] text-slate-500 truncate max-w-[220px]" title={it.articuloDescripcion ?? ''}>
                            {it.articuloDescripcion}
                          </span>
                          {perdida && (
                            <span className="block text-[9px] font-medium text-red-600">
                              Esta pieza ya salió en otro remito — quitá la línea y volvé a agregar el artículo
                            </span>
                          )}
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
                      {/* Tipeo libre; al salir del campo se capea a la unidad y
                          el excedente se completa con otras unidades del mismo
                          artículo (2026-08-04: el tope duro "no dejaba
                          modificar cantidades" con stock doc-por-unidad). */}
                      <input type="number" min={1} value={it.cantidad}
                        ref={el => { if (el) cantidadRefs.current.set(it.id, el); else cantidadRefs.current.delete(it.id); }}
                        onChange={e => onUpdate(it.id, { cantidad: Number(e.target.value) || 0 })}
                        onBlur={() => onNormalizeCantidad(it.id)}
                        // Enter confirma la cantidad y devuelve el foco al buscador
                        // para cargar el siguiente artículo (el blur normaliza).
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setBuscadorFocusToken(t => t + 1); } }}
                        className={`${inp} text-center`} />
                      {it.unidadId && max != null && (
                        <span className="block text-[9px] text-slate-400 text-center" title="Si pedís más, se completa con otras unidades del mismo artículo">
                          {max} en esta unidad
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <RemitoPresentacionCell
                        item={it}
                        envases={it.articuloId ? presentacionesPorArticulo?.[it.articuloId] ?? [] : []}
                        onUpdate={onUpdate}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      {/* Por ÍTEM, no por tipo de remito (2026-08-09): una misma
                          entrega puede llevar una lámpara que vuelve y un filtro
                          que no.

                          Las dos clases quedan PENDIENTES hasta que el cierre
                          administrativo de la OT las consuma — lo que cambia es
                          el desenlace posible: lo que "puede volver" admite
                          devolución, lo que "queda en el cliente" no. Los labels
                          nombran eso y no el movimiento físico (2026-08-18):
                          "Vuelve"/"Queda" se leían como si "Queda" cerrara el
                          asunto, cuando también hay que descargarlo. */}
                      <select value={it.tipoItem}
                        onChange={e => onUpdate(it.id, { tipoItem: e.target.value as RemitoItem['tipoItem'] })}
                        className={inp}>
                        <option value="sale_y_vuelve">Puede volver</option>
                        <option value="entrega">Queda en el cliente</option>
                      </select>
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
