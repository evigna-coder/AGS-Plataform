import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { remitosService, clientesService } from '../../services/firebaseService';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { PageHeader } from '../../components/ui/PageHeader';
import { CreateRemitoModal } from '../../components/stock/CreateRemitoModal';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import type { Remito, TipoRemito, EstadoRemito, Cliente } from '@ags/shared';

const TIPO_LABELS: Record<TipoRemito, string> = { salida_campo: 'Salida a campo', entrega_cliente: 'Entrega a cliente', devolucion: 'Devolución', interno: 'Interno', derivacion_proveedor: 'Derivación proveedor', loaner_salida: 'Loaner salida' };
const ESTADO_LABELS: Record<EstadoRemito, string> = { borrador: 'Borrador', confirmado: 'Confirmado', en_transito: 'En tránsito', completado: 'Completado', completado_parcial: 'Parcial', cancelado: 'Cancelado' };
const ESTADO_COLORS: Record<EstadoRemito, string> = { borrador: 'bg-slate-100 text-slate-600', confirmado: 'bg-blue-100 text-blue-700', en_transito: 'bg-amber-100 text-amber-700', completado: 'bg-green-100 text-green-700', completado_parcial: 'bg-purple-100 text-purple-700', cancelado: 'bg-red-100 text-red-700' };
const TIPO_COLORS: Record<TipoRemito, string> = { salida_campo: 'bg-blue-50 text-blue-700', entrega_cliente: 'bg-teal-50 text-teal-700', devolucion: 'bg-emerald-50 text-emerald-700', interno: 'bg-slate-100 text-slate-600', derivacion_proveedor: 'bg-purple-50 text-purple-700', loaner_salida: 'bg-amber-50 text-amber-700' };

export const RemitosList = () => {
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
    if (!confirm('¿Eliminar este remito borrador?')) return;
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
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider">Numero</th>
                    <th className="px-4 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider">Tipo</th>
                    <th className="px-4 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider">Estado</th>
                    <th className="px-4 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider">Ingeniero</th>
                    <th className="px-4 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider">Items</th>
                    <SortableHeader label="Fecha salida" field="fechaSalida" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider" />
                    <th className="px-4 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider">OTs</th>
                    <th className="px-4 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sorted.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2">
                        <span className="font-mono text-xs font-semibold text-teal-600">{r.numero}</span>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${TIPO_COLORS[r.tipo]}`}>
                          {TIPO_LABELS[r.tipo]}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${ESTADO_COLORS[r.estado]}`}>
                          {ESTADO_LABELS[r.estado]}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-900">{r.ingenieroNombre}</td>
                      <td className="px-4 py-2 text-xs text-slate-600">{r.items?.length ?? 0}</td>
                      <td className="px-4 py-2 text-xs text-slate-600">{formatDate(r.fechaSalida)}</td>
                      <td className="px-4 py-2 text-xs text-slate-600">
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
