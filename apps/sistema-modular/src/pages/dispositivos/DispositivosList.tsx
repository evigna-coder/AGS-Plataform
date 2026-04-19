import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { dispositivosService } from '../../services/firebaseService';
import { useDebounce } from '../../hooks/useDebounce';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useResizableColumns } from '../../hooks/useResizableColumns';
import { ColAlignIcon } from '../../components/ui/ColAlignIcon';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { DispositivoModal } from '../../components/dispositivos/DispositivoModal';
import type { Dispositivo, TipoDispositivo } from '@ags/shared';
import { useConfirm } from '../../components/ui/ConfirmDialog';

const TIPO_LABELS: Record<TipoDispositivo, string> = {
  celular: 'Celular', computadora: 'Computadora', tablet: 'Tablet', otro: 'Otro',
};
const TIPO_COLORS: Record<TipoDispositivo, string> = {
  celular: 'bg-blue-50 text-blue-700',
  computadora: 'bg-purple-50 text-purple-700',
  tablet: 'bg-teal-50 text-teal-700',
  otro: 'bg-slate-100 text-slate-600',
};

export const DispositivosList = () => {
  const confirm = useConfirm();
  const { tableRef, colWidths, colAligns, onResizeStart, onAutoFit, cycleAlign, getAlignClass } = useResizableColumns('dispositivos-list');
  const FILTER_SCHEMA = useMemo(() => ({
    search: { type: 'string' as const, default: '' },
    sortField: { type: 'string' as const, default: 'marca' },
    sortDir:   { type: 'string' as const, default: 'asc' },
  }), []);
  const [filters, setFilter, , ] = useUrlFilters(FILTER_SCHEMA);
  const handleSort = (f: string) => {
    const s = toggleSort(f, filters.sortField, filters.sortDir as SortDir);
    setFilter('sortField', s.field); setFilter('sortDir', s.dir);
  };

  const [items, setItems] = useState<Dispositivo[]>([]);
  const [loading, setLoading] = useState(true);
  const debouncedSearch = useDebounce(filters.search, 300);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Dispositivo | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    unsubRef.current?.();
    unsubRef.current = dispositivosService.subscribe(
      false,
      (data) => { setItems(data); setLoading(false); },
      (err) => { console.error('Error cargando dispositivos:', err); setLoading(false); },
    );
    return () => { unsubRef.current?.(); };
  }, []);

  const loadData = useCallback(() => {}, []);

  const filtered = useMemo(() => {
    let list = items;
    if (debouncedSearch) {
      const t = debouncedSearch.toLowerCase();
      list = list.filter(d =>
        d.marca.toLowerCase().includes(t) || d.modelo.toLowerCase().includes(t) ||
        d.serie.toLowerCase().includes(t) || (d.asignadoANombre ?? '').toLowerCase().includes(t)
      );
    }
    return sortByField(list, filters.sortField, filters.sortDir as SortDir);
  }, [items, debouncedSearch, filters.sortField, filters.sortDir]);

  const handleDelete = async (d: Dispositivo) => {
    if (!await confirm(`Eliminar dispositivo "${d.marca} ${d.modelo}"?`)) return;
    try {
      await dispositivosService.delete(d.id);
    } catch (err) {
      console.error('Error eliminando:', err);
    }
  };

  const isInitialLoad = loading && items.length === 0;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Dispositivos"
        subtitle="Celulares, computadoras y otros dispositivos"
        count={isInitialLoad ? undefined : filtered.length}
        actions={<Button size="sm" onClick={() => { setEditItem(null); setShowModal(true); }}>+ Nuevo dispositivo</Button>}
      >
        <input type="text" placeholder="Buscar por marca, modelo, serie o asignado..."
          value={filters.search} onChange={e => setFilter('search', e.target.value)}
          className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs w-72 focus:outline-none focus:ring-2 focus:ring-teal-500" />
      </PageHeader>

      <div className="flex-1 overflow-auto px-5 pb-4">
        {isInitialLoad ? (
          <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando...</p></div>
        ) : filtered.length === 0 ? (
          <Card><div className="text-center py-12"><p className="text-slate-400">No se encontraron dispositivos</p></div></Card>
        ) : (
          <div className="bg-white overflow-x-auto">
            <table ref={tableRef} className="w-full table-fixed">
              {colWidths ? (
                <colgroup>
                  {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
                </colgroup>
              ) : (
                <colgroup>
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '30%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '22%' }} />
                  <col style={{ width: '14%' }} />
                </colgroup>
              )}
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <SortableHeader label="Tipo" field="tipo" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`relative px-4 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider ${getAlignClass(0)}`}><ColAlignIcon align={colAligns?.[0] || 'left'} onClick={() => cycleAlign(0)} /><div onMouseDown={e => onResizeStart(0, e)} onDoubleClick={() => onAutoFit(0)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></SortableHeader>
                  <SortableHeader label="Marca / Modelo" field="marca" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`relative px-4 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider ${getAlignClass(1)}`}><ColAlignIcon align={colAligns?.[1] || 'left'} onClick={() => cycleAlign(1)} /><div onMouseDown={e => onResizeStart(1, e)} onDoubleClick={() => onAutoFit(1)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></SortableHeader>
                  <SortableHeader label="Serie" field="serie" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`relative px-4 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider ${getAlignClass(2)}`}><ColAlignIcon align={colAligns?.[2] || 'left'} onClick={() => cycleAlign(2)} /><div onMouseDown={e => onResizeStart(2, e)} onDoubleClick={() => onAutoFit(2)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></SortableHeader>
                  <SortableHeader label="Asignado a" field="asignadoANombre" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`relative px-4 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider ${getAlignClass(3)}`}><ColAlignIcon align={colAligns?.[3] || 'left'} onClick={() => cycleAlign(3)} /><div onMouseDown={e => onResizeStart(3, e)} onDoubleClick={() => onAutoFit(3)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></SortableHeader>
                  <th className="relative px-4 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider">Acciones<div onMouseDown={e => onResizeStart(4, e)} onDoubleClick={() => onAutoFit(4)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className={`px-4 py-2 ${getAlignClass(0)}`}>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${TIPO_COLORS[d.tipo]}`}>
                        {TIPO_LABELS[d.tipo]}
                      </span>
                    </td>
                    <td className={`px-4 py-2 ${getAlignClass(1)}`}>
                      <span className="text-xs font-semibold text-slate-900">{d.marca} {d.modelo}</span>
                      {d.descripcion && <p className="text-[10px] text-slate-400 mt-0.5">{d.descripcion}</p>}
                    </td>
                    <td className={`px-4 py-2 font-mono text-xs text-slate-600 ${getAlignClass(2)}`}>{d.serie || '-'}</td>
                    <td className={`px-4 py-2 text-xs text-slate-600 ${getAlignClass(3)}`}>{d.asignadoANombre || '-'}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setEditItem(d); setShowModal(true); }} className="text-xs text-teal-600 hover:underline font-medium">Editar</button>
                        <button onClick={() => handleDelete(d)} className="text-xs text-red-500 hover:underline font-medium">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DispositivoModal open={showModal} onClose={() => { setShowModal(false); setEditItem(null); }} onSaved={loadData} editData={editItem} />
    </div>
  );
};
