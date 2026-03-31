import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { Ticket, TicketEstado } from '@ags/shared';
import {
  TICKET_ESTADO_LABELS, TICKET_ESTADO_COLORS,
  TICKET_AREA_LABELS, TICKET_AREA_COLORS,
  MOTIVO_LLAMADO_LABELS, MOTIVO_LLAMADO_COLORS,
  TICKET_PRIORIDAD_LABELS, TICKET_PRIORIDAD_COLORS,
  canUserModifyTicket,
} from '@ags/shared';
import { ticketsService, usuariosService } from '../services/firebaseService';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import CrearTicketModal from '../components/tickets/CrearTicketModal';
import DerivarTicketModal from '../components/tickets/DerivarTicketModal';
import FinalizarTicketModal from '../components/tickets/FinalizarTicketModal';
import TicketQuickNoteModal from '../components/tickets/TicketQuickNoteModal';
import { TicketFilters, INITIAL_FILTERS, type TicketFiltersState } from '../components/tickets/TicketFilters';
import { getDaysOpen, getDaysUntilContacto, getDaysSinceLastActivity, formatCurrencyARS, getAgeBadgeColor, getContactoStatusColor, getContactoStatusText } from '../utils/ticketHelpers';
import { useResizableColumns } from '../hooks/useResizableColumns';

const thBase = 'px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap relative';

