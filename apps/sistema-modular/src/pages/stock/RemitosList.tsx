import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { remitosService, clientesService } from '../../services/firebaseService';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useResizableColumns } from '../../hooks/useResizableColumns';
import { ColAlignIcon } from '../../components/ui/ColAlignIcon';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { PageHeader } from '../../components/ui/PageHeader';
import { CreateRemitoModal } from '../../components/stock/CreateRemitoModal';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import type { Remito, TipoRemito, EstadoRemito, Cliente } from '@ags/shared';
import { useConfirm } from '../../components/ui/ConfirmDialog';

const TIPO_LABELS: Record<TipoRemito, string> = { salida_campo: 'Salida a campo', entrega_cliente: 'Entrega a cliente', devolucion: 'Devolución', interno: 'Interno', derivacion_proveedor: 'Derivación proveedor', loaner_salida: 'Loaner salida' };
const ESTADO_LABELS: Record<EstadoRemito, string> = { borrador: 'Borrador', confirmado: 'Confirmado', en_transito: 'En tránsito', completado: 'Completado', completado_parcial: 'Parcial', cancelado: 'Cancelado' };
const ESTADO_COLORS: Record<EstadoRemito, string> = { borrador: 'bg-slate-100 text-slate-600', confirmado: 'bg-blue-100 text-blue-700', en_transito: 'bg-amber-100 text-amber-700', completado: 'bg-green-100 text-green-700', completado_parcial: 'bg-purple-100 text-purple-700', cancelado: 'bg-red-100 text-red-700' };
const TIPO_COLORS: Record<TipoRemito, string> = { salida_campo: 'bg-blue-50 text-blue-700', entrega_cliente: 'bg-teal-50 text-teal-700', devolucion: 'bg-emerald-50 text-emerald-700', interno: 'bg-slate-100 text-slate-600', derivacion_proveedor: 'bg-purple-50 text-purple-700', loaner_salida: 'bg-amber-50 text-amber-700' };

