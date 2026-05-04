import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import type { Lead, UsuarioAGS, Posta } from '@ags/shared';
import { getSimplifiedEstadoLabel, getSimplifiedEstadoColor } from '@ags/shared';
import { leadsService, usuariosService, presupuestosService, ordenesTrabajoService, modulosService } from '../../services/firebaseService';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { LeadSidebar } from '../../components/leads/LeadSidebar';
import { LeadTimeline } from '../../components/leads/LeadTimeline';
import { DerivarLeadModal } from '../../components/leads/DerivarLeadModal';
import { FinalizarLeadModal } from '../../components/leads/FinalizarLeadModal';
import { LeadAdjuntosSection } from '../../components/leads/LeadAdjuntosSection';
import { ContactosTicketSection } from '../../components/leads/ContactosTicketSection';
import type { ContactoTicket } from '@ags/shared';
import { CreatePresupuestoModal } from '../../components/presupuestos/CreatePresupuestoModal';
import { TicketPendientesChips } from '../../components/pendientes/TicketPendientesChips';
import { useNavigateBack } from '../../hooks/useNavigateBack';

export const LeadDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const goBack = useNavigateBack();
  const { usuario } = useAuth();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [usuarios, setUsuarios] = useState<UsuarioAGS[]>([]);
  const [showDerivar, setShowDerivar] = useState(false);
  const [showFinalizar, setShowFinalizar] = useState(false);
  const [showCrearPresupuesto, setShowCrearPresupuesto] = useState(false);
  const [comentario, setComentario] = useState('');
  const [enviandoComentario, setEnviandoComentario] = useState(false);

  const [moduloNombre, setModuloNombre] = useState<string | null>(null);

  // Escape key → back to grid
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showDerivar && !showFinalizar && !showCrearPresupuesto) {
        goBack();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [goBack, showDerivar, showFinalizar, showCrearPresupuesto]);

  // Entidades vinculadas
  const [linkedPresupuestos, setLinkedPresupuestos] = useState<{ id: string; numero: string; estado: string }[]>([]);
  const [linkedOTs, setLinkedOTs] = useState<{ otNumber: string }[]>([]);
  const [otsRelacionadas, setOtsRelacionadas] = useState<{ otNumber: string }[]>([]);

  const unsubRef = useRef<(() => void) | null>(null);

  // Load usuarios once
  useEffect(() => {
    usuariosService.getAll().then(setUsuarios).catch(console.error);
  }, []);

  // Real-time subscription for lead document
  useEffect(() => {
    if (!id) return;
    setLoading(true);

    unsubRef.current?.();
    unsubRef.current = leadsService.subscribeById(id, (data) => {
      if (!data) {
        alert('Ticket no encontrado');
        navigate('/leads');
        return;
      }
      setLead(data);
      setLoading(false);
    }, (err) => {
      console.error('Error al cargar lead:', err);
      setLoading(false);
    });

    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, [id, navigate]);

  // One-shot loads for linked entities (re-run when lead changes relevant fields)
  const loadLinkedEntities = useCallback(async (data: Lead) => {
    // Cargar módulo nombre
    if (data.sistemaId && data.moduloId) {
      const mod = await modulosService.getById(data.sistemaId, data.moduloId);
      setModuloNombre(mod?.nombre || null);
    } else {
      setModuloNombre(null);
    }

    // Cargar presupuestos vinculados
    const presups: { id: string; numero: string; estado: string }[] = [];
    for (const pId of data.presupuestosIds || []) {
      const p = await presupuestosService.getById(pId);
      if (p) presups.push({ id: p.id, numero: p.numero, estado: p.estado });
    }
    setLinkedPresupuestos(presups);

    // Cargar OTs vinculadas (originadas por este ticket)
    const ots: { otNumber: string }[] = [];
    for (const otNum of data.otIds || []) {
      const ot = await ordenesTrabajoService.getByOtNumber(otNum);
      if (ot) ots.push({ otNumber: ot.otNumber });
    }
    setLinkedOTs(ots);

    // Cargar OTs relacionadas (preexistentes que motivaron este ticket — spawn-T_n).
    // Filtra duplicados con otIds: una OT que figura en ambos arrays solo aparece como "vinculada".
    const otIdsSet = new Set(data.otIds || []);
    const otsRel: { otNumber: string }[] = [];
    for (const otNum of data.otsRelacionadas || []) {
      if (otIdsSet.has(otNum)) continue;
      const ot = await ordenesTrabajoService.getByOtNumber(otNum);
      if (ot) otsRel.push({ otNumber: ot.otNumber });
    }
    setOtsRelacionadas(otsRel);
  }, []);

  // Stable ref to track previous linked IDs so we only re-fetch when they change
  const prevLinkedRef = useRef('');
  useEffect(() => {
    if (!lead) return;
    const key = JSON.stringify({
      sistemaId: lead.sistemaId,
      moduloId: lead.moduloId,
      presupuestosIds: lead.presupuestosIds,
      otIds: lead.otIds,
      otsRelacionadas: lead.otsRelacionadas,
    });
    if (key === prevLinkedRef.current) return;
    prevLinkedRef.current = key;
    loadLinkedEntities(lead);
  }, [lead, loadLinkedEntities]);

  const handleFieldUpdate = async (field: string, value: any) => {
    if (!lead) return;
    // Registrar posta al cambiar próximo contacto
    if (field === 'proximoContacto' && usuario && value !== lead.proximoContacto) {
      const fechaLabel = value
        ? new Date(value + 'T12:00:00').toLocaleDateString('es-AR')
        : 'sin definir';
      const posta: Posta = {
        id: crypto.randomUUID(),
        fecha: new Date().toISOString(),
        deUsuarioId: usuario.id,
        deUsuarioNombre: usuario.displayName,
        aUsuarioId: lead.asignadoA || usuario.id,
        aUsuarioNombre: usuarios.find(u => u.id === (lead.asignadoA || usuario.id))?.displayName || usuario.displayName,
        comentario: `Próximo contacto cambiado a ${fechaLabel}`,
        estadoAnterior: lead.estado,
        estadoNuevo: lead.estado,
      };
      leadsService.agregarComentario(lead.id, posta).catch(err => console.error('Error registrando cambio:', err));
    }
    leadsService.update(lead.id, { [field]: value }).catch(err => console.error('Error updating field:', err));
  };


  const handleCrearPresupuesto = () => {
    if (!lead) return;
    setShowCrearPresupuesto(true);
  };

  const handleCrearOT = () => {
    if (!lead) return;
    const params = new URLSearchParams();
    if (lead.clienteId) params.set('cliente', lead.clienteId);
    if (lead.sistemaId) params.set('sistema', lead.sistemaId);
    if (lead.moduloId) params.set('modulo', lead.moduloId);
    if (lead.contacto) params.set('contactoNombre', lead.contacto);
    if (lead.email) params.set('email', lead.email);
    params.set('leadId', lead.id);
    navigate(`/ordenes-trabajo/nuevo?${params.toString()}`);
  };

  const handleCompletarAccion = async () => {
    if (!lead || !usuario || !lead.accionPendiente) return;
    const posta: Posta = {
      id: crypto.randomUUID(),
      fecha: new Date().toISOString(),
      deUsuarioId: usuario.id,
      deUsuarioNombre: usuario.displayName,
      aUsuarioId: lead.asignadoA || usuario.id,
      aUsuarioNombre: usuarios.find(u => u.id === (lead.asignadoA || usuario.id))?.displayName || usuario.displayName,
      comentario: `Acción completada: ${lead.accionPendiente}`,
      estadoAnterior: lead.estado,
      estadoNuevo: lead.estado,
    };
    await leadsService.completarAccion(lead.id, posta);
  };

  const handleAgregarComentario = async () => {
    if (!lead || !usuario || !comentario.trim()) return;
    setEnviandoComentario(true);
    try {
      await leadsService.agregarComentario(lead.id, {
        id: crypto.randomUUID(),
        fecha: new Date().toISOString(),
        deUsuarioId: usuario.id,
        deUsuarioNombre: usuario.displayName,
        aUsuarioId: lead.asignadoA || usuario.id,
        aUsuarioNombre: usuarios.find(u => u.id === (lead.asignadoA || usuario.id))?.displayName || usuario.displayName,
        comentario: comentario.trim(),
        estadoAnterior: lead.estado,
        estadoNuevo: lead.estado,
      });
      setComentario('');
    } catch {
      alert('Error al agregar observación');
    } finally {
      setEnviandoComentario(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando ticket...</p></div>;
  if (!lead) return null;

  const isActive = lead.estado !== 'finalizado' && lead.estado !== 'no_concretado';

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="shrink-0 bg-white border-b border-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.06)] z-10 px-5 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => goBack()} className="text-slate-400 hover:text-slate-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <div>
              {lead.numero && (
                <span className="block text-[11px] font-mono text-slate-500 leading-tight">{lead.numero}</span>
              )}
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-900 tracking-tight">{lead.razonSocial}</h2>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${getSimplifiedEstadoColor(lead.estado)}`}>
                  {getSimplifiedEstadoLabel(lead.estado)}
                </span>
              </div>
              <p className="text-xs text-slate-400">{lead.contacto}{lead.email ? ` · ${lead.email}` : ''}</p>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            {isActive && (
              <>
                <Button size="sm" variant="outline" onClick={() => setShowDerivar(true)}>Derivar</Button>
                <Button size="sm" variant="outline" onClick={handleCrearPresupuesto}>Crear Presupuesto</Button>
                <Button size="sm" variant="outline" onClick={handleCrearOT}>Crear OT</Button>
                <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => setShowFinalizar(true)}>Finalizar</Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="flex gap-5">
          <div className="w-72 shrink-0">
            <LeadSidebar lead={lead} usuarios={usuarios} onFieldUpdate={handleFieldUpdate} moduloNombre={moduloNombre} />
          </div>

          <div className="flex-1 min-w-0 space-y-3">
            {/* Cliente (con contactos embebidos) + Descripción */}
            <div className="flex gap-3 items-start">
              <Card className="flex-1">
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="text-[11px] font-medium text-slate-400 mb-1">Cliente</h3>
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-slate-800">{lead.razonSocial}</span>
                      {lead.clienteId && (
                        <Link to={`/clientes/${lead.clienteId}`} state={{ from: pathname }} className="text-[11px] text-teal-600 hover:text-teal-800 font-medium shrink-0">
                          Ver cliente →
                        </Link>
                      )}
                    </div>
                  </div>
                  <ContactosTicketSection
                    inline
                    contactos={lead.contactos || []}
                    clienteId={lead.clienteId}
                    readOnly={!isActive}
                    onChange={(contactos: ContactoTicket[]) => handleFieldUpdate('contactos', contactos)}
                  />
                </div>
              </Card>
              {(lead.motivoContacto || lead.descripcion) && (
                <Card className="flex-1">
                  <div className="p-4">
                    <h3 className="text-[11px] font-medium text-slate-400 mb-1">Descripción</h3>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap">{lead.descripcion || lead.motivoContacto}</p>
                  </div>
                </Card>
              )}
            </div>

            {/* Acción pendiente banner */}
            {lead.accionPendiente && isActive && (
              <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-amber-600 mb-0.5">Acción pendiente</p>
                  <p className="text-xs text-amber-800 font-medium">{lead.accionPendiente}</p>
                </div>
                <Button size="sm" onClick={handleCompletarAccion}>Completar</Button>
              </div>
            )}

            {/* Agregar observación */}
            {isActive && (
              <Card>
                <div className="p-4">
                  <h3 className="text-[11px] font-medium text-slate-400 mb-2">Agregar observación</h3>
                  <div className="flex gap-2">
                    <textarea value={comentario} onChange={e => setComentario(e.target.value)}
                      rows={1} placeholder="Ej: Se envió mail al cliente, a la espera de respuesta..."
                      className="flex-1 text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAgregarComentario(); } }} />
                    <Button size="sm" onClick={handleAgregarComentario} disabled={!comentario.trim() || enviandoComentario}>
                      {enviandoComentario ? '...' : 'Agregar'}
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {/* Historial */}
            <Card>
              <div className="p-4">
                <h3 className="text-[11px] font-medium text-slate-400 mb-3">Historial</h3>
                <LeadTimeline postas={lead.postas} />
              </div>
            </Card>

            {/* Adjuntos */}
            <LeadAdjuntosSection
              leadId={lead.id}
              adjuntos={lead.adjuntos || []}
              onUpdated={() => {/* subscription auto-refreshes */}}
              readOnly={!isActive}
            />

            {/* Pendientes generados */}
            <TicketPendientesChips ticketId={lead.id} />

            {/* Entidades vinculadas */}
            {(linkedPresupuestos.length > 0 || linkedOTs.length > 0 || otsRelacionadas.length > 0) && (
              <Card>
                <div className="p-4">
                  <h3 className="text-[11px] font-medium text-slate-400 mb-3">Entidades vinculadas</h3>
                  <div className="space-y-2">
                    {linkedPresupuestos.map(p => (
                      <div key={p.id} className={`flex items-center gap-2 ${p.estado === 'anulado' ? 'opacity-50' : ''}`}>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">Presupuesto</span>
                        <Link to={`/presupuestos/${p.id}`} state={{ from: pathname }}
                          className={`text-xs font-medium ${p.estado === 'anulado' ? 'text-slate-400 line-through' : 'text-teal-600 hover:text-teal-800'}`}>
                          {p.numero}
                        </Link>
                        {p.estado === 'anulado' && <span className="text-[9px] text-slate-400">Anulado</span>}
                      </div>
                    ))}
                    {linkedOTs.map(ot => (
                      <div key={ot.otNumber} className="flex items-center gap-2">
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">OT</span>
                        <Link to={`/ordenes-trabajo/${ot.otNumber}`} state={{ from: pathname }} className="text-xs text-teal-600 hover:text-teal-800 font-medium">{ot.otNumber}</Link>
                      </div>
                    ))}
                    {otsRelacionadas.map(ot => (
                      <div key={`rel-${ot.otNumber}`} className="flex items-center gap-2" title="OT preexistente que motivó este ticket de seguimiento">
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">OT relacionada</span>
                        <Link to={`/ordenes-trabajo/${ot.otNumber}`} state={{ from: pathname }} className="text-xs text-slate-600 hover:text-teal-700 font-medium">{ot.otNumber}</Link>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {showDerivar && <DerivarLeadModal lead={lead} onClose={() => setShowDerivar(false)} onDerived={() => { setShowDerivar(false); }} />}
      {showFinalizar && <FinalizarLeadModal lead={lead} onClose={() => setShowFinalizar(false)} onFinalized={() => { setShowFinalizar(false); navigate('/leads'); }} />}
      <CreatePresupuestoModal
        open={showCrearPresupuesto}
        onClose={() => setShowCrearPresupuesto(false)}
        onCreated={() => { setShowCrearPresupuesto(false); }}
        prefill={{
          clienteId: lead.clienteId || undefined,
          sistemaId: lead.sistemaId || undefined,
          moduloId: lead.moduloId || undefined,
          contactoNombre: lead.contacto || undefined,
          origenTipo: 'lead',
          origenId: lead.id,
          origenRef: lead.razonSocial,
        }}
      />
    </div>
  );
};
