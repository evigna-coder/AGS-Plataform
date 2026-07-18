import { useState, useEffect, useMemo, useRef } from 'react';
import { presupuestosService, clientesService, usuariosService, facturacionService, ordenesTrabajoService } from '../../services/firebaseService';
import { ordenesCompraClienteService } from '../../services/ordenesCompraClienteService';
import { useDebounce } from '../../hooks/useDebounce';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useResizableColumns } from '../../hooks/useResizableColumns';
import { useAuth } from '../../contexts/AuthContext';
import { ColAlignIcon } from '../../components/ui/ColAlignIcon';
import type { Presupuesto, PresupuestoEstado, Cliente, UsuarioAGS, SolicitudFacturacion, OrdenCompraCliente, WorkOrder } from '@ags/shared';
import { ESTADO_PRESUPUESTO_LABELS, ESTADO_PRESUPUESTO_COLORS, TIPO_PRESUPUESTO_LABELS, TIPO_PRESUPUESTO_COLORS, MONEDA_SIMBOLO } from '@ags/shared';
import { exportPresupuestosExcel, exportPresupuestosPDF, type PresupuestoExportRow } from '../../utils/exports/exportPresupuestos';
import { exportOCsPendientesExcel, exportOCsPendientesPDF, type OCPendienteExportRow } from '../../utils/exports/exportOCsPendientes';
import { Button } from '../../components/ui/Button';
import { MenuButton } from '../../components/ui/MenuButton';
import { Card } from '../../components/ui/Card';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { PageHeader } from '../../components/ui/PageHeader';
import { CreatePresupuestoModal } from '../../components/presupuestos/CreatePresupuestoModal';
import { CreateRevisionModal } from '../../components/presupuestos/CreateRevisionModal';
import { ConceptosServicioModal } from '../../components/presupuestos/ConceptosServicioModal';
import { CategoriasPresupuestoModal } from '../../components/presupuestos/CategoriasPresupuestoModal';
import { CondicionesPagoModal } from '../../components/presupuestos/CondicionesPagoModal';
import { PlantillasTextoModal } from '../../components/presupuestos/PlantillasTextoModal';
import { PresupuestoDashboard } from '../../components/presupuestos/PresupuestoDashboard';
import { SolicitarFacturaModal } from '../../components/presupuestos/SolicitarFacturaModal';
import { AdjuntarOCModal } from '../../components/presupuestos/AdjuntarOCModal';
import { CargarOCModal } from '../../components/presupuestos/CargarOCModal';
import { CreateOTModal } from '../../components/ordenes-trabajo/CreateOTModal';
import { useFloatingPresupuesto } from '../../contexts/FloatingPresupuestoContext';
import { useTabs } from '../../contexts/TabsContext';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { getDaysUntilExpiry, getDaysUntilContacto, getExpiryStatusColor, getExpiryStatusText, getContactoStatusColor, getContactoStatusText, isExpired, needsFollowUp, isAnulado } from '../../utils/presupuestoHelpers';
import { computeOCAdeudada, OC_ADEUDADA_ESTADOS } from '../../utils/analitica/presupuestosMetrics';
import { hoyLocalISODate } from '../../utils/formatFecha';

const thClass = 'px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';
const ACTIVE_PIPELINE_STATES = ['enviado', 'aceptado', 'en_ejecucion', 'pendiente_facturacion'];

