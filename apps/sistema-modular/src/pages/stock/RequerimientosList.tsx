import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { requerimientosService } from '../../services/firebaseService';
import { Button } from '../../components/ui/Button';
import { sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { CreateRequerimientoModal } from '../../components/stock/CreateRequerimientoModal';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useRequerimientoInlineEdit } from '../../hooks/useRequerimientoInlineEdit';
import { useGenerarOC } from '../../hooks/useGenerarOC';
import { RequerimientoRow, URGENCIA_LABELS } from './RequerimientoRow';
import type { RequerimientoCompra, EstadoRequerimiento, OrigenRequerimiento, UrgenciaRequerimiento } from '@ags/shared';
import { ESTADO_REQUERIMIENTO_LABELS, ORIGEN_REQUERIMIENTO_LABELS } from '@ags/shared';
import { useConfirm } from '../../components/ui/ConfirmDialog';

const FILTER_SCHEMA = {
  estado:   { type: 'string' as const, default: '' },
  origen:   { type: 'string' as const, default: '' },
  urgencia: { type: 'string' as const, default: '' },
};

export const RequerimientosList = () => {
  const [requerimientos, setRequerimientos] = useState<RequerimientoCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const confirm = useConfirm();
  const [filters, setFilter] = useUrlFilters(FILTER_SCHEMA);
  const [showCreate, setShowCreate] = useState(false);
  const [sortField, setSortField] = useState('fechaSolicitud');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { editingCell, editValue, setEditValue, startEdit, cancelEdit, saveEdit } = useRequerimientoInlineEdit();
  const { generarOCs, loading: generandoOC } = useGenerarOC();

  const handleSort = (f: string) => {
    const s = toggleSort(f, sortField, sortDir);
    setSortField(s.field); setSortDir(s.dir);
  };

  const filtered = useMemo(() => {
    if (!filters.urgencia) return requerimientos;
    return requerimientos.filter(r => r.urgencia === filters.urgencia);
  }, [requerimientos, filters.urgencia]);
  const sorted = useMemo(() => sortByField(filtered, sortField, sortDir), [filtered, sortField, sortDir]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (selectedIds.size === sorted.length && sorted.length > 0) setSelectedIds(new Set());
    else setSelectedIds(new Set(sorted.map(r => r.id)));
  };

  const unsubRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    unsubRef.current?.();
    unsubRef.current = requerimientosService.subscribe(
      { estado: filters.estado || undefined, origen: filters.origen || undefined },
      (items) => { setRequerimientos(items); setLoading(false); },
      (err) => { console.error('Error cargando requerimientos:', err); setLoading(false); }
    );
    return () => { unsubRef.current?.(); };
  }, [filters.estado, filters.origen]);

  const loadData = useCallback(() => {}, []);

  const handleAprobar = async (id: string) => {
    if (!await confirm('¿Aprobar este requerimiento?')) return;
    try {
      await requerimientosService.update(id, { estado: 'aprobado', fechaAprobacion: new Date().toISOString() });
      setRequerimientos(prev => prev.map(r => r.id === id ? { ...r, estado: 'aprobado' as const, fechaAprobacion: new Date().toISOString() } : r));
    } catch { alert('Error al aprobar el requerimiento'); }
  };

  const handleDelete = async (id: string) => {
    if (!await confirm('¿Eliminar este requerimiento pendiente?')) return;
    try {
      await requerimientosService.delete(id);
      setRequerimientos(prev => prev.filter(r => r.id !== id));
    } catch { alert('Error al eliminar el requerimiento'); }
  };

  const handleGenerarOC = async () => {
    const sel = sorted.filter(r => selectedIds.has(r.id));
    const count = await generarOCs(sel);
    if (count > 0) {
      setSelectedIds(new Set());
      alert(`${count} OC(s) generada(s) en estado borrador. Complete los precios en Órdenes de Compra.`);
    }
  };

  const formatDate = (d?: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const isInitialLoad = loading && requerimientos.length === 0;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Requerimientos de Compra"
        subtitle="Requisiciones de compra"
        count={isInitialLoad ? undefined : sorted.length}
        actions={
          <>
            {selectedIds.size > 0 && (
              <Button size="sm" onClick={handleGenerarOC} disabled={generandoOC}>
                {generandoOC ? 'Generando...' : `Generar OC (${selectedIds.size})`}
              </Button>
            )}
            <Button size="sm" onClick={() => setShowCreate(true)}>+ Nuevo requerimiento</Button>
          </>
        }
      >
        <div className="flex items-center gap-3 flex-wrap">
          <select value={filters.estado} onChange={e => setFilter('estado', e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500">
            <option value="">Todos los estados</option>
            {(Object.keys(ESTADO_REQUERIMIENTO_LABELS) as EstadoRequerimiento[]).map(k => (
              <option key={k} value={k}>{ESTADO_REQUERIMIENTO_LABELS[k]}</option>
            ))}
          </select>
          <select value={filters.origen} onChange={e => setFilter('origen', e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500">
            <option value="">Todos los orígenes</option>
            {(Object.keys(ORIGEN_REQUERIMIENTO_LABELS) as OrigenRequerimiento[]).map(k => (
              <option key={k} value={k}>{ORIGEN_REQUERIMIENTO_LABELS[k]}</option>
            ))}
          </select>
          <select value={filters.urgencia} onChange={e => setFilter('urgencia', e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500">
            <option value="">Todas las urgencias</option>
            {(Object.keys(URGENCIA_LABELS) as UrgenciaRequerimiento[]).map(k => (
              <option key={k} value={k}>{URGENCIA_LABELS[k]}</option>
            ))}
          </select>
        </div>
      </PageHeader>

      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
        {isInitialLoad ? (
          <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando requerimientos...</p></div>
        ) : sorted.length === 0 ? (
          <Card><div className="text-center py-12"><p className="text-slate-400">No se encontraron requerimientos</p></div></Card>
        ) : (
          <div className="bg-white overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 w-8">
                    <input type="checkbox"
                      checked={selectedIds.size === sorted.length && sorted.length > 0}
                      onChange={toggleAll} />
                  </th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Numero</th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Artículo</th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Cantidad</th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Origen</th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Estado</th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Urgencia</th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Proveedor sugerido</th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Solicitado por</th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider cursor-pointer" onClick={() => handleSort('fechaSolicitud')}>
                    Fecha {sortField === 'fechaSolicitud' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map(r => (
                  <RequerimientoRow
                    key={r.id}
                    r={r}
                    selected={selectedIds.has(r.id)}
                    onToggle={() => toggleSelect(r.id)}
                    editingCell={editingCell}
                    editValue={editValue}
                    setEditValue={setEditValue}
                    startEdit={startEdit}
                    cancelEdit={cancelEdit}
                    saveEdit={saveEdit}
                    onAprobar={handleAprobar}
                    onDelete={handleDelete}
                    formatDate={formatDate}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateRequerimientoModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={loadData} />
    </div>
  );
};
