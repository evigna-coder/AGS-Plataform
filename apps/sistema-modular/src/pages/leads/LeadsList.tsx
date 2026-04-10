import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDebounce } from '../../hooks/useDebounce';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import type { Lead, LeadEstado, LeadArea, MotivoLlamado, UsuarioAGS } from '@ags/shared';
import {
  LEAD_ESTADO_LABELS, LEAD_ESTADO_COLORS,
  LEAD_AREA_LABELS, LEAD_AREA_COLORS,
  MOTIVO_LLAMADO_LABELS, MOTIVO_LLAMADO_COLORS,
  LEAD_PRIORIDAD_LABELS, LEAD_PRIORIDAD_COLORS,
  getUserTicketAreas,
  userHasRole,
  canUserModifyLead,
} from '@ags/shared';
import { leadsService, usuariosService } from '../../services/firebaseService';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { CrearLeadModal } from '../../components/leads/CrearLeadModal';
import { DerivarLeadModal } from '../../components/leads/DerivarLeadModal';
import { FinalizarLeadModal } from '../../components/leads/FinalizarLeadModal';
import { LeadQuickNoteModal } from '../../components/leads/LeadQuickNoteModal';
import { LeadFilters, type LeadFiltersState } from '../../components/leads/LeadFilters';
import { getDaysOpen, getDaysUntilContacto, getDaysSinceLastActivity, formatCurrencyARS, getAgeBadgeColor, getContactoStatusColor, getContactoStatusText } from '../../utils/leadHelpers';
import { useResizableColumns } from '../../hooks/useResizableColumns';

const thBase = 'px-3 py-2 text-center text-[11px] font-medium tracking-wider whitespace-nowrap relative select-none';

type SortKey = 'razonSocial' | 'contacto' | 'motivoLlamado' | 'prioridad' | 'estado' | 'areaActual' | 'asignadoA' | 'createdAt' | 'proximoContacto';
type SortDir = 'asc' | 'desc';

const PRIORIDAD_ORDER: Record<string, number> = { alta: 0, media: 1, baja: 2 };

