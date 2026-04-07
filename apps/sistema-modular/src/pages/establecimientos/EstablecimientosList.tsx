import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { establecimientosService, clientesService } from '../../services/firebaseService';
import { useDebounce } from '../../hooks/useDebounce';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import type { Establecimiento, Cliente } from '@ags/shared';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { PageHeader } from '../../components/ui/PageHeader';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { CreateEstablecimientoModal } from '../../components/establecimientos/CreateEstablecimientoModal';
import { BulkAddressValidationModal } from '../../components/establecimientos/BulkAddressValidationModal';
import { useResizableColumns } from '../../hooks/useResizableColumns';
import { useBackgroundTasks } from '../../contexts/BackgroundTasksContext';

const thClass = 'px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap relative';

const ResizeHandle = ({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) => (
  <div onMouseDown={onMouseDown} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40 z-20" />
);

export const EstablecimientosList = () => {
  const FILTER_SCHEMA = useMemo(() => ({
    search: { type: 'string' as const, default: '' },
    cliente: { type: 'string' as const, default: '' },
    sortField: { type: 'string' as const, default: 'cliente' },
    sortDir: { type: 'string' as const, default: 'asc' },
  }), []);
  const [filters, setFilter] = useUrlFilters(FILTER_SCHEMA);
  const [localSearch, setLocalSearch] = useState(filters.search);
  const debouncedSearch = useDebounce(localSearch, 300);
  useEffect(() => { setFilter('search', debouncedSearch); }, [debouncedSearch]);
  useEffect(() => { if (filters.search !== localSearch && filters.search === '') setLocalSearch(''); }, [filters.search]);

  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const unsubEstRef = useRef<(() => void) | null>(null);
  const unsubClientesRef = useRef<(() => void) | null>(null);
  const bgTasks = useBackgroundTasks();
  const hasAddressTask = !!bgTasks.getTask('bulk-address-validation');
  const [showCreate, setShowCreate] = useState(false);
  const [showBulkAddress, setShowBulkAddress] = useState(hasAddressTask);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const { tableRef, colWidths, onResizeStart } = useResizableColumns('establecimientos-list');

  const handleSort = (f: string) => {
    const s = toggleSort(f, filters.sortField, filters.sortDir as SortDir);
    setFilter('sortField', s.field); setFilter('sortDir', s.dir);
  };

  useEffect(() => {
    unsubEstRef.current?.();
    unsubEstRef.current = establecimientosService.subscribe(
      (data) => { setEstablecimientos(data); setLoading(false); },
      (err) => { console.error('Establecimientos subscription error:', err); setLoading(false); },
    );
    unsubClientesRef.current?.();
    unsubClientesRef.current = clientesService.subscribe(
      false,
      (data) => { setClientes(data); },
      (err) => { console.error('Clientes subscription error:', err); },
    );
    return () => { unsubEstRef.current?.(); unsubClientesRef.current?.(); };
  }, []);

  const loadData = useCallback(() => {}, []);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(e => e.id)));
    }
  };

  const handleDelete = async (est: Establecimiento) => {
    if (!confirm(`¿Eliminar el establecimiento "${est.nombre}"?\n\nEsta acción no se puede deshacer.`)) return;
    try {
      await establecimientosService.delete(est.id);
    } catch (e) {
      console.error('Error eliminando establecimiento:', e);
      alert('Error al eliminar el establecimiento');
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`¿Eliminar ${selected.size} establecimiento(s)?\n\nEsta acción no se puede deshacer.`)) return;
    setDeleting(true);
    try {
      for (const id of selected) {
        await establecimientosService.delete(id);
      }
      setSelected(new Set());
    } catch (e) {
      console.error('Error eliminando establecimientos:', e);
      alert('Error al eliminar establecimientos');
    } finally {
      setDeleting(false);
    }
  };

  const clienteMap = useMemo(() => {
    const map: Record<string, string> = {};
    clientes.forEach(c => {
      map[c.id] = c.razonSocial;
      if (c.cuit) map[c.cuit] = c.razonSocial;
      // También indexar por solo dígitos para cubrir mismatch de formato
      const digits = (c.cuit || c.id).replace(/\D/g, '');
      if (digits) map[digits] = c.razonSocial;
    });
    return map;
  }, [clientes]);

  const filtered = useMemo(() => {
    let result = establecimientos;
    if (filters.cliente) result = result.filter(e => (e.clienteCuit || (e as any).clienteId) === filters.cliente);
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      result = result.filter(e =>
        e.nombre.toLowerCase().includes(q) ||
        (e.direccion || '').toLowerCase().includes(q) ||
        (e.localidad || '').toLowerCase().includes(q) ||
        (e.provincia || '').toLowerCase().includes(q) ||
        (clienteMap[e.clienteCuit || (e as any).clienteId] || '').toLowerCase().includes(q)
      );
    }
    if (filters.sortField === 'cliente') {
      const dir = filters.sortDir === 'asc' ? 1 : -1;
      result = [...result].sort((a, b) => {
        const nameA = (clienteMap[a.clienteCuit || (a as any).clienteId] || '').toLowerCase();
        const nameB = (clienteMap[b.clienteCuit || (b as any).clienteId] || '').toLowerCase();
        return nameA.localeCompare(nameB) * dir;
      });
      return result;
    }
    return sortByField(result, filters.sortField, filters.sortDir as SortDir);
  }, [establecimientos, filters.cliente, debouncedSearch, clienteMap, filters.sortField, filters.sortDir]);

  const isInitialLoad = loading && establecimientos.length === 0;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader title="Establecimientos" count={isInitialLoad ? undefined : filtered.length}
        actions={
          <div className="flex gap-2 items-center">
            {selected.size > 0 && (
              <Button size="sm" variant="outline" onClick={handleBulkDelete} disabled={deleting}
                className="!border-red-300 !text-red-600 hover:!bg-red-50">
                {deleting ? 'Eliminando...' : `Eliminar (${selected.size})`}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setShowBulkAddress(true)}>Validar direcciones</Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>+ Nuevo Establecimiento</Button>
          </div>
        }>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Buscar por nombre, dirección, localidad, cliente..."
            value={localSearch}
            onChange={e => setLocalSearch(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 w-72"
          />
          <div className="min-w-[130px]">
            <SearchableSelect size="sm"
              value={filters.cliente}
              onChange={(v) => setFilter('cliente', v)}
              options={[{ value: '', label: 'Cliente: Todos' }, ...clientes.map(c => ({ value: c.id, label: c.razonSocial }))]}
              placeholder="Cliente"
            />
          </div>
          {(filters.cliente || filters.search) && (
            <Button size="sm" variant="ghost" onClick={() => { setFilter('cliente', ''); setFilter('search', ''); }}>
              Limpiar
            </Button>
          )}
        </div>
      </PageHeader>

      <div className="flex-1 min-h-0 px-5 pb-4">
        {isInitialLoad ? (
          <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando establecimientos...</p></div>
        ) : filtered.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-slate-400">No se encontraron establecimientos</p>
              <button onClick={() => setShowCreate(true)}
                className="text-teal-600 hover:underline mt-2 inline-block text-xs">
                Crear primer establecimiento
              </button>
            </div>
          </Card>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto overflow-x-hidden h-full">
            <table ref={tableRef} className="w-full table-fixed">
              {colWidths && (
                <colgroup>
                  {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
                </colgroup>
              )}
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-3 py-2 w-8">
                    <input type="checkbox" checked={selected.size > 0 && selected.size === filtered.length}
                      onChange={toggleSelectAll} className="rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                  </th>
                  <SortableHeader label="Cliente" field="cliente" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={thClass}>
                    <ResizeHandle onMouseDown={e => onResizeStart(1, e)} />
                  </SortableHeader>
                  <SortableHeader label="Nombre" field="nombre" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={thClass}>
                    <ResizeHandle onMouseDown={e => onResizeStart(2, e)} />
                  </SortableHeader>
                  <th className={thClass}>Dirección<ResizeHandle onMouseDown={e => onResizeStart(3, e)} /></th>
                  <SortableHeader label="Localidad" field="localidad" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={thClass}>
                    <ResizeHandle onMouseDown={e => onResizeStart(4, e)} />
                  </SortableHeader>
                  <SortableHeader label="Provincia" field="provincia" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={thClass}>
                    <ResizeHandle onMouseDown={e => onResizeStart(5, e)} />
                  </SortableHeader>
                  <th className={thClass}>Estado</th>
                  <th className={`${thClass} text-center`}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((est) => (
                  <tr key={est.id} className={`hover:bg-slate-50 transition-colors ${selected.has(est.id) ? 'bg-teal-50' : ''}`}>
                    <td className="px-3 py-2 w-8">
                      <input type="checkbox" checked={selected.has(est.id)}
                        onChange={() => toggleSelect(est.id)} className="rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                    </td>
                    <td className="px-3 py-2 overflow-hidden">
                      <Link to={`/establecimientos/${est.id}`}
                        className="text-xs font-semibold text-teal-600 hover:text-teal-800 truncate block"
                        title={clienteMap[est.clienteCuit || (est as any).clienteId]}>
                        {clienteMap[est.clienteCuit || (est as any).clienteId] || <span className="text-slate-300">—</span>}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600 truncate overflow-hidden" title={est.nombre}>
                      {est.nombre}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600 truncate overflow-hidden" title={est.direccion}>{est.direccion}</td>
                    <td className="px-3 py-2 text-xs text-slate-600 truncate overflow-hidden">{est.localidad}</td>
                    <td className="px-3 py-2 text-xs text-slate-600 truncate overflow-hidden">{est.provincia}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        est.activo ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {est.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <Link to={`/establecimientos/${est.id}`}
                          className="text-[10px] font-medium text-teal-600 hover:text-teal-800 px-1.5 py-0.5 rounded hover:bg-teal-50">
                          Editar
                        </Link>
                        <button onClick={() => handleDelete(est)}
                          className="text-[10px] font-medium text-red-500 hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-red-50">
                          Eliminar
                        </button>
                        <Link to={`/establecimientos/${est.id}`}
                          className="text-[10px] font-medium text-emerald-600 hover:text-emerald-800 px-1.5 py-0.5 rounded hover:bg-emerald-50">
                          Ver
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateEstablecimientoModal open={showCreate} onClose={() => setShowCreate(false)}
        onCreated={loadData} preselectedClienteId={filters.cliente || undefined} />
      <BulkAddressValidationModal open={showBulkAddress} onClose={() => setShowBulkAddress(false)}
        establecimientos={establecimientos} clienteMap={clienteMap} onUpdated={loadData} />
    </div>
  );
};