export default function TicketsPage() {
  const { usuario } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [derivarTicket, setDerivarTicket] = useState<Ticket | null>(null);
  const [finalizarTicket, setFinalizarTicket] = useState<Ticket | null>(null);
  const [quickNoteTicket, setQuickNoteTicket] = useState<Ticket | null>(null);
  const [usuarios, setUsuarios] = useState<{ id: string; displayName: string }[]>([]);

  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<TicketEstado | ''>('');
  const [filters, setFilters] = useState<TicketFiltersState>(INITIAL_FILTERS);

  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    usuariosService.getIngenieros().then(setUsuarios);
  }, []);

  // Build Firestore query filters
  const queryFilters = useMemo(() => {
    const responsableFilter = filters.soloMios && usuario ? usuario.id : filters.misCreados ? undefined : (filters.responsable || undefined);
    return {
      ...(estadoFilter ? { estado: estadoFilter as TicketEstado } : {}),
      ...(responsableFilter ? { asignadoA: responsableFilter } : {}),
    };
  }, [estadoFilter, filters.responsable, filters.soloMios, filters.misCreados, usuario]);

  // Real-time subscription
  useEffect(() => {
    setLoading(true);
    unsubRef.current?.();
    unsubRef.current = ticketsService.subscribe(
      queryFilters,
      (data) => { setTickets(data); setLoading(false); },
      (err) => { console.error('Error tickets:', err); setLoading(false); },
    );
    return () => { unsubRef.current?.(); };
  }, [queryFilters]);

  // No-op: onSnapshot handles real-time updates automatically
  const loadTickets = useCallback(async () => {}, []);

  const ticketsFiltered = useMemo(() => {
    let result = tickets;
    if (filters.misCreados && usuario) {
      result = result.filter(l => l.createdBy === usuario.id || l.derivadoPor === usuario.id);
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
  }, [tickets, usuario, filters.misCreados, filters.motivo, filters.area, filters.prioridad, filters.fechaDesde, filters.fechaHasta, search]);

  const { tableRef, colWidths, onResizeStart } = useResizableColumns();

  const pipelineTotal = useMemo(() =>
    ticketsFiltered.reduce((sum, l) => sum + (l.valorEstimado || 0), 0),
    [ticketsFiltered]
  );

  const getResponsableNombre = (id: string | null) => {
    if (!id) return '—';
    return usuarios.find(u => u.id === id)?.displayName || '—';
  };

  const formatDate = (d?: string) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }); } catch { return d; }
  };

  const getRowStyle = (ticket: Ticket) => {
    const isClosed = ticket.estado === 'finalizado' || ticket.estado === 'no_concretado';
    if (isClosed) return '';
    const daysUntil = getDaysUntilContacto(ticket.proximoContacto);
    if (daysUntil !== null && daysUntil < 0) return 'border-l-2 border-red-300 bg-red-50/50';
    const daysSince = getDaysSinceLastActivity(ticket.postas);
    if (daysSince !== null && daysSince > 5) return 'border-l-2 border-amber-300 bg-amber-50/30';
    return '';
  };

  if (loading && tickets.length === 0) {
    return <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando tickets...</p></div>;
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader title="Tickets / Consultas" count={ticketsFiltered.length}
        subtitle={pipelineTotal > 0 ? `Pipeline: ${formatCurrencyARS(pipelineTotal)}` : undefined}
        actions={<Button size="sm" onClick={() => setShowCreate(true)}>+ Nuevo Ticket</Button>}>
        <TicketFilters search={search} onSearchChange={setSearch} estadoFilter={estadoFilter} onEstadoChange={setEstadoFilter}
          filters={filters} onFiltersChange={setFilters} usuarios={usuarios} />
      </PageHeader>

      <div className="flex-1 min-h-0 px-3 md:px-5 pb-4">
        {ticketsFiltered.length === 0 ? (
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
              {ticketsFiltered.map(ticket => {
                const isClosed = ticket.estado === 'finalizado' || ticket.estado === 'no_concretado';
                const canModify = usuario ? canUserModifyTicket(ticket, usuario) : false;
                const daysOpen = getDaysOpen(ticket.createdAt);
                return (
                  <Link key={ticket.id} to={`/tickets/${ticket.id}`}
                    className={`block bg-white rounded-xl border border-slate-200 p-3 active:bg-slate-50 ${getRowStyle(ticket)}`}>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="text-sm font-semibold text-slate-800 truncate">{ticket.razonSocial}</span>
                      <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TICKET_ESTADO_COLORS[ticket.estado]}`}>
                        {TICKET_ESTADO_LABELS[ticket.estado]}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mb-2">{ticket.contacto}</div>
                    {(ticket.descripcion || ticket.motivoContacto) && (
                      <p className="text-[11px] text-slate-400 line-clamp-2 mb-2">{ticket.descripcion || ticket.motivoContacto}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${MOTIVO_LLAMADO_COLORS[ticket.motivoLlamado]}`}>
                        {MOTIVO_LLAMADO_LABELS[ticket.motivoLlamado]}
                      </span>
                      {ticket.areaActual && (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TICKET_AREA_COLORS[ticket.areaActual]}`}>
                          {TICKET_AREA_LABELS[ticket.areaActual]}
                        </span>
                      )}
                      {ticket.prioridad && (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TICKET_PRIORIDAD_COLORS[ticket.prioridad]}`}>
                          {TICKET_PRIORIDAD_LABELS[ticket.prioridad]}
                        </span>
                      )}
                      <span className="ml-auto text-[10px] text-slate-400">
                        {formatDate(ticket.createdAt)}
                        {!isClosed && <span className={`font-medium ml-1 ${getAgeBadgeColor(daysOpen)}`}>{daysOpen}d</span>}
                      </span>
                    </div>
                    {ticket.asignadoA && (
                      <div className="mt-1.5 text-[10px] text-slate-400">
                        Asignado: <span className="text-slate-600">{getResponsableNombre(ticket.asignadoA)}</span>
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
                    <th className={thBase}>Cliente<div onMouseDown={e => onResizeStart(0, e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                    <th className={thBase}>Contacto<div onMouseDown={e => onResizeStart(1, e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                    <th className={thBase}>Motivo<div onMouseDown={e => onResizeStart(2, e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                    <th className={thBase}>Prioridad<div onMouseDown={e => onResizeStart(3, e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                    <th className={thBase}>Estado<div onMouseDown={e => onResizeStart(4, e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                    <th className={thBase}>Área<div onMouseDown={e => onResizeStart(5, e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                    <th className={thBase}>Asignado<div onMouseDown={e => onResizeStart(6, e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                    <th className={thBase}>Fecha<div onMouseDown={e => onResizeStart(7, e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                    <th className={thBase}>Seguim.<div onMouseDown={e => onResizeStart(8, e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                    <th className={thBase}>Observaciones<div onMouseDown={e => onResizeStart(9, e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                    <th className={`${thBase} text-center`}>Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ticketsFiltered.map(ticket => {
                    const isClosed = ticket.estado === 'finalizado' || ticket.estado === 'no_concretado';
                    const canModify = usuario ? canUserModifyTicket(ticket, usuario) : false;
                    const daysOpen = getDaysOpen(ticket.createdAt);
                    const daysUntil = getDaysUntilContacto(ticket.proximoContacto);
                    return (
                      <tr key={ticket.id} className={`hover:bg-slate-50 transition-colors ${getRowStyle(ticket)}`}>
                        <td className="px-3 py-2 overflow-hidden">
                          <Link to={`/tickets/${ticket.id}`} className="text-xs font-semibold text-teal-600 hover:text-teal-800 truncate block" title={ticket.razonSocial}>
                            {ticket.razonSocial}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-600 truncate overflow-hidden" title={ticket.contacto}>
                          {ticket.contacto}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap overflow-hidden">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${MOTIVO_LLAMADO_COLORS[ticket.motivoLlamado]}`}>
                            {MOTIVO_LLAMADO_LABELS[ticket.motivoLlamado]}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap overflow-hidden">
                          {ticket.prioridad ? (
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TICKET_PRIORIDAD_COLORS[ticket.prioridad]}`}>
                              {TICKET_PRIORIDAD_LABELS[ticket.prioridad]}
                            </span>
                          ) : <span className="text-[10px] text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap overflow-hidden">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TICKET_ESTADO_COLORS[ticket.estado]}`}>
                            {TICKET_ESTADO_LABELS[ticket.estado]}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap overflow-hidden">
                          {ticket.areaActual ? (
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TICKET_AREA_COLORS[ticket.areaActual]}`}>
                              {TICKET_AREA_LABELS[ticket.areaActual]}
                            </span>
                          ) : <span className="text-[10px] text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500 truncate overflow-hidden" title={getResponsableNombre(ticket.asignadoA)}>
                          {getResponsableNombre(ticket.asignadoA)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap overflow-hidden">
                          <span className="text-[10px] text-slate-400">{formatDate(ticket.createdAt)}</span>
                          {!isClosed && <span className={`text-[10px] font-medium ml-1 ${getAgeBadgeColor(daysOpen)}`}>{daysOpen}d</span>}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap overflow-hidden">
                          {daysUntil !== null ? (
                            <span className={`text-[10px] font-medium ${getContactoStatusColor(daysUntil)}`}>
                              {getContactoStatusText(daysUntil)}
                            </span>
                          ) : <span className="text-[10px] text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-2 overflow-hidden">
                          <span className="text-[10px] text-slate-500 line-clamp-2" title={ticket.descripcion || ticket.motivoContacto || ''}>
                            {ticket.descripcion || ticket.motivoContacto || '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center whitespace-nowrap overflow-hidden">
                          <div className="flex items-center justify-end gap-1">
                            {!isClosed && canModify && (
                              <>
                                <button onClick={() => setQuickNoteTicket(ticket)} title="Nota rápida"
                                  className="text-[10px] font-medium text-slate-400 hover:text-slate-600 px-1 py-0.5 rounded hover:bg-slate-100">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                                  </svg>
                                </button>
                                <button onClick={() => setDerivarTicket(ticket)}
                                  className="text-[10px] font-medium text-teal-600 hover:text-teal-800 px-1.5 py-0.5 rounded hover:bg-teal-50">
                                  Derivar
                                </button>
                                <button onClick={() => setFinalizarTicket(ticket)}
                                  className="text-[10px] font-medium text-red-500 hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-red-50">
                                  Finalizar
                                </button>
                              </>
                            )}
                            <Link to={`/tickets/${ticket.id}`}
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

      {showCreate && <CrearTicketModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={loadTickets} />}
      {derivarTicket && <DerivarTicketModal ticket={derivarTicket} onClose={() => setDerivarTicket(null)} onSuccess={() => { setDerivarTicket(null); loadTickets(); }} />}
      {finalizarTicket && <FinalizarTicketModal ticket={finalizarTicket} onClose={() => setFinalizarTicket(null)} onSuccess={() => { setFinalizarTicket(null); loadTickets(); }} />}
      {quickNoteTicket && <TicketQuickNoteModal ticket={quickNoteTicket} onClose={() => setQuickNoteTicket(null)} onAdded={() => { setQuickNoteTicket(null); loadTickets(); }} />}
    </div>
  );
}
