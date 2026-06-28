import { useState, useCallback } from 'react';
import { ordenesTrabajoService } from '../../services/firebaseService';
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
import { OTFiltersBar } from '../../components/ordenes-trabajo/OTFiltersBar';
import { OTKpiBar } from '../../components/ordenes-trabajo/OTKpiBar';
import { OTBulkActionsBar } from '../../components/ordenes-trabajo/OTBulkActionsBar';
import { OTListTable, OT_DATA_COLUMNS } from '../../components/ordenes-trabajo/OTListTable';
import { OTColumnsMenu } from '../../components/ordenes-trabajo/OTColumnsMenu';
import { type SortDir, toggleSort } from '../../components/ui/SortableHeader';
import { useResizableColumns } from '../../hooks/useResizableColumns';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { exportOTsToCSV } from '../../utils/otCsvExport';

const FILTER_SCHEMA = {
  clienteId: { type: 'string' as const, default: '' },
  sistemaId: { type: 'string' as const, default: '' },
  estadoAdmin: { type: 'string' as const, default: '__pendientes__' },
  busqueda: { type: 'string' as const, default: '' },
  busquedaDescripcion: { type: 'string' as const, default: '' },
  tipoServicio: { type: 'string' as const, default: '' },
  ingenieroId: { type: 'string' as const, default: '' },
  fechaDesde: { type: 'string' as const, default: '' },
  fechaHasta: { type: 'string' as const, default: '' },
  tipoFecha: { type: 'string' as const, default: 'createdAt' },
  soloFacturable: { type: 'boolean' as const, default: false },
  soloContrato: { type: 'boolean' as const, default: false },
  soloGarantia: { type: 'boolean' as const, default: false },
  sortField: { type: 'string' as const, default: 'createdAt' },
  sortDir: { type: 'string' as const, default: 'desc' },
};

/** Columnas ocultables para el menú "Columnas" (todas menos OT, que es el identificador). */
const HIDEABLE_COLUMNS = OT_DATA_COLUMNS.filter(c => c.idx !== 1).map(c => ({ idx: c.idx, label: c.label }));

export const OTList = () => {
  const confirm = useConfirm();
  const [filters, setFilter, setFilters, resetFilters] = useUrlFilters(FILTER_SCHEMA);

  // Las búsquedas ya vienen debounced desde OTFiltersBar (estado local + debounce
  // antes de tocar la URL), así que acá se usan directo.
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
    tipoFecha: filters.tipoFecha,
    soloFacturable: filters.soloFacturable,
    soloContrato: filters.soloContrato,
    soloGarantia: filters.soloGarantia,
    sortField: filters.sortField,
    sortDir: filters.sortDir,
    busqueda: filters.busqueda,
    busquedaDescripcion: filters.busquedaDescripcion,
  });

  const { tableRef, colWidths, colAligns, onResizeStart, onAutoFit, cycleAlign, getAlignClass, isHidden, toggleCol, showAllCols } = useResizableColumns('ot-list-v2');

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
            <OTColumnsMenu columns={HIDEABLE_COLUMNS} isHidden={isHidden} toggleCol={toggleCol} showAllCols={showAllCols} />
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
          <OTListTable
            grouped={grouped}
            sistemas={sistemas}
            selectedOTs={selectedOTs}
            allSelected={selectedOTs.size === grouped.length && grouped.length > 0}
            toggleSelect={toggleSelect}
            toggleSelectAll={toggleSelectAll}
            sortField={filters.sortField}
            sortDir={filters.sortDir as SortDir}
            onSort={handleSort}
            onRowClick={handleRowClick}
            onNewItem={setNewItemParent}
            onDelete={handleDelete}
            tableRef={tableRef}
            colWidths={colWidths}
            colAligns={colAligns}
            onResizeStart={onResizeStart}
            onAutoFit={onAutoFit}
            cycleAlign={cycleAlign}
            getAlignClass={getAlignClass}
            isHidden={isHidden}
            toggleCol={toggleCol}
            showAllCols={showAllCols}
          />
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
