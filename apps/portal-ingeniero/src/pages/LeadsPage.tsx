import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Lead } from '@ags/shared';
import {
  getSimplifiedEstadoLabel, getSimplifiedEstadoColor,
  TICKET_AREA_LABELS, TICKET_AREA_COLORS,
  MOTIVO_LLAMADO_LABELS, MOTIVO_LLAMADO_COLORS,
  TICKET_PRIORIDAD_LABELS, TICKET_PRIORIDAD_COLORS,
  canUserModifyLead,
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
import { LeadFilters, INITIAL_FILTERS, type LeadFiltersState, type EstadoFilterValue } from '../components/leads/LeadFilters';
import { getDaysOpen, getDaysUntilContacto, getDaysSinceLastActivity, formatCurrencyARS, getAgeBadgeColor, getContactoStatusColor, getContactoStatusText } from '../utils/leadHelpers';
import { useResizableColumns } from '../hooks/useResizableColumns';
import { ColAlignIcon } from '../components/ui/ColAlignIcon';

const thBase = 'px-2 py-1.5 text-center text-[10px] font-medium text-slate-400 tracking-wider whitespace-nowrap relative select-none';

export default function LeadsPage() {
  const navigate = useNavigate();
  const { usuario, hasRole } = useAuth();
  // Only admin and admin_ing_soporte can see all tickets; others are locked to their own
  const canSeeAll = hasRole('admin', 'admin_ing_soporte');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [derivarLead, setDerivarLead] = useState<Lead | null>(null);
  const [finalizarLead, setFinalizarLead] = useState<Lead | null>(null);
  const [quickNoteLead, setQuickNoteLead] = useState<Lead | null>(null);
  const [usuarios, setUsuarios] = useState<{ id: string; displayName: string }[]>([]);

  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilterValue>('');
  const [filters, setFilters] = useState<LeadFiltersState>(INITIAL_FILTERS);

  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    usuariosService.getIngenieros().then(setUsuarios);
  }, []);

  // Build Firestore query filters
  // Estado: se filtra client-side porque "en_proceso" agrupa múltiples estados internos.
  const queryFilters = useMemo(() => {
    // Non-admin: always lock to own tickets at query level
    if (!canSeeAll && usuario) {
      if (filters.misCreados) return { createdBy: usuario.id };
      if (filters.misDerivados) return { derivadoPor: usuario.id };
      return { asignadoA: usuario.id };
    }
    // Admin: soloMios filters by asignadoA; misCreados/misDerivados fetch all and filter client-side
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
    // Ocultar finalizados salvo que el checkbox esté tildado
    if (!filters.mostrarFinalizados) {
      result = result.filter(l => l.estado !== 'finalizado' && l.estado !== 'no_concretado');
    }
    // Filtro de estado simplificado (nuevo / en_proceso / finalizado)
    if (estadoFilter === 'nuevo') {
      result = result.filter(l => l.estado === 'nuevo');
    } else if (estadoFilter === 'en_proceso') {
      result = result.filter(l => l.estado !== 'nuevo' && l.estado !== 'finalizado' && l.estado !== 'no_concretado');
    } else if (estadoFilter === 'finalizado') {
      result = result.filter(l => l.estado === 'finalizado' || l.estado === 'no_concretado');
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
        l.razonSocial.toLowerCase().includes(q) ||
        l.contacto.toLowerCase().includes(q) ||
        (l.descripcion || '').toLowerCase().includes(q) ||
        (l.motivoContacto || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [leads, usuario, estadoFilter, filters.misCreados, filters.misDerivados, filters.mostrarFinalizados, filters.motivo, filters.area, filters.prioridad, filters.fechaDesde, filters.fechaHasta, search]);

  const { tableRef, colWidths, colAligns, onResizeStart, onAutoFit, cycleAlign, getAlignClass } = useResizableColumns('pi-tickets-list');

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
                      <span className="text-sm font-semibold text-slate-800 truncate">{lead.razonSocial}</span>
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
            <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto h-full">
              <table ref={tableRef} className="w-full table-fixed">
                {colWidths ? (
                  <colgroup>{colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
                ) : (
                  <colgroup>
                    <col style={{ width: '11%' }} />{/* Cliente */}
                    <col style={{ width: '8%' }} />{/* Contacto */}
                    <col style={{ width: '6%' }} />{/* Motivo */}
                    <col style={{ width: '5%' }} />{/* Prioridad */}
                    <col style={{ width: '7%' }} />{/* Estado */}
                    <col style={{ width: '8%' }} />{/* Área */}
                    <col style={{ width: '8%' }} />{/* Asignado */}
                    <col style={{ width: '6%' }} />{/* Fecha */}
                    <col style={{ width: '5%' }} />{/* Seguimiento */}
                    <col style={{ width: '22%' }} />{/* Observaciones */}
                    <col style={{ width: '14%' }} />{/* Acciones */}
                  </colgroup>
                )}
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className={`${thBase} ${getAlignClass(0)}`}><ColAlignIcon align={colAligns?.[0] || 'left'} onClick={() => cycleAlign(0)} />Cliente<div onMouseDown={e => onResizeStart(0, e)} onDoubleClick={() => onAutoFit(0)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                    <th className={`${thBase} ${getAlignClass(1)}`}><ColAlignIcon align={colAligns?.[1] || 'left'} onClick={() => cycleAlign(1)} />Contacto<div onMouseDown={e => onResizeStart(1, e)} onDoubleClick={() => onAutoFit(1)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                    <th className={`${thBase} ${getAlignClass(2)}`}><ColAlignIcon align={colAligns?.[2] || 'left'} onClick={() => cycleAlign(2)} />Motivo<div onMouseDown={e => onResizeStart(2, e)} onDoubleClick={() => onAutoFit(2)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                    <th className={`${thBase} ${getAlignClass(3)}`}><ColAlignIcon align={colAligns?.[3] || 'left'} onClick={() => cycleAlign(3)} />Prioridad<div onMouseDown={e => onResizeStart(3, e)} onDoubleClick={() => onAutoFit(3)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                    <th className={`${thBase} ${getAlignClass(4)}`}><ColAlignIcon align={colAligns?.[4] || 'left'} onClick={() => cycleAlign(4)} />Estado<div onMouseDown={e => onResizeStart(4, e)} onDoubleClick={() => onAutoFit(4)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                    <th className={`${thBase} ${getAlignClass(5)}`}><ColAlignIcon align={colAligns?.[5] || 'left'} onClick={() => cycleAlign(5)} />Área<div onMouseDown={e => onResizeStart(5, e)} onDoubleClick={() => onAutoFit(5)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                    <th className={`${thBase} ${getAlignClass(6)}`}><ColAlignIcon align={colAligns?.[6] || 'left'} onClick={() => cycleAlign(6)} />Asignado<div onMouseDown={e => onResizeStart(6, e)} onDoubleClick={() => onAutoFit(6)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                    <th className={`${thBase} ${getAlignClass(7)}`}><ColAlignIcon align={colAligns?.[7] || 'left'} onClick={() => cycleAlign(7)} />Fecha<div onMouseDown={e => onResizeStart(7, e)} onDoubleClick={() => onAutoFit(7)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                    <th className={`${thBase} ${getAlignClass(8)}`}><ColAlignIcon align={colAligns?.[8] || 'left'} onClick={() => cycleAlign(8)} />Seguim.<div onMouseDown={e => onResizeStart(8, e)} onDoubleClick={() => onAutoFit(8)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                    <th className={`${thBase} ${getAlignClass(9)}`}><ColAlignIcon align={colAligns?.[9] || 'left'} onClick={() => cycleAlign(9)} />Observaciones<div onMouseDown={e => onResizeStart(9, e)} onDoubleClick={() => onAutoFit(9)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
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
                        <td className={`px-2 py-1.5 overflow-hidden ${getAlignClass(0)}`}>
                          <Link to={`/leads/${lead.id}`} className="text-[11px] font-semibold text-teal-600 hover:text-teal-800 truncate block" title={lead.razonSocial}>
                            {lead.razonSocial}
                          </Link>
                        </td>
                        <td className={`px-2 py-1.5 text-[11px] text-slate-600 truncate overflow-hidden ${getAlignClass(1)}`} title={lead.contacto}>
                          {lead.contacto}
                        </td>
                        <td className={`px-3 py-2 whitespace-nowrap overflow-hidden ${getAlignClass(2)}`}>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${MOTIVO_LLAMADO_COLORS[lead.motivoLlamado]}`}>
                            {MOTIVO_LLAMADO_LABELS[lead.motivoLlamado]}
                          </span>
                        </td>
                        <td className={`px-3 py-2 whitespace-nowrap overflow-hidden ${getAlignClass(3)}`}>
                          {lead.prioridad ? (
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TICKET_PRIORIDAD_COLORS[lead.prioridad]}`}>
                              {TICKET_PRIORIDAD_LABELS[lead.prioridad]}
                            </span>
                          ) : <span className="text-[10px] text-slate-300">—</span>}
                        </td>
                        <td className={`px-3 py-2 whitespace-nowrap overflow-hidden ${getAlignClass(4)}`}>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${getSimplifiedEstadoColor(lead.estado)}`}>
                            {getSimplifiedEstadoLabel(lead.estado)}
                          </span>
                        </td>
                        <td className={`px-3 py-2 whitespace-nowrap overflow-hidden ${getAlignClass(5)}`}>
                          {lead.areaActual ? (
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TICKET_AREA_COLORS[lead.areaActual]}`}>
                              {TICKET_AREA_LABELS[lead.areaActual]}
                            </span>
                          ) : <span className="text-[10px] text-slate-300">—</span>}
                        </td>
                        <td className={`px-3 py-2 text-xs text-slate-500 truncate overflow-hidden ${getAlignClass(6)}`} title={getResponsableNombre(lead.asignadoA)}>
                          {getResponsableNombre(lead.asignadoA)}
                        </td>
                        <td className={`px-3 py-2 whitespace-nowrap overflow-hidden ${getAlignClass(7)}`}>
                          <span className="text-[10px] text-slate-400">{formatDate(lead.createdAt)}</span>
                          {!isClosed && <span className={`text-[10px] font-medium ml-1 ${getAgeBadgeColor(daysOpen)}`}>{daysOpen}d</span>}
                        </td>
                        <td className={`px-3 py-2 whitespace-nowrap overflow-hidden ${getAlignClass(8)}`}>
                          {daysUntil !== null ? (
                            <span className={`text-[10px] font-medium ${getContactoStatusColor(daysUntil)}`}>
                              {getContactoStatusText(daysUntil)}
                            </span>
                          ) : <span className="text-[10px] text-slate-300">—</span>}
                        </td>
                        <td className={`px-3 py-2 overflow-hidden ${getAlignClass(9)}`}>
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
                            <Link to={`/leads/${lead.id}`}
                              className="text-[10px] font-medium text-emerald-600 hover:text-emerald-800 px-1.5 py-0.5 rounded hover:bg-emerald-50">
                              Ver
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
