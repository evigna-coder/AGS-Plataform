import { useState, useCallback } from 'react';
import { ordenesTrabajoService } from '../../services/firebaseService';
import { useDebounce } from '../../hooks/useDebounce';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useOTListData } from '../../hooks/useOTListData';
import type { WorkOrder, OTEstadoAdmin } from '@ags/shared';
import { OT_ESTADO_LABELS } from '@ags/shared';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { CreateOTModal } from '../../components/ordenes-trabajo/CreateOTModal';
import { EditOTModal } from '../../components/ordenes-trabajo/EditOTModal';
import { TiposServicioModal } from '../../components/ordenes-trabajo/TiposServicioModal';
import { NewItemOTModal } from '../../components/ordenes-trabajo/NewItemOTModal';
import { OTStatusBadge } from '../../components/ordenes-trabajo/OTStatusBadge';
import { OTFiltersBar } from '../../components/ordenes-trabajo/OTFiltersBar';
import { OTKpiBar } from '../../components/ordenes-trabajo/OTKpiBar';
import { OTBulkActionsBar } from '../../components/ordenes-trabajo/OTBulkActionsBar';
import { SortableHeader, type SortDir, toggleSort } from '../../components/ui/SortableHeader';
import { useResizableColumns } from '../../hooks/useResizableColumns';
import { ColAlignIcon } from '../../components/ui/ColAlignIcon';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { exportOTsToCSV } from '../../utils/otCsvExport';

const FILTER_SCHEMA = {
  clienteId: { type: 'string' as const, default: '' },
  sistemaId: { type: 'string' as const, default: '' },
  estadoAdmin: { type: 'string' as const, default: '__pendientes__' },
  busquedaOT: { type: 'string' as const, default: '' },
  busquedaModulo: { type: 'string' as const, default: '' },
  busquedaEquipo: { type: 'string' as const, default: '' },
  tipoServicio: { type: 'string' as const, default: '' },
  ingenieroId: { type: 'string' as const, default: '' },
  fechaDesde: { type: 'string' as const, default: '' },
  fechaHasta: { type: 'string' as const, default: '' },
  soloFacturable: { type: 'boolean' as const, default: false },
  soloContrato: { type: 'boolean' as const, default: false },
  soloGarantia: { type: 'boolean' as const, default: false },
  sortField: { type: 'string' as const, default: 'createdAt' },
  sortDir: { type: 'string' as const, default: 'desc' },
};

const thClass = 'px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';

/** Abre el reporte en reportes-ot (Electron o browser). */
const openReport = (otNum: string) => {
  const url = `http://localhost:3000?reportId=${otNum}`;
  if ((window as any).electronAPI?.openWindow) (window as any).electronAPI.openWindow(url);
  else if ((window as any).electronAPI?.openExternal) (window as any).electronAPI.openExternal(url);
  else window.open(url, '_blank');
};

const formatDate = (dateString: string | undefined) => {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-AR');
  } catch { return '—'; }
};

