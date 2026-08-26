import { useEffect, useMemo, useRef, useState } from 'react';
import type { RemitoItem, UnidadStock } from '@ags/shared';
import type { RemitoFila } from '../../hooks/useRemitoForm';
import { SearchableSelect } from '../ui/SearchableSelect';
import { RemitoPresentacionCell } from './RemitoPresentacionCell';

interface Props {
  /** Filas visibles: lo fungible viene agrupado en una fila por artículo (2026-08-25). */
  filas: RemitoFila[];
  unidades: UnidadStock[];
  /** Envases por artículo: hacen buscable la unidad por el N° de parte del
   *  envase, no solo por el código base (2026-08-14). */
  presentacionesPorArticulo?: Record<string, { codigoParte: string; factor: number }[]>;
  /** Ids de ítems cuya unidad ya no está disponible (salió en otro remito). */
  itemsUnidadPerdida?: Set<string>;
  /** Última línea agregada — para enfocar su fila (puede ser un grupo existente). */
  lastAddedId: string | null;
  onAdd: (unidadId: string) => void;
  onAddManual: () => void;
  /** Aplica un patch a TODAS las líneas de la fila. */
  onUpdateFila: (ids: string[], patch: Partial<RemitoItem>) => void;
  onRemoveFila: (ids: string[]) => void;
  /** Fila fungible: fija la cantidad total redistribuyendo entre documentos de stock. */
  onSetCantidadFungible: (ids: string[], cantidad: number) => void;
  /** Fila no fungible (serie/manual): capear al salir del campo (comportamiento clásico). */
  onNormalizeCantidad: (id: string) => void;
}

const inp = 'w-full border border-slate-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal-400';

/**
 * Editor inline de items del remito (rework 2026-07-31): buscador de unidades
 * disponibles + tabla editable con cantidad, N° de serie y observaciones por
 * línea. Todo dentro del mismo modal — sin pantalla externa.
 *
 * Fungibles agrupados (2026-08-25): un artículo sin serie se muestra en UNA
 * fila aunque el stock lo tenga repartido en varios documentos — pedías 5 de
 * un frit y aparecían tres filas (2+1+2), puro ruido. Por dentro las líneas
 * siguen atadas a su documento (trazabilidad y costo por lote intactos).
 */
