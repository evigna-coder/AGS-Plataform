import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { articulosService, marcasService } from '../../services/firebaseService';
import { useDebounce } from '../../hooks/useDebounce';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useResizableColumns } from '../../hooks/useResizableColumns';
import { ColAlignIcon } from '../../components/ui/ColAlignIcon';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { CreateArticuloModal } from '../../components/stock/CreateArticuloModal';
import { EditArticuloModal } from '../../components/stock/EditArticuloModal';
import { ViewArticuloModal } from '../../components/stock/ViewArticuloModal';
import { DesagregarStockModal } from '../../components/stock/DesagregarStockModal';
import { ArticulosListFilters } from './ArticulosListFilters';
import { ArticulosListRow } from './ArticulosListRow';
import { useEquivalenciaListExpansion } from './hooks/useEquivalenciaListExpansion';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import type { Articulo, Marca } from '@ags/shared';
import type { ColAlign } from '../../hooks/useResizableColumns';

// ── Column header (co-located, not worth its own file) ────────────────────────

const TH_CLS = 'px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider relative';
const RESIZE = (onStart: (e: React.MouseEvent) => void, onFit: () => void) => (
  <div onMouseDown={onStart} onDoubleClick={onFit} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
);

interface TheadProps {
  allSelected: boolean; onToggleAll: () => void;
  sortField: string; sortDir: SortDir; onSort: (f: string) => void;
  colAligns: string[] | null; onCycleAlign: (i: number) => void;
  getAlignClass: (i: number) => string;
  onResizeStart: (i: number, e: React.MouseEvent) => void;
  onAutoFit: (i: number) => void;
}
function ArticulosListThead({ allSelected, onToggleAll, sortField, sortDir, onSort, colAligns, onCycleAlign, getAlignClass, onResizeStart, onAutoFit }: TheadProps) {
  const SH = ({ label, field, idx, ws }: { label: string; field: string; idx: number; ws?: boolean }) => (
    <SortableHeader label={label} field={field} currentField={sortField} currentDir={sortDir} onSort={onSort} className={`${TH_CLS}${ws ? ' whitespace-nowrap' : ''} ${getAlignClass(idx)}`}>
      <ColAlignIcon align={(colAligns?.[idx] as ColAlign) || 'left'} onClick={() => onCycleAlign(idx)} />
      {RESIZE(e => onResizeStart(idx, e), () => onAutoFit(idx))}
    </SortableHeader>
  );
  return (
    <thead className="bg-slate-50 border-b border-slate-200">
      <tr>
        <th className="px-3 py-2 w-8 relative">
          <input type="checkbox" checked={allSelected} onChange={onToggleAll} className="w-3.5 h-3.5 rounded border-slate-300 accent-teal-700" />
          {RESIZE(e => onResizeStart(0, e), () => onAutoFit(0))}
        </th>
        <SH label="Codigo" field="codigo" idx={1} ws />
        <SH label="Descripcion" field="descripcion" idx={2} />
        <SH label="Marca" field="marcaId" idx={3} />
        <SH label="Categoria" field="categoriaEquipo" idx={4} />
        <SH label="Tipo" field="tipo" idx={5} />
        <SH label="Stock min." field="stockMinimo" idx={6} />
        <SH label="Precio ref." field="precioReferencia" idx={7} />
        <th className={`${TH_CLS} text-center`}>
          Acciones
          {RESIZE(e => onResizeStart(8, e), () => onAutoFit(8))}
        </th>
      </tr>
    </thead>
  );
}

// ── Main list component ───────────────────────────────────────────────────────

