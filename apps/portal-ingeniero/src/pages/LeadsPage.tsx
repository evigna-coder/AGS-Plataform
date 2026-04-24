import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Lead } from '@ags/shared';
import {
  getSimplifiedEstadoLabel, getSimplifiedEstadoColor,
  TICKET_AREA_LABELS, TICKET_AREA_COLORS,
  MOTIVO_LLAMADO_LABELS, MOTIVO_LLAMADO_COLORS,
  TICKET_PRIORIDAD_LABELS, TICKET_PRIORIDAD_COLORS,
  canUserModifyLead,
  getUserTicketAreas,
} from '@ags/shared';
import { leadsService, usuariosService } from '../services/firebaseService';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import CrearLeadModal from '../components/leads/CrearLeadModal';
import DerivarLeadModal from '../components/leads/DerivarLeadModal';
import FinalizarLeadModal from '../components/leads/FinalizarLeadModal';
import LeadQuickNoteModal from '../components/leads/LeadQuickNoteModal';
import { LeadFilters, type LeadFiltersState, type EstadoFilterValue } from '../components/leads/LeadFilters';
import { useUrlFilters } from '../hooks/useUrlFilters';
import type { MotivoLlamado, TicketArea, TicketPrioridad } from '@ags/shared';
import { getDaysOpen, getDaysUntilContacto, getDaysSinceLastActivity, formatCurrencyARS, getAgeBadgeColor, getContactoStatusColor, getContactoStatusText } from '../utils/leadHelpers';
import { useResizableColumns, type ColAlign } from '../hooks/useResizableColumns';
import { ColMenu, type ColMenuHandle } from '../components/ui/ColMenu';
import { sortByField, toggleSort, type SortDir } from '../components/ui/SortableHeader';

const thBase = 'px-2 py-1.5 text-center text-[10px] font-medium text-slate-400 tracking-wider whitespace-nowrap relative select-none';

