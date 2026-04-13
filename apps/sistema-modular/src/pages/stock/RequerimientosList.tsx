import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { requerimientosService } from '../../services/firebaseService';
import { Button } from '../../components/ui/Button';
import { sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { CreateRequerimientoModal } from '../../components/stock/CreateRequerimientoModal';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useRequerimientoInlineEdit } from '../../hooks/useRequerimientoInlineEdit';
import { useResizableColumns } from '../../hooks/useResizableColumns';
import { ColAlignIcon } from '../../components/ui/ColAlignIcon';
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
  const { tableRef, colWidths, colAligns, onResizeStart, onAutoFit, cycleAlign, getAlignClass } = useResizableColumns('requerimientos-list');

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
            <table ref={tableRef} className="w-full table-fixed">
              {colWidths ? (
                <colgroup>
                  {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
                </colgroup>
              ) : (
                <colgroup>
                  <col style={{ width: '4%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '7%' }} />
                </colgroup>
              )}
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="relative px-3 py-2 w-8">
                    <input type="checkbox"
                      checked={selectedIds.size === sorted.length && sorted.length > 0}
                      onChange={toggleAll} />
                    <div onMouseDown={e => onResizeStart(0, e)} onDoubleClick={() => onAutoFit(0)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </th>
                  <th className={`relative px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider ${getAlignClass(1)}`}><ColAlignIcon align={colAligns?.[1] || 'left'} onClick={() => cycleAlign(1)} />Numero<div onMouseDown={e => onResizeStart(1, e)} onDoubleClick={() => onAutoFit(1)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`relative px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider ${getAlignClass(2)}`}><ColAlignIcon align={colAligns?.[2] || 'left'} onClick={() => cycleAlign(2)} />Artículo<div onMouseDown={e => onResizeStart(2, e)} onDoubleClick={() => onAutoFit(2)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`relative px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider ${getAlignClass(3)}`}><ColAlignIcon align={colAligns?.[3] || 'left'} onClick={() => cycleAlign(3)} />Cantidad<div onMouseDown={e => onResizeStart(3, e)} onDoubleClick={() => onAutoFit(3)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`relative px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider ${getAlignClass(4)}`}><ColAlignIcon align={colAligns?.[4] || 'left'} onClick={() => cycleAlign(4)} />Origen<div onMouseDown={e => onResizeStart(4, e)} onDoubleClick={() => onAutoFit(4)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`relative px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider ${getAlignClass(5)}`}><ColAlignIcon align={colAligns?.[5] || 'left'} onClick={() => cycleAlign(5)} />Estado<div onMouseDown={e => onResizeStart(5, e)} onDoubleClick={() => onAutoFit(5)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`relative px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider ${getAlignClass(6)}`}><ColAlignIcon align={colAligns?.[6] || 'left'} onClick={() => cycleAlign(6)} />Urgencia<div onMouseDown={e => onResizeStart(6, e)} onDoubleClick={() => onAutoFit(6)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`relative px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider ${getAlignClass(7)}`}><ColAlignIcon align={colAligns?.[7] || 'left'} onClick={() => cycleAlign(7)} />Proveedor sugerido<div onMouseDown={e => onResizeStart(7, e)} onDoubleClick={() => onAutoFit(7)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`relative px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider ${getAlignClass(8)}`}><ColAlignIcon align={colAligns?.[8] || 'left'} onClick={() => cycleAlign(8)} />Solicitado por<div onMouseDown={e => onResizeStart(8, e)} onDoubleClick={() => onAutoFit(8)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`relative px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider cursor-pointer ${getAlignClass(9)}`} onClick={() => handleSort('fechaSolicitud')}>
                    <ColAlignIcon align={colAligns?.[9] || 'left'} onClick={() => cycleAlign(9)} />
                    Fecha {sortField === 'fechaSolicitud' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    <div onMouseDown={e => onResizeStart(9, e)} onDoubleClick={() => onAutoFit(9)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </th>
                  <th className="relative px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Acciones<div onMouseDown={e => onResizeStart(10, e)} onDoubleClick={() => onAutoFit(10)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
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
                    getAlignClass={getAlignClass}
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
