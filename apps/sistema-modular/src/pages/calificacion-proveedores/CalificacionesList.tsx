import { useEffect, useState, useMemo, useRef } from 'react';
import { calificacionesService, promedioPonderado } from '../../services/calificacionesService';
import { proveedoresService } from '../../services/firebaseService';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { CalificacionModal } from './CalificacionModal';
import { CalificacionesTable, type CicloTab } from './CalificacionesTable';
import type { CalificacionProveedor, CriterioEvaluacion, EstadoCalificacion, Proveedor } from '@ags/shared';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { usePrompt } from '../../components/ui/PromptDialog';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { ExportarButton } from '../../components/ui/ExportarButton';
import { InformesButton } from './InformesButton';
import { CALIFICACIONES_EXPORT_COLUMNS } from '../../utils/exports/exportCalificaciones';
import { detalleCalificacion } from '../../utils/calificaciones';
import { filtrosAplicadosDesc } from '../../utils/exports/filtros';

const FILTER_SCHEMA = {
  ciclo: { type: 'string' as const, default: 'pendiente' },
  proveedorId: { type: 'string' as const, default: '' },
  estado: { type: 'string' as const, default: '' },
};

export function CalificacionesList() {
  const [items, setItems] = useState<CalificacionProveedor[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const confirm = useConfirm();
  const promptText = usePrompt();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CalificacionProveedor | null>(null);
  const [pendiente, setPendiente] = useState<CalificacionProveedor | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  const [filters, setFilter, _setFilters, resetFilters] = useUrlFilters(FILTER_SCHEMA);
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

  const tab = filters.ciclo as CicloTab;
  const pendientesCount = useMemo(() => items.filter(c => (c.estadoCiclo ?? 'calificada') === 'pendiente').length, [items]);

  const filtered = useMemo(() => {
    let result = items;
    if (tab) result = result.filter(c => (c.estadoCiclo ?? 'calificada') === tab);
    if (filters.estado) result = result.filter(c => c.estado === filters.estado);
    return sortByField(result, sortField, sortDir);
  }, [items, tab, filters.estado, sortField, sortDir]);

  // Promedio ponderado por proveedor sobre TODO lo suscripto (calificadas),
  // vía el service — no sobre el set filtrado por pestaña (bug del listado viejo).
  const promedios = useMemo(() => {
    const porProveedor = new Map<string, CalificacionProveedor[]>();
    items.forEach(c => {
      const arr = porProveedor.get(c.proveedorId) ?? [];
      arr.push(c);
      porProveedor.set(c.proveedorId, arr);
    });
    const map: Record<string, { promedio: number; count: number; estado: EstadoCalificacion }> = {};
    porProveedor.forEach((arr, provId) => { map[provId] = promedioPonderado(arr); });
    return map;
  }, [items]);

  const handleSave = async (data: Omit<CalificacionProveedor, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editing) await calificacionesService.update(editing.id, data);
    else await calificacionesService.create(data);
  };

  const handleCalificar = async (id: string, data: { criterios: CriterioEvaluacion[]; puntajeTotal: number; observaciones?: string | null; responsable: string }) => {
    await calificacionesService.calificar(id, data);
  };

  const handleOmitir = async (c: CalificacionProveedor) => {
    const motivo = await promptText({
      title: 'Omitir calificación',
      label: `Motivo (${c.proveedorNombre} — ${detalleCalificacion(c)})`,
      required: true,
      multiline: true,
    });
    if (motivo === null) return;
    await calificacionesService.omitir(c.id, motivo);
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
  const tabs: Array<{ value: CicloTab; label: string }> = [
    { value: 'pendiente', label: `Pendientes (${pendientesCount})` },
    { value: 'calificada', label: 'Calificadas' },
    { value: 'omitida', label: 'Omitidas' },
    { value: '', label: 'Todas' },
  ];

  const isInitialLoad = loading && items.length === 0;

  // Export Excel/PDF del array filtrado que muestra la tabla (set de columnas
  // común a todas las pestañas; "Ciclo" identifica la etapa de cada fila).
  const filtrosExport = filtrosAplicadosDesc({
    'Pestaña': tab ? ({ pendiente: 'Pendientes', calificada: 'Calificadas', omitida: 'Omitidas' } as Record<string, string>)[tab] : '',
    Proveedor: proveedores.find(p => p.id === filters.proveedorId)?.nombre,
    Estado: ({ aprobado: 'Aprobado', condicional: 'Condicional', no_aprobado: 'No aprobado' } as Record<string, string>)[filters.estado] ?? '',
  });

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Calificación de Proveedores"
        subtitle="Evaluación de entregas y ranking de proveedores"
        count={isInitialLoad ? undefined : filtered.length}
        actions={
          <div className="flex items-center gap-2">
            <InformesButton items={items} />
            <ExportarButton
              columnas={CALIFICACIONES_EXPORT_COLUMNS}
              data={filtered}
              titulo="Calificación de Proveedores"
              filename="calificaciones-proveedores"
              filtrosAplicados={filtrosExport}
            />
            <Button size="sm" onClick={() => { setEditing(null); setPendiente(null); setShowModal(true); }}>+ Nueva calificación</Button>
          </div>
        }
      >
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            {tabs.map(t => (
              <button key={t.value || 'todas'} onClick={() => setFilter('ciclo', t.value)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                  tab === t.value ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="min-w-[180px]">
            <SearchableSelect value={filters.proveedorId} onChange={(v: string) => setFilter('proveedorId', v)}
              options={proveedorOptions} placeholder="Proveedor..." />
          </div>
          {(tab === 'calificada' || tab === '') && (
            <div className="min-w-[150px]">
              <SearchableSelect value={filters.estado} onChange={(v: string) => setFilter('estado', v)}
                options={estadoOptions} placeholder="Estado..." />
            </div>
          )}
          {(filters.proveedorId || filters.estado || tab !== 'pendiente') && (
            <button onClick={resetFilters}
              className="text-xs text-slate-400 hover:text-slate-600 underline">Limpiar</button>
          )}
        </div>
      </PageHeader>

      <div className="flex-1 min-h-0 px-4 pb-4">
        {isInitialLoad ? (
          <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando calificaciones...</p></div>
        ) : (
          <CalificacionesTable
            items={filtered}
            tab={tab}
            promedios={promedios}
            sortField={sortField}
            sortDir={sortDir}
            onSort={handleSort}
            onCalificar={(c) => { setPendiente(c); setEditing(null); setShowModal(true); }}
            onOmitir={handleOmitir}
            onEditar={(c) => { setEditing(c); setPendiente(null); setShowModal(true); }}
            onEliminar={handleDelete}
          />
        )}
      </div>

      <CalificacionModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditing(null); setPendiente(null); }}
        onSave={handleSave}
        onCalificar={handleCalificar}
        proveedores={proveedores}
        editing={editing}
        pendiente={pendiente}
      />
    </div>
  );
}
