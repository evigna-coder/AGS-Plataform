import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { sistemasService, categoriasEquipoService, clientesService, establecimientosService } from '../../services/firebaseService';
import { useDebounce } from '../../hooks/useDebounce';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import type { Sistema, CategoriaEquipo, Cliente, Establecimiento } from '@ags/shared';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { PageHeader } from '../../components/ui/PageHeader';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { CreateEquipoModal } from '../../components/equipos/CreateEquipoModal';
import QREquipoModal from '../../components/equipos/QREquipoModal';
import { Modal } from '../../components/ui/Modal';
import { useResizableColumns } from '../../hooks/useResizableColumns';

const thClass = 'px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap relative';

const ResizeHandle = ({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) => (
  <div onMouseDown={onMouseDown} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40 z-20" />
);

const ESTADO_TABS = [
  { value: 'activos', label: 'Activos' },
  { value: 'inactivos', label: 'Inactivos' },
  { value: 'todos', label: 'Todos' },
] as const;
export const EquiposList = () => {
  const FILTER_SCHEMA = useMemo(() => ({
    search: { type: 'string' as const, default: '' },
    estadoTab: { type: 'string' as const, default: 'activos' },
    categoriaFilter: { type: 'string' as const, default: '' },
    cliente: { type: 'string' as const, default: '' },
    sortField: { type: 'string' as const, default: 'cliente' },
    sortDir: { type: 'string' as const, default: 'asc' },
  }), []);
  const [filters, setFilter] = useUrlFilters(FILTER_SCHEMA);
  const debouncedSearch = useDebounce(filters.search, 300);

  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [categorias, setCategorias] = useState<CategoriaEquipo[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [qrSistema, setQrSistema] = useState<Sistema | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [showReassign, setShowReassign] = useState(false);
  const [reassignClienteId, setReassignClienteId] = useState('');
  const [reassignEstId, setReassignEstId] = useState('');
  const [reassignSector, setReassignSector] = useState('');
  const [reassigning, setReassigning] = useState(false);
  const { tableRef, colWidths, onResizeStart } = useResizableColumns();

  const handleSort = (f: string) => {
    const s = toggleSort(f, filters.sortField, filters.sortDir as SortDir);
    setFilter('sortField', s.field); setFilter('sortDir', s.dir);
  };

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sistemasData, categoriasData, clientesData, establecimientosData] = await Promise.all([
        sistemasService.getAll({
          clienteId: filters.cliente || undefined,
        }),
        categoriasEquipoService.getAll(),
        clientesService.getAll(),
        establecimientosService.getAll(),
      ]);
      setSistemas(sistemasData);
      setCategorias(categoriasData);
      setClientes(clientesData);
      setEstablecimientos(establecimientosData);
    } catch (error) {
      console.error('Error cargando datos:', error);
      alert('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const clienteMap = useMemo(() => {
    const map: Record<string, string> = {};
    clientes.forEach(c => {
      map[c.id] = c.razonSocial;
      if (c.cuit) map[c.cuit] = c.razonSocial;
      const digits = (c.cuit || c.id).replace(/\D/g, '');
      if (digits) map[digits] = c.razonSocial;
    });
    return map;
  }, [clientes]);

  const estMap = useMemo(() => {
    const map: Record<string, Establecimiento> = {};
    establecimientos.forEach(e => { map[e.id] = e; });
    return map;
  }, [establecimientos]);

  const catMap = useMemo(() => {
    const map: Record<string, string> = {};
    categorias.forEach(c => { map[c.id] = c.nombre; });
    return map;
  }, [categorias]);

  const sistemasFiltrados = useMemo(() => {
    let result = sistemas;
    if (filters.estadoTab === 'activos') result = result.filter(s => s.activo !== false);
    else if (filters.estadoTab === 'inactivos') result = result.filter(s => s.activo === false);
    if (filters.categoriaFilter) result = result.filter(s => s.categoriaId === filters.categoriaFilter);
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      result = result.filter(s => {
        const est = estMap[s.establecimientoId || ''];
        const clienteName = clienteMap[est?.clienteCuit ?? s.clienteId ?? ''] || '';
        return (
          s.nombre.toLowerCase().includes(q) ||
          clienteName.toLowerCase().includes(q) ||
          (est?.nombre || '').toLowerCase().includes(q) ||
          (s.codigoInternoCliente || '').toLowerCase().includes(q) ||
          (s.software || '').toLowerCase().includes(q)
        );
      });
    }
    if (filters.sortField === 'cliente') {
      const dir = filters.sortDir === 'asc' ? 1 : -1;
      result = [...result].sort((a, b) => {
        const estA = estMap[a.establecimientoId || ''];
        const estB = estMap[b.establecimientoId || ''];
        const nameA = (clienteMap[estA?.clienteCuit ?? a.clienteId ?? ''] || '').toLowerCase();
        const nameB = (clienteMap[estB?.clienteCuit ?? b.clienteId ?? ''] || '').toLowerCase();
        return nameA.localeCompare(nameB) * dir;
      });
      return result;
    }
    return sortByField(result, filters.sortField, filters.sortDir as SortDir);
  }, [sistemas, filters.estadoTab, filters.categoriaFilter, debouncedSearch, clienteMap, estMap, filters.sortField, filters.sortDir]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === sistemasFiltrados.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sistemasFiltrados.map(s => s.id)));
    }
  };

  const handleDeleteSistema = async (sistemaId: string, sistemaNombre: string) => {
    if (!confirm(`¿Eliminar el sistema "${sistemaNombre}"?\n\nEsta acción eliminará también todos los módulos asociados y no se puede deshacer.`)) return;
    try {
      await sistemasService.delete(sistemaId);
      await loadData();
    } catch (error) {
      console.error('Error eliminando sistema:', error);
      alert('Error al eliminar el sistema');
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`¿Eliminar ${selected.size} sistema(s)?\n\nEsta acción eliminará también todos los módulos asociados y no se puede deshacer.`)) return;
    setDeleting(true);
    try {
      for (const id of selected) {
        await sistemasService.delete(id);
      }
      setSelected(new Set());
      await loadData();
    } catch (error) {
      console.error('Error eliminando sistemas:', error);
      alert('Error al eliminar sistemas');
    } finally {
      setDeleting(false);
    }
  };

  const reassignEstFiltrados = useMemo(() => {
    if (!reassignClienteId) return [];
    return establecimientos.filter(e => e.clienteCuit === reassignClienteId);
  }, [reassignClienteId, establecimientos]);

  const reassignEstSectores = useMemo(() => {
    if (!reassignEstId) return [];
    const est = estMap[reassignEstId];
    return est?.sectores || [];
  }, [reassignEstId, estMap]);

  const openReassign = () => {
    const firstSelected = sistemas.find(s => selected.has(s.id));
    if (firstSelected) {
      const est = estMap[firstSelected.establecimientoId || ''];
      setReassignClienteId(est?.clienteCuit || (firstSelected as any).clienteId || (firstSelected as any).clienteCuit || '');
    }
    setReassignEstId('');
    setReassignSector('');
    setShowReassign(true);
  };

  const handleReassign = async () => {
    if (!reassignEstId) { alert('Seleccione un establecimiento destino'); return; }
    setReassigning(true);
    try {
      for (const id of selected) {
        await sistemasService.update(id, {
          establecimientoId: reassignEstId,
          ...(reassignSector ? { sector: reassignSector } : {}),
        });
      }
      setSelected(new Set());
      setShowReassign(false);
      await loadData();
    } catch (error) {
      console.error('Error reasignando sistemas:', error);
      alert('Error al reasignar');
    } finally {
      setReassigning(false);
    }
  };

  if (loading && sistemas.length === 0) {
    return <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando equipos...</p></div>;
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader title="Equipos / Sistemas" count={sistemasFiltrados.length}
        actions={
          <div className="flex gap-2 items-center">
            {selected.size > 0 && (
              <>
                <Button size="sm" variant="outline" onClick={openReassign}>
                  Reasignar ({selected.size})
                </Button>
                <Button size="sm" variant="outline" onClick={handleBulkDelete} disabled={deleting}
                  className="!border-red-300 !text-red-600 hover:!bg-red-50">
                  {deleting ? 'Eliminando...' : `Eliminar (${selected.size})`}
                </Button>
              </>
            )}
            <Button size="sm" onClick={() => setShowCreate(true)}>+ Nuevo Sistema</Button>
            <Link to="/categorias-equipo">
              <Button size="sm" variant="outline">Categorías</Button>
            </Link>
          </div>
        }>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Buscar por nombre, cliente, establecimiento, código..."
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 w-72"
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
          <div className="min-w-[120px]">
            <SearchableSelect size="sm"
              value={filters.categoriaFilter}
              onChange={(v) => setFilter('categoriaFilter', v)}
              options={[{ value: '', label: 'Categoría: Todas' }, ...categorias.map(cat => ({ value: cat.id, label: cat.nombre }))]}
              placeholder="Categoría"
            />
          </div>
          {(filters.categoriaFilter || filters.search) && (
            <Button size="sm" variant="ghost" onClick={() => { setFilter('categoriaFilter', ''); setFilter('search', ''); }}>
              Limpiar
            </Button>
          )}
        </div>
      </PageHeader>

      <div className="flex-1 min-h-0 px-5 pb-4">
        {sistemasFiltrados.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-slate-400">No se encontraron sistemas</p>
              <button onClick={() => setShowCreate(true)} className="text-teal-600 hover:underline mt-2 inline-block text-xs">
                Crear primer sistema
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
                    <input type="checkbox" checked={selected.size > 0 && selected.size === sistemasFiltrados.length}
                      onChange={toggleSelectAll} className="rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                  </th>
                  <SortableHeader label="Cliente" field="cliente" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={thClass}>
                    <ResizeHandle onMouseDown={e => onResizeStart(1, e)} />
                  </SortableHeader>
                  <SortableHeader label="Nombre" field="nombre" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={thClass}>
                    <ResizeHandle onMouseDown={e => onResizeStart(2, e)} />
                  </SortableHeader>
                  <th className={thClass}>Establecimiento<ResizeHandle onMouseDown={e => onResizeStart(3, e)} /></th>
                  <SortableHeader label="Categoría" field="categoriaId" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={thClass}>
                    <ResizeHandle onMouseDown={e => onResizeStart(4, e)} />
                  </SortableHeader>
                  <th className={thClass}>Sector<ResizeHandle onMouseDown={e => onResizeStart(5, e)} /></th>
                  <th className={thClass}>Código<ResizeHandle onMouseDown={e => onResizeStart(6, e)} /></th>
                  <th className={thClass}>Software<ResizeHandle onMouseDown={e => onResizeStart(7, e)} /></th>
                  <th className={thClass}>Estado</th>
                  <th className={`${thClass} text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sistemasFiltrados.map((sistema) => {
                  const est = estMap[sistema.establecimientoId || ''];
                  const clienteName = clienteMap[est?.clienteCuit ?? sistema.clienteId ?? ''];
                  return (
                    <tr key={sistema.id} className={`hover:bg-slate-50 transition-colors ${selected.has(sistema.id) ? 'bg-teal-50' : ''}`}>
                      <td className="px-3 py-2 w-8">
                        <input type="checkbox" checked={selected.has(sistema.id)}
                          onChange={() => toggleSelect(sistema.id)} className="rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                      </td>
                      <td className="px-3 py-2 overflow-hidden">
                        <Link to={`/equipos/${sistema.id}`}
                          className="text-xs font-semibold text-teal-600 hover:text-teal-800 truncate block"
                          title={clienteName}>
                          {clienteName || <span className="text-slate-300">—</span>}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600 truncate overflow-hidden" title={sistema.nombre}>
                        {sistema.nombre}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600 truncate overflow-hidden">{est?.nombre || <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-2 text-xs text-slate-600 truncate">{catMap[sistema.categoriaId] || <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-2 text-xs text-slate-600 truncate">{sistema.sector || <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-2 text-xs font-mono text-slate-600 whitespace-nowrap">{sistema.codigoInternoCliente || <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-2 text-xs text-slate-600 truncate">{sistema.software || <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                            sistema.activo ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {sistema.activo ? 'Activo' : 'Inactivo'}
                          </span>
                          {sistema.enContrato && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                              Contrato
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Link to={`/equipos/${sistema.id}`}
                            className="text-[10px] font-medium text-teal-600 hover:text-teal-800 px-1.5 py-0.5 rounded hover:bg-teal-50">
                            Editar
                          </Link>
                          {sistema.agsVisibleId && (
                            <button onClick={() => setQrSistema(sistema)}
                              className="text-[10px] font-medium text-slate-500 hover:text-slate-700 px-1.5 py-0.5 rounded hover:bg-slate-100"
                              title={`QR — ${sistema.agsVisibleId}`}>
                              QR
                            </button>
                          )}
                          <button onClick={() => handleDeleteSistema(sistema.id, sistema.nombre)}
                            className="text-[10px] font-medium text-red-500 hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-red-50">
                            Eliminar
                          </button>
                          <Link to={`/equipos/${sistema.id}`}
                            className="text-[10px] font-medium text-emerald-600 hover:text-emerald-800 px-1.5 py-0.5 rounded hover:bg-emerald-50">
                            Ver
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateEquipoModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={loadData} />

      <Modal open={showReassign} onClose={() => setShowReassign(false)} title="Reasignar sistemas"
        subtitle={`${selected.size} sistema(s) seleccionado(s)`}
        footer={<>
          <Button variant="outline" size="sm" onClick={() => setShowReassign(false)}>Cancelar</Button>
          <Button size="sm" onClick={handleReassign} disabled={reassigning || !reassignEstId}>
            {reassigning ? 'Reasignando...' : 'Reasignar'}
          </Button>
        </>}>
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Cliente</label>
            <SearchableSelect value={reassignClienteId}
              onChange={v => { setReassignClienteId(v); setReassignEstId(''); }}
              options={clientes.map(c => ({ value: c.id, label: c.razonSocial }))}
              placeholder="Seleccionar cliente..." />
          </div>
          {reassignClienteId && (
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Establecimiento destino *</label>
              <SearchableSelect value={reassignEstId}
                onChange={v => { setReassignEstId(v); setReassignSector(''); }}
                options={reassignEstFiltrados.map(e => ({ value: e.id, label: `${e.nombre} — ${e.localidad}` }))}
                placeholder="Seleccionar establecimiento..." />
              {reassignEstFiltrados.length === 0 && (
                <p className="text-[10px] text-amber-600 mt-1">Este cliente no tiene establecimientos registrados.</p>
              )}
            </div>
          )}
          {reassignEstId && (
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Sector (opcional)</label>
              {reassignEstSectores.length > 0 ? (
                <SearchableSelect value={reassignSector}
                  onChange={setReassignSector}
                  options={[{ value: '', label: 'Sin sector' }, ...reassignEstSectores.map(s => ({ value: s, label: s }))]}
                  placeholder="Seleccionar sector..." />
              ) : (
                <input type="text" value={reassignSector} onChange={e => setReassignSector(e.target.value)}
                  placeholder="Ej: Control de Calidad"
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500" />
              )}
            </div>
          )}
          {selected.size > 0 && (
            <div className="bg-slate-50 rounded-lg p-3 max-h-40 overflow-y-auto">
              <p className="text-[10px] font-medium text-slate-500 mb-2">Sistemas seleccionados:</p>
              {sistemas.filter(s => selected.has(s.id)).map(s => (
                <div key={s.id} className="text-[11px] text-slate-600 py-0.5">{s.nombre} — {s.codigoInternoCliente || 'sin código'}</div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {qrSistema?.agsVisibleId && (
        <QREquipoModal
          agsVisibleId={qrSistema.agsVisibleId}
          equipoNombre={qrSistema.nombre}
          onClose={() => setQrSistema(null)}
        />
      )}
    </div>
  );
};
