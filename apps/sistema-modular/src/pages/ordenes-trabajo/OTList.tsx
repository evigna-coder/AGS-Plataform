import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ordenesTrabajoService, clientesService, sistemasService, tiposServicioService, usuariosService } from '../../services/firebaseService';
import type { WorkOrder, Cliente, Sistema, OTEstadoAdmin, TipoServicio, UsuarioAGS } from '@ags/shared';
import { OT_ESTADO_LABELS, OT_ESTADO_ORDER } from '@ags/shared';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { PageHeader } from '../../components/ui/PageHeader';
import { CreateOTModal } from '../../components/ordenes-trabajo/CreateOTModal';
import { EditOTModal } from '../../components/ordenes-trabajo/EditOTModal';
import { TiposServicioModal } from '../../components/ordenes-trabajo/TiposServicioModal';
import { Modal } from '../../components/ui/Modal';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { useResizableColumns } from '../../hooks/useResizableColumns';

const ESTADO_COLORS: Record<string, string> = {
  CREADA: 'bg-slate-100 text-slate-600',
  ASIGNADA: 'bg-blue-100 text-blue-700',
  COORDINADA: 'bg-violet-100 text-violet-700',
  EN_CURSO: 'bg-amber-100 text-amber-700',
  CIERRE_TECNICO: 'bg-orange-100 text-orange-700',
  CIERRE_ADMINISTRATIVO: 'bg-cyan-100 text-cyan-700',
  FINALIZADO: 'bg-emerald-100 text-emerald-700',
  BORRADOR: 'bg-amber-100 text-amber-700',
};