const SortIcon = ({ active, dir }: { active: boolean; dir: SortDir }) =>
  active ? (
    <svg className="w-3 h-3 text-teal-500 inline-block ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d={dir === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
    </svg>
  ) : (
    <svg className="w-3 h-3 text-slate-300 inline-block ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  );

export default function LeadsPage() {
  const navigate = useNavigate();
  const { usuario, hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  // Áreas de tickets que el usuario puede gestionar (además de los propios)
  const extraAreas = useMemo(() => {
    if (!usuario || isAdmin) return null;
    const areas = getUserTicketAreas(usuario);
    return areas.length > 0 ? new Set(areas) : null;
  }, [usuario, isAdmin]);
  // Admin ve todo; roles con áreas asignadas pueden destildar "Mis tickets" para ver su área
  const canSeeAll = isAdmin || !!extraAreas;
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [derivarLead, setDerivarLead] = useState<Lead | null>(null);
  const [finalizarLead, setFinalizarLead] = useState<Lead | null>(null);
  const [quickNoteLead, setQuickNoteLead] = useState<Lead | null>(null);
  const [usuarios, setUsuarios] = useState<{ id: string; displayName: string }[]>([]);

  // Filtros persistidos en URL — sobreviven al volver del detalle con browser back.
  const FILTER_SCHEMA = useMemo(() => ({
    search: { type: 'string' as const, default: '' },
    estadoFilter: { type: 'string' as const, default: '' },
    motivo: { type: 'string' as const, default: '' },
    area: { type: 'string' as const, default: '' },
    prioridad: { type: 'string' as const, default: '' },
    responsable: { type: 'string' as const, default: '' },
    soloMios: { type: 'boolean' as const, default: true },
    misCreados: { type: 'boolean' as const, default: false },
    misDerivados: { type: 'boolean' as const, default: false },
    mostrarFinalizados: { type: 'boolean' as const, default: false },
    fechaDesde: { type: 'string' as const, default: '' },
    fechaHasta: { type: 'string' as const, default: '' },
    sortField: { type: 'string' as const, default: 'createdAt' },
    sortDir: { type: 'string' as const, default: 'desc' },
  }), []);
  const [urlF, setUrlF, setUrlFs] = useUrlFilters(FILTER_SCHEMA);
  const search = urlF.search;
  const setSearch = (v: string) => setUrlF('search', v);
  const estadoFilter = urlF.estadoFilter as EstadoFilterValue;
  const setEstadoFilter = (v: EstadoFilterValue) => setUrlF('estadoFilter', v);
  const sortField = urlF.sortField;
  const sortDir = urlF.sortDir as SortDir;
  const filters: LeadFiltersState = useMemo(() => ({
    motivo: (urlF.motivo || '') as MotivoLlamado | '',
    area: (urlF.area || '') as TicketArea | '',
    prioridad: (urlF.prioridad || '') as TicketPrioridad | '',
    responsable: urlF.responsable,
    soloMios: urlF.soloMios,
    misCreados: urlF.misCreados,
    misDerivados: urlF.misDerivados,
    mostrarFinalizados: urlF.mostrarFinalizados,
    fechaDesde: urlF.fechaDesde,
    fechaHasta: urlF.fechaHasta,
  }), [urlF.motivo, urlF.area, urlF.prioridad, urlF.responsable, urlF.soloMios, urlF.misCreados, urlF.misDerivados, urlF.mostrarFinalizados, urlF.fechaDesde, urlF.fechaHasta]);
  const setFilters = (f: LeadFiltersState) => setUrlFs(f);
  const handleSort = (f: string) => {
    const s = toggleSort(f, sortField, sortDir);
    setUrlFs({ sortField: s.field, sortDir: s.dir });
  };

  const unsubRef = useRef<(() => void) | null>(null);
  const colMenuRefs = useRef(new Map<number, ColMenuHandle>());
  const openColMenuAt = useCallback((i: number, e: React.MouseEvent) => {
    e.preventDefault();
    colMenuRefs.current.get(i)?.openAt(e.clientX, e.clientY);
  }, []);
  const setColMenuRef = useCallback((i: number) => (handle: ColMenuHandle | null) => {
    if (handle) colMenuRefs.current.set(i, handle);
    else colMenuRefs.current.delete(i);
  }, []);

  useEffect(() => {
    usuariosService.getIngenieros().then(setUsuarios);
  }, []);

  // Build Firestore query filters
  // Estado: se filtra client-side porque "en_proceso" agrupa múltiples estados internos.
  const queryFilters = useMemo(() => {
    // Sin acceso ampliado: lock estricto a tickets propios a nivel query
    if (!canSeeAll && usuario) {
      if (filters.misCreados) return { createdBy: usuario.id };
      if (filters.misDerivados) return { derivadoPor: usuario.id };
      return { asignadoA: usuario.id };
    }
    // Admin o con áreas: soloMios → asignadoA; misCreados/misDerivados → fetch all y filtrar client-side
    const responsableFilter = filters.soloMios && usuario
      ? usuario.id
      : (filters.misCreados || filters.misDerivados)
        ? undefined
        : (filters.responsable || undefined);
    return {
      ...(responsableFilter ? { asignadoA: responsableFilter } : {}),
    };
  }, [filters.responsable, filters.soloMios, filters.misCreados, filters.misDerivados, usuario, canSeeAll]);

  // Real-time subscription
  useEffect(() => {
    setLoading(true);
    unsubRef.current?.();
    unsubRef.current = leadsService.subscribe(
      queryFilters,
      (data) => { setLeads(data); setLoading(false); },
      (err) => { console.error('Error leads:', err); setLoading(false); },
    );
    return () => { unsubRef.current?.(); };
  }, [queryFilters]);

  // No-op: onSnapshot handles real-time updates automatically
  const loadLeads = useCallback(async () => {}, []);

  const leadsFiltered = useMemo(() => {
    let result = leads;
    // Visibilidad por rol: no-admin con áreas solo ve sus tickets + tickets de sus áreas
    if (!isAdmin && usuario && extraAreas) {
      result = result.filter(l =>
        l.asignadoA === usuario.id ||
        l.createdBy === usuario.id ||
        l.derivadoPor === usuario.id ||
        (l.areaActual && extraAreas.has(l.areaActual))
      );
    }
    // Filtro Finalizados — EXCLUSIVO:
    //   checkbox ✓  → solo finalizados (finalizado + no_concretado)
    //   checkbox ✗ → solo abiertos (oculta finalizados)
    // Si el tab de estado avanzado pide 'finalizado', también activa el scope de finalizados.
    const soloFinalizados = filters.mostrarFinalizados || estadoFilter === 'finalizado';
    if (soloFinalizados) {
      result = result.filter(l => l.estado === 'finalizado' || l.estado === 'no_concretado');
    } else {
      result = result.filter(l => l.estado !== 'finalizado' && l.estado !== 'no_concretado');
    }
    // Sub-filtro de estado dentro de "abiertos" (solo aplica si NO estamos en scope finalizados)
    if (!soloFinalizados) {
      if (estadoFilter === 'nuevo') {
        result = result.filter(l => l.estado === 'nuevo');
      } else if (estadoFilter === 'en_proceso') {
        result = result.filter(l => l.estado !== 'nuevo' && l.estado !== 'finalizado' && l.estado !== 'no_concretado');
      }
    }
    if (filters.misCreados && usuario) {
      result = result.filter(l => l.createdBy === usuario.id);
    }
    if (filters.misDerivados && usuario) {
      result = result.filter(l => l.derivadoPor === usuario.id);
    }
    if (filters.motivo) result = result.filter(l => l.motivoLlamado === filters.motivo);
    if (filters.area) result = result.filter(l => l.areaActual === filters.area);
    if (filters.prioridad) result = result.filter(l => l.prioridad === filters.prioridad);
    if (filters.fechaDesde) result = result.filter(l => l.createdAt >= filters.fechaDesde);
    if (filters.fechaHasta) result = result.filter(l => l.createdAt <= filters.fechaHasta + 'T23:59:59');
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        (l.numero || '').toLowerCase().includes(q) ||
        l.razonSocial.toLowerCase().includes(q) ||
        l.contacto.toLowerCase().includes(q) ||
        (l.descripcion || '').toLowerCase().includes(q) ||
        (l.motivoContacto || '').toLowerCase().includes(q)
      );
    }
    return sortByField(result, sortField, sortDir);
  }, [leads, usuario, isAdmin, extraAreas, estadoFilter, filters.misCreados, filters.misDerivados, filters.mostrarFinalizados, filters.motivo, filters.area, filters.prioridad, filters.fechaDesde, filters.fechaHasta, search, sortField, sortDir]);

  const {
    tableRef, colWidths, colAligns,
    onResizeStart, onAutoFit, setAlign, getAlignClass,
    hiddenCols, hideCol, showAllCols, isHidden,
  } = useResizableColumns('pi-tickets-list');

  const getColAlign = (i: number): ColAlign => (colAligns?.[i] || 'left');

  const pipelineTotal = useMemo(() =>
    leadsFiltered.reduce((sum, l) => sum + (l.valorEstimado || 0), 0),
    [leadsFiltered]
  );

  const getResponsableNombre = (id: string | null) => {
    if (!id) return '—';
    return usuarios.find(u => u.id === id)?.displayName || '—';
  };

  const formatDate = (d?: string) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }); } catch { return d; }
  };

  const getRowStyle = (lead: Lead) => {
    const isClosed = lead.estado === 'finalizado' || lead.estado === 'no_concretado';
    if (isClosed) return '';
    const daysUntil = getDaysUntilContacto(lead.proximoContacto);
    if (daysUntil !== null && daysUntil < 0) return 'border-l-2 border-red-300 bg-red-50/50';
    const daysSince = getDaysSinceLastActivity(lead.postas);
    if (daysSince !== null && daysSince > 5) return 'border-l-2 border-amber-300 bg-amber-50/30';
    return '';
  };

  if (loading && leads.length === 0) {
    return <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando tickets...</p></div>;
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader title="Tickets" count={leadsFiltered.length}
        subtitle={pipelineTotal > 0 ? `Pipeline: ${formatCurrencyARS(pipelineTotal)}` : undefined}
        actions={<Button size="sm" onClick={() => setShowCreate(true)}>+ Nuevo Ticket</Button>}>
        <LeadFilters search={search} onSearchChange={setSearch} estadoFilter={estadoFilter} onEstadoChange={setEstadoFilter}
          filters={filters} onFiltersChange={setFilters} usuarios={usuarios} canSeeAll={canSeeAll} />
      </PageHeader>

      <div className="flex-1 min-h-0 px-3 md:px-5 pb-4">
        {leadsFiltered.length === 0 ? (
          <Card><div className="text-center py-12">
            <p className="text-slate-400">No se encontraron tickets</p>
            <button onClick={() => setShowCreate(true)} className="text-teal-600 hover:underline mt-2 inline-block text-xs">
              Crear primer ticket
            </button>
          </div></Card>
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="md:hidden space-y-2 overflow-y-auto h-full pb-2">
              {leadsFiltered.map(lead => {
                const isClosed = lead.estado === 'finalizado' || lead.estado === 'no_concretado';
                const canModify = usuario ? canUserModifyLead(lead, usuario) : false;
                const daysOpen = getDaysOpen(lead.createdAt);
                return (
                  <Link key={lead.id} to={`/leads/${lead.id}`}
                    className={`block bg-white rounded-xl border border-slate-200 p-3 active:bg-slate-50 ${getRowStyle(lead)}`}>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="min-w-0 flex-1">
                        {lead.numero && (
                          <span className="block text-[10px] font-mono text-slate-400 leading-tight">{lead.numero}</span>
                        )}
                        <span className="block text-sm font-semibold text-slate-800 truncate">{lead.razonSocial}</span>
                      </div>
                      <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${getSimplifiedEstadoColor(lead.estado)}`}>
                        {getSimplifiedEstadoLabel(lead.estado)}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mb-2">{lead.contacto}</div>
                    {(() => {
                      const lastComment = lead.postas?.slice().reverse().find(p => p.comentario)?.comentario;
                      const text = lastComment || lead.descripcion || lead.motivoContacto;
                      return text ? <p className="text-[11px] text-slate-400 line-clamp-2 mb-2">{text}</p> : null;
                    })()}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${MOTIVO_LLAMADO_COLORS[lead.motivoLlamado]}`}>
                        {MOTIVO_LLAMADO_LABELS[lead.motivoLlamado]}
                      </span>
                      {lead.areaActual && (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TICKET_AREA_COLORS[lead.areaActual]}`}>
                          {TICKET_AREA_LABELS[lead.areaActual]}
                        </span>
                      )}
                      {lead.prioridad && (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TICKET_PRIORIDAD_COLORS[lead.prioridad]}`}>
                          {TICKET_PRIORIDAD_LABELS[lead.prioridad]}
                        </span>
                      )}
                      <span className="ml-auto text-[10px] text-slate-400">
                        {formatDate(lead.createdAt)}
                        {!isClosed && <span className={`font-medium ml-1 ${getAgeBadgeColor(daysOpen)}`}>{daysOpen}d</span>}
                      </span>
                    </div>
                    {lead.asignadoA && (
                      <div className="mt-1.5 text-[10px] text-slate-400">
                        Asignado: <span className="text-slate-600">{getResponsableNombre(lead.asignadoA)}</span>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Desktop: table */}
            {hiddenCols.length > 0 && (
              <div className="hidden md:flex items-center justify-end mb-1.5">
                <button
                  onClick={showAllCols}
                  className="text-[11px] font-medium text-slate-500 hover:text-teal-700 bg-slate-100 hover:bg-teal-50 rounded-full px-2.5 py-0.5 transition-colors"
                  title="Mostrar todas las columnas"
                >
                  {hiddenCols.length} {hiddenCols.length === 1 ? 'columna oculta' : 'columnas ocultas'} · Mostrar todas
                </button>
              </div>
            )}
            <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-auto h-full">
              {(() => {
                const defaultPct = ['11%', '8%', '6%', '5%', '7%', '8%', '8%', '6%', '5%', '22%', '14%'];
                // Skip rendering completo de columnas ocultas (no display:none, que rompe la
                // alineación posicional de <th>/<td> con los <col> del colgroup en table-fixed).
                const tdCls = (i: number, extra = '') => `${extra} ${getAlignClass(i)}`.trim();
                const renderTh = (i: number, sortKey: string, label: string) => {
                  if (isHidden(i)) return null;
                  return (
                    <th className={`${thBase} ${getAlignClass(i)}`}
                      onContextMenu={(e) => openColMenuAt(i, e)}>
                      <ColMenu ref={setColMenuRef(i)} align={getColAlign(i)} onAlign={(a) => setAlign(i, a)} onHide={() => hideCol(i)} />
                      <span className="cursor-pointer hover:text-slate-600" onClick={() => handleSort(sortKey)}>
                        {label}<SortIcon active={sortField === sortKey} dir={sortDir} />
                      </span>
                      <div onMouseDown={e => onResizeStart(i, e)} onDoubleClick={() => onAutoFit(i)}
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                    </th>
                  );
                };
                return (
              <table ref={tableRef} className="w-full table-fixed min-w-[1200px]">
                <colgroup>
                  {(colWidths || defaultPct).map((w, i) => (
                    isHidden(i) ? null : <col key={i} style={{ width: w }} />
                  ))}
                </colgroup>
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {renderTh(0, 'razonSocial', 'Cliente')}
                    {renderTh(1, 'contacto', 'Contacto')}
                    {renderTh(2, 'motivoLlamado', 'Motivo')}
                    {renderTh(3, 'prioridad', 'Prioridad')}
                    {renderTh(4, 'estado', 'Estado')}
                    {renderTh(5, 'areaActual', 'Área')}
                    {renderTh(6, 'asignadoA', 'Asignado')}
                    {renderTh(7, 'createdAt', 'Fecha')}
                    {renderTh(8, 'proximoContacto', 'Seguim.')}
                    {renderTh(9, 'descripcion', 'Observaciones')}
                    <th className={`${thBase} text-center`}>Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leadsFiltered.map(lead => {
                    const isClosed = lead.estado === 'finalizado' || lead.estado === 'no_concretado';
                    const canModify = usuario ? canUserModifyLead(lead, usuario) : false;
                    const daysOpen = getDaysOpen(lead.createdAt);
                    const daysUntil = getDaysUntilContacto(lead.proximoContacto);
                    return (
                      <tr key={lead.id} className={`hover:bg-slate-50 transition-colors cursor-pointer ${getRowStyle(lead)}`}
                        onClick={() => navigate(`/leads/${lead.id}`)}>
                        {!isHidden(0) && (
                          <td className={tdCls(0, 'px-2 py-1.5 overflow-hidden')}>
                            <Link to={`/leads/${lead.id}`} className="block" title={lead.numero ? `${lead.numero} · ${lead.razonSocial}` : lead.razonSocial}>
                              {lead.numero && (
                                <span className="block text-[9px] font-mono text-slate-400 leading-tight truncate">{lead.numero}</span>
                              )}
                              <span className="block text-[11px] font-semibold text-teal-600 hover:text-teal-800 truncate">
                                {lead.razonSocial}
                              </span>
                            </Link>
                          </td>
                        )}
                        {!isHidden(1) && (
                          <td className={tdCls(1, 'px-2 py-1.5 text-[11px] text-slate-600 truncate overflow-hidden')} title={lead.contacto}>
                            {lead.contacto}
                          </td>
                        )}
                        {!isHidden(2) && (
                          <td className={tdCls(2, 'px-3 py-2 whitespace-nowrap overflow-hidden')}>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${MOTIVO_LLAMADO_COLORS[lead.motivoLlamado]}`}>
                              {MOTIVO_LLAMADO_LABELS[lead.motivoLlamado]}
                            </span>
                          </td>
                        )}
                        {!isHidden(3) && (
                          <td className={tdCls(3, 'px-3 py-2 whitespace-nowrap overflow-hidden')}>
                            {lead.prioridad ? (
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TICKET_PRIORIDAD_COLORS[lead.prioridad]}`}>
                                {TICKET_PRIORIDAD_LABELS[lead.prioridad]}
                              </span>
                            ) : <span className="text-[10px] text-slate-300">—</span>}
                          </td>
                        )}
                        {!isHidden(4) && (
                          <td className={tdCls(4, 'px-3 py-2 whitespace-nowrap overflow-hidden')}>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${getSimplifiedEstadoColor(lead.estado)}`}>
                              {getSimplifiedEstadoLabel(lead.estado)}
                            </span>
                          </td>
                        )}
                        {!isHidden(5) && (
                          <td className={tdCls(5, 'px-3 py-2 whitespace-nowrap overflow-hidden')}>
                            {lead.areaActual ? (
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TICKET_AREA_COLORS[lead.areaActual]}`}>
                                {TICKET_AREA_LABELS[lead.areaActual]}
                              </span>
                            ) : <span className="text-[10px] text-slate-300">—</span>}
                          </td>
                        )}
                        {!isHidden(6) && (
                          <td className={tdCls(6, 'px-3 py-2 text-xs text-slate-500 truncate overflow-hidden')} title={getResponsableNombre(lead.asignadoA)}>
                            {getResponsableNombre(lead.asignadoA)}
                          </td>
                        )}
                        {!isHidden(7) && (
                          <td className={tdCls(7, 'px-3 py-2 whitespace-nowrap overflow-hidden')}>
                            <span className="text-[10px] text-slate-400">{formatDate(lead.createdAt)}</span>
                            {!isClosed && <span className={`text-[10px] font-medium ml-1 ${getAgeBadgeColor(daysOpen)}`}>{daysOpen}d</span>}
                          </td>
                        )}
                        {!isHidden(8) && (
                          <td className={tdCls(8, 'px-3 py-2 whitespace-nowrap overflow-hidden')}>
                            {isClosed ? (
                              <span className="text-[10px] text-slate-300">—</span>
                            ) : daysUntil !== null ? (
                              <span className={`text-[10px] font-medium ${getContactoStatusColor(daysUntil)}`}>
                                {getContactoStatusText(daysUntil)}
                              </span>
                            ) : <span className="text-[10px] text-slate-300">—</span>}
                          </td>
                        )}
                        {!isHidden(9) && (
                          <td className={tdCls(9, 'px-3 py-2 overflow-hidden')}>
                            {(() => {
                              const lastComment = lead.postas?.slice().reverse().find(p => p.comentario)?.comentario;
                              const text = lastComment || lead.descripcion || lead.motivoContacto || '—';
                              return (
                                <span className="text-[10px] text-slate-500 line-clamp-2" title={text}>
                                  {text}
                                </span>
                              );
                            })()}
                          </td>
                        )}
                        <td className="px-3 py-2 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {!isClosed && canModify && (
                              <>
                                <button onClick={() => setQuickNoteLead(lead)} title="Nota rápida"
                                  className="text-[10px] font-medium text-slate-400 hover:text-slate-600 px-1 py-0.5 rounded hover:bg-slate-100">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                                  </svg>
                                </button>
                                <button onClick={() => setDerivarLead(lead)}
                                  className="text-[10px] font-medium text-teal-600 hover:text-teal-800 px-1.5 py-0.5 rounded hover:bg-teal-50">
                                  Derivar
                                </button>
                                <button onClick={() => setFinalizarLead(lead)}
                                  className="text-[10px] font-medium text-red-500 hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-red-50">
                                  Finalizar
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
                );
              })()}
            </div>
          </>
        )}
      </div>

      {showCreate && <CrearLeadModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={loadLeads} />}
      {derivarLead && <DerivarLeadModal lead={derivarLead} onClose={() => setDerivarLead(null)} onSuccess={() => { setDerivarLead(null); loadLeads(); }} />}
      {finalizarLead && <FinalizarLeadModal lead={finalizarLead} onClose={() => setFinalizarLead(null)} onSuccess={() => { setFinalizarLead(null); loadLeads(); }} />}
      {quickNoteLead && <LeadQuickNoteModal lead={quickNoteLead} onClose={() => setQuickNoteLead(null)} onAdded={() => { setQuickNoteLead(null); loadLeads(); }} />}
    </div>
  );
}