export const LeadsList = () => {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showCreate, setShowCreate] = useState(false);
  const [derivarLead, setDerivarLead] = useState<Lead | null>(null);
  const [finalizarLead, setFinalizarLead] = useState<Lead | null>(null);
  const [quickNoteLead, setQuickNoteLead] = useState<Lead | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioAGS[]>([]);

  const FILTER_SCHEMA = useMemo(() => ({
    search: { type: 'string' as const, default: '' },
    estadoFilter: { type: 'string' as const, default: '' },
    motivo: { type: 'string' as const, default: '' },
    area: { type: 'string' as const, default: '' },
    responsable: { type: 'string' as const, default: '' },
    soloMios: { type: 'boolean' as const, default: false },
    misCreados: { type: 'boolean' as const, default: false },
    misDerivados: { type: 'boolean' as const, default: false },
    mostrarFinalizados: { type: 'boolean' as const, default: false },
    prioridad: { type: 'string' as const, default: '' },
    fechaDesde: { type: 'string' as const, default: '' },
    fechaHasta: { type: 'string' as const, default: '' },
  }), []);
  const [filters, setFilter, setFilters, _resetFilters] = useUrlFilters(FILTER_SCHEMA);
  const debouncedSearch = useDebounce(filters.search, 300);

  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    usuariosService.getAll().then(setUsuarios);
  }, []);

  // Build Firestore query filters (stable ref via JSON key)
  const queryFilters = useMemo(() => {
    const responsableFilter = filters.soloMios && usuario
      ? usuario.id
      : (filters.misCreados || filters.misDerivados)
        ? undefined
        : (filters.responsable || undefined);
    return {
      ...(filters.estadoFilter ? { estado: filters.estadoFilter as LeadEstado } : {}),
      ...(filters.motivo ? { motivoLlamado: filters.motivo as MotivoLlamado } : {}),
      ...(filters.area ? { areaActual: filters.area as LeadArea } : {}),
      ...(responsableFilter ? { asignadoA: responsableFilter } : {}),
    };
  }, [filters.estadoFilter, filters.motivo, filters.area, filters.responsable, filters.soloMios, filters.misCreados, filters.misDerivados, usuario]);

  // Real-time subscription — auto-updates when any user writes
  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    unsubRef.current?.();
    unsubRef.current = leadsService.subscribe(
      queryFilters,
      (data) => { setLeads(data); setLoading(false); },
      (err) => { console.error('Error leads:', err); setLoadError('Error al cargar los leads.'); setLoading(false); },
    );
    return () => { unsubRef.current?.(); };
  }, [queryFilters]);

  // Manual refresh (for post-mutation callbacks that need immediate reload)
  const loadLeads = useCallback(async () => {
    // With onSnapshot the data refreshes automatically,
    // but we keep this for components that call onCreated/onDerived/etc.
    // No-op: the listener already handles updates.
  }, []);

  const isAdmin = usuario ? userHasRole(usuario, 'admin') : false;
  // Areas this user can see beyond their own tickets (from all roles)
  const extraAreas = useMemo(() => {
    if (!usuario || isAdmin) return null;
    const areas = getUserTicketAreas(usuario);
    return areas.length > 0 ? new Set(areas) : null;
  }, [usuario, isAdmin]);

  const leadsFiltered = useMemo(() => {
    let result = leads;

    // Visibility by role
    if (!isAdmin && usuario) {
      result = result.filter(l =>
        l.asignadoA === usuario.id ||
        l.createdBy === usuario.id ||
        (extraAreas && l.areaActual && extraAreas.has(l.areaActual))
      );
    }

    // Ocultar finalizados salvo que el checkbox esté tildado
    if (!filters.mostrarFinalizados) {
      result = result.filter(l => l.estado !== 'finalizado');
    }
    if (filters.misCreados && usuario) {
      result = result.filter(l => l.createdBy === usuario.id);
    }
    if (filters.misDerivados && usuario) {
      result = result.filter(l => l.derivadoPor === usuario.id);
    }
    if (filters.prioridad) result = result.filter(l => l.prioridad === filters.prioridad);
    if (filters.fechaDesde) result = result.filter(l => l.createdAt >= filters.fechaDesde);
    if (filters.fechaHasta) result = result.filter(l => l.createdAt <= filters.fechaHasta + 'T23:59:59');
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(l =>
        l.razonSocial.toLowerCase().includes(q) ||
        l.contacto.toLowerCase().includes(q) ||
        (l.descripcion || '').toLowerCase().includes(q) ||
        (l.motivoContacto || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [leads, usuario, isAdmin, extraAreas, filters.misCreados, filters.misDerivados, filters.mostrarFinalizados, filters.prioridad, filters.fechaDesde, filters.fechaHasta, debouncedSearch]);

  const leadsSorted = useMemo(() => {
    const sorted = [...leadsFiltered];
    const dir = sortDir === 'asc' ? 1 : -1;
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'razonSocial': cmp = a.razonSocial.localeCompare(b.razonSocial); break;
        case 'contacto': cmp = a.contacto.localeCompare(b.contacto); break;
        case 'motivoLlamado': cmp = a.motivoLlamado.localeCompare(b.motivoLlamado); break;
        case 'prioridad': cmp = (PRIORIDAD_ORDER[a.prioridad || 'normal'] ?? 2) - (PRIORIDAD_ORDER[b.prioridad || 'normal'] ?? 2); break;
        case 'estado': cmp = a.estado.localeCompare(b.estado); break;
        case 'areaActual': cmp = (a.areaActual || '').localeCompare(b.areaActual || ''); break;
        case 'asignadoA': cmp = getResponsableNombre(a.asignadoA).localeCompare(getResponsableNombre(b.asignadoA)); break;
        case 'createdAt': cmp = (a.createdAt || '').localeCompare(b.createdAt || ''); break;
        case 'proximoContacto': cmp = (a.proximoContacto || '').localeCompare(b.proximoContacto || ''); break;
      }
      return cmp * dir;
    });
    return sorted;
  }, [leadsFiltered, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <span className="text-slate-300 ml-0.5">↕</span>;
    return <span className="text-teal-500 ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const { tableRef, colWidths, onResizeStart } = useResizableColumns('tickets-list');

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

  // Bridge between URL filters and LeadFilters component interface
  const leadFiltersState = useMemo((): LeadFiltersState => ({
    motivo: filters.motivo as LeadFiltersState['motivo'],
    area: filters.area as LeadFiltersState['area'],
    prioridad: filters.prioridad as LeadFiltersState['prioridad'],
    responsable: filters.responsable,
    soloMios: filters.soloMios,
    misCreados: filters.misCreados,
    misDerivados: filters.misDerivados,
    mostrarFinalizados: filters.mostrarFinalizados,
    fechaDesde: filters.fechaDesde,
    fechaHasta: filters.fechaHasta,
  }), [filters.motivo, filters.area, filters.prioridad, filters.responsable, filters.soloMios, filters.misCreados, filters.misDerivados, filters.mostrarFinalizados, filters.fechaDesde, filters.fechaHasta]);

  const handleLeadFiltersChange = (f: LeadFiltersState) => {
    setFilters({
      motivo: f.motivo,
      area: f.area,
      prioridad: f.prioridad,
      responsable: f.responsable,
      soloMios: f.soloMios,
      misCreados: f.misCreados,
      misDerivados: f.misDerivados,
      mostrarFinalizados: f.mostrarFinalizados,
      fechaDesde: f.fechaDesde,
      fechaHasta: f.fechaHasta,
    });
  };

  const isInitialLoad = loading && leads.length === 0;

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <p className="text-sm text-red-600">{loadError}</p>
        <button onClick={loadLeads} className="text-xs text-teal-600 hover:text-teal-800 font-medium">Reintentar</button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader title="Tickets" count={isInitialLoad ? undefined : leadsFiltered.length}
        subtitle={pipelineTotal > 0 ? `Pipeline: ${formatCurrencyARS(pipelineTotal)}` : undefined}
        actions={<Button size="sm" onClick={() => setShowCreate(true)}>+ Nuevo Ticket</Button>}>
        <LeadFilters search={filters.search} onSearchChange={v => setFilter('search', v)}
          estadoFilter={filters.estadoFilter as LeadEstado | ''} onEstadoChange={v => setFilter('estadoFilter', v)}
          filters={leadFiltersState} onFiltersChange={handleLeadFiltersChange}
          usuarios={usuarios} />
      </PageHeader>

      <div className="flex-1 min-h-0 px-5 pb-4">
        {isInitialLoad ? (
          <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando leads...</p></div>
        ) : leadsFiltered.length === 0 ? (
          <Card><div className="text-center py-12">
            <p className="text-slate-400">No se encontraron tickets</p>
            <button onClick={() => setShowCreate(true)} className="text-teal-600 hover:underline mt-2 inline-block text-xs">
              Crear primer ticket
            </button>
          </div></Card>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto h-full">
            <table ref={tableRef} className="w-full table-fixed">
              {colWidths ? (
                <colgroup>{colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
              ) : (
                <colgroup>
                  <col style={{ width: '13%' }} />{/* Cliente */}
                  <col style={{ width: '10%' }} />{/* Contacto */}
                  <col style={{ width: '6%' }} />{/* Motivo */}
                  <col style={{ width: '5%' }} />{/* Prioridad */}
                  <col style={{ width: '7%' }} />{/* Estado */}
                  <col style={{ width: '9%' }} />{/* Área */}
                  <col style={{ width: '9%' }} />{/* Asignado */}
                  <col style={{ width: '7%' }} />{/* Fecha */}
                  <col style={{ width: '6%' }} />{/* Seguimiento */}
                  <col style={{ width: '18%' }} />{/* Observaciones */}
                  <col style={{ width: '10%' }} />{/* Acciones */}
                </colgroup>
              )}
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className={`${thBase} cursor-pointer hover:text-slate-600`} onClick={() => toggleSort('razonSocial')}>Cliente <SortIcon col="razonSocial" /><div onMouseDown={e => { e.stopPropagation(); onResizeStart(0, e); }} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thBase} cursor-pointer hover:text-slate-600`} onClick={() => toggleSort('contacto')}>Contacto <SortIcon col="contacto" /><div onMouseDown={e => { e.stopPropagation(); onResizeStart(1, e); }} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thBase} cursor-pointer hover:text-slate-600`} onClick={() => toggleSort('motivoLlamado')}>Motivo <SortIcon col="motivoLlamado" /><div onMouseDown={e => { e.stopPropagation(); onResizeStart(2, e); }} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thBase} cursor-pointer hover:text-slate-600`} onClick={() => toggleSort('prioridad')}>Prioridad <SortIcon col="prioridad" /><div onMouseDown={e => { e.stopPropagation(); onResizeStart(3, e); }} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thBase} cursor-pointer hover:text-slate-600`} onClick={() => toggleSort('estado')}>Estado <SortIcon col="estado" /><div onMouseDown={e => { e.stopPropagation(); onResizeStart(4, e); }} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thBase} cursor-pointer hover:text-slate-600`} onClick={() => toggleSort('areaActual')}>Área <SortIcon col="areaActual" /><div onMouseDown={e => { e.stopPropagation(); onResizeStart(5, e); }} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thBase} cursor-pointer hover:text-slate-600`} onClick={() => toggleSort('asignadoA')}>Asignado <SortIcon col="asignadoA" /><div onMouseDown={e => { e.stopPropagation(); onResizeStart(6, e); }} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thBase} cursor-pointer hover:text-slate-600`} onClick={() => toggleSort('createdAt')}>Fecha <SortIcon col="createdAt" /><div onMouseDown={e => { e.stopPropagation(); onResizeStart(7, e); }} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thBase} cursor-pointer hover:text-slate-600`} onClick={() => toggleSort('proximoContacto')}>Seguim. <SortIcon col="proximoContacto" /><div onMouseDown={e => { e.stopPropagation(); onResizeStart(8, e); }} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thBase} text-slate-400`}>Observaciones<div onMouseDown={e => onResizeStart(9, e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thBase} text-center text-slate-400`}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leadsSorted.map(lead => {
                  const isClosed = lead.estado === 'finalizado' || lead.estado === 'no_concretado';
                  const canModify = usuario ? canUserModifyLead(lead, usuario) : false;
                  const daysOpen = getDaysOpen(lead.createdAt);
                  const daysUntil = getDaysUntilContacto(lead.proximoContacto);
                  return (
                    <tr key={lead.id} className={`hover:bg-slate-50 transition-colors cursor-pointer ${getRowStyle(lead)}`}
                      onClick={() => navigate(`/leads/${lead.id}`)}>
                      <td className="px-3 py-2 overflow-hidden text-left">
                        <Link to={`/leads/${lead.id}`} className="text-xs font-semibold text-teal-600 hover:text-teal-800 truncate block" title={lead.razonSocial}
                          onClick={e => e.stopPropagation()}>
                          {lead.razonSocial}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600 truncate overflow-hidden text-center" title={lead.contacto}>
                        {lead.contacto}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap overflow-hidden text-center">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${MOTIVO_LLAMADO_COLORS[lead.motivoLlamado]}`}>
                          {MOTIVO_LLAMADO_LABELS[lead.motivoLlamado]}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap overflow-hidden text-center">
                        {lead.prioridad ? (
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${LEAD_PRIORIDAD_COLORS[lead.prioridad]}`}>
                            {LEAD_PRIORIDAD_LABELS[lead.prioridad]}
                          </span>
                        ) : <span className="text-[10px] text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap overflow-hidden text-center">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${LEAD_ESTADO_COLORS[lead.estado]}`}>
                          {LEAD_ESTADO_LABELS[lead.estado]}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap overflow-hidden text-center">
                        {lead.areaActual ? (
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${LEAD_AREA_COLORS[lead.areaActual]}`}>
                            {LEAD_AREA_LABELS[lead.areaActual]}
                          </span>
                        ) : <span className="text-[10px] text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500 truncate overflow-hidden text-center" title={getResponsableNombre(lead.asignadoA)}>
                        {getResponsableNombre(lead.asignadoA)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap overflow-hidden text-center">
                        <span className="text-[10px] text-slate-400">{formatDate(lead.createdAt)}</span>
                        {!isClosed && <span className={`text-[10px] font-medium ml-1 ${getAgeBadgeColor(daysOpen)}`}>{daysOpen}d</span>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap overflow-hidden text-center">
                        {daysUntil !== null ? (
                          <span className={`text-[10px] font-medium ${getContactoStatusColor(daysUntil)}`}>
                            {getContactoStatusText(daysUntil)}
                          </span>
                        ) : <span className="text-[10px] text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 overflow-hidden text-left">
                        <span className="text-[10px] text-slate-500 truncate block" title={lead.descripcion || lead.motivoContacto || ''}>
                          {((lead.descripcion || lead.motivoContacto || '—').length > 30
                            ? (lead.descripcion || lead.motivoContacto || '').slice(0, 30) + '...'
                            : lead.descripcion || lead.motivoContacto || '—')}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                          {!isClosed && (
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
          </div>
        )}
      </div>

      {showCreate && <CrearLeadModal onClose={() => setShowCreate(false)} onCreated={loadLeads} />}
      {derivarLead && <DerivarLeadModal lead={derivarLead} onClose={() => setDerivarLead(null)} onDerived={() => { setDerivarLead(null); loadLeads(); }} />}
      {finalizarLead && <FinalizarLeadModal lead={finalizarLead} onClose={() => setFinalizarLead(null)} onFinalized={() => { setFinalizarLead(null); loadLeads(); }} />}
      {quickNoteLead && <LeadQuickNoteModal lead={quickNoteLead} onClose={() => setQuickNoteLead(null)} onAdded={() => { setQuickNoteLead(null); loadLeads(); }} />}
    </div>
  );
};
