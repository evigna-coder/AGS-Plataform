import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { articulosService, marcasService } from '../../services/firebaseService';
import { useDebounce } from '../../hooks/useDebounce';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useResizableColumns } from '../../hooks/useResizableColumns';
import { ColAlignIcon } from '../../components/ui/ColAlignIcon';

import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { CreateArticuloModal } from '../../components/stock/CreateArticuloModal';
import { EditArticuloModal } from '../../components/stock/EditArticuloModal';
import { ViewArticuloModal } from '../../components/stock/ViewArticuloModal';
import type { Articulo, Marca, CategoriaEquipoStock, TipoArticulo } from '@ags/shared';
import { useConfirm } from '../../components/ui/ConfirmDialog';

const CATEGORIA_LABELS: Record<CategoriaEquipoStock, string> = {
  HPLC: 'HPLC', GC: 'GC', MSD: 'MSD', UV: 'UV', OSMOMETRO: 'Osmometro', GENERAL: 'General',
};
const TIPO_LABELS: Record<TipoArticulo, string> = {
  repuesto: 'Repuesto', consumible: 'Consumible', equipo: 'Equipo', columna: 'Columna',
  accesorio: 'Accesorio', muestra: 'Muestra', otro: 'Otro',
};

export const ArticulosList = () => {
  const confirm = useConfirm();
  const { tableRef, colWidths, colAligns, onResizeStart, onAutoFit, cycleAlign, getAlignClass } = useResizableColumns('articulos-list');
  const FILTER_SCHEMA = useMemo(() => ({
    search: { type: 'string' as const, default: '' },
    categoriaEquipo: { type: 'string' as const, default: '' },
    marcaId: { type: 'string' as const, default: '' },
    tipo: { type: 'string' as const, default: '' },
    showInactive: { type: 'boolean' as const, default: false },
  }), []);
  const [filters, setFilter] = useUrlFilters(FILTER_SCHEMA);
  const debouncedSearch = useDebounce(filters.search, 300);

  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const unsubRef = useRef<(() => void) | null>(null);

  // Load reference data (marcas) once
  useEffect(() => {
    marcasService.getAll(false).then(data => setMarcas(data as Marca[]));
  }, []);

  // Subscribe to articulos with current filters
  useEffect(() => {
    unsubRef.current?.();
    unsubRef.current = articulosService.subscribe(
      {
        categoriaEquipo: filters.categoriaEquipo || undefined,
        marcaId: filters.marcaId || undefined,
        tipo: filters.tipo || undefined,
        activoOnly: !filters.showInactive,
      },
      (data) => { setArticulos(data); setLoading(false); },
      (err) => { console.error('Error cargando articulos:', err); setLoading(false); },
    );
    return () => { unsubRef.current?.(); };
  }, [filters.categoriaEquipo, filters.marcaId, filters.tipo, filters.showInactive]);

  const loadData = useCallback(() => {}, []);

  const handleDeactivate = async (art: Articulo) => {
    if (!await confirm(`Desactivar el articulo "${art.codigo} - ${art.descripcion}"?`)) return;
    try {
      await articulosService.deactivate(art.id);
    } catch (error) {
      console.error('Error desactivando articulo:', error);
      alert('Error al desactivar el articulo');
    }
  };

  const handleDelete = async (art: Articulo) => {
    if (!await confirm(`Eliminar permanentemente "${art.codigo}"?\n\nEsta accion no se puede deshacer.`)) return;
    try {
      await articulosService.delete(art.id);
    } catch (error) {
      console.error('Error eliminando articulo:', error);
      alert('Error al eliminar el articulo');
    }
  };

  const getMarcaNombre = (art: Articulo) => {
    if (art.marcaId) return marcas.find(m => m.id === art.marcaId)?.nombre ?? '-';
    return (art as any).marca || '-';
  };

  const filtered = useMemo(() => {
    if (!debouncedSearch) return articulos;
    const term = debouncedSearch.toLowerCase();
    return articulos.filter(a =>
      a.codigo.toLowerCase().includes(term) || a.descripcion.toLowerCase().includes(term)
    );
  }, [articulos, debouncedSearch]);

  // ─── Selection helpers ──────────────────────────────────────────────────────
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev =>
      prev.size === filtered.length ? new Set() : new Set(filtered.map(a => a.id)),
    );
  }, [filtered]);

  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length;

  const [bulkLoading, setBulkLoading] = useState(false);

  // Process in batches of 100 to avoid Firestore rate limits
  const processBatched = async (ids: string[], fn: (id: string) => Promise<void>) => {
    const arr = [...ids];
    for (let i = 0; i < arr.length; i += 100) {
      await Promise.all(arr.slice(i, i + 100).map(fn));
    }
  };

  const handleBulkDeactivate = async () => {
    if (selectedIds.size === 0) return;
    if (!await confirm(`Desactivar ${selectedIds.size} articulo(s)?`)) return;
    try {
      setBulkLoading(true);
      await processBatched([...selectedIds], id => articulosService.deactivate(id));
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error en desactivacion masiva:', error);
      alert('Error al desactivar articulos');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!await confirm(`Eliminar permanentemente ${selectedIds.size} articulo(s)?\n\nEsta accion no se puede deshacer.`)) return;
    try {
      setBulkLoading(true);
      await processBatched([...selectedIds], id => articulosService.delete(id));
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error en eliminacion masiva:', error);
      alert('Error al eliminar articulos');
    } finally {
      setBulkLoading(false);
    }
  };

  const isInitialLoad = loading && articulos.length === 0;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Articulos"
        subtitle="Catalogo de articulos de stock"
        count={isInitialLoad ? undefined : filtered.length}
        actions={
          <Button size="sm" onClick={() => setShowCreate(true)}>+ Nuevo articulo</Button>
        }
      >
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Buscar por codigo o descripcion..."
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs w-56 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <select
            value={filters.categoriaEquipo}
            onChange={e => setFilter('categoriaEquipo', e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">Todas las categorias</option>
            {(Object.keys(CATEGORIA_LABELS) as CategoriaEquipoStock[]).map(k => (
              <option key={k} value={k}>{CATEGORIA_LABELS[k]}</option>
            ))}
          </select>
          <select
            value={filters.marcaId}
            onChange={e => setFilter('marcaId', e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">Todas las marcas</option>
            {marcas.map(m => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </select>
          <select
            value={filters.tipo}
            onChange={e => setFilter('tipo', e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">Todos los tipos</option>
            {(Object.keys(TIPO_LABELS) as TipoArticulo[]).map(k => (
              <option key={k} value={k}>{TIPO_LABELS[k]}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-500">
            <input
              type="checkbox"
              checked={filters.showInactive}
              onChange={e => setFilter('showInactive', e.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-300"
            />
            Mostrar inactivos
          </label>
        </div>
      </PageHeader>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="mx-5 mb-2 flex items-center gap-3 bg-teal-50 border border-teal-200 rounded-lg px-4 py-2">
          <span className="text-xs font-medium text-teal-800">{selectedIds.size} seleccionado(s)</span>
          {bulkLoading ? (
            <span className="flex items-center gap-2 text-xs text-teal-700">
              <span className="inline-block w-3.5 h-3.5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
              Procesando...
            </span>
          ) : (
            <>
              <button onClick={handleBulkDeactivate} className="text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-2 py-0.5 rounded transition-colors">Desactivar</button>
              <button onClick={handleBulkDelete} className="text-[11px] font-medium text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-0.5 rounded transition-colors">Eliminar</button>
              <button onClick={() => setSelectedIds(new Set())} className="text-[11px] text-slate-400 hover:text-slate-600 ml-auto">Deseleccionar</button>
            </>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
        {isInitialLoad ? (
          <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando articulos...</p></div>
        ) : filtered.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-slate-400">No se encontraron articulos</p>
              <button onClick={() => setShowCreate(true)} className="text-teal-600 hover:underline mt-2 inline-block text-xs">
                Crear primer articulo
              </button>
            </div>
          </Card>
        ) : (
          <div className="bg-white overflow-x-auto">
              <table ref={tableRef} className="w-full table-fixed">
                {colWidths ? (
                  <colgroup>{colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
                ) : (
                  <colgroup>
                    <col style={{ width: '4%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '24%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '9%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '13%' }} />
                  </colgroup>
                )}
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 w-8 relative">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        className="w-3.5 h-3.5 rounded border-slate-300 accent-teal-700"
                      />
                      <div onMouseDown={e => onResizeStart(0, e)} onDoubleClick={() => onAutoFit(0)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                    </th>
                    <th className={`px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap relative ${getAlignClass(1)}`}>
                      <ColAlignIcon align={colAligns?.[1] || 'left'} onClick={() => cycleAlign(1)} />
                      Codigo
                      <div onMouseDown={e => onResizeStart(1, e)} onDoubleClick={() => onAutoFit(1)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                    </th>
                    <th className={`px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider relative ${getAlignClass(2)}`}>
                      <ColAlignIcon align={colAligns?.[2] || 'left'} onClick={() => cycleAlign(2)} />
                      Descripcion
                      <div onMouseDown={e => onResizeStart(2, e)} onDoubleClick={() => onAutoFit(2)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                    </th>
                    <th className={`px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider relative ${getAlignClass(3)}`}>
                      <ColAlignIcon align={colAligns?.[3] || 'left'} onClick={() => cycleAlign(3)} />
                      Marca
                      <div onMouseDown={e => onResizeStart(3, e)} onDoubleClick={() => onAutoFit(3)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                    </th>
                    <th className={`px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider relative ${getAlignClass(4)}`}>
                      <ColAlignIcon align={colAligns?.[4] || 'left'} onClick={() => cycleAlign(4)} />
                      Categoria
                      <div onMouseDown={e => onResizeStart(4, e)} onDoubleClick={() => onAutoFit(4)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                    </th>
                    <th className={`px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider relative ${getAlignClass(5)}`}>
                      <ColAlignIcon align={colAligns?.[5] || 'left'} onClick={() => cycleAlign(5)} />
                      Tipo
                      <div onMouseDown={e => onResizeStart(5, e)} onDoubleClick={() => onAutoFit(5)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                    </th>
                    <th className={`px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider relative ${getAlignClass(6)}`}>
                      <ColAlignIcon align={colAligns?.[6] || 'left'} onClick={() => cycleAlign(6)} />
                      Stock min.
                      <div onMouseDown={e => onResizeStart(6, e)} onDoubleClick={() => onAutoFit(6)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                    </th>
                    <th className={`px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider relative ${getAlignClass(7)}`}>
                      <ColAlignIcon align={colAligns?.[7] || 'left'} onClick={() => cycleAlign(7)} />
                      Precio ref.
                      <div onMouseDown={e => onResizeStart(7, e)} onDoubleClick={() => onAutoFit(7)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                    </th>
                    <th className="px-4 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider relative">
                      Acciones
                      <div onMouseDown={e => onResizeStart(8, e)} onDoubleClick={() => onAutoFit(8)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(art => (
                    <tr key={art.id} className={`hover:bg-slate-50 ${!art.activo ? 'opacity-50' : ''} ${selectedIds.has(art.id) ? 'bg-teal-50/50' : ''}`}>
                      <td className="px-3 py-2 w-8">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(art.id)}
                          onChange={() => toggleSelect(art.id)}
                          className="w-3.5 h-3.5 rounded border-slate-300 accent-teal-700"
                        />
                      </td>
                      <td className={`px-4 py-2 whitespace-nowrap ${getAlignClass(1)}`}>
                        <button onClick={() => setViewId(art.id)} className="font-mono text-xs font-semibold text-teal-700 hover:text-teal-800 hover:underline text-left">
                          {art.codigo}
                        </button>
                      </td>
                      <td className={`px-4 py-2 text-xs text-slate-900 max-w-md truncate ${getAlignClass(2)}`}>
                        <button onClick={() => setViewId(art.id)} className="hover:text-teal-700 hover:underline text-left">
                          {art.descripcion}
                        </button>
                      </td>
                      <td className={`px-4 py-2 text-xs text-slate-600 ${getAlignClass(3)}`}>{getMarcaNombre(art)}</td>
                      <td className={`px-4 py-2 ${getAlignClass(4)}`}>
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">
                          {CATEGORIA_LABELS[art.categoriaEquipo] ?? art.categoriaEquipo}
                        </span>
                      </td>
                      <td className={`px-4 py-2 ${getAlignClass(5)}`}>
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-teal-50 text-teal-700">
                          {TIPO_LABELS[art.tipo] ?? art.tipo}
                        </span>
                      </td>
                      <td className={`px-4 py-2 text-xs text-slate-600 ${getAlignClass(6)}`}>{art.stockMinimo}</td>
                      <td className={`px-4 py-2 text-xs text-slate-600 ${getAlignClass(7)}`}>
                        {art.precioReferencia != null
                          ? `${art.monedaPrecio === 'USD' ? 'US$' : '$'} ${art.precioReferencia.toLocaleString('es-AR')}`
                          : '-'}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => setViewId(art.id)}
                            className="px-2 py-1 text-[10px] font-medium text-emerald-600 hover:bg-emerald-50 rounded transition-colors">
                            Ver
                          </button>
                          <button onClick={() => setEditId(art.id)}
                            className="px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-100 rounded transition-colors">
                            Editar
                          </button>
                          {art.activo && (
                            <button onClick={() => handleDeactivate(art)}
                              className="px-2 py-1 text-[10px] font-medium text-slate-500 hover:bg-slate-100 rounded transition-colors">
                              Desactivar
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(art)}
                            className="px-2 py-1 text-[10px] font-medium text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          </div>
        )}
      </div>

      <CreateArticuloModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={loadData} />
      <EditArticuloModal open={!!editId} articuloId={editId} onClose={() => setEditId(null)} onSaved={loadData} />
      <ViewArticuloModal open={!!viewId} articuloId={viewId} onClose={() => setViewId(null)} onEdit={id => { setViewId(null); setEditId(id); }} />
    </div>
  );
};
