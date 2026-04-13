import { useEffect, useState, useMemo, useRef } from 'react';
import { calificacionesService } from '../../services/calificacionesService';
import { proveedoresService } from '../../services/firebaseService';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { CalificacionModal } from './CalificacionModal';
import type { CalificacionProveedor, Proveedor } from '@ags/shared';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { useResizableColumns } from '../../hooks/useResizableColumns';
import { ColAlignIcon } from '../../components/ui/ColAlignIcon';

const thClass = 'px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';

const ESTADO_COLORS: Record<string, string> = {
  aprobado: 'bg-emerald-100 text-emerald-700',
  condicional: 'bg-amber-100 text-amber-700',
  no_aprobado: 'bg-red-100 text-red-700',
};

const ESTADO_LABELS: Record<string, string> = {
  aprobado: 'Aprobado',
  condicional: 'Condicional',
  no_aprobado: 'No aprobado',
};

export function CalificacionesList() {
  const [items, setItems] = useState<CalificacionProveedor[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const confirm = useConfirm();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CalificacionProveedor | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  const { tableRef, colWidths, colAligns, onResizeStart, onAutoFit, cycleAlign, getAlignClass } = useResizableColumns('calificaciones-list');

  const [filters, setFilters] = useState({ proveedorId: '', estado: '' });
  const [sortField, setSortField] = useState('fechaRecepcion');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (f: string) => {
    const s = toggleSort(f, sortField, sortDir);
    setSortField(s.field); setSortDir(s.dir);
  };

  useEffect(() => {
    proveedoresService.getAll().then(setProveedores);
  }, []);

  useEffect(() => {
    setLoading(true);
    unsubRef.current?.();
    unsubRef.current = calificacionesService.subscribe(
      filters.proveedorId ? { proveedorId: filters.proveedorId } : undefined,
      (data) => { setItems(data); setLoading(false); },
      (err) => { console.error('Calificaciones error:', err); setLoading(false); },
    );
    return () => { unsubRef.current?.(); };
  }, [filters.proveedorId]);

  const filtered = useMemo(() => {
    let result = items;
    if (filters.estado) result = result.filter(c => c.estado === filters.estado);
    return sortByField(result, sortField, sortDir);
  }, [items, filters.estado, sortField, sortDir]);

  // Promedios por proveedor
  const promedios = useMemo(() => {
    const map: Record<string, { sum: number; count: number }> = {};
    items.forEach(c => {
      if (!map[c.proveedorId]) map[c.proveedorId] = { sum: 0, count: 0 };
      map[c.proveedorId].sum += c.puntajeTotal;
      map[c.proveedorId].count++;
    });
    return map;
  }, [items]);

  const handleSave = async (data: Omit<CalificacionProveedor, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editing) {
      await calificacionesService.update(editing.id, data);
    } else {
      await calificacionesService.create(data);
    }
  };

  const handleDelete = async (id: string) => {
    if (!await confirm('¿Eliminar esta calificación?')) return;
    await calificacionesService.delete(id);
  };

  const proveedorOptions = [
    { value: '', label: 'Todos' },
    ...proveedores.filter(p => p.activo).map(p => ({ value: p.id, label: p.nombre })),
  ];

  const estadoOptions = [
    { value: '', label: 'Todos' },
    { value: 'aprobado', label: 'Aprobado' },
    { value: 'condicional', label: 'Condicional' },
    { value: 'no_aprobado', label: 'No aprobado' },
  ];

  const isInitialLoad = loading && items.length === 0;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Calificación de Proveedores"
        subtitle="Evaluación de entregas y ranking de proveedores"
        count={isInitialLoad ? undefined : filtered.length}
        actions={<Button size="sm" onClick={() => { setEditing(null); setShowModal(true); }}>+ Nueva calificación</Button>}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <div className="min-w-[180px]">
            <SearchableSelect value={filters.proveedorId} onChange={(v: string) => setFilters(f => ({ ...f, proveedorId: v }))}
              options={proveedorOptions} placeholder="Proveedor..." />
          </div>
          <div className="min-w-[150px]">
            <SearchableSelect value={filters.estado} onChange={(v: string) => setFilters(f => ({ ...f, estado: v }))}
              options={estadoOptions} placeholder="Estado..." />
          </div>
          {(filters.proveedorId || filters.estado) && (
            <button onClick={() => setFilters({ proveedorId: '', estado: '' })}
              className="text-xs text-slate-400 hover:text-slate-600 underline">Limpiar</button>
          )}
        </div>
      </PageHeader>

      <div className="flex-1 overflow-auto px-4 pb-4">
        {isInitialLoad ? (
          <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando calificaciones...</p></div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto h-full">
          <table ref={tableRef} className="w-full text-sm table-fixed">
            {colWidths ? (
              <colgroup>{colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
            ) : (
              <colgroup>
                <col style={{ width: '11%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '9%' }} />
              </colgroup>
            )}
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
              <tr>
                <SortableHeader label="Fecha" field="fechaRecepcion" current={sortField} dir={sortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(0)} relative`}>
                  <ColAlignIcon align={colAligns?.[0] || 'left'} onClick={() => cycleAlign(0)} />
                  <div onMouseDown={e => onResizeStart(0, e)} onDoubleClick={() => onAutoFit(0)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                </SortableHeader>
                <SortableHeader label="Proveedor" field="proveedorNombre" current={sortField} dir={sortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(1)} relative`}>
                  <ColAlignIcon align={colAligns?.[1] || 'left'} onClick={() => cycleAlign(1)} />
                  <div onMouseDown={e => onResizeStart(1, e)} onDoubleClick={() => onAutoFit(1)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                </SortableHeader>
                <th className={`${thClass} ${getAlignClass(2)} relative`}><ColAlignIcon align={colAligns?.[2] || 'left'} onClick={() => cycleAlign(2)} />OC<div onMouseDown={e => onResizeStart(2, e)} onDoubleClick={() => onAutoFit(2)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                <th className={`${thClass} ${getAlignClass(3)} relative`}><ColAlignIcon align={colAligns?.[3] || 'left'} onClick={() => cycleAlign(3)} />Remito<div onMouseDown={e => onResizeStart(3, e)} onDoubleClick={() => onAutoFit(3)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                <SortableHeader label="Puntaje" field="puntajeTotal" current={sortField} dir={sortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(4)} relative`}>
                  <ColAlignIcon align={colAligns?.[4] || 'left'} onClick={() => cycleAlign(4)} />
                  <div onMouseDown={e => onResizeStart(4, e)} onDoubleClick={() => onAutoFit(4)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                </SortableHeader>
                <th className={`${thClass} ${getAlignClass(5)} relative`}><ColAlignIcon align={colAligns?.[5] || 'left'} onClick={() => cycleAlign(5)} />Prom. Prov.<div onMouseDown={e => onResizeStart(5, e)} onDoubleClick={() => onAutoFit(5)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                <th className={`${thClass} ${getAlignClass(6)} relative`}><ColAlignIcon align={colAligns?.[6] || 'left'} onClick={() => cycleAlign(6)} />Estado<div onMouseDown={e => onResizeStart(6, e)} onDoubleClick={() => onAutoFit(6)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                <th className={`${thClass} ${getAlignClass(7)} relative`}><ColAlignIcon align={colAligns?.[7] || 'left'} onClick={() => cycleAlign(7)} />Resp.<div onMouseDown={e => onResizeStart(7, e)} onDoubleClick={() => onAutoFit(7)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                <th className={thClass + ' relative w-20'}><div onMouseDown={e => onResizeStart(8, e)} onDoubleClick={() => onAutoFit(8)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(c => {
                const prom = promedios[c.proveedorId];
                const promedio = prom ? Math.round(prom.sum / prom.count) : 0;
                const promEstado = promedio >= 80 ? 'aprobado' : promedio >= 60 ? 'condicional' : 'no_aprobado';
                return (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className={`px-3 py-2 text-slate-600 font-mono text-xs ${getAlignClass(0)}`}>{c.fechaRecepcion}</td>
                    <td className={`px-3 py-2 font-semibold text-teal-700 ${getAlignClass(1)}`}>{c.proveedorNombre}</td>
                    <td className={`px-3 py-2 text-slate-500 text-xs ${getAlignClass(2)}`}>{c.ordenCompraNro || '—'}</td>
                    <td className={`px-3 py-2 text-slate-500 text-xs ${getAlignClass(3)}`}>{c.remitoNro || '—'}</td>
                    <td className={`px-3 py-2 font-mono font-bold ${getAlignClass(4)}`}>{c.puntajeTotal}</td>
                    <td className={`px-3 py-2 ${getAlignClass(5)}`}>
                      <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded-full ${ESTADO_COLORS[promEstado]}`}>
                        {promedio} ({prom?.count || 0})
                      </span>
                    </td>
                    <td className={`px-3 py-2 ${getAlignClass(6)}`}>
                      <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded-full ${ESTADO_COLORS[c.estado]}`}>
                        {ESTADO_LABELS[c.estado]}
                      </span>
                    </td>
                    <td className={`px-3 py-2 text-slate-500 text-xs ${getAlignClass(7)}`}>{c.responsable}</td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center gap-1 justify-center">
                        <button onClick={() => { setEditing(c); setShowModal(true); }}
                          className="text-teal-600 hover:underline text-xs">Editar</button>
                        <button onClick={() => handleDelete(c.id)}
                          className="text-red-400 hover:text-red-600 text-xs">×</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="text-center py-8 text-slate-400">No hay calificaciones registradas</td></tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>

      <CalificacionModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditing(null); }}
        onSave={handleSave}
        proveedores={proveedores}
        editing={editing}
      />
    </div>
  );
}