export function RemitoItemsEditor({
  filas, unidades, presentacionesPorArticulo, itemsUnidadPerdida, lastAddedId,
  onAdd, onAddManual, onUpdateFila, onRemoveFila, onSetCantidadFungible, onNormalizeCantidad,
}: Props) {
  // Flujo de carga rápida (2026-08-04): elegir artículo → foco en la cantidad
  // de la fila (nueva o el grupo al que se sumó) → Enter vuelve al buscador.
  const cantidadRefs = useRef(new Map<string, HTMLInputElement>());
  const [buscadorFocusToken, setBuscadorFocusToken] = useState(0);
  /** Borrador local de cantidad por fila fungible (clave = primer id). Se
   *  commitea al salir del campo, redistribuyendo entre documentos. */
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!lastAddedId) return;
    const fila = filas.find(f => f.ids.includes(lastAddedId));
    const el = fila && cantidadRefs.current.get(fila.ids[0]);
    if (el) { el.focus(); el.select(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastAddedId]);

  // No ofrecer unidades ya agregadas. La UBICACIÓN en el label ES elegir de
  // dónde sale el artículo (misma pieza en dos depósitos = dos opciones).
  const opciones = useMemo(() => {
    // No ofrecer documentos ya tomados por alguna fila. Elegir OTRO doc del
    // mismo artículo fungible simplemente suma a la fila agrupada existente.
    const docsEnUso = new Set(filas.flatMap(f => f.unidadIds));
    return unidades
      .filter(u => !docsEnUso.has(u.id))
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
  }, [unidades, filas, presentacionesPorArticulo]);

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="block text-[11px] font-medium text-slate-500 mb-1">
            Agregar artículo del stock <span className="text-slate-300">(la ubicación indica de qué depósito sale)</span>
          </label>
          <SearchableSelect
            value=""
            onChange={v => { if (v) onAdd(v); }}
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

      {filas.length === 0 ? (
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
              {filas.map(fila => {
                const it = fila.item;
                const key = fila.ids[0];
                // Alguna línea de la fila ya salió en otro remito: si se intenta
                // confirmar, la transacción falla ENTERA y el error nombra este
                // código sin decir dónde está (2026-08-14).
                const perdida = fila.ids.some(id => itemsUnidadPerdida?.has(id) ?? false);
                return (
                  <tr key={key} className={perdida ? 'bg-red-50' : undefined}>
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
                          <input value={it.articuloCodigo ?? ''} onChange={e => onUpdateFila(fila.ids, { articuloCodigo: e.target.value })}
                            placeholder="Código (opcional)" className={`${inp} font-mono`} />
                          <input value={it.articuloDescripcion ?? ''} onChange={e => onUpdateFila(fila.ids, { articuloDescripcion: e.target.value })}
                            placeholder="Descripción *" className={inp} />
                          <span className="block text-[9px] text-amber-600">Manual — no descuenta stock</span>
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      {fila.fungible ? (
                        <>
                          {/* Cantidad TOTAL de la fila: al confirmar se redistribuye
                              entre los documentos de stock del artículo (FIFO). */}
                          <input type="number" min={1} value={draft[key] ?? String(fila.cantidad)}
                            ref={el => { if (el) cantidadRefs.current.set(key, el); else cantidadRefs.current.delete(key); }}
                            onChange={e => setDraft(prev => ({ ...prev, [key]: e.target.value }))}
                            onBlur={() => {
                              const v = Number(draft[key] ?? fila.cantidad);
                              setDraft(prev => { const { [key]: _omit, ...rest } = prev; return rest; });
                              if (v !== fila.cantidad) onSetCantidadFungible(fila.ids, v);
                            }}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); setBuscadorFocusToken(t => t + 1); } }}
                            className={`${inp} text-center`} />
                          {fila.max != null && (
                            <span className="block text-[9px] text-slate-400 text-center">
                              hasta {fila.max} disp.
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          {/* Tipeo libre; al salir del campo se capea a la unidad y
                              el excedente se completa con otras unidades del mismo
                              artículo (2026-08-04). */}
                          <input type="number" min={1} value={it.cantidad}
                            ref={el => { if (el) cantidadRefs.current.set(key, el); else cantidadRefs.current.delete(key); }}
                            onChange={e => onUpdateFila(fila.ids, { cantidad: Number(e.target.value) || 0 })}
                            onBlur={() => onNormalizeCantidad(it.id)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setBuscadorFocusToken(t => t + 1); } }}
                            className={`${inp} text-center`} />
                          {it.unidadId && fila.max != null && (
                            <span className="block text-[9px] text-slate-400 text-center" title="Si pedís más, se completa con otras unidades del mismo artículo">
                              {fila.max} en esta unidad
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <RemitoPresentacionCell
                        item={it}
                        envases={it.articuloId ? presentacionesPorArticulo?.[it.articuloId] ?? [] : []}
                        onUpdate={(_id, patch) => onUpdateFila(fila.ids, patch)}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      {/* Por ÍTEM, no por tipo de remito (2026-08-09): una misma
                          entrega puede llevar una lámpara que vuelve y un filtro
                          que no. Los labels nombran el desenlace posible, no el
                          movimiento físico (2026-08-18). */}
                      <select value={it.tipoItem}
                        onChange={e => onUpdateFila(fila.ids, { tipoItem: e.target.value as RemitoItem['tipoItem'] })}
                        className={inp}>
                        <option value="sale_y_vuelve">Puede volver</option>
                        <option value="entrega">Queda en el cliente</option>
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      {fila.fungible && fila.ids.length > 1 ? (
                        // Grupo sin serie: cargar una serie acá no identifica nada
                        // (son varias piezas indistintas).
                        <span className="text-slate-300 text-center block">—</span>
                      ) : (
                        <input value={it.serie ?? ''} onChange={e => onUpdateFila(fila.ids, { serie: e.target.value || null })}
                          placeholder="—" className={`${inp} font-mono`} />
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <input value={it.observaciones ?? ''} onChange={e => onUpdateFila(fila.ids, { observaciones: e.target.value || null })}
                        placeholder="Opcional" className={inp} />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button onClick={() => onRemoveFila(fila.ids)} title="Quitar"
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
