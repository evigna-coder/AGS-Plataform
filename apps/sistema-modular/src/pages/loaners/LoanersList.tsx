import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { loanersService } from '../../services/firebaseService';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { CreateLoanerModal } from '../../components/loaners/CreateLoanerModal';
import type { Loaner, EstadoLoaner } from '@ags/shared';
import { ESTADO_LOANER_LABELS, ESTADO_LOANER_COLORS } from '@ags/shared';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { useResizableColumns } from '../../hooks/useResizableColumns';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { ColAlignIcon } from '../../components/ui/ColAlignIcon';

const FILTER_SCHEMA = {
  estado: { type: 'string' as const, default: '' },
  showInactivos: { type: 'boolean' as const, default: false },
};

const thClass = 'px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';
const ALERTA_DIAS = 30;

function diasPrestamo(fechaSalida: string): number {
  return Math.floor((Date.now() - new Date(fechaSalida).getTime()) / (1000 * 60 * 60 * 24));
}

export function LoanersList() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { tableRef, colWidths, colAligns, onResizeStart, onAutoFit, cycleAlign, getAlignClass } = useResizableColumns('loaners-list');
  const [loaners, setLoaners] = useState<Loaner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);

  const [filters, setFilter, _setFilters, resetFilters] = useUrlFilters(FILTER_SCHEMA);
  const [sortField, setSortField] = useState('codigo');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (f: string) => {
    const s = toggleSort(f, sortField, sortDir);
    setSortField(s.field); setSortDir(s.dir);
  };

  useEffect(() => {
    setLoading(true);
    unsubRef.current?.();
    unsubRef.current = loanersService.subscribe(
      { activoOnly: !filters.showInactivos },
      (data) => { setLoaners(data); setLoading(false); },
      (err) => { console.error('Loaners subscription error:', err); setLoading(false); },
    );
    return () => { unsubRef.current?.(); };
  }, [filters.showInactivos]);

  const filtered = useMemo(() => {
    let result = loaners;
    if (filters.estado) result = result.filter(l => l.estado === filters.estado);
    return sortByField(result, sortField, sortDir);
  }, [loaners, filters.estado, sortField, sortDir]);

  const handleDelete = async (id: string) => {
    if (!await confirm('Eliminar este loaner?')) return;
    await loanersService.delete(id);
    setLoaners(prev => prev.filter(l => l.id !== id));
  };

  const getPrestamoActivo = (l: Loaner) => l.prestamos.find(p => p.estado === 'activo');

  const isInitialLoad = loading && loaners.length === 0;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Loaners"
        subtitle="Equipos de la empresa para prestamo y venta"
        count={isInitialLoad ? undefined : filtered.length}
        actions={
          <Button size="sm" onClick={() => setShowCreate(true)}>+ Nuevo loaner</Button>
        }
      >
        <div className="flex items-center gap-3 flex-wrap">
          <div className="min-w-[150px]">
            <SearchableSelect value={filters.estado}
              onChange={(v) => setFilter('estado', v)}
              options={[{ value: '', label: 'Todos' }, ...(Object.keys(ESTADO_LOANER_LABELS) as EstadoLoaner[]).map(e => ({ value: e, label: ESTADO_LOANER_LABELS[e] }))]}
              placeholder="Estado" />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.showInactivos}
              onChange={e => setFilter('showInactivos', e.target.checked)}
              className="rounded border-slate-300"
            />
            Mostrar inactivos
          </label>
          <Button size="sm" variant="ghost" onClick={resetFilters}>
            Limpiar
          </Button>
        </div>
      </PageHeader>

      <div className="flex-1 min-h-0 px-5 pb-4">
        {isInitialLoad ? (
          <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando loaners...</p></div>
        ) : filtered.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-slate-400">No hay loaners registrados</p>
              <button onClick={() => setShowCreate(true)}
                className="text-teal-600 hover:underline mt-2 inline-block text-xs">
                Crear primer loaner
              </button>
            </div>
          </Card>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto h-full">
            <table ref={tableRef} className="w-full table-fixed">
              {colWidths ? (
                <colgroup>
                  {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
                </colgroup>
              ) : (
                <colgroup>
                  <col style={{ width: 75 }} />
                  <col />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: 80 }} />
                  <col style={{ width: 90 }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: 110 }} />
                </colgroup>
              )}
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <SortableHeader label="Codigo" field="codigo" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(0)} relative`}>
                    <ColAlignIcon align={colAligns?.[0] || 'left'} onClick={() => cycleAlign(0)} />
                    <div onMouseDown={e => onResizeStart(0, e)} onDoubleClick={() => onAutoFit(0)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <SortableHeader label="Descripcion" field="descripcion" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(1)} relative`}>
                    <ColAlignIcon align={colAligns?.[1] || 'left'} onClick={() => cycleAlign(1)} />
                    <div onMouseDown={e => onResizeStart(1, e)} onDoubleClick={() => onAutoFit(1)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <SortableHeader label="Categoria" field="categoriaEquipo" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(2)} relative`}>
                    <ColAlignIcon align={colAligns?.[2] || 'left'} onClick={() => cycleAlign(2)} />
                    <div onMouseDown={e => onResizeStart(2, e)} onDoubleClick={() => onAutoFit(2)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <th className={`${thClass} ${getAlignClass(3)} relative`}>Serie<ColAlignIcon align={colAligns?.[3] || 'left'} onClick={() => cycleAlign(3)} /><div onMouseDown={e => onResizeStart(3, e)} onDoubleClick={() => onAutoFit(3)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <SortableHeader label="Estado" field="estado" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(4)} relative`}>
                    <ColAlignIcon align={colAligns?.[4] || 'left'} onClick={() => cycleAlign(4)} />
                    <div onMouseDown={e => onResizeStart(4, e)} onDoubleClick={() => onAutoFit(4)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <th className={`${thClass} ${getAlignClass(5)} relative`}>Ubicacion actual<ColAlignIcon align={colAligns?.[5] || 'left'} onClick={() => cycleAlign(5)} /><div onMouseDown={e => onResizeStart(5, e)} onDoubleClick={() => onAutoFit(5)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thClass} text-center relative`}>Acciones<div onMouseDown={e => onResizeStart(6, e)} onDoubleClick={() => onAutoFit(6)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(l => {
                  const prestamo = getPrestamoActivo(l);
                  const diasFuera = prestamo ? diasPrestamo(prestamo.fechaSalida) : 0;
                  const alerta = prestamo && diasFuera > ALERTA_DIAS;

                  return (
                    <tr key={l.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => navigate(`/loaners/${l.id}`)}>
                      <td className={`px-3 py-2 whitespace-nowrap ${getAlignClass(0)}`}>
                        <span className="font-semibold text-teal-600 text-xs">{l.codigo}</span>
                      </td>
                      <td className={`px-3 py-2 text-xs text-slate-700 truncate ${getAlignClass(1)}`} title={l.descripcion}>{l.descripcion}</td>
                      <td className={`px-3 py-2 text-xs text-slate-500 truncate ${getAlignClass(2)}`}>{l.categoriaEquipo || <span className="text-slate-300">—</span>}</td>
                      <td className={`px-3 py-2 text-xs text-slate-500 whitespace-nowrap ${getAlignClass(3)}`}>{l.serie || <span className="text-slate-300">—</span>}</td>
                      <td className={`px-3 py-2 whitespace-nowrap ${getAlignClass(4)}`}>
                        <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded-full ${ESTADO_LOANER_COLORS[l.estado]}`}>
                          {ESTADO_LOANER_LABELS[l.estado]}
                        </span>
                        {alerta && (
                          <span className="ml-1.5 inline-flex px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-100 text-red-700" title={`${diasFuera} dias en cliente`}>
                            {diasFuera}d
                          </span>
                        )}
                      </td>
                      <td className={`px-3 py-2 text-xs text-slate-500 truncate ${getAlignClass(5)}`}>
                        {prestamo ? prestamo.clienteNombre : l.estado === 'en_base' ? 'AGS Base' : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-0.5">
                          <button onClick={() => navigate(`/loaners/${l.id}`)}
                            className="text-[10px] font-medium text-emerald-600 hover:text-emerald-800 px-1 py-0.5 rounded hover:bg-emerald-50">
                            Ver
                          </button>
                          {l.estado === 'en_base' && (
                            <button onClick={() => handleDelete(l.id)}
                              className="text-[10px] font-medium text-red-500 hover:text-red-700 px-1 py-0.5 rounded hover:bg-red-50">
                              Eliminar
                            </button>
                          )}
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

      <CreateLoanerModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => {}} />
    </div>
  );
}
