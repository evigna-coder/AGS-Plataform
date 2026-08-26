import { useEffect, useMemo, useState, Fragment } from 'react';
import { useImportaciones } from '../../hooks/useImportaciones';
import { ImportacionModal } from '../../components/stock/ImportacionModal';
import { ImportacionItemsPanel } from '../../components/stock/ImportacionItemsPanel';
import { articulosService } from '../../services/stockService';
import type { Articulo } from '@ags/shared';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useResizableColumns } from '../../hooks/useResizableColumns';
import { ColAlignIcon } from '../../components/ui/ColAlignIcon';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import type { EstadoImportacion, Importacion } from '@ags/shared';
import { ESTADO_IMPORTACION_LABELS, ESTADO_IMPORTACION_COLORS } from '@ags/shared';
import { ExportarButton } from '../../components/ui/ExportarButton';
import { IMPORTACIONES_EXPORT_COLUMNS } from '../../utils/exports/exportImportaciones';
import { filtrosAplicadosDesc } from '../../utils/exports/filtros';

const ESTADOS: EstadoImportacion[] = [
  'preparacion', 'en_origen', 'embarcado', 'en_transito', 'en_aduana', 'despachado', 'recibido', 'cancelado',
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
  const { importaciones, loading, loadImportaciones } = useImportaciones();
  const [filters, setFilter] = useUrlFilters(FILTER_SCHEMA);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalImpId, setModalImpId] = useState<string | null>(null);
  const openImp = (id: string | null) => { setModalImpId(id); setModalOpen(true); };
  const reloadList = () => loadImportaciones(filters.estado ? { estado: filters.estado } : undefined);
  // v3 (2026-08-07): 6 → 9 columnas (embarque, liberación, despachante). Al
  // cambiar la cantidad de columnas hay que versionar la key o los anchos
  // guardados empujan las últimas fuera de la tabla.
  const { tableRef, colWidths, colAligns, onResizeStart, onAutoFit, cycleAlign, getAlignClass } = useResizableColumns('importaciones-list-v3');

  // Detalle desplegable por fila (2026-08-07): artículos con factor individual.
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  const [articulosById, setArticulosById] = useState<Map<string, Articulo>>(new Map());
  const toggleExpand = (id: string) => setExpandidas(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // Catálogo de artículos para recomputar el costeo del panel (una vez, cacheado).
  useEffect(() => {
    articulosService.getAll()
      .then(arts => setArticulosById(new Map(arts.map(a => [a.id, a]))))
      .catch(err => console.error('[ImportacionesList] artículos:', err));
  }, []);

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
    // Del TEXTO ISO, no de Date+toLocaleDateString: los datos viejos guardados a
    // medianoche UTC retrocedían un día al formatear en huso argentino.
    const [y, m, dd] = d.slice(0, 10).split('-');
    return `${dd}/${m}/${y.slice(2)}`;
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Importaciones"
        subtitle="Operaciones de comercio exterior"
        count={sorted.length}
        actions={
          <div className="flex items-center gap-2">
            <ExportarButton
              columnas={IMPORTACIONES_EXPORT_COLUMNS}
              data={sorted}
              titulo="Importaciones"
              filename="importaciones"
              filtrosAplicados={filtrosAplicadosDesc({
                Estado: filters.estado ? (ESTADO_IMPORTACION_LABELS[filters.estado as EstadoImportacion] ?? filters.estado) : '',
              })}
            />
            <Button size="sm" onClick={() => openImp(null)}>
              + Nueva importacion
            </Button>
          </div>
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
            <table ref={tableRef} className="tabla-compacta w-full table-fixed">
              {colWidths ? (
                <colgroup>
                  {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
                </colgroup>
              ) : (
                <colgroup>
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '17%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '9%' }} />
                </colgroup>
              )}
              <thead>
                <tr className="border-b border-slate-100">
                  <th className={`${thClass} relative ${getAlignClass(0)}`}>OC<ColAlignIcon align={colAligns?.[0] || 'left'} onClick={() => cycleAlign(0)} /><div onMouseDown={e => onResizeStart(0, e)} onDoubleClick={() => onAutoFit(0)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thClass} relative ${getAlignClass(1)}`}>Proveedor<ColAlignIcon align={colAligns?.[1] || 'left'} onClick={() => cycleAlign(1)} /><div onMouseDown={e => onResizeStart(1, e)} onDoubleClick={() => onAutoFit(1)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thClass} relative ${getAlignClass(2)}`}>Estado<ColAlignIcon align={colAligns?.[2] || 'left'} onClick={() => cycleAlign(2)} /><div onMouseDown={e => onResizeStart(2, e)} onDoubleClick={() => onAutoFit(2)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thClass} relative ${getAlignClass(3)}`}>Embarque<ColAlignIcon align={colAligns?.[3] || 'left'} onClick={() => cycleAlign(3)} /><div onMouseDown={e => onResizeStart(3, e)} onDoubleClick={() => onAutoFit(3)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <SortableHeader
                    label="Arribo"
                    field="fechaEstimadaArribo"
                    currentField={filters.sortField}
                    currentDir={filters.sortDir as SortDir}
                    onSort={handleSort}
                    className={`relative text-left text-[11px] font-medium text-slate-400 tracking-wider py-2 px-4 ${getAlignClass(4)}`}
                  >
                    <ColAlignIcon align={colAligns?.[4] || 'left'} onClick={() => cycleAlign(4)} />
                    <div onMouseDown={e => onResizeStart(4, e)} onDoubleClick={() => onAutoFit(4)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <th className={`${thClass} relative ${getAlignClass(5)}`}>Liberación<ColAlignIcon align={colAligns?.[5] || 'left'} onClick={() => cycleAlign(5)} /><div onMouseDown={e => onResizeStart(5, e)} onDoubleClick={() => onAutoFit(5)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thClass} relative ${getAlignClass(6)}`}>Despachante<ColAlignIcon align={colAligns?.[6] || 'left'} onClick={() => cycleAlign(6)} /><div onMouseDown={e => onResizeStart(6, e)} onDoubleClick={() => onAutoFit(6)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thClass} relative ${getAlignClass(7)}`}>Agente de carga<ColAlignIcon align={colAligns?.[7] || 'left'} onClick={() => cycleAlign(7)} /><div onMouseDown={e => onResizeStart(7, e)} onDoubleClick={() => onAutoFit(7)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thClass} relative ${getAlignClass(8)}`}>N° guia<ColAlignIcon align={colAligns?.[8] || 'left'} onClick={() => cycleAlign(8)} /><div onMouseDown={e => onResizeStart(8, e)} onDoubleClick={() => onAutoFit(8)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(imp => {
                  const abierta = expandidas.has(imp.id);
                  return (
                  <Fragment key={imp.id}>
                  <tr
                    onClick={() => openImp(imp.id)}
                    className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer">
                    <td className={`text-xs py-2 px-4 text-teal-600 font-medium whitespace-nowrap ${getAlignClass(0)}`}>
                      {/* El chevron despliega los artículos; el resto de la fila abre la importación. */}
                      <button
                        onClick={e => { e.stopPropagation(); toggleExpand(imp.id); }}
                        title={abierta ? 'Ocultar artículos' : 'Ver artículos y factores'}
                        className="mr-1.5 text-slate-400 hover:text-teal-600 align-middle">
                        <svg className={`w-3 h-3 inline transition-transform ${abierta ? 'rotate-90' : ''}`}
                          fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </button>
                      {imp.ordenCompraNumero}
                    </td>
                    <td className={`text-xs py-2 px-4 text-slate-700 truncate ${getAlignClass(1)}`}>{imp.proveedorNombre}</td>
                    <td className={`text-xs py-2 px-4 ${getAlignClass(2)}`}>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_IMPORTACION_COLORS[imp.estado]}`}>
                        {ESTADO_IMPORTACION_LABELS[imp.estado]}
                      </span>
                      {isEtaVencida(imp) && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 ml-1">
                          ETA vencida
                        </span>
                      )}
                    </td>
                    <td className={`text-xs py-2 px-4 text-slate-700 whitespace-nowrap ${getAlignClass(3)}`}>{formatDate(imp.fechaEmbarque)}</td>
                    <td className={`text-xs py-2 px-4 text-slate-700 whitespace-nowrap ${getAlignClass(4)}`}>{formatDate(imp.fechaEstimadaArribo)}</td>
                    <td className={`text-xs py-2 px-4 text-slate-700 whitespace-nowrap ${getAlignClass(5)}`}>{formatDate(imp.fechaDespacho)}</td>
                    <td className={`text-xs py-2 px-4 text-slate-700 truncate ${getAlignClass(6)}`}>{imp.despachante || (imp.esCourier ? 'Courier' : '-')}</td>
                    <td className={`text-xs py-2 px-4 text-slate-700 truncate ${getAlignClass(7)}`}>{imp.agenteCarga || '-'}</td>
                    <td className={`text-xs py-2 px-4 text-slate-700 whitespace-nowrap font-mono ${getAlignClass(8)}`}>{imp.numeroGuia || '-'}</td>
                  </tr>
                  {abierta && (
                    <tr>
                      <td colSpan={9} className="p-0">
                        <ImportacionItemsPanel imp={imp} articulosById={articulosById} />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ImportacionModal
        open={modalOpen}
        impId={modalImpId}
        onClose={() => { setModalOpen(false); setModalImpId(null); }}
        onSaved={reloadList}
      />
    </div>
  );
};
