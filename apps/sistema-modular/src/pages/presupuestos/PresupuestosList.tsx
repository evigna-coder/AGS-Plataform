import { useState, useEffect, useMemo, useRef } from 'react';
import { presupuestosService, clientesService, usuariosService } from '../../services/firebaseService';
import { useDebounce } from '../../hooks/useDebounce';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import type { Presupuesto, Cliente, MonedaPresupuesto, UsuarioAGS } from '@ags/shared';
import { ESTADO_PRESUPUESTO_LABELS, ESTADO_PRESUPUESTO_COLORS, TIPO_PRESUPUESTO_LABELS, TIPO_PRESUPUESTO_COLORS, MONEDA_SIMBOLO } from '@ags/shared';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { PageHeader } from '../../components/ui/PageHeader';
import { CreatePresupuestoModal } from '../../components/presupuestos/CreatePresupuestoModal';
import { CreateRevisionModal } from '../../components/presupuestos/CreateRevisionModal';
import { ConceptosServicioModal } from '../../components/presupuestos/ConceptosServicioModal';
import { CategoriasPresupuestoModal } from '../../components/presupuestos/CategoriasPresupuestoModal';
import { CondicionesPagoModal } from '../../components/presupuestos/CondicionesPagoModal';
import { useFloatingPresupuesto } from '../../contexts/FloatingPresupuestoContext';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { getDaysUntilExpiry, getDaysUntilContacto, getExpiryStatusColor, getExpiryStatusText, getContactoStatusColor, getContactoStatusText, isExpired, needsFollowUp, isAnulado } from '../../utils/presupuestoHelpers';

const thClass = 'px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';
const ACTIVE_PIPELINE_STATES = ['enviado', 'en_seguimiento', 'pendiente_oc', 'aceptado'];

