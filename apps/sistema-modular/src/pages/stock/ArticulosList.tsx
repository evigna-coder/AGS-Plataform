import { useState, useEffect, useCallback, useMemo } from 'react';
import { articulosService, marcasService } from '../../services/firebaseService';
import { useDebounce } from '../../hooks/useDebounce';

import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { CreateArticuloModal } from '../../components/stock/CreateArticuloModal';
import { EditArticuloModal } from '../../components/stock/EditArticuloModal';
import { ViewArticuloModal } from '../../components/stock/ViewArticuloModal';
import type { Articulo, Marca, CategoriaEquipoStock, TipoArticulo } from '@ags/shared';

const CATEGORIA_LABELS: Record<CategoriaEquipoStock, string> = {
  HPLC: 'HPLC', GC: 'GC', MSD: 'MSD', UV: 'UV', OSMOMETRO: 'Osmometro', GENERAL: 'General',
};
const TIPO_LABELS: Record<TipoArticulo, string> = {
  repuesto: 'Repuesto', consumible: 'Consumible', equipo: 'Equipo', columna: 'Columna',
  accesorio: 'Accesorio', muestra: 'Muestra', otro: 'Otro',
};

export const ArticulosList = () => {
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    categoriaEquipo: '' as string,
    marcaId: '' as string,
    tipo: '' as string,
    showInactive: false,
  });

  useEffect(() => {
    loadData();
  }, [filters.categoriaEquipo, filters.marcaId, filters.tipo, filters.showInactive]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [artData, marcasData] = await Promise.all([
        articulosService.getAll({
          categoriaEquipo: filters.categoriaEquipo || undefined,
          marcaId: filters.marcaId || undefined,
          tipo: filters.tipo || undefined,
          activoOnly: !filters.showInactive,
        }),
        marcas.length === 0 ? marcasService.getAll(false) : Promise.resolve(marcas),
      ]);
      setArticulos(artData);
      if (marcas.length === 0) setMarcas(marcasData as Marca[]);
    } catch (error) {
      console.error('Error cargando articulos:', error);
      alert('Error al cargar los articulos');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (art: Articulo) => {
    if (!confirm(`Desactivar el articulo "${art.codigo} - ${art.descripcion}"?`)) return;
    try {
      await articulosService.deactivate(art.id);
      await loadData();
    } catch (error) {
      console.error('Error desactivando articulo:', error);
      alert('Error al desactivar el articulo');
    }
  };

  const handleDelete = async (art: Articulo) => {
    if (!confirm(`Eliminar permanentemente "${art.codigo}"?\n\nEsta accion no se puede deshacer.`)) return;
    try {
      await articulosService.delete(art.id);
      await loadData();
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
    if (!confirm(`Desactivar ${selectedIds.size} articulo(s)?`)) return;
    try {
      setBulkLoading(true);
      await processBatched([...selectedIds], id => articulosService.deactivate(id));
      setSelectedIds(new Set());
      await loadData();
    } catch (error) {
      console.error('Error en desactivacion masiva:', error);
      alert('Error al desactivar articulos');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Eliminar permanentemente ${selectedIds.size} articulo(s)?\n\nEsta accion no se puede deshacer.`)) return;
    try {
      setBulkLoading(true);
      await processBatched([...selectedIds], id => articulosService.delete(id));
      setSelectedIds(new Set());
      await loadData();
    } catch (error) {
      console.error('Error en eliminacion masiva:', error);
      alert('Error al eliminar articulos');
    } finally {
      setBulkLoading(false);
    }
  };

  if (loading && articulos.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-400">Cargando articulos...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Articulos"
        subtitle="Catalogo de articulos de stock"
        count={filtered.length}
        actions={
          <Button size="sm" onClick={() => setShowCreate(true)}>+ Nuevo articulo</Button>
        }
      >
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Buscar por codigo o descripcion..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs w-56 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <select
            value={filters.categoriaEquipo}
            onChange={e => setFilters({ ...filters, categoriaEquipo: e.target.value })}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">Todas las categorias</option>
            {(Object.keys(CATEGORIA_LABELS) as CategoriaEquipoStock[]).map(k => (
              <option key={k} value={k}>{CATEGORIA_LABELS[k]}</option>
            ))}
          </select>
          <select
            value={filters.marcaId}
            onChange={e => setFilters({ ...filters, marcaId: e.target.value })}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">Todas las marcas</option>
            {marcas.map(m => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </select>
          <select
            value={filters.tipo}
            onChange={e => setFilters({ ...filters, tipo: e.target.value })}
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
              onChange={e => setFilters({ ...filters, showInactive: e.target.checked })}
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
        {filtered.length === 0 ? (
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
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 w-8">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        className="w-3.5 h-3.5 rounded border-slate-300 accent-teal-700"
                      />
                    </th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap">Codigo</th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Descripcion</th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Marca</th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Categoria</th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Tipo</th>
                    <th className="px-4 py-2 text-right text-[11px] font-medium text-slate-400 tracking-wider">Stock min.</th>
                    <th className="px-4 py-2 text-right text-[11px] font-medium text-slate-400 tracking-wider">Precio ref.</th>
                    <th className="px-4 py-2 text-right text-[11px] font-medium text-slate-400 tracking-wider">Acciones</th>
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
                      <td className="px-4 py-2 whitespace-nowrap">
                        <button onClick={() => setViewId(art.id)} className="font-mono text-xs font-semibold text-teal-700 hover:text-teal-800 hover:underline text-left">
                          {art.codigo}
                        </button>
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-900 max-w-md truncate">
                        <button onClick={() => setViewId(art.id)} className="hover:text-teal-700 hover:underline text-left">
                          {art.descripcion}
                        </button>
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-600">{getMarcaNombre(art)}</td>
                      <td className="px-4 py-2">
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">
                          {CATEGORIA_LABELS[art.categoriaEquipo] ?? art.categoriaEquipo}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-teal-50 text-teal-700">
                          {TIPO_LABELS[art.tipo] ?? art.tipo}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-600 text-right">{art.stockMinimo}</td>
                      <td className="px-4 py-2 text-xs text-slate-600 text-right">
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