export const PresupuestosList = () => {
  const confirm = useConfirm();
  const { hasRole, usuario } = useAuth();
  const canExport = hasRole('admin', 'admin_soporte');
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioAGS[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [revisionTarget, setRevisionTarget] = useState<Presupuesto | null>(null);
  const [showConceptos, setShowConceptos] = useState(false);
  const [showCategorias, setShowCategorias] = useState(false);
  const [showCondiciones, setShowCondiciones] = useState(false);
  const [showPlantillas, setShowPlantillas] = useState(false);
  const [solicitudes, setSolicitudes] = useState<SolicitudFacturacion[]>([]);
  // OTs cerradas (cierre técnico o posterior) — join para "Pend. OC — trabajo realizado".
  const [otsCerradas, setOtsCerradas] = useState<WorkOrder[]>([]);
  const [facturaTarget, setFacturaTarget] = useState<Presupuesto | null>(null);
  const [ocTarget, setOcTarget] = useState<Presupuesto | null>(null);
  // Target presupuesto para el nuevo modal de FLOW-02 "Cargar OC" (se activa solo en estado aceptado).
  const [cargarOCTarget, setCargarOCTarget] = useState<Presupuesto | null>(null);
  // OCs previas del cliente del cargarOCTarget — resuelto async al abrir.
  const [ocsExistentesForTarget, setOcsExistentesForTarget] = useState<OrdenCompraCliente[]>([]);
  const [otTarget, setOtTarget] = useState<Presupuesto | null>(null);
  const floatingPres = useFloatingPresupuesto();
  const { navigateInActiveTab } = useTabs();
  const { tableRef, colWidths, colAligns, onResizeStart, onAutoFit, cycleAlign, getAlignClass } = useResizableColumns('presupuestos-list');

  // Aviso a facturación 1-click desde la fila (UAT 2026-07-17): agrupa TODAS las
  // OTs cerradas pendientes del ppto en una solicitud, sin pasar por la OT.
  const handleQuickAviso = async (p: Presupuesto) => {
    const ots = p.otsListasParaFacturar ?? [];
    if (ots.length === 0) { alert('El presupuesto no tiene OTs listas para facturar.'); return; }
    const detalle = ots.length === 1 ? `la OT ${ots[0]}` : `las OTs ${ots.join(', ')}`;
    if (!await confirm(`¿Generar el aviso a facturación de ${p.numero} por ${detalle}?`)) return;
    try {
      await presupuestosService.generarAvisoFacturacion(
        p.id, ots, undefined,
        usuario ? { uid: usuario.id, name: usuario.displayName } : undefined,
      );
    } catch (err) {
      console.error('Error generando aviso a facturación:', err);
      alert(err instanceof Error ? err.message : 'Error al generar el aviso a facturación');
    }
  };

  const handleQuickEstado = async (p: Presupuesto, nuevoEstado: PresupuestoEstado) => {
    if (!await confirm(`¿Cambiar ${p.numero} a "${ESTADO_PRESUPUESTO_LABELS[nuevoEstado]}"?`)) return;
    const updates: Partial<Presupuesto> = { estado: nuevoEstado };
    if (nuevoEstado === 'enviado' && !p.fechaEnvio) updates.fechaEnvio = hoyLocalISODate();
    await presupuestosService.update(p.id, updates).catch(() => alert('Error al cambiar estado'));
  };

  const FILTER_SCHEMA = useMemo(() => ({
    search:      { type: 'string' as const,  default: '' },
    cliente:     { type: 'string' as const,  default: '' },
    estado:      { type: 'string' as const,  default: '' },
    tipo:        { type: 'string' as const,  default: '' },
    responsable: { type: 'string' as const,  default: '' },
    fechaDesde:  { type: 'string' as const,  default: '' },
    fechaHasta:  { type: 'string' as const,  default: '' },
    sortField:   { type: 'string' as const,  default: 'createdAt' },
    sortDir:     { type: 'string' as const,  default: 'desc' },
    ocPendiente: { type: 'boolean' as const, default: false },
    // Subconjunto de ocPendiente con OT cerrada: el trabajo ya se hizo y la OC se debe.
    ocTrabajoRealizado: { type: 'boolean' as const, default: false },
    // KPI activo como filtro (click en las tarjetas del dashboard).
    kpi:         { type: 'string' as const,  default: '' },
  }), []);
  const [filters, setFilter, , resetFilters] = useUrlFilters(FILTER_SCHEMA);
  // Local search state for responsive typing — syncs to URL debounced
  const [localSearch, setLocalSearch] = useState(filters.search);
  const debouncedSearch = useDebounce(localSearch, 300);
  useEffect(() => { setFilter('search', debouncedSearch); }, [debouncedSearch]);
  useEffect(() => { if (filters.search !== localSearch && filters.search === '') setLocalSearch(''); }, [filters.search]);

  const handleSort = (f: string) => {
    const s = toggleSort(f, filters.sortField, filters.sortDir as SortDir);
    setFilter('sortField', s.field); setFilter('sortDir', s.dir);
  };

  const unsubRef = useRef<(() => void) | null>(null);
  const unsubSolRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Load reference data
    Promise.all([
      clientesService.getAll(true),
      usuariosService.getAll(),
    ]).then(([clientesData, usrs]) => {
      setClientes(clientesData);
      setUsuarios(usrs);
    }).catch(err => console.error('Error cargando datos de referencia:', err));

    // Carga única de OTs cerradas para el badge/filtro "Pend. OC — trabajo realizado"
    // (UAT 2026-07-17 item 1). Sin subscribe: alcanza el snapshot al montar.
    ordenesTrabajoService.getCerradas()
      .then(setOtsCerradas)
      .catch(err => console.error('Error cargando OTs cerradas:', err));

    // Real-time subscription for presupuestos
    setLoading(true);
    unsubRef.current = presupuestosService.subscribe(
      undefined,
      (data) => { setPresupuestos(data); setLoading(false); },
      (err) => { console.error('Error presupuestos:', err); setLoading(false); },
    );
    // Real-time subscription for solicitudes facturacion (dashboard)
    unsubSolRef.current = facturacionService.subscribe(
      undefined,
      (data) => setSolicitudes(data),
    );
    return () => { unsubRef.current?.(); unsubSolRef.current?.(); };
  }, []);

  // No-op: onSnapshot handles real-time updates. Kept for callback compatibility.
  const loadData = () => {};

  // FLOW-02: al abrir el modal "Cargar OC" (target seteado) resuelve las OCs
  // previas del mismo cliente para poblar el tab "Existente". Se limpia al cerrar.
  useEffect(() => {
    let cancelled = false;
    if (!cargarOCTarget) {
      setOcsExistentesForTarget([]);
      return;
    }
    ordenesCompraClienteService.getByCliente(cargarOCTarget.clienteId)
      .then(list => { if (!cancelled) setOcsExistentesForTarget(list); })
      .catch(err => {
        console.error('Error resolviendo OCs previas del cliente:', err);
        if (!cancelled) setOcsExistentesForTarget([]);
      });
    return () => { cancelled = true; };
  }, [cargarOCTarget?.clienteId, cargarOCTarget?.id]);

  // Otros presupuestos del mismo cliente, `aceptado` y sin OC cargada aún — para
  // el checkbox N:M del modal. Derivado de la lista ya cargada en memoria.
  const otrosPresupuestosParaOC = useMemo<Presupuesto[]>(() => {
    if (!cargarOCTarget) return [];
    return presupuestos.filter(p =>
      p.id !== cargarOCTarget.id &&
      p.clienteId === cargarOCTarget.clienteId &&
      p.estado === 'aceptado' &&
      (!p.ordenesCompraIds || p.ordenesCompraIds.length === 0)
    );
  }, [presupuestos, cargarOCTarget]);

  const getClienteNombre = (clienteId: string) => {
    return clientes.find(c => c.id === clienteId)?.razonSocial || '—';
  };

  // Sets por presupuesto derivados de las solicitudes de facturación (avisos):
  // activas (no anuladas), pendientes de facturar y facturadas sin cobro.
  const solicitudSets = useMemo(() => {
    const activas = new Set<string>(), pendientes = new Set<string>(), facturadas = new Set<string>();
    for (const s of solicitudes) {
      if (s.estado !== 'anulada') activas.add(s.presupuestoId);
      if (s.estado === 'pendiente') pendientes.add(s.presupuestoId);
      if (s.estado === 'facturada') facturadas.add(s.presupuestoId);
    }
    return { activas, pendientes, facturadas };
  }, [solicitudes]);

  // OT cerrada lista para facturar pero sin aviso a facturación generado.
  const faltaAviso = (p: Presupuesto) =>
    p.estado === 'pendiente_facturacion' && !solicitudSets.activas.has(p.id);

  // Pptos SIN OC del cliente pero CON al menos una OT cerrada: el trabajo ya se
  // hizo y la OC se debe (UAT 2026-07-17 item 1). Mismo join que la analítica.
  const trabajoRealizadoIds = useMemo(
    () => new Set(computeOCAdeudada(presupuestos, otsCerradas, new Date()).rows.map(r => r.presupuesto.id)),
    [presupuestos, otsCerradas],
  );

  const presupuestosFiltrados = useMemo(() => {
    // Vista básica (sin estado/KPI/filtros de OC elegidos): ocultar los que ya no
    // requieren acción comercial — finalizados y los enviados a facturación (aviso
    // generado, en manos de Administración). Se ven eligiendo el estado en el
    // filtro o clickeando los KPIs (UAT 2026-07-18).
    const vistaBasica = !filters.estado && !filters.kpi && !filters.ocPendiente && !filters.ocTrabajoRealizado;
    let result = presupuestos.filter(p => {
      if (vistaBasica) {
        if (p.estado === 'finalizado') return false;
        if (p.estado === 'pendiente_facturacion' && solicitudSets.activas.has(p.id)) return false;
      }
      if (filters.cliente && p.clienteId !== filters.cliente) return false;
      if (filters.estado && p.estado !== filters.estado) return false;
      if (filters.tipo && p.tipo !== filters.tipo) return false;
      if (filters.responsable && p.responsableId !== filters.responsable) return false;
      if (filters.fechaDesde && p.createdAt < filters.fechaDesde) return false;
      if (filters.fechaHasta && p.createdAt > filters.fechaHasta + 'T23:59:59') return false;
      // OCs pendientes: aceptado o posterior SIN OCs cargadas aun (esperando OC del
      // cliente). Mismos estados que la analítica (OC_ADEUDADA_ESTADOS) — alinea el
      // drill-down que navega con ?ocPendiente=true.
      if (filters.ocPendiente) {
        if (!OC_ADEUDADA_ESTADOS.has(p.estado)) return false;
        if ((p.ordenesCompraIds || []).length > 0) return false;
      }
      // Solo trabajo realizado: subconjunto sin OC con OT cerrada.
      if (filters.ocTrabajoRealizado && !trabajoRealizadoIds.has(p.id)) return false;
      // KPI del dashboard como filtro (UAT 2026-07-17).
      if (filters.kpi === 'enviados' && p.estado !== 'enviado') return false;
      if (filters.kpi === 'aceptados' && p.estado !== 'aceptado') return false;
      if (filters.kpi === 'fact_pendientes' && !solicitudSets.pendientes.has(p.id)) return false;
      if (filters.kpi === 'pend_cobro' && !solicitudSets.facturadas.has(p.id)) return false;
      if (filters.kpi === 'pendiente_aviso' && !faltaAviso(p)) return false;
      return true;
    });
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(p =>
        p.numero.toLowerCase().includes(q) ||
        getClienteNombre(p.clienteId).toLowerCase().includes(q)
      );
    }
    // Custom sort for computed fields
    if (filters.sortField === '_validez') {
      result = [...result].sort((a, b) => {
        const va = getDaysUntilExpiry(a.validUntil, a.fechaEnvio, a.validezDias) ?? 9999;
        const vb = getDaysUntilExpiry(b.validUntil, b.fechaEnvio, b.validezDias) ?? 9999;
        return filters.sortDir === 'asc' ? va - vb : vb - va;
      });
    } else if (filters.sortField === '_seguimiento') {
      result = [...result].sort((a, b) => {
        const va = getDaysUntilContacto(a.proximoContacto) ?? 9999;
        const vb = getDaysUntilContacto(b.proximoContacto) ?? 9999;
        return filters.sortDir === 'asc' ? va - vb : vb - va;
      });
    } else {
      result = sortByField(result, filters.sortField, filters.sortDir as SortDir);
    }
    return result;
  }, [presupuestos, filters, debouncedSearch, solicitudSets, trabajoRealizadoIds]);

  // (UAT 2026-07-17) El "Pipeline: ..." del subtítulo se unificó con el que ya
  // muestra la tarjeta Enviados del dashboard — decía lo mismo en dos lugares.

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '—';
    // Timezone-safe: tomar la parte 'YYYY-MM-DD' y armar la fecha en zona local.
    // Evita que `new Date(isoUTC)` corra el día al mostrarlo en UTC-3 (incluye los
    // registros históricos guardados como medianoche UTC antes del fix).
    const m = dateString.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
    try { return new Date(dateString).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }); } catch { return dateString; }
  };

  const getRowStyle = (p: Presupuesto) => {
    if (isAnulado(p)) return 'opacity-50';
    if (p.estado === 'anulado' || p.estado === 'finalizado') return 'opacity-60';
    if (isExpired(p) && ACTIVE_PIPELINE_STATES.includes(p.estado)) return 'border-l-2 border-red-300 bg-red-50/50';
    if (needsFollowUp(p)) return 'border-l-2 border-amber-300 bg-amber-50/30';
    return '';
  };

  const handleRevisionCreated = (newId: string) => {
    setRevisionTarget(null);
    loadData();
    floatingPres.open(newId, loadData);
  };

  const hasFilters = filters.cliente || filters.estado || filters.tipo || filters.responsable || filters.fechaDesde || filters.fechaHasta || filters.ocPendiente || filters.ocTrabajoRealizado || filters.kpi;

  const isInitialLoad = loading && presupuestos.length === 0;

  // ---- Export helpers ----
  function buildPresupuestoRows(rows: Presupuesto[], clientesList: Cliente[], usuariosList: UsuarioAGS[]): PresupuestoExportRow[] {
    return rows.map(p => ({
      presupuesto: p,
      clienteNombre: clientesList.find(c => c.id === p.clienteId)?.razonSocial || '—',
      responsableNombre: usuariosList.find(u => u.id === p.responsableId)?.displayName || p.responsableNombre || '—',
    }));
  }

  function buildOCPendienteRows(rows: Presupuesto[], clientesList: Cliente[], usuariosList: UsuarioAGS[]): OCPendienteExportRow[] {
    return rows.map(p => ({
      presupuesto: p,
      clienteNombre: clientesList.find(c => c.id === p.clienteId)?.razonSocial || '—',
      ocNumero: 'N/A',
      ocFecha: null,
      adjuntosCount: (p.adjuntos || []).length,
      diasDesdeCarga: Math.floor((Date.now() - new Date(p.createdAt).getTime()) / 86_400_000),
      coordinadorNombre: usuariosList.find(u => u.id === p.responsableId)?.displayName || p.responsableNombre || '—',
    }));
  }

  function buildFiltrosLabel(f: typeof filters, clientesList: Cliente[]): string {
    const parts: string[] = [];
    if (f.cliente) {
      const nombre = clientesList.find(c => c.id === f.cliente)?.razonSocial;
      if (nombre) parts.push(`cliente=${nombre}`);
    }
    if (f.estado) parts.push(`estado=${ESTADO_PRESUPUESTO_LABELS[f.estado as keyof typeof ESTADO_PRESUPUESTO_LABELS] || f.estado}`);
    if (f.tipo) parts.push(`tipo=${f.tipo}`);
    if (f.responsable) parts.push(`responsable=${f.responsable}`);
    if (f.ocPendiente) parts.push('OCs pendientes');
    if (f.ocTrabajoRealizado) parts.push('Pend. OC — trabajo realizado');
    return parts.length > 0 ? parts.join(', ') : 'Sin filtros';
  }
  // ---- End export helpers ----

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader title="Presupuestos" count={isInitialLoad ? undefined : presupuestosFiltrados.length}
        actions={
          <div className="flex gap-2">
            {/* UAT 2026-07-17: los 6 accesos de configuración (uso ocasional) colapsados
                en un solo menú para descargar el header. */}
            <MenuButton label="Configuración" items={[
              { label: 'Conceptos de servicio', onClick: () => setShowConceptos(true) },
              { label: 'Categorías', onClick: () => setShowCategorias(true) },
              { label: 'Condiciones de pago', onClick: () => setShowCondiciones(true) },
              { label: 'Plantillas de textos', onClick: () => setShowPlantillas(true) },
              { label: 'Tipos de equipo', onClick: () => navigateInActiveTab('/presupuestos/tipos-equipo') },
              { label: 'Consumibles por módulo', onClick: () => navigateInActiveTab('/presupuestos/consumibles-por-modulo') },
            ]} />
            <Button size="sm" variant="outline" onClick={() => navigateInActiveTab('/presupuestos/analitica')}>Analítica</Button>
            {canExport && (
              <>
                <Button size="sm" variant="outline" onClick={() => {
                  const filtrosLabel = buildFiltrosLabel(filters, clientes);
                  if (filters.ocPendiente) {
                    const ocRows = buildOCPendienteRows(presupuestosFiltrados, clientes, usuarios);
                    exportOCsPendientesExcel(ocRows, { filtrosLabel });
                  } else {
                    const rows = buildPresupuestoRows(presupuestosFiltrados, clientes, usuarios);
                    exportPresupuestosExcel(rows, { filtrosLabel });
                  }
                }}>
                  Exportar Excel
                </Button>
                <Button size="sm" variant="outline" onClick={async () => {
                  const filtrosLabel = buildFiltrosLabel(filters, clientes);
                  if (filters.ocPendiente) {
                    const ocRows = buildOCPendienteRows(presupuestosFiltrados, clientes, usuarios);
                    await exportOCsPendientesPDF(ocRows, { filtrosLabel });
                  } else {
                    const rows = buildPresupuestoRows(presupuestosFiltrados, clientes, usuarios);
                    await exportPresupuestosPDF(rows, { filtrosLabel });
                  }
                }}>
                  Exportar PDF
                </Button>
              </>
            )}
            <Button size="sm" onClick={() => setShowCreate(true)}>+ Nuevo Presupuesto</Button>
          </div>
        }>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="text" placeholder="Buscar por número, cliente..." value={localSearch} onChange={e => setLocalSearch(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 w-56" />
          <div className="min-w-[120px]">
            <SearchableSelect size="sm" value={filters.cliente} onChange={v => setFilter('cliente', v)}
              options={[{ value: '', label: 'Cliente: Todos' }, ...clientes.map(c => ({ value: c.id, label: c.razonSocial }))]}
              placeholder="Cliente" />
          </div>
          <div className="min-w-[100px]">
            <SearchableSelect size="sm" value={filters.estado} onChange={v => setFilter('estado', v)}
              options={[{ value: '', label: 'Estado: Todos' }, ...Object.entries(ESTADO_PRESUPUESTO_LABELS).map(([value, label]) => ({ value, label }))]}
              placeholder="Estado" />
          </div>
          <div className="min-w-[90px]">
            <SearchableSelect size="sm" value={filters.tipo} onChange={v => setFilter('tipo', v)}
              options={[{ value: '', label: 'Tipo: Todos' }, ...Object.entries(TIPO_PRESUPUESTO_LABELS).map(([value, label]) => ({ value, label }))]}
              placeholder="Tipo" />
          </div>
          <div className="min-w-[110px]">
            <SearchableSelect size="sm" value={filters.responsable} onChange={v => setFilter('responsable', v)}
              options={[{ value: '', label: 'Responsable' }, ...usuarios.filter(u => u.status === 'activo').map(u => ({ value: u.id, label: u.displayName }))]}
              placeholder="Responsable" />
          </div>
          <input type="date" value={filters.fechaDesde} onChange={e => setFilter('fechaDesde', e.target.value)}
            className="text-[11px] border border-slate-200 rounded-lg px-2 py-1 text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500" title="Desde" />
          <input type="date" value={filters.fechaHasta} onChange={e => setFilter('fechaHasta', e.target.value)}
            className="text-[11px] border border-slate-200 rounded-lg px-2 py-1 text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500" title="Hasta" />
          <label className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filters.ocPendiente}
              onChange={e => setFilter('ocPendiente', e.target.checked)}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            OCs pendientes
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer select-none"
            title="Presupuestos sin OC del cliente pero con al menos una OT cerrada — el trabajo ya se realizó">
            <input
              type="checkbox"
              checked={filters.ocTrabajoRealizado}
              onChange={e => setFilter('ocTrabajoRealizado', e.target.checked)}
              className="rounded border-slate-300 text-red-600 focus:ring-red-500"
            />
            Solo trabajo realizado
          </label>
          {hasFilters && (
            <Button size="sm" variant="ghost" onClick={() => resetFilters()}>Limpiar</Button>
          )}
        </div>
      </PageHeader>

      <PresupuestoDashboard
        presupuestos={presupuestos}
        solicitudes={solicitudes}
        activeKpi={filters.kpi as any}
        onKpiClick={(k) => setFilter('kpi', filters.kpi === k ? '' : k)}
      />

      <div className="flex-1 min-h-0 px-5 pb-4">
        {isInitialLoad ? (
          <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando presupuestos...</p></div>
        ) : presupuestosFiltrados.length === 0 ? (
          <Card><div className="text-center py-12">
            <p className="text-slate-400">No hay presupuestos para mostrar</p>
            <button onClick={() => setShowCreate(true)} className="text-teal-600 hover:underline mt-2 inline-block text-xs">Crear primer presupuesto</button>
          </div></Card>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto h-full">
            <table ref={tableRef} className="w-full table-fixed">
              {colWidths ? (
                <colgroup>{colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
              ) : (
                <colgroup>
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '12%' }} />
                </colgroup>
              )}
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <SortableHeader label="Número" field="numero" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`${thClass} relative ${getAlignClass(0)}`}>
                    <ColAlignIcon align={colAligns?.[0] || 'left'} onClick={() => cycleAlign(0)} />
                    <div onMouseDown={e => onResizeStart(0, e)} onDoubleClick={() => onAutoFit(0)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <SortableHeader label="Cliente" field="clienteId" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`${thClass} relative ${getAlignClass(1)}`}>
                    <ColAlignIcon align={colAligns?.[1] || 'left'} onClick={() => cycleAlign(1)} />
                    <div onMouseDown={e => onResizeStart(1, e)} onDoubleClick={() => onAutoFit(1)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <SortableHeader label="Tipo" field="tipo" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`${thClass} relative ${getAlignClass(2)}`}>
                    <ColAlignIcon align={colAligns?.[2] || 'left'} onClick={() => cycleAlign(2)} />
                    <div onMouseDown={e => onResizeStart(2, e)} onDoubleClick={() => onAutoFit(2)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <SortableHeader label="Estado" field="estado" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`${thClass} relative ${getAlignClass(3)}`}>
                    <ColAlignIcon align={colAligns?.[3] || 'left'} onClick={() => cycleAlign(3)} />
                    <div onMouseDown={e => onResizeStart(3, e)} onDoubleClick={() => onAutoFit(3)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <SortableHeader label="Total" field="total" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`${thClass} relative ${getAlignClass(4)}`}>
                    <ColAlignIcon align={colAligns?.[4] || 'left'} onClick={() => cycleAlign(4)} />
                    <div onMouseDown={e => onResizeStart(4, e)} onDoubleClick={() => onAutoFit(4)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <SortableHeader label="Responsable" field="responsableNombre" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`${thClass} relative ${getAlignClass(5)}`}>
                    <ColAlignIcon align={colAligns?.[5] || 'left'} onClick={() => cycleAlign(5)} />
                    <div onMouseDown={e => onResizeStart(5, e)} onDoubleClick={() => onAutoFit(5)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <SortableHeader label="Creado" field="createdAt" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`${thClass} relative ${getAlignClass(6)}`}>
                    <ColAlignIcon align={colAligns?.[6] || 'left'} onClick={() => cycleAlign(6)} />
                    <div onMouseDown={e => onResizeStart(6, e)} onDoubleClick={() => onAutoFit(6)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <SortableHeader label="Enviado" field="fechaEnvio" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`${thClass} relative ${getAlignClass(7)}`}>
                    <ColAlignIcon align={colAligns?.[7] || 'left'} onClick={() => cycleAlign(7)} />
                    <div onMouseDown={e => onResizeStart(7, e)} onDoubleClick={() => onAutoFit(7)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <SortableHeader label="Validez" field="_validez" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`${thClass} relative ${getAlignClass(8)}`}>
                    <ColAlignIcon align={colAligns?.[8] || 'left'} onClick={() => cycleAlign(8)} />
                    <div onMouseDown={e => onResizeStart(8, e)} onDoubleClick={() => onAutoFit(8)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <SortableHeader label="Seguimiento" field="_seguimiento" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`${thClass} relative ${getAlignClass(9)}`}>
                    <ColAlignIcon align={colAligns?.[9] || 'left'} onClick={() => cycleAlign(9)} />
                    <div onMouseDown={e => onResizeStart(9, e)} onDoubleClick={() => onAutoFit(9)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <th className={`${thClass} text-center relative`}>
                    Acciones
                    <div onMouseDown={e => onResizeStart(10, e)} onDoubleClick={() => onAutoFit(10)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {presupuestosFiltrados.map((p) => {
                  const sym = MONEDA_SIMBOLO[(p.moneda || 'USD') as keyof typeof MONEDA_SIMBOLO] || '$';
                  const daysExpiry = getDaysUntilExpiry(p.validUntil, p.fechaEnvio, p.validezDias);
                  const daysContact = getDaysUntilContacto(p.proximoContacto);
                  return (
                    <tr key={p.id} className={`hover:bg-slate-50 transition-colors cursor-pointer ${getRowStyle(p)}`}
                      onClick={() => floatingPres.open(p.id, loadData)}>
                      <td className={`px-3 py-2 whitespace-nowrap ${getAlignClass(0)}`}>
                        <span className="font-semibold text-teal-600 text-[10px]">{p.numero}</span>
                      </td>
                      <td className={`px-3 py-2 text-[10px] text-slate-700 truncate max-w-[140px] ${getAlignClass(1)}`} title={getClienteNombre(p.clienteId)}>
                        {getClienteNombre(p.clienteId)}
                      </td>
                      <td className={`px-3 py-2 whitespace-nowrap ${getAlignClass(2)}`}>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TIPO_PRESUPUESTO_COLORS[p.tipo || 'servicio']}`}>
                          {TIPO_PRESUPUESTO_LABELS[p.tipo || 'servicio']}
                        </span>
                      </td>
                      <td className={`px-3 py-2 whitespace-nowrap ${getAlignClass(3)}`}>
                        {/* Una sola línea: badge de estado + chip compacto "OC ⚠" (UAT 2026-07-18 —
                            el segundo badge apilado duplicaba el alto de la fila). */}
                        <div className="inline-flex items-center gap-1">
                          {faltaAviso(p) ? (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700"
                              title="OT cerrada lista para facturar, pero todavía no se generó el aviso a facturación — generalo desde el presupuesto (sección Facturación)">
                              OT cerrada — falta aviso
                            </span>
                          ) : (
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_PRESUPUESTO_COLORS[p.estado]}`}
                              title={isAnulado(p) && p.motivoAnulacion ? `Motivo: ${p.motivoAnulacion}` : undefined}>
                              {ESTADO_PRESUPUESTO_LABELS[p.estado]}
                            </span>
                          )}
                          {trabajoRealizadoIds.has(p.id) && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 cursor-help"
                              title="Pend. OC — trabajo realizado: el trabajo ya se hizo (OT cerrada) y el cliente todavía no mandó la orden de compra. Reclamar OC.">
                              OC ⚠
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={`px-3 py-2 text-[10px] text-slate-900 font-medium tabular-nums whitespace-nowrap ${getAlignClass(4)}`}>
                        {sym} {p.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className={`px-3 py-2 text-[10px] text-slate-500 truncate max-w-[90px] whitespace-nowrap ${getAlignClass(5)}`} title={p.responsableNombre || ''}>
                        {p.responsableNombre || '—'}
                      </td>
                      <td className={`px-3 py-2 text-[10px] text-slate-500 whitespace-nowrap ${getAlignClass(6)}`}>{formatDate(p.createdAt)}</td>
                      <td className={`px-3 py-2 text-[10px] text-slate-500 whitespace-nowrap ${getAlignClass(7)}`}>{formatDate(p.fechaEnvio)}</td>
                      <td className={`px-3 py-2 whitespace-nowrap ${getAlignClass(8)}`}>
                        {daysExpiry !== null ? (
                          <span className={`text-[10px] font-medium ${getExpiryStatusColor(daysExpiry)}`}>
                            {getExpiryStatusText(daysExpiry)}
                          </span>
                        ) : <span className="text-[10px] text-slate-300">—</span>}
                      </td>
                      <td className={`px-3 py-2 whitespace-nowrap ${getAlignClass(9)}`}>
                        {daysContact !== null ? (
                          <span className={`text-[10px] font-medium ${getContactoStatusColor(daysContact)}`}>
                            {getContactoStatusText(daysContact)}
                          </span>
                        ) : <span className="text-[10px] text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-0.5">
                          {!isAnulado(p) && (
                            <>
                              <select
                                value={p.estado}
                                onChange={e => handleQuickEstado(p, e.target.value as PresupuestoEstado)}
                                className="text-[10px] border border-slate-200 rounded px-1 py-0.5 bg-white text-slate-600 cursor-pointer hover:border-slate-400"
                                title="Cambiar estado"
                              >
                                {Object.entries(ESTADO_PRESUPUESTO_LABELS).map(([k, v]) => (
                                  <option key={k} value={k}>{v}</option>
                                ))}
                              </select>
                              <button onClick={() => setOcTarget(p)} title="Adjuntar OC"
                                className="text-[10px] font-medium text-slate-400 hover:text-slate-600 px-1 py-0.5 rounded hover:bg-slate-100">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                                </svg>
                              </button>
                              {p.estado === 'aceptado' && (
                                <button onClick={() => setCargarOCTarget(p)}
                                  title="Cargar OC del cliente (FLOW-02)"
                                  className="text-[10px] font-medium text-teal-600 hover:text-teal-800 px-1.5 py-0.5 rounded hover:bg-teal-50 border border-teal-100">
                                  Cargar OC
                                </button>
                              )}
                              {(p.estado === 'borrador' || p.estado === 'enviado') && (
                                <button onClick={() => handleQuickEstado(p, 'enviado')} title="Marcar como enviado"
                                  className="text-[10px] font-medium text-blue-500 hover:text-blue-700 px-1 py-0.5 rounded hover:bg-blue-50">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                                  </svg>
                                </button>
                              )}
                              {faltaAviso(p) && (p.otsListasParaFacturar?.length ?? 0) > 0 && (
                                <button onClick={() => handleQuickAviso(p)}
                                  title={`Generar aviso a facturación — ${(p.otsListasParaFacturar ?? []).length} OT(s) cerrada(s) sin aviso`}
                                  data-testid={`aviso-facturacion-${p.numero}`}
                                  className="text-[10px] font-medium text-orange-500 hover:text-orange-700 px-1 py-0.5 rounded hover:bg-orange-50">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                                  </svg>
                                </button>
                              )}
                              {p.estado === 'aceptado' && (
                                <button onClick={() => setFacturaTarget(p)} title="Solicitar facturación"
                                  className="text-[10px] font-medium text-amber-500 hover:text-amber-700 px-1 py-0.5 rounded hover:bg-amber-50">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
                                  </svg>
                                </button>
                              )}
                              <button onClick={() => setOtTarget(p)} title="Crear OT"
                                className="text-[10px] font-medium text-violet-500 hover:text-violet-700 px-1 py-0.5 rounded hover:bg-violet-50">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085" />
                                </svg>
                              </button>
                              <button onClick={() => setRevisionTarget(p)} title="Crear revisión"
                                className="text-[10px] font-medium text-slate-400 hover:text-slate-600 px-1 py-0.5 rounded hover:bg-slate-100">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
                                </svg>
                              </button>
                            </>
                          )}
                          <button onClick={() => floatingPres.open(p.id, loadData)}
                            className="text-[10px] font-medium text-emerald-600 hover:text-emerald-800 px-1 py-0.5 rounded hover:bg-emerald-50">
                            Ver
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

      <CreatePresupuestoModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(newId) => {
          loadData();
          // Auto-abrir el edit modal para completar notas/condiciones/adjuntos
          // antes de enviar — regla 2026-04-24: "se crea para ser enviado".
          if (newId) floatingPres.open(newId, loadData);
        }}
      />
      <CreateRevisionModal open={!!revisionTarget} presupuesto={revisionTarget} onClose={() => setRevisionTarget(null)} onCreated={handleRevisionCreated} />
      <ConceptosServicioModal open={showConceptos} onClose={() => setShowConceptos(false)} />
      <CategoriasPresupuestoModal open={showCategorias} onClose={() => setShowCategorias(false)} />
      <CondicionesPagoModal open={showCondiciones} onClose={() => setShowCondiciones(false)} />
      <PlantillasTextoModal open={showPlantillas} onClose={() => setShowPlantillas(false)} />
      {otTarget && (
        <CreateOTModal
          open={!!otTarget}
          onClose={() => setOtTarget(null)}
          onCreated={() => setOtTarget(null)}
          prefill={{
            clienteId: otTarget.clienteId,
            establecimientoId: otTarget.establecimientoId || undefined,
            sistemaId: otTarget.sistemaId || undefined,
            contactoId: otTarget.contactoId || undefined,
            presupuestoId: otTarget.id,
            presupuestoNumero: otTarget.numero,
            ordenCompra: (otTarget as any).ordenCompraNumero || undefined,
          }}
        />
      )}
      {ocTarget && (
        <AdjuntarOCModal
          open={!!ocTarget}
          presupuestoId={ocTarget.id}
          presupuestoNumero={ocTarget.numero}
          currentOCNumero={(ocTarget as any).ordenCompraNumero}
          currentAdjuntos={ocTarget.adjuntos || []}
          onClose={() => setOcTarget(null)}
          onSaved={() => setOcTarget(null)}
        />
      )}
      {cargarOCTarget && (
        <CargarOCModal
          open={!!cargarOCTarget}
          presupuesto={cargarOCTarget}
          onClose={() => setCargarOCTarget(null)}
          onSuccess={() => setCargarOCTarget(null) /* subscribe refresca automático */}
          ocsExistentes={ocsExistentesForTarget}
          otrosPresupuestosPendientes={otrosPresupuestosParaOC}
        />
      )}
      {facturaTarget && (
        <SolicitarFacturaModal
          open={!!facturaTarget}
          presupuesto={facturaTarget}
          clienteNombre={getClienteNombre(facturaTarget.clienteId)}
          condicionPagoNombre="—"
          onClose={() => setFacturaTarget(null)}
          onCreated={() => setFacturaTarget(null)}
        />
      )}
    </div>
  );
};