export const RemitosList = () => {
  const confirm = useConfirm();
  const { tableRef, colWidths, colAligns, onResizeStart, onAutoFit, cycleAlign, getAlignClass } = useResizableColumns('remitos-list');
  const FILTER_SCHEMA = useMemo(() => ({
    estado: { type: 'string' as const, default: '' },
    tipo: { type: 'string' as const, default: '' },
    showAll: { type: 'boolean' as const, default: false },
    clienteId: { type: 'string' as const, default: '' },
    sortField: { type: 'string' as const, default: 'fechaSalida' },
    sortDir: { type: 'string' as const, default: 'desc' },
  }), []);
  const [filters, setFilter, , ] = useUrlFilters(FILTER_SCHEMA);

  const [remitos, setRemitos] = useState<Remito[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const handleSort = (f: string) => {
    const s = toggleSort(f, filters.sortField, filters.sortDir as SortDir);
    setFilter('sortField', s.field); setFilter('sortDir', s.dir);
  };

  const unsubRef = useRef<(() => void) | null>(null);

  // Load reference data (clientes) once
  useEffect(() => { clientesService.getAll(true).then(setClientes); }, []);

  // Subscribe to remitos with current filters
  useEffect(() => {
    unsubRef.current?.();
    unsubRef.current = remitosService.subscribe(
      {
        estado: filters.estado || undefined,
        tipo: filters.tipo || undefined,
      },
      (data) => {
        const filtered = filters.showAll ? data : data.filter(r => r.estado !== 'cancelado');
        setRemitos(filtered);
        setLoading(false);
      },
      (err) => { console.error('Error cargando remitos:', err); setLoading(false); },
    );
    return () => { unsubRef.current?.(); };
  }, [filters.estado, filters.tipo, filters.showAll]);

  const loadData = useCallback(() => {}, []);

  const handleDelete = async (id: string) => {
    if (!await confirm('¿Eliminar este remito borrador?')) return;
    try {
      await remitosService.delete(id);
      setRemitos(prev => prev.filter(r => r.id !== id));
    } catch (error) {
      console.error('Error eliminando remito:', error);
      alert('Error al eliminar el remito');
    }
  };

  const sorted = useMemo(() => {
    let result = remitos;
    if (filters.clienteId) result = result.filter(r => r.clienteId === filters.clienteId);
    return sortByField(result, filters.sortField, filters.sortDir as SortDir);
  }, [remitos, filters.clienteId, filters.sortField, filters.sortDir]);

  const formatDate = (d?: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const isInitialLoad = loading && remitos.length === 0;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Remitos"
        subtitle="Gestionar remitos de stock"
        count={isInitialLoad ? undefined : sorted.length}
        actions={
          <Button size="sm" onClick={() => setShowCreate(true)}>+ Nuevo remito</Button>
        }
      >
        <div className="flex items-center gap-3 flex-wrap">
          <select value={filters.estado} onChange={e => setFilter('estado', e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500">
            <option value="">Todos los estados</option>
            {(Object.keys(ESTADO_LABELS) as EstadoRemito[]).map(k => (
              <option key={k} value={k}>{ESTADO_LABELS[k]}</option>
            ))}
          </select>
          <select value={filters.tipo} onChange={e => setFilter('tipo', e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500">
            <option value="">Todos los tipos</option>
            {(Object.keys(TIPO_LABELS) as TipoRemito[]).map(k => (
              <option key={k} value={k}>{TIPO_LABELS[k]}</option>
            ))}
          </select>
          <div className="min-w-[180px]">
            <SearchableSelect value={filters.clienteId} onChange={v => setFilter('clienteId', v)}
              options={[{ value: '', label: 'Todos los clientes' }, ...clientes.map(c => ({ value: c.id, label: c.razonSocial }))]}
              placeholder="Cliente..." />
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-500">
            <input type="checkbox" checked={filters.showAll} onChange={e => setFilter('showAll', e.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-300" />
            Mostrar cancelados
          </label>
        </div>
      </PageHeader>

      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
        {isInitialLoad ? (
          <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando remitos...</p></div>
        ) : sorted.length === 0 ? (
          <Card><div className="text-center py-12"><p className="text-slate-400">No se encontraron remitos</p></div></Card>
        ) : (
          <div className="bg-white overflow-x-auto">
              <table ref={tableRef} className="w-full table-fixed">
                {colWidths ? (
                  <colgroup>{colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
                ) : (
                  <colgroup>
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '12%' }} />
                  </colgroup>
                )}
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className={`px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider relative ${getAlignClass(0)}`}>
                      <ColAlignIcon align={colAligns?.[0] || 'left'} onClick={() => cycleAlign(0)} />
                      Numero
                      <div onMouseDown={e => onResizeStart(0, e)} onDoubleClick={() => onAutoFit(0)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                    </th>
                    <th className={`px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider relative ${getAlignClass(1)}`}>
                      <ColAlignIcon align={colAligns?.[1] || 'left'} onClick={() => cycleAlign(1)} />
                      Tipo
                      <div onMouseDown={e => onResizeStart(1, e)} onDoubleClick={() => onAutoFit(1)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                    </th>
                    <th className={`px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider relative ${getAlignClass(2)}`}>
                      <ColAlignIcon align={colAligns?.[2] || 'left'} onClick={() => cycleAlign(2)} />
                      Estado
                      <div onMouseDown={e => onResizeStart(2, e)} onDoubleClick={() => onAutoFit(2)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                    </th>
                    <th className={`px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider relative ${getAlignClass(3)}`}>
                      <ColAlignIcon align={colAligns?.[3] || 'left'} onClick={() => cycleAlign(3)} />
                      Ingeniero
                      <div onMouseDown={e => onResizeStart(3, e)} onDoubleClick={() => onAutoFit(3)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                    </th>
                    <th className={`px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider relative ${getAlignClass(4)}`}>
                      <ColAlignIcon align={colAligns?.[4] || 'left'} onClick={() => cycleAlign(4)} />
                      Items
                      <div onMouseDown={e => onResizeStart(4, e)} onDoubleClick={() => onAutoFit(4)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                    </th>
                    <SortableHeader label="Fecha salida" field="fechaSalida" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider relative ${getAlignClass(5)}`}>
                      <ColAlignIcon align={colAligns?.[5] || 'left'} onClick={() => cycleAlign(5)} />
                      <div onMouseDown={e => onResizeStart(5, e)} onDoubleClick={() => onAutoFit(5)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                    </SortableHeader>
                    <th className={`px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider relative ${getAlignClass(6)}`}>
                      <ColAlignIcon align={colAligns?.[6] || 'left'} onClick={() => cycleAlign(6)} />
                      OTs
                      <div onMouseDown={e => onResizeStart(6, e)} onDoubleClick={() => onAutoFit(6)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                    </th>
                    <th className="px-4 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider relative">
                      Acciones
                      <div onMouseDown={e => onResizeStart(7, e)} onDoubleClick={() => onAutoFit(7)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sorted.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className={`px-4 py-2 ${getAlignClass(0)}`}>
                        <span className="font-mono text-xs font-semibold text-teal-600">{r.numero}</span>
                      </td>
                      <td className={`px-4 py-2 ${getAlignClass(1)}`}>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${TIPO_COLORS[r.tipo]}`}>
                          {TIPO_LABELS[r.tipo]}
                        </span>
                      </td>
                      <td className={`px-4 py-2 ${getAlignClass(2)}`}>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${ESTADO_COLORS[r.estado]}`}>
                          {ESTADO_LABELS[r.estado]}
                        </span>
                      </td>
                      <td className={`px-4 py-2 text-xs text-slate-900 ${getAlignClass(3)}`}>{r.ingenieroNombre}</td>
                      <td className={`px-4 py-2 text-xs text-slate-600 ${getAlignClass(4)}`}>{r.items?.length ?? 0}</td>
                      <td className={`px-4 py-2 text-xs text-slate-600 ${getAlignClass(5)}`}>{formatDate(r.fechaSalida)}</td>
                      <td className={`px-4 py-2 text-xs text-slate-600 ${getAlignClass(6)}`}>
                        {r.otNumbers?.length ? r.otNumbers.join(', ') : '-'}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <Link to={`/stock/remitos/${r.id}`} className="text-xs text-teal-600 hover:underline font-medium">Ver</Link>
                          {r.estado === 'borrador' && (
                            <button onClick={() => handleDelete(r.id)} className="text-xs text-red-500 hover:underline font-medium">Eliminar</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          </div>
        )}
      </div>

      <CreateRemitoModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={loadData} />
    </div>
  );
};
