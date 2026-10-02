import { useMemo, useState } from 'react';
import type { TipoItemAsignacion } from '@ags/shared';
import type { InventarioItem } from '../../hooks/useInventarioIngeniero';
import { getTipoEntidadLabel } from '../../utils/inventarioToRemitoItem';
import { codigoItemAsignacion, descripcionItemAsignacion } from '../../utils/itemAsignacionLabel';
import { matchesSearch } from '../../utils/searchTerms';

interface Props {
  /** Ítems que se pueden remitir (asignados con cantidad neta > 0). */
  elegibles: InventarioItem[];
  selectedIds: Set<string>;
  onChange: (next: Set<string>) => void;
}

export const itemKey = (item: InventarioItem): string => `${item.asignacionId}-${item.id}`;

const descDe = (item: InventarioItem): string => {
  const desc = descripcionItemAsignacion(item);
  // Serie de la unidad de stock (2026-09-10); columna y dispositivo ya la traen.
  return item.serie ? `${desc} · S/N ${item.serie}` : desc;
};

const neta = (i: InventarioItem) => i.cantidad - i.cantidadDevuelta - i.cantidadConsumida;

/**
 * Selector de ítems del inventario de un ingeniero para armar el remito
 * (2026-10-02): filtro por tipo + buscador por código, descripción o serie
 * (con muchos ítems ya no había forma de encontrar uno) y filas compactas.
 * "Seleccionar todos" actúa sobre lo que muestran el filtro y la búsqueda.
 */
export function RemitoInventarioSelector({ elegibles, selectedIds, onChange }: Props) {
  const [tipo, setTipo] = useState<TipoItemAsignacion | 'todos'>('todos');
  const [busqueda, setBusqueda] = useState('');

  const tipos = useMemo(() => [...new Set(elegibles.map(i => i.tipo))] as TipoItemAsignacion[], [elegibles]);
  const visibles = useMemo(() => elegibles
    .filter(i => tipo === 'todos' || i.tipo === tipo)
    .filter(i => !busqueda.trim() || matchesSearch(busqueda, codigoItemAsignacion(i), descDe(i), i.serie)),
  [elegibles, tipo, busqueda]);

  const todos = visibles.length > 0 && visibles.every(i => selectedIds.has(itemKey(i)));
  const alternarTodos = () => {
    const next = new Set(selectedIds);
    visibles.forEach(i => (todos ? next.delete(itemKey(i)) : next.add(itemKey(i))));
    onChange(next);
  };
  const alternar = (i: InventarioItem) => {
    const next = new Set(selectedIds);
    const k = itemKey(i);
    if (next.has(k)) next.delete(k); else next.add(k);
    onChange(next);
  };

  const chip = (activo: boolean) => `px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
    activo ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)} autoFocus
          placeholder="Buscar por código, descripción o serie…"
          className="flex-1 min-w-[200px] border border-slate-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500" />
        <div className="flex flex-wrap gap-1">
          <button type="button" className={chip(tipo === 'todos')} onClick={() => setTipo('todos')}>Todos ({elegibles.length})</button>
          {tipos.map(t => (
            <button type="button" key={t} className={chip(tipo === t)} onClick={() => setTipo(t)}>
              {getTipoEntidadLabel(t)} ({elegibles.filter(i => i.tipo === t).length})
            </button>
          ))}
        </div>
      </div>

      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <label className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 border-b border-slate-200 cursor-pointer">
          <input type="checkbox" checked={todos} onChange={alternarTodos} disabled={visibles.length === 0}
            className="rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
          <span className="text-[11px] text-slate-600">Seleccionar {busqueda.trim() || tipo !== 'todos' ? 'los visibles' : 'todos'} ({visibles.length})</span>
          <span className="ml-auto text-[11px] font-medium text-teal-700">{selectedIds.size > 0 ? `${selectedIds.size} seleccionado${selectedIds.size === 1 ? '' : 's'}` : ''}</span>
        </label>
        <div className="max-h-[220px] overflow-y-auto divide-y divide-slate-100">
          {visibles.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">{elegibles.length === 0 ? 'No hay ítems para remitir.' : 'Ningún ítem coincide con la búsqueda.'}</p>
          ) : visibles.map(item => {
            const k = itemKey(item);
            const sel = selectedIds.has(k);
            return (
              <label key={k} className={`flex items-center gap-2 px-2.5 py-1 cursor-pointer transition-colors ${sel ? 'bg-teal-50' : 'hover:bg-slate-50'}`}>
                <input type="checkbox" checked={sel} onChange={() => alternar(item)}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 shrink-0" />
                <span className="font-mono text-[10px] text-teal-700 font-semibold shrink-0">{codigoItemAsignacion(item)}</span>
                <span className="text-[11px] text-slate-700 truncate flex-1" title={descDe(item)}>{descDe(item)}</span>
                <span className="text-[9px] text-slate-400 shrink-0">{getTipoEntidadLabel(item.tipo)}</span>
                <span className="text-[10px] font-mono text-slate-500 shrink-0 w-7 text-right">×{neta(item)}</span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
