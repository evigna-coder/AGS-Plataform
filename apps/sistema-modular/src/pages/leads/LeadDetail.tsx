import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import type { Lead, LeadEstado, UsuarioAGS, Posta } from '@ags/shared';
import { LEAD_ESTADO_LABELS, LEAD_ESTADO_COLORS } from '@ags/shared';
import { leadsService, usuariosService, presupuestosService, ordenesTrabajoService, modulosService } from '../../services/firebaseService';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { LeadSidebar } from '../../components/leads/LeadSidebar';
import { LeadTimeline } from '../../components/leads/LeadTimeline';
import { DerivarLeadModal } from '../../components/leads/DerivarLeadModal';
import { FinalizarLeadModal } from '../../components/leads/FinalizarLeadModal';
import { LeadAdjuntosSection } from '../../components/leads/LeadAdjuntosSection';
import { CreatePresupuestoModal } from '../../components/presupuestos/CreatePresupuestoModal';
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

  // Entidades vinculadas
  const [linkedPresupuestos, setLinkedPresupuestos] = useState<{ id: string; numero: string; estado: string }[]>([]);
  const [linkedOTs, setLinkedOTs] = useState<{ otNumber: string }[]>([]);

  const load = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) setLoading(true);
    try {
      const [data, usrs] = await Promise.all([
        leadsService.getById(id),
        usuariosService.getAll(),
      ]);
      if (!data) {
        alert('Lead no encontrado');
        navigate('/leads');
        return;
      }
      setLead(data);
      setUsuarios(usrs);

      // Cargar módulo nombre
      if (data.sistemaId && data.moduloId) {
        const mod = await modulosService.getById(data.sistemaId, data.moduloId);
        setModuloNombre(mod?.nombre || null);
      } else {
        setModuloNombre(null);
      }

      // Cargar entidades vinculadas
      const presups: { id: string; numero: string; estado: string }[] = [];
      for (const pId of data.presupuestosIds || []) {
        const p = await presupuestosService.getById(pId);
        if (p) presups.push({ id: p.id, numero: p.numero, estado: p.estado });
      }
      setLinkedPresupuestos(presups);

      const ots: { otNumber: string }[] = [];
      for (const otNum of data.otIds || []) {
        const ot = await ordenesTrabajoService.getByOtNumber(otNum);
        if (ot) ots.push({ otNumber: ot.otNumber });
      }
      setLinkedOTs(ots);
    } catch (err) {
      console.error('Error al cargar lead:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleEstadoChange = async (estado: LeadEstado) => {
    if (!lead) return;
    await leadsService.update(lead.id, { estado });
    setLead(prev => prev ? { ...prev, estado } : prev);
  };

  const handleFieldUpdate = async (field: string, value: any) => {
    if (!lead) return;
    await leadsService.update(lead.id, { [field]: value });
    setLead(prev => prev ? { ...prev, [field]: value } : prev);
  };

  const handleDelete = async () => {
    if (!lead || !confirm('Eliminar este lead?')) return;
    await leadsService.delete(lead.id);
    navigate('/leads');
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
    await load(true);
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
      await load(true);
    } catch {
      alert('Error al agregar observación');
    } finally {
      setEnviandoComentario(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando lead...</p></div>;
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
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-900 tracking-tight">{lead.razonSocial}</h2>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${LEAD_ESTADO_COLORS[lead.estado]}`}>
                  {LEAD_ESTADO_LABELS[lead.estado]}
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
            <Button size="sm" variant="ghost" onClick={handleDelete}>Eliminar</Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="flex gap-5">
          <div className="w-72 shrink-0">
            <LeadSidebar lead={lead} usuarios={usuarios} onEstadoChange={handleEstadoChange} onFieldUpdate={handleFieldUpdate} moduloNombre={moduloNombre} />
          </div>

          <div className="flex-1 min-w-0 space-y-3">
            {/* Contacto + Descripción arriba de todo */}
            <div className="flex gap-3">
              <Card className="flex-1">
                <div className="p-4 space-y-2">
                  <h3 className="text-[11px] font-medium text-slate-400 mb-2">Contacto</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-slate-800">{lead.razonSocial}</span>
                    {lead.clienteId && (
                      <Link to={`/clientes/${lead.clienteId}`} state={{ from: pathname }} className="text-[11px] text-teal-600 hover:text-teal-800 font-medium shrink-0">
                        Ver cliente →
                      </Link>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                    {lead.contacto && <span>{lead.contacto}</span>}
                    {lead.email && <a href={`mailto:${lead.email}`} className="text-teal-600 hover:text-teal-800">{lead.email}</a>}
                    {lead.telefono && <span>{lead.telefono}</span>}
                  </div>
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

            {/* Adjuntos */}
            <LeadAdjuntosSection
              leadId={lead.id}
              adjuntos={lead.adjuntos || []}
              onUpdated={load}
              readOnly={!isActive}
            />

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

            {/* Timeline */}
            <Card>
              <div className="p-4">
                <h3 className="text-[11px] font-medium text-slate-400 mb-3">Historial</h3>
                <LeadTimeline postas={lead.postas} />
              </div>
            </Card>

            {/* Entidades vinculadas */}
            {(linkedPresupuestos.length > 0 || linkedOTs.length > 0) && (
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
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {showDerivar && <DerivarLeadModal lead={lead} onClose={() => setShowDerivar(false)} onDerived={() => { setShowDerivar(false); load(true); }} />}
      {showFinalizar && <FinalizarLeadModal lead={lead} onClose={() => setShowFinalizar(false)} onFinalized={() => { setShowFinalizar(false); load(true); }} />}
      <CreatePresupuestoModal
        open={showCrearPresupuesto}
        onClose={() => setShowCrearPresupuesto(false)}
        onCreated={() => { setShowCrearPresupuesto(false); load(true); }}
        prefill={{
          clienteId: lead.clienteId || undefined,
          sistemaId: lead.sistemaId || undefined,
          origenTipo: 'lead',
          origenId: lead.id,
          origenRef: lead.razonSocial,
        }}
      />
    </div>
  );
};