/** Export filtered OTs to CSV and trigger download */
const exportToCSV = (rows: { ot: WorkOrder }[], sistemas: Sistema[]) => {
  const headers = ['OT', 'Cliente', 'Sistema', 'Id Equipo', 'Módulo', 'Serie', 'Tipo Servicio', 'Descripción', 'Estado', 'Ingeniero', 'Fecha Creación', 'Fecha Servicio', 'Hs Lab', 'Hs Viaje', 'Facturable', 'Contrato', 'Garantía'];
  const csvRows = rows.map(({ ot }) => {
    const sist = sistemas.find(s => s.id === ot.sistemaId);
    return [
      ot.otNumber, ot.razonSocial, sist?.nombre || ot.sistema || '', ot.codigoInternoCliente || '',
      ot.moduloModelo || '', ot.moduloSerie || '', ot.tipoServicio || '',
      (ot.problemaFallaInicial || '').replace(/[\n\r,]/g, ' '), resolveEstado(ot),
      ot.ingenieroAsignadoNombre || '', ot.createdAt || '', ot.fechaInicio || ot.fechaServicioAprox || '',
      ot.horasTrabajadas || '', ot.tiempoViaje || '',
      ot.esFacturable ? 'Sí' : 'No', ot.tieneContrato ? 'Sí' : 'No', ot.esGarantia ? 'Sí' : 'No',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });
  const csv = [headers.join(','), ...csvRows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ordenes_trabajo_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const resolveEstado = (ot: WorkOrder): string => {
  if (ot.estadoAdmin) return ot.estadoAdmin;
  return ot.status === 'FINALIZADO' ? 'FINALIZADO' : 'CREADA';
};

const StatusBadge = ({ ot }: { ot: WorkOrder }) => {
  const estado = resolveEstado(ot);
  const label = OT_ESTADO_LABELS[estado as OTEstadoAdmin] ?? estado;
  const color = ESTADO_COLORS[estado] ?? 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${color}`}>
      {label}
    </span>
  );
};

const thClass = 'px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';

/** Abre el reporte en reportes-ot (Electron o browser) */
const openReport = (otNum: string) => {
  const url = `http://localhost:3000?reportId=${otNum}`;
  if ((window as any).electronAPI?.openWindow) (window as any).electronAPI.openWindow(url);
  else if ((window as any).electronAPI?.openExternal) (window as any).electronAPI.openExternal(url);
  else window.open(url, '_blank');
};

// ---------- New Item Modal ----------
interface NewItemModalProps {
  open: boolean;
  parentOt: WorkOrder | null;
  onClose: () => void;
  onCreated: () => void;
}

const lbl = 'block text-[11px] font-medium text-slate-500 mb-0.5';

const NewItemModal: React.FC<NewItemModalProps> = ({ open, parentOt, onClose, onCreated }) => {
  const [saving, setSaving] = useState(false);
  const [tiposServicio, setTiposServicio] = useState<TipoServicio[]>([]);
  const [form, setForm] = useState({ tipoServicio: '', descripcion: '' });

  useEffect(() => {
    if (open) tiposServicioService.getAll().then(setTiposServicio);
  }, [open]);

  const handleCreate = async () => {
    if (!parentOt) return;
    const parentBase = parentOt.otNumber.includes('.') ? parentOt.otNumber.split('.')[0] : parentOt.otNumber;
    if (!form.tipoServicio.trim()) { alert('Seleccione tipo de servicio'); return; }
    setSaving(true);
    try {
      const nextNum = await ordenesTrabajoService.getNextItemNumber(parentBase);
      const itemData: any = {
        otNumber: nextNum,
        status: 'BORRADOR' as const,
        estadoAdmin: parentOt.estadoAdmin || 'CREADA',
        estadoAdminFecha: new Date().toISOString(),
        estadoHistorial: [{ estado: 'CREADA' as const, fecha: new Date().toISOString() }],
        budgets: parentOt.budgets || [],
        ordenCompra: parentOt.ordenCompra || '',
        tipoServicio: form.tipoServicio,
        esFacturable: parentOt.esFacturable ?? true,
        tieneContrato: parentOt.tieneContrato ?? false,
        esGarantia: false,
        razonSocial: parentOt.razonSocial,
        contacto: parentOt.contacto || '',
        direccion: parentOt.direccion || '',
        localidad: parentOt.localidad || '',
        provincia: parentOt.provincia || '',
        sistema: parentOt.sistema || '',
        moduloModelo: parentOt.moduloModelo || '',
        moduloDescripcion: parentOt.moduloDescripcion || '',
        moduloSerie: parentOt.moduloSerie || '',
        codigoInternoCliente: parentOt.codigoInternoCliente || '',
        fechaInicio: new Date().toISOString().split('T')[0],
        fechaFin: new Date().toISOString().split('T')[0],
        fechaServicioAprox: parentOt.fechaServicioAprox || '',
        horasTrabajadas: '',
        tiempoViaje: '',
        reporteTecnico: form.descripcion || '',
        accionesTomar: '',
        articulos: [],
        emailPrincipal: parentOt.emailPrincipal || '',
        signatureEngineer: null,
        aclaracionEspecialista: '',
        signatureClient: null,
        aclaracionCliente: '',
        materialesParaServicio: '',
        problemaFallaInicial: parentOt.problemaFallaInicial || '',
        updatedAt: new Date().toISOString(),
        clienteId: parentOt.clienteId || null,
        sistemaId: parentOt.sistemaId || null,
        moduloId: parentOt.moduloId || null,
        ingenieroAsignadoId: parentOt.ingenieroAsignadoId || null,
        ingenieroAsignadoNombre: parentOt.ingenieroAsignadoNombre || null,
      };
      await ordenesTrabajoService.create(itemData);
      setForm({ tipoServicio: '', descripcion: '' });
      onClose();
      onCreated();
    } catch { alert('Error al crear el item'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Nuevo item para OT-${parentOt?.otNumber || ''}`}
      subtitle="Crear sub-orden de trabajo"
      footer={<>
        <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
        <Button size="sm" onClick={handleCreate} disabled={saving}>
          {saving ? 'Creando...' : 'Crear Item'}
        </Button>
      </>}>
      <div className="space-y-3">
        <div>
          <label className={lbl}>Tipo de servicio *</label>
          <SearchableSelect value={form.tipoServicio}
            onChange={v => setForm(f => ({ ...f, tipoServicio: v }))}
            options={tiposServicio.map(t => ({ value: t.nombre, label: t.nombre }))}
            placeholder="Seleccionar..." />
        </div>
        <div>
          <label className={lbl}>Descripción del trabajo</label>
          <textarea value={form.descripcion}
            onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
            rows={3} placeholder="Describa brevemente..."
            className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs resize-none focus:ring-1 focus:ring-teal-400" />
        </div>
      </div>
    </Modal>
  );
};

// ---------- Main OTList ----------
export const OTList = () => {
  const [searchParams] = useSearchParams();
  const clienteIdFilter = searchParams.get('cliente');
  const sistemaIdFilter = searchParams.get('sistema');

  const { tableRef, colWidths, onResizeStart } = useResizableColumns();
  const [ordenes, setOrdenes] = useState<WorkOrder[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [tiposServicioList, setTiposServicioList] = useState<TipoServicio[]>([]);
  const [ingenierosList, setIngenierosList] = useState<UsuarioAGS[]>([]);
  const [loading, setLoading] = useState(true);

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
    if (!window.confirm(`¿Eliminar ${selectedOTs.size} OTs seleccionadas?`)) return;
    try {
      for (const otNum of selectedOTs) await ordenesTrabajoService.delete(otNum);
      setSelectedOTs(new Set());
      await loadOrdenes();
    } catch { alert('Error al eliminar'); }
  };
  const handleBulkEstado = async (nuevoEstado: OTEstadoAdmin) => {
    if (selectedOTs.size === 0) return;
    if (!window.confirm(`¿Cambiar ${selectedOTs.size} OTs a ${OT_ESTADO_LABELS[nuevoEstado]}?`)) return;
    try {
      const ahora = new Date().toISOString();
      for (const otNum of selectedOTs) {
        const ot = ordenes.find(o => o.otNumber === otNum);
        await ordenesTrabajoService.update(otNum, {
          estadoAdmin: nuevoEstado, estadoAdminFecha: ahora,
          estadoHistorial: [...(ot?.estadoHistorial || []), { estado: nuevoEstado, fecha: ahora, nota: 'Cambio masivo' }],
          ...(nuevoEstado === 'FINALIZADO' ? { status: 'FINALIZADO' } : {}),
        });
      }
      setSelectedOTs(new Set());
      await loadOrdenes();
    } catch { alert('Error al cambiar estados'); }
  };

  const [filters, setFilters] = useState({
    clienteId: clienteIdFilter || '',
    sistemaId: sistemaIdFilter || '',
    estadoAdmin: '__pendientes__' as string,
    busquedaOT: '',
    busquedaModulo: '',
    busquedaEquipo: '',
    tipoServicio: '',
    ingenieroId: '',
    fechaDesde: '',
    fechaHasta: '',
    soloFacturable: false,
    soloContrato: false,
    soloGarantia: false,
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [sortField, setSortField] = useState('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (f: string) => {
    const s = toggleSort(f, sortField, sortDir);
    setSortField(s.field);
    setSortDir(s.dir);
  };

  // Agrupar: padres y sus items. Orphaned items (sin padre en lista) se muestran standalone.
  const grouped = useMemo(() => {
    let list = ordenes;
    if (filters.estadoAdmin === '__pendientes__') {
      list = list.filter(ot => resolveEstado(ot) !== 'FINALIZADO');
    } else if (filters.estadoAdmin) {
      list = list.filter(ot => resolveEstado(ot) === filters.estadoAdmin);
    }
    if (filters.busquedaOT.trim()) {
      const q = filters.busquedaOT.trim().toLowerCase();
      list = list.filter(ot => ot.otNumber.toLowerCase().includes(q));
    }
    if (filters.busquedaModulo.trim()) {
      const q = filters.busquedaModulo.trim().toLowerCase();
      list = list.filter(ot =>
        (ot.moduloModelo || '').toLowerCase().includes(q) ||
        (ot.moduloDescripcion || '').toLowerCase().includes(q) ||
        (ot.moduloSerie || '').toLowerCase().includes(q)
      );
    }
    if (filters.busquedaEquipo.trim()) {
      const q = filters.busquedaEquipo.trim().toLowerCase();
      list = list.filter(ot =>
        (ot.codigoInternoCliente || '').toLowerCase().includes(q)
      );
    }
    if (filters.tipoServicio) {
      list = list.filter(ot => ot.tipoServicio === filters.tipoServicio);
    }
    if (filters.ingenieroId) {
      list = list.filter(ot => ot.ingenieroAsignadoId === filters.ingenieroId);
    }
    if (filters.fechaDesde) {
      list = list.filter(ot => (ot.createdAt || '') >= filters.fechaDesde);
    }
    if (filters.fechaHasta) {
      const hasta = filters.fechaHasta + 'T23:59:59';
      list = list.filter(ot => (ot.createdAt || '') <= hasta);
    }
    if (filters.soloFacturable) list = list.filter(ot => ot.esFacturable);
    if (filters.soloContrato) list = list.filter(ot => ot.tieneContrato);
    if (filters.soloGarantia) list = list.filter(ot => ot.esGarantia);

    const parents: WorkOrder[] = [];
    const itemsByParent: Record<string, WorkOrder[]> = {};
    const parentNumbers = new Set<string>();

    // First pass: identify all parents
    list.forEach(ot => {
      if (!ot.otNumber.includes('.')) {
        parents.push(ot);
        parentNumbers.add(ot.otNumber);
      }
    });

    // Second pass: group items; orphaned items become standalone rows
    const orphans: WorkOrder[] = [];
    list.forEach(ot => {
      if (ot.otNumber.includes('.')) {
        const parentNum = ot.otNumber.split('.')[0];
        if (parentNumbers.has(parentNum)) {
          if (!itemsByParent[parentNum]) itemsByParent[parentNum] = [];
          itemsByParent[parentNum].push(ot);
        } else {
          orphans.push(ot);
        }
      }
    });

    const sortedParents = sortByField(parents, sortField, sortDir);
    const sortedOrphans = sortByField(orphans, sortField, sortDir);

    const result: { ot: WorkOrder; isItem: boolean; hasItems: boolean }[] = [];

    // Parents with their items
    sortedParents.forEach(parent => {
      const items = itemsByParent[parent.otNumber];
      const hasItems = !!(items && items.length > 0);
      result.push({ ot: parent, isItem: false, hasItems });
      if (items) {
        items.sort((a, b) => {
          const ia = parseInt(a.otNumber.split('.')[1]);
          const ib = parseInt(b.otNumber.split('.')[1]);
          return ia - ib;
        });
        items.forEach(item => result.push({ ot: item, isItem: true, hasItems: false }));
      }
    });

    // Orphaned items (legacy OTs que son items sin padre)
    sortedOrphans.forEach(ot => result.push({ ot, isItem: false, hasItems: false }));

    return result;
  }, [ordenes, filters, sortField, sortDir]);

  useEffect(() => { loadData(); }, []);
  useEffect(() => { loadOrdenes(); }, [filters.clienteId, filters.sistemaId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [clientesData, sistemasData, tiposData, usersData] = await Promise.all([
        clientesService.getAll(true),
        sistemasService.getAll(),
        tiposServicioService.getAll(),
        usuariosService.getAll(),
      ]);
      setClientes(clientesData);
      setSistemas(sistemasData);
      setTiposServicioList(tiposData);
      setIngenierosList(usersData.filter(u => u.role === 'ingeniero_soporte' && u.status === 'activo'));
      await loadOrdenes();
    } catch {
      alert('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const loadOrdenes = async () => {
    try {
      setLoading(true);
      const filtersToApply: any = {};
      if (filters.clienteId) filtersToApply.clienteId = filters.clienteId;
      if (filters.sistemaId) filtersToApply.sistemaId = filters.sistemaId;
      const data = await ordenesTrabajoService.getAll(
        Object.keys(filtersToApply).length > 0 ? filtersToApply : undefined
      );
      setOrdenes(data);
    } catch {
      console.error('Error cargando órdenes');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (ot: WorkOrder) => {
    if (!window.confirm(`¿Eliminar OT-${ot.otNumber}?`)) return;
    try {
      await ordenesTrabajoService.delete(ot.otNumber);
      await loadOrdenes();
    } catch { alert('Error al eliminar'); }
  };

  /** Click en fila: items y padres sin items → editar; padres con items → no-op (usar botones) */
  const handleRowClick = (ot: WorkOrder, hasItems: boolean) => {
    const isParent = !ot.otNumber.includes('.');
    if (isParent && hasItems) return; // padre con items: no editar directamente
    setEditOtNumber(ot.otNumber);
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '—';
    try { return new Date(dateString).toLocaleDateString('es-AR'); } catch { return dateString; }
  };

  const estadoOptions = [
    { value: '__pendientes__', label: 'Pendientes' },
    { value: '', label: 'Todos' },
    ...OT_ESTADO_ORDER.map(e => ({ value: e, label: OT_ESTADO_LABELS[e] })),
  ];

  // KPI stats from all ordenes (not filtered)
  const kpis = useMemo(() => {
    const byEstado: Record<string, number> = {};
    let totalHsLab = 0, totalHsViaje = 0, facturables = 0;
    ordenes.forEach(ot => {
      const est = resolveEstado(ot);
      byEstado[est] = (byEstado[est] || 0) + 1;
      totalHsLab += Number(ot.horasTrabajadas) || 0;
      totalHsViaje += Number(ot.tiempoViaje) || 0;
      if (ot.esFacturable) facturables++;
    });
    const pendientes = ordenes.filter(ot => resolveEstado(ot) !== 'FINALIZADO').length;
    return { byEstado, totalHsLab, totalHsViaje, pendientes, facturables, total: ordenes.length };
  }, [ordenes]);

  if (loading && ordenes.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-400">Cargando órdenes de trabajo...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Órdenes de Trabajo"
        subtitle="Gestión de órdenes de servicio"
        count={grouped.length}
        actions={
          <div className="flex gap-2 items-center">
            <Button size="sm" variant="outline" onClick={() => exportToCSV(grouped, sistemas)}
              disabled={grouped.length === 0} title="Exportar datos filtrados a CSV">
              Exportar CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowTiposServicio(true)}>Tipos de Servicio</Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>+ Nueva OT</Button>
          </div>
        }
      >
        <div className="flex items-center gap-2 flex-wrap">
          <div className="min-w-[120px]">
            <SearchableSelect size="sm"
              value={filters.clienteId}
              onChange={(value) => setFilters({ ...filters, clienteId: value })}
              options={[{ value: '', label: 'Todos' }, ...clientes.map(c => ({ value: c.id, label: c.razonSocial }))]}
              placeholder="Cliente"
            />
          </div>
          <div className="min-w-[120px]">
            <SearchableSelect size="sm"
              value={filters.sistemaId}
              onChange={(value) => setFilters({ ...filters, sistemaId: value })}
              options={[{ value: '', label: 'Todos' }, ...sistemas.map(s => ({ value: s.id, label: s.nombre }))]}
              placeholder="Sistema"
            />
          </div>
          <div className="min-w-[110px]">
            <SearchableSelect size="sm"
              value={filters.estadoAdmin}
              onChange={(value) => setFilters({ ...filters, estadoAdmin: value })}
              options={estadoOptions}
              placeholder="Estado"
            />
          </div>
          <input
            type="text"
            value={filters.busquedaOT}
            onChange={e => setFilters({ ...filters, busquedaOT: e.target.value })}
            placeholder="Buscar OT #"
            className="w-28 border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-teal-400 focus:border-teal-400 outline-none"
          />
          <input
            type="text"
            value={filters.busquedaEquipo}
            onChange={e => setFilters({ ...filters, busquedaEquipo: e.target.value })}
            placeholder="Id Equipo"
            className="w-28 border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-teal-400 focus:border-teal-400 outline-none"
          />
          <input
            type="text"
            value={filters.busquedaModulo}
            onChange={e => setFilters({ ...filters, busquedaModulo: e.target.value })}
            placeholder="Módulo / N° serie"
            className="w-36 border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-teal-400 focus:border-teal-400 outline-none"
          />
          <Button size="sm" variant="ghost" onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}>
            {showAdvancedFilters ? 'Menos filtros' : 'Más filtros'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setFilters({
            clienteId: '', sistemaId: '', estadoAdmin: '__pendientes__', busquedaOT: '', busquedaModulo: '', busquedaEquipo: '',
            tipoServicio: '', ingenieroId: '', fechaDesde: '', fechaHasta: '',
            soloFacturable: false, soloContrato: false, soloGarantia: false,
          })}>
            Limpiar
          </Button>
        </div>
        {showAdvancedFilters && (
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <div className="min-w-[110px]">
              <SearchableSelect size="sm" value={filters.tipoServicio}
                onChange={v => setFilters({ ...filters, tipoServicio: v })}
                options={[{ value: '', label: 'Tipo servicio' }, ...tiposServicioList.map(t => ({ value: t.nombre, label: t.nombre }))]}
                placeholder="Tipo servicio" />
            </div>
            <div className="min-w-[120px]">
              <SearchableSelect size="sm" value={filters.ingenieroId}
                onChange={v => setFilters({ ...filters, ingenieroId: v })}
                options={[{ value: '', label: 'Ingeniero' }, ...ingenierosList.map(u => ({ value: u.id, label: u.displayName }))]}
                placeholder="Ingeniero" />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-400">Desde</span>
              <input type="date" value={filters.fechaDesde}
                onChange={e => setFilters({ ...filters, fechaDesde: e.target.value })}
                className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-teal-400 outline-none" />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-400">Hasta</span>
              <input type="date" value={filters.fechaHasta}
                onChange={e => setFilters({ ...filters, fechaHasta: e.target.value })}
                className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-teal-400 outline-none" />
            </div>
            <label className="flex items-center gap-1 text-xs text-slate-600 cursor-pointer">
              <input type="checkbox" checked={filters.soloFacturable}
                onChange={e => setFilters({ ...filters, soloFacturable: e.target.checked })}
                className="rounded border-slate-300" /> Facturable
            </label>
            <label className="flex items-center gap-1 text-xs text-slate-600 cursor-pointer">
              <input type="checkbox" checked={filters.soloContrato}
                onChange={e => setFilters({ ...filters, soloContrato: e.target.checked })}
                className="rounded border-slate-300" /> Contrato
            </label>
            <label className="flex items-center gap-1 text-xs text-slate-600 cursor-pointer">
              <input type="checkbox" checked={filters.soloGarantia}
                onChange={e => setFilters({ ...filters, soloGarantia: e.target.checked })}
                className="rounded border-slate-300" /> Garantía
            </label>
          </div>
        )}
      </PageHeader>

      {/* KPI summary */}
      {ordenes.length > 0 && (
        <div className="px-5 pb-2 flex gap-3 flex-wrap">
          {[
            { label: 'Total', value: kpis.total, color: 'text-slate-700' },
            { label: 'Pendientes', value: kpis.pendientes, color: 'text-amber-600' },
            { label: 'En curso', value: kpis.byEstado['EN_CURSO'] || 0, color: 'text-blue-600' },
            { label: 'Cierre admin', value: kpis.byEstado['CIERRE_ADMINISTRATIVO'] || 0, color: 'text-cyan-600' },
            { label: 'Finalizadas', value: kpis.byEstado['FINALIZADO'] || 0, color: 'text-emerald-600' },
            { label: 'Hs Lab', value: kpis.totalHsLab.toFixed(0) + 'h', color: 'text-slate-600' },
            { label: 'Hs Viaje', value: kpis.totalHsViaje.toFixed(0) + 'h', color: 'text-slate-600' },
            { label: 'Facturables', value: kpis.facturables, color: 'text-teal-600' },
          ].map(kpi => (
            <div key={kpi.label} className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 min-w-[80px]">
              <p className="text-[10px] text-slate-400 font-medium">{kpi.label}</p>
              <p className={`text-sm font-semibold ${kpi.color}`}>{kpi.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Bulk actions bar */}
      {selectedOTs.size > 0 && (
        <div className="px-5 pb-2 flex items-center gap-3">
          <span className="text-xs text-slate-500 font-medium">{selectedOTs.size} seleccionadas</span>
          <select
            defaultValue=""
            onChange={e => { if (e.target.value) handleBulkEstado(e.target.value as OTEstadoAdmin); e.target.value = ''; }}
            className="border border-slate-300 rounded-lg px-2 py-1 text-xs"
          >
            <option value="" disabled>Cambiar estado a...</option>
            {OT_ESTADO_ORDER.map(e => <option key={e} value={e}>{OT_ESTADO_LABELS[e]}</option>)}
          </select>
          <Button size="sm" variant="outline" onClick={handleBulkDelete} className="text-red-600 border-red-300 hover:bg-red-50">
            Eliminar seleccionadas
          </Button>
          <button onClick={() => setSelectedOTs(new Set())} className="text-xs text-slate-400 hover:underline">Deseleccionar</button>
        </div>
      )}

      <div className="flex-1 min-h-0 px-5 pb-4">
        {grouped.length === 0 ? (
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
                      currentField={sortField} currentDir={sortDir} onSort={handleSort}
                      className={`${thClass} relative`}>
                      <div onMouseDown={e => onResizeStart(i, e)}
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                    </SortableHeader>
                  ))}
                  <th className={`${thClass} relative`}>
                    Descripción
                    <div onMouseDown={e => onResizeStart(6, e)}
                      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </th>
                  {[
                    { label: 'Creada', field: 'createdAt', idx: 7 },
                    { label: 'F. Serv.', field: 'fechaInicio', idx: 8 },
                    { label: 'Estado', field: 'estadoAdmin', idx: 9 },
                  ].map(col => (
                    <SortableHeader key={col.field} label={col.label} field={col.field}
                      currentField={sortField} currentDir={sortDir} onSort={handleSort}
                      className={`${thClass} relative`}>
                      <div onMouseDown={e => onResizeStart(col.idx, e)}
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                    </SortableHeader>
                  ))}
                  <th className={`${thClass} text-right`}>Acciones</th>
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
                      <td className="px-2 py-2 whitespace-nowrap">
                        {isItem ? (
                          <span className="text-xs text-teal-500 pl-2">
                            <span className="text-slate-300 mr-1">└</span>{ot.otNumber}
                          </span>
                        ) : (
                          <span className="font-semibold text-teal-600 text-xs">{ot.otNumber}</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-xs text-slate-700 truncate" title={ot.razonSocial}>
                        {isItem ? '' : ot.razonSocial}
                      </td>
                      <td className="px-2 py-2 text-xs text-slate-600 truncate" title={sistema?.nombre || ot.sistema}>
                        {isItem ? '' : (sistema?.nombre || ot.sistema || '—')}
                      </td>
                      <td className="px-2 py-2 text-xs text-slate-600 font-mono truncate" title={ot.codigoInternoCliente || ''}>
                        {isItem ? '' : (ot.codigoInternoCliente || '—')}
                      </td>
                      <td className="px-2 py-2 text-xs text-slate-600 truncate" title={[ot.moduloModelo, ot.moduloSerie].filter(Boolean).join(' — ')}>
                        {ot.moduloModelo || '—'}
                        {ot.moduloSerie && <span className="text-slate-400 ml-1">({ot.moduloSerie})</span>}
                      </td>
                      <td className="px-2 py-2 text-xs text-slate-600 truncate" title={ot.tipoServicio}>{ot.tipoServicio}</td>
                      <td className="px-2 py-2 text-xs text-slate-500 truncate" title={ot.problemaFallaInicial || ''}>
                        {ot.problemaFallaInicial || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-2 py-2 text-xs text-slate-500 whitespace-nowrap">{formatDate(ot.createdAt)}</td>
                      <td className="px-2 py-2 text-xs text-slate-500 whitespace-nowrap">{formatDate(ot.fechaInicio || ot.fechaServicioAprox)}</td>
                      <td className="px-2 py-2 whitespace-nowrap"><StatusBadge ot={ot} /></td>
                      <td className="px-2 py-2 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
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

      {/* Modals */}
      <CreateOTModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={loadData} />
      {editOtNumber && (
        <EditOTModal
          open={!!editOtNumber}
          otNumber={editOtNumber}
          onClose={() => setEditOtNumber(null)}
          onSaved={loadOrdenes}
        />
      )}
      <NewItemModal
        open={!!newItemParent}
        parentOt={newItemParent}
        onClose={() => setNewItemParent(null)}
        onCreated={loadOrdenes}
      />
      <TiposServicioModal open={showTiposServicio} onClose={() => setShowTiposServicio(false)} />
    </div>
  );
};
