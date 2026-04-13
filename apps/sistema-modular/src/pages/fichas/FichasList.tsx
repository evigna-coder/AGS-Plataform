import { useEffect, useState, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fichasService, clientesService } from '../../services/firebaseService';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { CreateFichaModal } from '../../components/fichas/CreateFichaModal';
import type { FichaPropiedad, EstadoFicha, Cliente } from '@ags/shared';
import { ESTADO_FICHA_LABELS, ESTADO_FICHA_COLORS } from '@ags/shared';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { useResizableColumns } from '../../hooks/useResizableColumns';
import { ColAlignIcon } from '../../components/ui/ColAlignIcon';

const thClass = 'px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';

export function FichasList() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { tableRef, colWidths, colAligns, onResizeStart, onAutoFit, cycleAlign, getAlignClass } = useResizableColumns('fichas-list');

  const FILTER_SCHEMA = useMemo(() => ({
    estado: { type: 'string' as const, default: '' },
    cliente: { type: 'string' as const, default: '' },
    showEntregadas: { type: 'boolean' as const, default: false },
    sortField: { type: 'string' as const, default: 'fechaIngreso' },
    sortDir: { type: 'string' as const, default: 'desc' },
  }), []);
  const [filters, setFilter, , resetFilters] = useUrlFilters(FILTER_SCHEMA);

  const [fichas, setFichas] = useState<FichaPropiedad[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const unsubFichasRef = useRef<(() => void) | null>(null);

  const handleSort = (f: string) => {
    const s = toggleSort(f, filters.sortField, filters.sortDir as SortDir);
    setFilter('sortField', s.field); setFilter('sortDir', s.dir);
  };

  // Load reference data (clientes) once
  useEffect(() => {
    clientesService.getAll().then(setClientes).catch(err => console.error('Error cargando clientes:', err));
  }, []);

  // Subscribe to fichas, re-subscribe when showEntregadas changes
  useEffect(() => {
    setLoading(true);
    unsubFichasRef.current?.();
    unsubFichasRef.current = fichasService.subscribe(
      { activasOnly: !filters.showEntregadas },
      (data) => { setFichas(data); setLoading(false); },
      (err) => { console.error('Fichas subscription error:', err); setLoading(false); },
    );
    return () => { unsubFichasRef.current?.(); };
  }, [filters.showEntregadas]);

  const filtered = useMemo(() => {
    let result = fichas.filter(f => {
      if (filters.estado && f.estado !== filters.estado) return false;
      if (filters.cliente && f.clienteId !== filters.cliente) return false;
      return true;
    });
    return sortByField(result, filters.sortField, filters.sortDir as SortDir);
  }, [fichas, filters.estado, filters.cliente, filters.sortField, filters.sortDir]);

  const handleDelete = async (id: string) => {
    if (!await confirm('Eliminar esta ficha?')) return;
    await fichasService.delete(id);
    setFichas(prev => prev.filter(f => f.id !== id));
  };

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('es-AR'); } catch { return '—'; }
  };

  const isInitialLoad = loading && fichas.length === 0;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Fichas Propiedad del Cliente"
        subtitle="Módulos y equipos ingresados para reparación"
        count={isInitialLoad ? undefined : filtered.length}
        actions={
          <Button size="sm" onClick={() => setShowCreate(true)}>+ Nueva ficha</Button>
        }
      >
        <div className="flex items-center gap-3 flex-wrap">
          <div className="min-w-[160px]">
            <SearchableSelect value={filters.cliente} onChange={(v) => setFilter('cliente', v)}
              options={[{ value: '', label: 'Todos' }, ...clientes.map(c => ({ value: c.id, label: c.razonSocial }))]}
              placeholder="Cliente" />
          </div>
          <div className="min-w-[150px]">
            <SearchableSelect value={filters.estado}
              onChange={(v) => setFilter('estado', v)}
              options={[{ value: '', label: 'Todos' }, ...(Object.keys(ESTADO_FICHA_LABELS) as EstadoFicha[]).map(e => ({ value: e, label: ESTADO_FICHA_LABELS[e] }))]}
              placeholder="Estado" />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.showEntregadas}
              onChange={e => setFilter('showEntregadas', e.target.checked)}
              className="rounded border-slate-300"
            />
            Mostrar entregadas
          </label>
          <Button size="sm" variant="ghost" onClick={() => resetFilters()}>
            Limpiar
          </Button>
        </div>
      </PageHeader>

      <div className="flex-1 min-h-0 px-5 pb-4">
        {isInitialLoad ? (
          <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando fichas...</p></div>
        ) : filtered.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-slate-400">No hay fichas registradas</p>
              <button onClick={() => setShowCreate(true)}
                className="text-teal-600 hover:underline mt-2 inline-block text-xs">
                Crear primera ficha
              </button>
            </div>
          </Card>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto h-full">
            <table ref={tableRef} className="w-full table-fixed">
              {colWidths ? (
                <colgroup>{colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
              ) : (
                <colgroup>
                  <col style={{ width: 75 }} />
                  <col style={{ width: '15%' }} />
                  <col />
                  <col style={{ width: 85 }} />
                  <col style={{ width: 78 }} />
                  <col style={{ width: 75 }} />
                  <col style={{ width: 110 }} />
                </colgroup>
              )}
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <SortableHeader label="Numero" field="numero" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(0)} relative`}>
                    <ColAlignIcon align={colAligns?.[0] || 'left'} onClick={() => cycleAlign(0)} />
                    <div onMouseDown={e => onResizeStart(0, e)} onDoubleClick={() => onAutoFit(0)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <SortableHeader label="Cliente" field="clienteNombre" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(1)} relative`}>
                    <ColAlignIcon align={colAligns?.[1] || 'left'} onClick={() => cycleAlign(1)} />
                    <div onMouseDown={e => onResizeStart(1, e)} onDoubleClick={() => onAutoFit(1)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <th className={`${thClass} ${getAlignClass(2)} relative`}><ColAlignIcon align={colAligns?.[2] || 'left'} onClick={() => cycleAlign(2)} />Descripcion<div onMouseDown={e => onResizeStart(2, e)} onDoubleClick={() => onAutoFit(2)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <SortableHeader label="Estado" field="estado" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(3)} relative`}>
                    <ColAlignIcon align={colAligns?.[3] || 'left'} onClick={() => cycleAlign(3)} />
                    <div onMouseDown={e => onResizeStart(3, e)} onDoubleClick={() => onAutoFit(3)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <SortableHeader label="Ingreso" field="fechaIngreso" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(4)} relative`}>
                    <ColAlignIcon align={colAligns?.[4] || 'left'} onClick={() => cycleAlign(4)} />
                    <div onMouseDown={e => onResizeStart(4, e)} onDoubleClick={() => onAutoFit(4)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <th className={`${thClass} ${getAlignClass(5)} relative`}><ColAlignIcon align={colAligns?.[5] || 'left'} onClick={() => cycleAlign(5)} />OT Ref<div onMouseDown={e => onResizeStart(5, e)} onDoubleClick={() => onAutoFit(5)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thClass} text-center relative`}>Acciones<div onMouseDown={e => onResizeStart(6, e)} onDoubleClick={() => onAutoFit(6)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(f => (
                  <tr key={f.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => navigate(`/fichas/${f.id}`)}>
                    <td className={`px-3 py-2 whitespace-nowrap ${getAlignClass(0)}`}>
                      <span className="font-semibold text-teal-600 text-xs">{f.numero}</span>
                    </td>
                    <td className={`px-3 py-2 text-xs text-slate-700 truncate ${getAlignClass(1)}`} title={f.clienteNombre}>{f.clienteNombre}</td>
                    <td className={`px-3 py-2 text-xs text-slate-600 truncate ${getAlignClass(2)}`} title={f.moduloNombre || f.descripcionLibre || ''}>
                      {f.moduloNombre || f.descripcionLibre || <span className="text-slate-300">—</span>}
                    </td>
                    <td className={`px-3 py-2 whitespace-nowrap ${getAlignClass(3)}`}>
                      <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded-full ${ESTADO_FICHA_COLORS[f.estado]}`}>
                        {ESTADO_FICHA_LABELS[f.estado]}
                      </span>
                    </td>
                    <td className={`px-3 py-2 text-xs text-slate-500 whitespace-nowrap ${getAlignClass(4)}`}>{formatDate(f.fechaIngreso)}</td>
                    <td className={`px-3 py-2 text-xs text-slate-500 whitespace-nowrap ${getAlignClass(5)}`}>
                      {f.otReferencia ? (
                        <Link to={`/ordenes-trabajo/${f.otReferencia}`} className="text-teal-600 hover:underline" onClick={e => e.stopPropagation()}>
                          {f.otReferencia}
                        </Link>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-0.5">
                        <button onClick={() => navigate(`/fichas/${f.id}`)}
                          className="text-[10px] font-medium text-emerald-600 hover:text-emerald-800 px-1 py-0.5 rounded hover:bg-emerald-50">
                          Ver
                        </button>
                        {f.estado === 'recibido' && (
                          <button onClick={() => handleDelete(f.id)}
                            className="text-[10px] font-medium text-red-500 hover:text-red-700 px-1 py-0.5 rounded hover:bg-red-50">
                            Eliminar
                          </button>
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

      <CreateFichaModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => {}} />
    </div>
  );
}