export const PresupuestosList = () => {
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioAGS[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [revisionTarget, setRevisionTarget] = useState<Presupuesto | null>(null);
  const [showConceptos, setShowConceptos] = useState(false);
  const [showCategorias, setShowCategorias] = useState(false);
  const [showCondiciones, setShowCondiciones] = useState(false);
  const floatingPres = useFloatingPresupuesto();

  const FILTER_SCHEMA = useMemo(() => ({
    search:      { type: 'string' as const, default: '' },
    cliente:     { type: 'string' as const, default: '' },
    estado:      { type: 'string' as const, default: '' },
    tipo:        { type: 'string' as const, default: '' },
    responsable: { type: 'string' as const, default: '' },
    fechaDesde:  { type: 'string' as const, default: '' },
    fechaHasta:  { type: 'string' as const, default: '' },
    sortField:   { type: 'string' as const, default: 'createdAt' },
    sortDir:     { type: 'string' as const, default: 'desc' },
  }), []);
  const [filters, setFilter, , resetFilters] = useUrlFilters(FILTER_SCHEMA);
  const debouncedSearch = useDebounce(filters.search, 300);

  const handleSort = (f: string) => {
    const s = toggleSort(f, filters.sortField, filters.sortDir as SortDir);
    setFilter('sortField', s.field); setFilter('sortDir', s.dir);
  };

  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Load reference data
    Promise.all([
      clientesService.getAll(true),
      usuariosService.getAll(),
    ]).then(([clientesData, usrs]) => {
      setClientes(clientesData);
      setUsuarios(usrs);
    }).catch(err => console.error('Error cargando datos de referencia:', err));

    // Real-time subscription for presupuestos
    setLoading(true);
    unsubRef.current = presupuestosService.subscribe(
      undefined,
      (data) => { setPresupuestos(data); setLoading(false); },
      (err) => { console.error('Error presupuestos:', err); setLoading(false); },
    );
    return () => { unsubRef.current?.(); };
  }, []);

  // No-op: onSnapshot handles real-time updates. Kept for callback compatibility.
  const loadData = () => {};

  const presupuestosFiltrados = useMemo(() => {
    let result = presupuestos.filter(p => {
      if (filters.cliente && p.clienteId !== filters.cliente) return false;
      if (filters.estado && p.estado !== filters.estado) return false;
      if (filters.tipo && p.tipo !== filters.tipo) return false;
      if (filters.responsable && p.responsableId !== filters.responsable) return false;
      if (filters.fechaDesde && p.createdAt < filters.fechaDesde) return false;
      if (filters.fechaHasta && p.createdAt > filters.fechaHasta + 'T23:59:59') return false;
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
  }, [presupuestos, filters, debouncedSearch]);

  const pipelineByMoneda = useMemo(() => {
    const map: Record<string, number> = {};
    presupuestosFiltrados.forEach(p => {
      if (ACTIVE_PIPELINE_STATES.includes(p.estado)) {
        const m = p.moneda || 'USD';
        map[m] = (map[m] || 0) + p.total;
      }
    });
    return map;
  }, [presupuestosFiltrados]);

  const pipelineText = useMemo(() => {
    const parts = Object.entries(pipelineByMoneda)
      .filter(([, v]) => v > 0)
      .map(([m, v]) => `${MONEDA_SIMBOLO[m as MonedaPresupuesto] || '$'} ${v.toLocaleString('es-AR', { minimumFractionDigits: 0 })}`);
    return parts.length > 0 ? `Pipeline: ${parts.join(' · ')}` : undefined;
  }, [pipelineByMoneda]);

  const getClienteNombre = (clienteId: string) => {
    return clientes.find(c => c.id === clienteId)?.razonSocial || '—';
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '—';
    try { return new Date(dateString).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }); } catch { return dateString; }
  };

  const getRowStyle = (p: Presupuesto) => {
    if (isAnulado(p)) return 'opacity-50';
    if (p.estado === 'rechazado' || p.estado === 'vencido') return 'opacity-60';
    if (isExpired(p) && ACTIVE_PIPELINE_STATES.includes(p.estado)) return 'border-l-2 border-red-300 bg-red-50/50';
    if (needsFollowUp(p)) return 'border-l-2 border-amber-300 bg-amber-50/30';
    return '';
  };

  const handleRevisionCreated = (newId: string) => {
    setRevisionTarget(null);
    loadData();
    floatingPres.open(newId, loadData);
  };

  const hasFilters = filters.cliente || filters.estado || filters.tipo || filters.responsable || filters.fechaDesde || filters.fechaHasta;

  if (loading && presupuestos.length === 0) {
    return <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando presupuestos...</p></div>;
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader title="Presupuestos" count={presupuestosFiltrados.length} subtitle={pipelineText}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowConceptos(true)}>Conceptos</Button>
            <Button size="sm" variant="outline" onClick={() => setShowCategorias(true)}>Categorías</Button>
            <Button size="sm" variant="outline" onClick={() => setShowCondiciones(true)}>Condiciones</Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>+ Nuevo Presupuesto</Button>
          </div>
        }>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="text" placeholder="Buscar por número, cliente..." value={filters.search} onChange={e => setFilter('search', e.target.value)}
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
          {hasFilters && (
            <Button size="sm" variant="ghost" onClick={() => resetFilters()}>Limpiar</Button>
          )}
        </div>
      </PageHeader>

      <div className="flex-1 min-h-0 px-5 pb-4">
        {presupuestosFiltrados.length === 0 ? (
          <Card><div className="text-center py-12">
            <p className="text-slate-400">No hay presupuestos para mostrar</p>
            <button onClick={() => setShowCreate(true)} className="text-teal-600 hover:underline mt-2 inline-block text-xs">Crear primer presupuesto</button>
          </div></Card>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto h-full">
            <table className="w-full">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <SortableHeader label="Número" field="numero" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={thClass} />
                  <SortableHeader label="Cliente" field="clienteId" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={thClass} />
                  <SortableHeader label="Tipo" field="tipo" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={thClass} />
                  <SortableHeader label="Estado" field="estado" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={thClass} />
                  <SortableHeader label="Total" field="total" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`${thClass} text-right`} />
                  <SortableHeader label="Responsable" field="responsableNombre" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={thClass} />
                  <SortableHeader label="Creado" field="createdAt" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={thClass} />
                  <SortableHeader label="Enviado" field="fechaEnvio" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={thClass} />
                  <SortableHeader label="Validez" field="_validez" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={thClass} />
                  <SortableHeader label="Seguimiento" field="_seguimiento" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={thClass} />
                  <th className={`${thClass} text-center`}>Acciones</th>
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
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="font-semibold text-teal-600 text-xs">{p.numero}</span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-700 truncate max-w-[140px]" title={getClienteNombre(p.clienteId)}>
                        {getClienteNombre(p.clienteId)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TIPO_PRESUPUESTO_COLORS[p.tipo || 'servicio']}`}>
                          {TIPO_PRESUPUESTO_LABELS[p.tipo || 'servicio']}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_PRESUPUESTO_COLORS[p.estado]}`}
                          title={isAnulado(p) && p.motivoAnulacion ? `Motivo: ${p.motivoAnulacion}` : undefined}>
                          {ESTADO_PRESUPUESTO_LABELS[p.estado]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-900 font-medium text-center tabular-nums whitespace-nowrap">
                        {sym} {p.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500 truncate max-w-[90px] whitespace-nowrap" title={p.responsableNombre || ''}>
                        {p.responsableNombre || '—'}
                      </td>
                      <td className="px-3 py-2 text-[10px] text-slate-500 whitespace-nowrap">{formatDate(p.createdAt)}</td>
                      <td className="px-3 py-2 text-[10px] text-slate-500 whitespace-nowrap">{formatDate(p.fechaEnvio)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {daysExpiry !== null ? (
                          <span className={`text-[10px] font-medium ${getExpiryStatusColor(daysExpiry)}`}>
                            {getExpiryStatusText(daysExpiry)}
                          </span>
                        ) : <span className="text-[10px] text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {daysContact !== null ? (
                          <span className={`text-[10px] font-medium ${getContactoStatusColor(daysContact)}`}>
                            {getContactoStatusText(daysContact)}
                          </span>
                        ) : <span className="text-[10px] text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-0.5">
                          {!isAnulado(p) && (
                            <button onClick={() => setRevisionTarget(p)} title="Crear revisión"
                              className="text-[10px] font-medium text-slate-400 hover:text-slate-600 px-1 py-0.5 rounded hover:bg-slate-100">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
                              </svg>
                            </button>
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

      <CreatePresupuestoModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={loadData} />
      <CreateRevisionModal open={!!revisionTarget} presupuesto={revisionTarget} onClose={() => setRevisionTarget(null)} onCreated={handleRevisionCreated} />
      <ConceptosServicioModal open={showConceptos} onClose={() => setShowConceptos(false)} />
      <CategoriasPresupuestoModal open={showCategorias} onClose={() => setShowCategorias(false)} />
      <CondicionesPagoModal open={showCondiciones} onClose={() => setShowCondiciones(false)} />
    </div>
  );
};