export const OTList = () => {
  const confirm = useConfirm();
  const [filters, setFilter, setFilters, resetFilters] = useUrlFilters(FILTER_SCHEMA);

  // Búsquedas debounced — el grouping se memoiza por estos valores ya estabilizados.
  const debouncedBusquedaOT = useDebounce(filters.busquedaOT, 300);
  const debouncedBusquedaModulo = useDebounce(filters.busquedaModulo, 300);
  const debouncedBusquedaEquipo = useDebounce(filters.busquedaEquipo, 300);

  const {
    ordenes, clientes, sistemas, tiposServicioList, ingenierosList,
    loading, grouped, kpis, reloadReferenceData,
  } = useOTListData({
    clienteId: filters.clienteId,
    sistemaId: filters.sistemaId,
    estadoAdmin: filters.estadoAdmin,
    tipoServicio: filters.tipoServicio,
    ingenieroId: filters.ingenieroId,
    fechaDesde: filters.fechaDesde,
    fechaHasta: filters.fechaHasta,
    soloFacturable: filters.soloFacturable,
    soloContrato: filters.soloContrato,
    soloGarantia: filters.soloGarantia,
    sortField: filters.sortField,
    sortDir: filters.sortDir,
    busquedaOT: debouncedBusquedaOT,
    busquedaModulo: debouncedBusquedaModulo,
    busquedaEquipo: debouncedBusquedaEquipo,
  });

  const { tableRef, colWidths, colAligns, onResizeStart, onAutoFit, cycleAlign, getAlignClass } = useResizableColumns('ot-list');

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [editOtNumber, setEditOtNumber] = useState<string | null>(null);
  const [newItemParent, setNewItemParent] = useState<WorkOrder | null>(null);
  const [showTiposServicio, setShowTiposServicio] = useState(false);

  // Bulk selection
  const [selectedOTs, setSelectedOTs] = useState<Set<string>>(new Set());
  const toggleSelect = (otNum: string) => setSelectedOTs(prev => {
    const next = new Set(prev);
    next.has(otNum) ? next.delete(otNum) : next.add(otNum);
    return next;
  });
  const toggleSelectAll = () => {
    if (selectedOTs.size === grouped.length) setSelectedOTs(new Set());
    else setSelectedOTs(new Set(grouped.map(g => g.ot.otNumber)));
  };

  const handleBulkDelete = async () => {
    if (selectedOTs.size === 0) return;
    if (!await confirm(`¿Eliminar ${selectedOTs.size} OTs seleccionadas?`)) return;
    try {
      for (const otNum of selectedOTs) await ordenesTrabajoService.delete(otNum);
      setSelectedOTs(new Set());
    } catch (err) { alert(err instanceof Error ? err.message : 'Error al eliminar'); }
  };

  const handleBulkEstado = async (nuevoEstado: OTEstadoAdmin) => {
    if (selectedOTs.size === 0) return;
    if (!await confirm(`¿Cambiar ${selectedOTs.size} OTs a ${OT_ESTADO_LABELS[nuevoEstado]}?`)) return;
    try {
      const ahora = new Date().toISOString();
      for (const otNum of selectedOTs) {
        const ot = ordenes.find(o => o.otNumber === otNum);
        await ordenesTrabajoService.update(otNum, {
          estadoAdmin: nuevoEstado, estadoAdminFecha: ahora,
          estadoHistorial: [...(ot?.estadoHistorial || []), { estado: nuevoEstado, fecha: ahora, nota: 'Cambio masivo' }],
          ...(nuevoEstado === 'FINALIZADO' ? { status: 'FINALIZADO' as const } : {}),
        });
      }
      setSelectedOTs(new Set());
    } catch { alert('Error al cambiar estados'); }
  };

  const handleSort = (f: string) => {
    const s = toggleSort(f, filters.sortField, filters.sortDir as SortDir);
    setFilters({ sortField: s.field, sortDir: s.dir });
  };

  // Real-time updates ya vienen del subscribe en useOTListData — onSaved/onCreated no
  // necesitan refetch manual.
  const noopReload = useCallback(async () => {}, []);

  const handleDelete = async (ot: WorkOrder) => {
    if (!await confirm(`¿Eliminar OT-${ot.otNumber}?`)) return;
    try {
      await ordenesTrabajoService.delete(ot.otNumber);
    } catch (err) { alert(err instanceof Error ? err.message : 'Error al eliminar'); }
  };

  /** Click en fila: items y padres sin items → editar; padres con items → no-op (usar botones) */
  const handleRowClick = (ot: WorkOrder, hasItems: boolean) => {
    const isParent = !ot.otNumber.includes('.');
    if (isParent && hasItems) return;
    setEditOtNumber(ot.otNumber);
  };

  const isInitialLoad = loading && ordenes.length === 0;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Órdenes de Trabajo"
        subtitle="Gestión de órdenes de servicio"
        count={isInitialLoad ? undefined : grouped.length}
        actions={
          <div className="flex gap-2 items-center">
            <Button size="sm" variant="outline" onClick={() => exportOTsToCSV(grouped, sistemas)}
              disabled={grouped.length === 0} title="Exportar datos filtrados a CSV">
              Exportar CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowTiposServicio(true)}>Tipos de Servicio</Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>+ Nueva OT</Button>
          </div>
        }
      >
        <OTFiltersBar
          filters={filters}
          setFilter={setFilter as (key: string, value: string | boolean) => void}
          resetFilters={resetFilters}
          clientes={clientes}
          sistemas={sistemas}
          tiposServicioList={tiposServicioList}
          ingenierosList={ingenierosList}
        />
      </PageHeader>

      {ordenes.length > 0 && <OTKpiBar kpis={kpis} />}

      <OTBulkActionsBar
        count={selectedOTs.size}
        onChangeEstado={handleBulkEstado}
        onDelete={handleBulkDelete}
        onClear={() => setSelectedOTs(new Set())}
      />

      <div className="flex-1 min-h-0 px-5 pb-4">
        {isInitialLoad ? (
          <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando órdenes de trabajo...</p></div>
        ) : grouped.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-slate-400">No se encontraron órdenes de trabajo</p>
              <button onClick={() => setShowCreate(true)}
                className="text-teal-600 hover:underline mt-2 inline-block text-xs">
                Crear primera orden de trabajo
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
                  {/* Checkbox | OT | Cliente | Sistema | Id Equipo | Módulo | Servicio | Descripción | Creada | F.Serv | Estado | Acciones */}
                  <col style={{ width: 32 }} />
                  <col style={{ width: 75 }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '12%' }} />
                  <col />
                  <col style={{ width: 78 }} />
                  <col style={{ width: 78 }} />
                  <col style={{ width: 85 }} />
                  <col style={{ width: 180 }} />
                </colgroup>
              )}
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-1 py-2 text-center" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedOTs.size === grouped.length && grouped.length > 0}
                      onChange={toggleSelectAll} className="w-3.5 h-3.5 accent-teal-600" />
                  </th>
                  {[
                    { label: 'OT', field: 'otNumber' },
                    { label: 'Cliente', field: 'razonSocial' },
                    { label: 'Sistema', field: 'sistema' },
                    { label: 'Id Equipo', field: 'codigoInternoCliente' },
                    { label: 'Módulo', field: 'moduloModelo' },
                    { label: 'Servicio', field: 'tipoServicio' },
                  ].map((col, i) => (
                    <SortableHeader key={col.field} label={col.label} field={col.field}
                      currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort}
                      className={`${thClass} relative ${getAlignClass(i)}`}>
                      <ColAlignIcon align={colAligns?.[i] || 'left'} onClick={() => cycleAlign(i)} />
                      <div onMouseDown={e => onResizeStart(i, e)} onDoubleClick={() => onAutoFit(i)}
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                    </SortableHeader>
                  ))}
                  <th className={`${thClass} relative ${getAlignClass(6)}`}>
                    <ColAlignIcon align={colAligns?.[6] || 'left'} onClick={() => cycleAlign(6)} />
                    Descripción
                    <div onMouseDown={e => onResizeStart(6, e)} onDoubleClick={() => onAutoFit(6)}
                      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </th>
                  {[
                    { label: 'Creada', field: 'createdAt', idx: 7 },
                    { label: 'F. Serv.', field: 'fechaInicio', idx: 8 },
                    { label: 'Estado', field: 'estadoAdmin', idx: 9 },
                  ].map(col => (
                    <SortableHeader key={col.field} label={col.label} field={col.field}
                      currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort}
                      className={`${thClass} relative ${getAlignClass(col.idx)}`}>
                      <ColAlignIcon align={colAligns?.[col.idx] || 'left'} onClick={() => cycleAlign(col.idx)} />
                      <div onMouseDown={e => onResizeStart(col.idx, e)} onDoubleClick={() => onAutoFit(col.idx)}
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                    </SortableHeader>
                  ))}
                  <th className={`${thClass} text-center`}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {grouped.map(({ ot, isItem, hasItems }) => {
                  const sistema = sistemas.find(s => s.id === ot.sistemaId);
                  const isParent = !ot.otNumber.includes('.');
                  const parentWithItems = isParent && hasItems;
                  return (
                    <tr key={ot.otNumber}
                      className={`hover:bg-slate-50 transition-colors ${isItem ? 'bg-slate-50/50' : ''} ${parentWithItems ? '' : 'cursor-pointer'}`}
                      onClick={() => handleRowClick(ot, hasItems)}>
                      <td className="px-1 py-2 text-center" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedOTs.has(ot.otNumber)}
                          onChange={() => toggleSelect(ot.otNumber)} className="w-3.5 h-3.5 accent-teal-600" />
                      </td>
                      <td className={`px-2 py-2 whitespace-nowrap ${getAlignClass(0)}`}>
                        {isItem ? (
                          <span className="text-xs text-teal-500 pl-2">
                            <span className="text-slate-300 mr-1">└</span>{ot.otNumber}
                          </span>
                        ) : (
                          <span className="font-semibold text-teal-600 text-xs">{ot.otNumber}</span>
                        )}
                      </td>
                      <td className={`px-2 py-2 text-xs text-slate-700 truncate ${getAlignClass(1)}`} title={ot.razonSocial}>
                        {isItem ? '' : ot.razonSocial}
                      </td>
                      <td className={`px-2 py-2 text-xs text-slate-600 truncate ${getAlignClass(2)}`} title={sistema?.nombre || ot.sistema}>
                        {isItem ? '' : (sistema?.nombre || ot.sistema || '—')}
                      </td>
                      <td className={`px-2 py-2 text-xs text-slate-600 font-mono truncate ${getAlignClass(3)}`} title={ot.codigoInternoCliente || ''}>
                        {isItem ? '' : (ot.codigoInternoCliente || '—')}
                      </td>
                      <td className={`px-2 py-2 text-xs text-slate-600 truncate ${getAlignClass(4)}`} title={[ot.moduloModelo, ot.moduloSerie].filter(Boolean).join(' — ')}>
                        {ot.moduloModelo || '—'}
                        {ot.moduloSerie && <span className="text-slate-400 ml-1">({ot.moduloSerie})</span>}
                      </td>
                      <td className={`px-2 py-2 text-xs text-slate-600 truncate ${getAlignClass(5)}`} title={ot.tipoServicio}>{ot.tipoServicio}</td>
                      <td className={`px-2 py-2 text-xs text-slate-500 truncate ${getAlignClass(6)}`} title={ot.problemaFallaInicial || ''}>
                        {ot.problemaFallaInicial || <span className="text-slate-300">—</span>}
                      </td>
                      <td className={`px-2 py-2 text-xs text-slate-500 whitespace-nowrap ${getAlignClass(7)}`}>{formatDate(ot.createdAt)}</td>
                      <td className={`px-2 py-2 text-xs text-slate-500 whitespace-nowrap ${getAlignClass(8)}`}>{formatDate(ot.fechaInicio || ot.fechaServicioAprox)}</td>
                      <td className={`px-2 py-2 whitespace-nowrap ${getAlignClass(9)}`}><OTStatusBadge ot={ot} /></td>
                      <td className="px-2 py-2 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            onClick={() => openReport(ot.otNumber)}
                            className="text-[10px] font-medium text-emerald-600 hover:text-emerald-800 px-1 py-0.5 rounded hover:bg-emerald-50"
                            title="Abrir reporte"
                          >
                            Reporte
                          </button>
                          {!isItem && (
                            <button
                              onClick={() => setNewItemParent(ot)}
                              className="text-[10px] font-medium text-teal-600 hover:text-teal-800 px-1 py-0.5 rounded hover:bg-teal-50"
                              title="Crear nuevo item"
                            >
                              +Item
                            </button>
                          )}
                          {!parentWithItems && (
                            <button
                              onClick={() => setEditOtNumber(ot.otNumber)}
                              className="text-[10px] font-medium text-slate-500 hover:text-slate-700 px-1 py-0.5 rounded hover:bg-slate-100"
                              title="Editar"
                            >
                              Editar
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(ot)}
                            className="text-[10px] font-medium text-red-500 hover:text-red-700 px-1 py-0.5 rounded hover:bg-red-50"
                            title="Eliminar"
                          >
                            Eliminar
                          </button>
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

      <CreateOTModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={reloadReferenceData} />
      {editOtNumber && (
        <EditOTModal
          open={!!editOtNumber}
          otNumber={editOtNumber}
          onClose={() => setEditOtNumber(null)}
          onSaved={noopReload}
        />
      )}
      <NewItemOTModal
        open={!!newItemParent}
        parentOt={newItemParent}
        onClose={() => setNewItemParent(null)}
        onCreated={noopReload}
      />
      <TiposServicioModal open={showTiposServicio} onClose={() => setShowTiposServicio(false)} />
    </div>
  );
};
