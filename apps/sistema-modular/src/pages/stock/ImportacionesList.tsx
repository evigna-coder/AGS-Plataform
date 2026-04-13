import { useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useImportaciones } from '../../hooks/useImportaciones';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useResizableColumns } from '../../hooks/useResizableColumns';
import { ColAlignIcon } from '../../components/ui/ColAlignIcon';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import type { EstadoImportacion, Importacion } from '@ags/shared';
import { ESTADO_IMPORTACION_LABELS, ESTADO_IMPORTACION_COLORS } from '@ags/shared';

const ESTADOS: EstadoImportacion[] = [
  'preparacion', 'embarcado', 'en_transito', 'en_aduana', 'despachado', 'recibido', 'cancelado',
];

const FILTER_SCHEMA = {
  estado: { type: 'string' as const, default: '' },
  sortField: { type: 'string' as const, default: 'fechaEstimadaArribo' },
  sortDir: { type: 'string' as const, default: 'desc' },
};

const isEtaVencida = (imp: Importacion): boolean => {
  if (!imp.fechaEstimadaArribo) return false;
  if (imp.estado === 'recibido' || imp.estado === 'cancelado') return false;
  return new Date(imp.fechaEstimadaArribo) < new Date();
};

const thClass = 'text-center text-[11px] font-medium text-slate-400 tracking-wider py-2 px-4';

export const ImportacionesList = () => {
  const navigate = useNavigate();
  const { importaciones, loading, loadImportaciones } = useImportaciones();
  const [filters, setFilter] = useUrlFilters(FILTER_SCHEMA);
  const { tableRef, colWidths, colAligns, onResizeStart, onAutoFit, cycleAlign, getAlignClass } = useResizableColumns('importaciones-list');

  const handleSort = (f: string) => {
    const s = toggleSort(f, filters.sortField, filters.sortDir as SortDir);
    setFilter('sortField', s.field);
    setFilter('sortDir', s.dir);
  };

  const sorted = useMemo(
    () => sortByField(importaciones, filters.sortField, filters.sortDir as SortDir),
    [importaciones, filters.sortField, filters.sortDir],
  );

  useEffect(() => {
    loadImportaciones(filters.estado ? { estado: filters.estado } : undefined);
  }, [filters.estado]);

  const formatDate = (d?: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Importaciones"
        subtitle="Operaciones de comercio exterior"
        count={sorted.length}
        actions={
          <Button size="sm" onClick={() => navigate('/stock/importaciones/nuevo')}>
            + Nueva importacion
          </Button>
        }
      >
        <div className="flex items-center gap-2">
          <select
            value={filters.estado}
            onChange={e => setFilter('estado', e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">Todos los estados</option>
            {ESTADOS.map(e => (
              <option key={e} value={e}>{ESTADO_IMPORTACION_LABELS[e]}</option>
            ))}
          </select>
        </div>
      </PageHeader>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="text-center py-12 text-xs text-slate-400">Cargando...</div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-xs text-slate-400">No hay importaciones registradas</p>
            </div>
          ) : (
            <table ref={tableRef} className="w-full table-fixed">
              {colWidths ? (
                <colgroup>
                  {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
                </colgroup>
              ) : (
                <colgroup>
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '14%' }} />
                </colgroup>
              )}
              <thead>
                <tr className="border-b border-slate-100">
                  <th className={`${thClass} relative ${getAlignClass(0)}`}>Numero<ColAlignIcon align={colAligns?.[0] || 'left'} onClick={() => cycleAlign(0)} /><div onMouseDown={e => onResizeStart(0, e)} onDoubleClick={() => onAutoFit(0)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thClass} relative ${getAlignClass(1)}`}>OC<ColAlignIcon align={colAligns?.[1] || 'left'} onClick={() => cycleAlign(1)} /><div onMouseDown={e => onResizeStart(1, e)} onDoubleClick={() => onAutoFit(1)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thClass} relative ${getAlignClass(2)}`}>Proveedor<ColAlignIcon align={colAligns?.[2] || 'left'} onClick={() => cycleAlign(2)} /><div onMouseDown={e => onResizeStart(2, e)} onDoubleClick={() => onAutoFit(2)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thClass} relative ${getAlignClass(3)}`}>Estado<ColAlignIcon align={colAligns?.[3] || 'left'} onClick={() => cycleAlign(3)} /><div onMouseDown={e => onResizeStart(3, e)} onDoubleClick={() => onAutoFit(3)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thClass} relative ${getAlignClass(4)}`}>Puerto destino<ColAlignIcon align={colAligns?.[4] || 'left'} onClick={() => cycleAlign(4)} /><div onMouseDown={e => onResizeStart(4, e)} onDoubleClick={() => onAutoFit(4)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <SortableHeader
                    label="ETA"
                    field="fechaEstimadaArribo"
                    currentField={filters.sortField}
                    currentDir={filters.sortDir as SortDir}
                    onSort={handleSort}
                    className={`relative text-left text-[11px] font-medium text-slate-400 tracking-wider py-2 px-4 ${getAlignClass(5)}`}
                  >
                    <ColAlignIcon align={colAligns?.[5] || 'left'} onClick={() => cycleAlign(5)} />
                    <div onMouseDown={e => onResizeStart(5, e)} onDoubleClick={() => onAutoFit(5)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <th className={thClass + ' relative'}>Acciones<div onMouseDown={e => onResizeStart(6, e)} onDoubleClick={() => onAutoFit(6)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(imp => (
                  <tr key={imp.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className={`text-xs py-2 px-4 ${getAlignClass(0)}`}>
                      <Link to={`/stock/importaciones/${imp.id}`} className="text-teal-600 font-medium hover:underline">
                        {imp.numero}
                      </Link>
                    </td>
                    <td className={`text-xs py-2 px-4 text-slate-700 whitespace-nowrap ${getAlignClass(1)}`}>{imp.ordenCompraNumero}</td>
                    <td className={`text-xs py-2 px-4 text-slate-700 truncate max-w-[160px] ${getAlignClass(2)}`}>{imp.proveedorNombre}</td>
                    <td className={`text-xs py-2 px-4 ${getAlignClass(3)}`}>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_IMPORTACION_COLORS[imp.estado]}`}>
                        {ESTADO_IMPORTACION_LABELS[imp.estado]}
                      </span>
                      {isEtaVencida(imp) && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 ml-1">
                          ETA vencida
                        </span>
                      )}
                    </td>
                    <td className={`text-xs py-2 px-4 text-slate-700 whitespace-nowrap ${getAlignClass(4)}`}>{imp.puertoDestino || '-'}</td>
                    <td className={`text-xs py-2 px-4 text-slate-700 whitespace-nowrap ${getAlignClass(5)}`}>{formatDate(imp.fechaEstimadaArribo)}</td>
                    <td className="text-xs py-2 px-4 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/stock/importaciones/${imp.id}`)}
                      >
                        Ver
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
