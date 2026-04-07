import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { clientesService, establecimientosService } from '../../services/firebaseService';
import { useDebounce } from '../../hooks/useDebounce';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import type { Cliente } from '@ags/shared';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { CreateClienteModal } from '../../components/clientes/CreateClienteModal';
import { BulkCuitValidationModal } from '../../components/clientes/BulkCuitValidationModal';
import { useResizableColumns } from '../../hooks/useResizableColumns';
import { useBackgroundTasks } from '../../contexts/BackgroundTasksContext';
import { useConfirm } from '../../components/ui/ConfirmDialog';

const thClass = 'px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap relative';

const ResizeHandle = ({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) => (
  <div onMouseDown={onMouseDown} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40 z-20" />
);

const ESTADO_TABS = [
  { value: 'activos', label: 'Activos' },
  { value: 'inactivos', label: 'Inactivos' },
  { value: 'todos', label: 'Todos' },
] as const;
export const ClientesList = () => {
  const confirm = useConfirm();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [establecimientosByCliente, setEstablecimientosByCliente] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const unsubClientesRef = useRef<(() => void) | null>(null);
  const unsubEstRef = useRef<(() => void) | null>(null);
  const bgTasks = useBackgroundTasks();
  const hasCuitTask = !!bgTasks.getTask('bulk-cuit-validation');
  const [showCreate, setShowCreate] = useState(false);
  const [showBulkValidation, setShowBulkValidation] = useState(hasCuitTask);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkActioning, setBulkActioning] = useState(false);

  const FILTER_SCHEMA = useMemo(() => ({
    search:    { type: 'string' as const, default: '' },
    estadoTab: { type: 'string' as const, default: 'activos' },
    sortField: { type: 'string' as const, default: 'razonSocial' },
    sortDir:   { type: 'string' as const, default: 'asc' },
  }), []);
  const [filters, setFilter] = useUrlFilters(FILTER_SCHEMA);
  // Local search state for responsive typing — syncs to URL debounced
  const [localSearch, setLocalSearch] = useState(filters.search);
  const debouncedSearch = useDebounce(localSearch, 300);
  useEffect(() => { setFilter('search', debouncedSearch); }, [debouncedSearch]);
  // Sync from URL → local only when URL changes externally (e.g., "Limpiar" button)
  useEffect(() => { if (filters.search !== localSearch && filters.search === '') setLocalSearch(''); }, [filters.search]);
  const { tableRef, colWidths, onResizeStart } = useResizableColumns('clientes-list');

  const handleSort = (f: string) => {
    const s = toggleSort(f, filters.sortField, filters.sortDir as SortDir);
    setFilter('sortField', s.field); setFilter('sortDir', s.dir);
  };

  useEffect(() => {
    unsubClientesRef.current?.();
    unsubClientesRef.current = clientesService.subscribe(
      false,
      (data) => { setClientes(data); setLoading(false); },
      (err) => { console.error('Clientes subscription error:', err); setLoading(false); },
    );
    unsubEstRef.current?.();
    unsubEstRef.current = establecimientosService.subscribe(
      (establecimientos) => {
        const byCliente: Record<string, number> = {};
        establecimientos.forEach((e) => {
          byCliente[e.clienteCuit] = (byCliente[e.clienteCuit] ?? 0) + 1;
        });
        setEstablecimientosByCliente(byCliente);
      },
      (err) => { console.error('Establecimientos subscription error:', err); },
    );
    return () => { unsubClientesRef.current?.(); unsubEstRef.current?.(); };
  }, []);

  const loadClientes = useCallback(() => {}, []);

  const handleDeactivate = async (cliente: Cliente) => {
    const action = cliente.activo ? 'desactivar' : 'reactivar';
    if (!await confirm(`¿${action.charAt(0).toUpperCase() + action.slice(1)} "${cliente.razonSocial}"?`)) return;
    try {
      await clientesService.update(cliente.id, { activo: !cliente.activo });
    } catch (e) {
      console.error(`Error al ${action} cliente:`, e);
      alert(`Error al ${action} el cliente`);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === deferredFiltered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(deferredFiltered.map(c => c.id)));
    }
  };

  const handleBulkDeactivate = async () => {
    if (selected.size === 0) return;
    const allActive = [...selected].every(id => {
      const c = clientes.find(cl => cl.id === id);
      return c?.activo !== false;
    });
    const action = allActive ? 'desactivar' : 'cambiar estado de';
    if (!await confirm(`¿${action.charAt(0).toUpperCase() + action.slice(1)} ${selected.size} cliente(s)?`)) return;
    setBulkActioning(true);
    try {
      for (const id of selected) {
        const c = clientes.find(cl => cl.id === id);
        if (c) await clientesService.update(id, { activo: !c.activo });
      }
      setSelected(new Set());
    } catch (e) {
      console.error('Error en acción masiva:', e);
      alert('Error al procesar la acción masiva');
    } finally {
      setBulkActioning(false);
    }
  };

  const filtered = useMemo(() => {
    let result = clientes;
    if (filters.estadoTab === 'activos') result = result.filter(c => c.activo !== false);
    else if (filters.estadoTab === 'inactivos') result = result.filter(c => c.activo === false);
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      result = result.filter(c =>
        c.razonSocial.toLowerCase().includes(q) ||
        (c.cuit || '').toLowerCase().includes(q) ||
        (c.rubro || '').toLowerCase().includes(q)
      );
    }
    return sortByField(result, filters.sortField, filters.sortDir as SortDir);
  }, [clientes, debouncedSearch, filters.estadoTab, filters.sortField, filters.sortDir]);

  const deferredFiltered = filtered;

  // Determine bulk action label based on selected clients' state
  const bulkLabel = useMemo(() => {
    if (selected.size === 0) return '';
    const allActive = [...selected].every(id => clientes.find(c => c.id === id)?.activo !== false);
    const allInactive = [...selected].every(id => clientes.find(c => c.id === id)?.activo === false);
    if (allActive) return `Desactivar (${selected.size})`;
    if (allInactive) return `Reactivar (${selected.size})`;
    return `Cambiar estado (${selected.size})`;
  }, [selected, clientes]);

  const isInitialLoad = loading && clientes.length === 0;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader title="Clientes" count={isInitialLoad ? undefined : filtered.length}
        actions={
          <div className="flex gap-2 items-center">
            {selected.size > 0 && (
              <Button size="sm" variant="outline" onClick={handleBulkDeactivate} disabled={bulkActioning}
                className="!border-red-300 !text-red-600 hover:!bg-red-50">
                {bulkActioning ? 'Procesando...' : bulkLabel}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setShowBulkValidation(true)}>Validar CUITs</Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>+ Nuevo Cliente</Button>
          </div>
        }>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Buscar por razón social, CUIT, rubro..."
            value={localSearch}
            onChange={e => setLocalSearch(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 w-64"
          />
          <div className="flex items-center gap-1.5">
            {ESTADO_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setFilter('estadoTab', tab.value)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                  filters.estadoTab === tab.value
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </PageHeader>

      <div className="flex-1 min-h-0 px-5 pb-4">
        {isInitialLoad ? (
          <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando clientes...</p></div>
        ) : deferredFiltered.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-slate-400">No se encontraron clientes</p>
              <button onClick={() => setShowCreate(true)} className="text-teal-600 hover:underline mt-2 inline-block text-xs">
                Crear primer cliente
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
                    <input type="checkbox" checked={selected.size > 0 && selected.size === deferredFiltered.length}
                      onChange={toggleSelectAll} className="rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                  </th>
                  <SortableHeader label="Razón Social" field="razonSocial" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={thClass}>
                    <ResizeHandle onMouseDown={e => onResizeStart(1, e)} />
                  </SortableHeader>
                  <th className={thClass}>CUIT<ResizeHandle onMouseDown={e => onResizeStart(2, e)} /></th>
                  <SortableHeader label="Rubro" field="rubro" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={thClass}>
                    <ResizeHandle onMouseDown={e => onResizeStart(3, e)} />
                  </SortableHeader>
                  <th className={`${thClass} text-center`}>Establec.</th>
                  <th className={thClass}>Estado</th>
                  <th className={`${thClass} text-center`}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deferredFiltered.map((cliente) => (
                  <tr key={cliente.id} className={`hover:bg-slate-50 transition-colors ${selected.has(cliente.id) ? 'bg-teal-50' : ''}`}>
                    <td className="px-3 py-2 w-8">
                      <input type="checkbox" checked={selected.has(cliente.id)}
                        onChange={() => toggleSelect(cliente.id)} className="rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                    </td>
                    <td className="px-3 py-2 overflow-hidden">
                      <Link to={`/clientes/${cliente.id}`}
                        className="text-xs font-semibold text-teal-600 hover:text-teal-800 truncate block"
                        title={cliente.razonSocial}>
                        {cliente.razonSocial}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600 font-mono whitespace-nowrap overflow-hidden">{cliente.cuit || <span className="text-slate-300">—</span>}</td>
                    <td className="px-3 py-2 text-xs text-slate-600 truncate overflow-hidden">{cliente.rubro || <span className="text-slate-300">—</span>}</td>
                    <td className="px-3 py-2 text-xs text-slate-600 text-center tabular-nums whitespace-nowrap">{establecimientosByCliente[cliente.id] ?? 0}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        cliente.activo !== false ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {cliente.activo !== false ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <Link to={`/clientes/${cliente.id}`}
                          className="text-[10px] font-medium text-teal-600 hover:text-teal-800 px-1.5 py-0.5 rounded hover:bg-teal-50">
                          Editar
                        </Link>
                        <button onClick={() => handleDeactivate(cliente)}
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            cliente.activo !== false
                              ? 'text-red-500 hover:text-red-700 hover:bg-red-50'
                              : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                          }`}>
                          {cliente.activo !== false ? 'Desactivar' : 'Reactivar'}
                        </button>
                        <Link to={`/clientes/${cliente.id}`}
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

      <CreateClienteModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={loadClientes} />
      <BulkCuitValidationModal open={showBulkValidation} onClose={() => setShowBulkValidation(false)} clientes={clientes} />
    </div>
  );
};