export const ArticulosList = () => {
  const confirm = useConfirm();
  const { tableRef, colWidths, colAligns, onResizeStart, onAutoFit, cycleAlign, getAlignClass } = useResizableColumns('articulos-list');
  const FILTER_SCHEMA = useMemo(() => ({
    search: { type: 'string' as const, default: '' },
    categoriaEquipo: { type: 'string' as const, default: '' },
    marcaId: { type: 'string' as const, default: '' },
    tipo: { type: 'string' as const, default: '' },
    showInactive: { type: 'boolean' as const, default: false },
    sortField: { type: 'string' as const, default: 'codigo' },
    sortDir:   { type: 'string' as const, default: 'asc' },
  }), []);
  const [filters, setFilter] = useUrlFilters(FILTER_SCHEMA);
  const handleSort = (f: string) => { const s = toggleSort(f, filters.sortField, filters.sortDir as SortDir); setFilter('sortField', s.field); setFilter('sortDir', s.dir); };
  const [localSearch, setLocalSearch] = useState(filters.search);
  const debouncedSearch = useDebounce(localSearch, 300);
  useEffect(() => { setFilter('search', debouncedSearch); }, [debouncedSearch]);
  useEffect(() => { if (filters.search !== localSearch && filters.search === '') setLocalSearch(''); }, [filters.search]);

  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [desagregarTarget, setDesagregarTarget] = useState<Articulo | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => { marcasService.getAll(false).then(data => setMarcas(data as Marca[])); }, []);

  useEffect(() => {
    unsubRef.current?.();
    unsubRef.current = articulosService.subscribe(
      { categoriaEquipo: filters.categoriaEquipo || undefined, marcaId: filters.marcaId || undefined, tipo: filters.tipo || undefined, activoOnly: !filters.showInactive },
      (data) => { setArticulos(data); setLoading(false); },
      (err) => { console.error('Error cargando articulos:', err); setLoading(false); },
    );
    return () => { unsubRef.current?.(); };
  }, [filters.categoriaEquipo, filters.marcaId, filters.tipo, filters.showInactive]);

  const loadData = useCallback(() => {}, []);

  // Phase 13 STKE-07 — expansion hook (unconditional, m3 fix)
  const { hasEquivalencia, shouldExpandRow } = useEquivalenciaListExpansion({ articulos, searchTerm: debouncedSearch });

  const handleDeactivate = async (art: Articulo) => {
    if (!await confirm(`Desactivar el articulo "${art.codigo} - ${art.descripcion}"?`)) return;
    try { await articulosService.deactivate(art.id); } catch (e) { console.error(e); alert('Error al desactivar el articulo'); }
  };
  const handleDelete = async (art: Articulo) => {
    if (!await confirm(`Eliminar permanentemente "${art.codigo}"?\n\nEsta accion no se puede deshacer.`)) return;
    try { await articulosService.delete(art.id); } catch (e) { console.error(e); alert('Error al eliminar el articulo'); }
  };

  const getMarcaNombre = (art: Articulo) => art.marcaId ? (marcas.find(m => m.id === art.marcaId)?.nombre ?? '-') : ((art as any).marca || '-');

  const filtered = useMemo(() => {
    let list = articulos;
    if (debouncedSearch) { const t = debouncedSearch.toLowerCase(); list = list.filter(a => a.codigo.toLowerCase().includes(t) || a.descripcion.toLowerCase().includes(t)); }
    return sortByField(list, filters.sortField, filters.sortDir as SortDir);
  }, [articulos, debouncedSearch, filters.sortField, filters.sortDir]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }, []);
  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(a => a.id)));
  }, [filtered]);

  const processBatched = async (ids: string[], fn: (id: string) => Promise<void>) => {
    const arr = [...ids];
    for (let i = 0; i < arr.length; i += 100) await Promise.all(arr.slice(i, i + 100).map(fn));
  };
  const handleBulkDeactivate = async () => {
    if (!selectedIds.size || !await confirm(`Desactivar ${selectedIds.size} articulo(s)?`)) return;
    try { setBulkLoading(true); await processBatched([...selectedIds], id => articulosService.deactivate(id)); setSelectedIds(new Set()); }
    catch (e) { console.error(e); alert('Error al desactivar articulos'); } finally { setBulkLoading(false); }
  };
  const handleBulkDelete = async () => {
    if (!selectedIds.size || !await confirm(`Eliminar permanentemente ${selectedIds.size} articulo(s)?\n\nEsta accion no se puede deshacer.`)) return;
    try { setBulkLoading(true); await processBatched([...selectedIds], id => articulosService.delete(id)); setSelectedIds(new Set()); }
    catch (e) { console.error(e); alert('Error al eliminar articulos'); } finally { setBulkLoading(false); }
  };

  const isInitialLoad = loading && articulos.length === 0;
  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader title="Articulos" subtitle="Catalogo de articulos de stock" count={isInitialLoad ? undefined : filtered.length}
        actions={<Button size="sm" onClick={() => setShowCreate(true)}>+ Nuevo articulo</Button>}>
        <ArticulosListFilters
          localSearch={localSearch} onSearchChange={setLocalSearch}
          categoriaEquipo={filters.categoriaEquipo} onCategoriaChange={v => setFilter('categoriaEquipo', v)}
          marcaId={filters.marcaId} onMarcaChange={v => setFilter('marcaId', v)}
          tipo={filters.tipo} onTipoChange={v => setFilter('tipo', v)}
          showInactive={filters.showInactive} onShowInactiveChange={v => setFilter('showInactive', v)}
          marcas={marcas}
        />
      </PageHeader>

      {selectedIds.size > 0 && (
        <div className="mx-5 mb-2 flex items-center gap-3 bg-teal-50 border border-teal-200 rounded-lg px-4 py-2">
          <span className="text-xs font-medium text-teal-800">{selectedIds.size} seleccionado(s)</span>
          {bulkLoading
            ? <span className="flex items-center gap-2 text-xs text-teal-700"><span className="inline-block w-3.5 h-3.5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />Procesando...</span>
            : <>
                <button onClick={handleBulkDeactivate} className="text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-2 py-0.5 rounded transition-colors">Desactivar</button>
                <button onClick={handleBulkDelete} className="text-[11px] font-medium text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-0.5 rounded transition-colors">Eliminar</button>
                <button onClick={() => setSelectedIds(new Set())} className="text-[11px] text-slate-400 hover:text-slate-600 ml-auto">Deseleccionar</button>
              </>
          }
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
        {isInitialLoad ? (
          <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando articulos...</p></div>
        ) : filtered.length === 0 ? (
          <Card><div className="text-center py-12">
            <p className="text-slate-400">No se encontraron articulos</p>
            <button onClick={() => setShowCreate(true)} className="text-teal-600 hover:underline mt-2 inline-block text-xs">Crear primer articulo</button>
          </div></Card>
        ) : (
          <div className="bg-white overflow-x-auto" data-testid="articulos-list">
            <table ref={tableRef} className="w-full table-fixed">
              {colWidths
                ? <colgroup>{colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
                : <colgroup>
                    <col style={{ width: '4%' }} /><col style={{ width: '12%' }} /><col style={{ width: '24%' }} />
                    <col style={{ width: '10%' }} /><col style={{ width: '10%' }} /><col style={{ width: '9%' }} />
                    <col style={{ width: '8%' }} /><col style={{ width: '10%' }} /><col style={{ width: '13%' }} />
                  </colgroup>
              }
              <ArticulosListThead
                allSelected={allSelected} onToggleAll={toggleSelectAll}
                sortField={filters.sortField} sortDir={filters.sortDir as SortDir} onSort={handleSort}
                colAligns={colAligns} onCycleAlign={cycleAlign} getAlignClass={getAlignClass}
                onResizeStart={onResizeStart} onAutoFit={onAutoFit}
              />
              <tbody className="divide-y divide-slate-100">
                {filtered.map(art => (
                  <ArticulosListRow
                    key={art.id}
                    articulo={art}
                    marcaName={getMarcaNombre(art)}
                    colWidths={colWidths}
                    colAligns={colAligns}
                    getAlignClass={getAlignClass}
                    isSelected={selectedIds.has(art.id)}
                    onSelect={toggleSelect}
                    onEdit={id => setEditId(id)}
                    onView={id => setViewId(id)}
                    onDeactivate={handleDeactivate}
                    onDelete={handleDelete}
                    hasEquivalencia={hasEquivalencia(art)}
                    expandDual={shouldExpandRow(art)}
                    onDesagregar={a => setDesagregarTarget(a)}
                    totalCols={9}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateArticuloModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={loadData} />
      <EditArticuloModal open={!!editId} articuloId={editId} onClose={() => setEditId(null)} onSaved={loadData} />
      <ViewArticuloModal open={!!viewId} articuloId={viewId} onClose={() => setViewId(null)} onEdit={id => { setViewId(null); setEditId(id); }} />
      <DesagregarStockModal open={!!desagregarTarget} onClose={() => setDesagregarTarget(null)} articulo={desagregarTarget} onSuccess={() => {}} />
    </div>
  );
};
