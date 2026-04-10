import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import type { Lead, Posta } from '@ags/shared';
import { getSimplifiedEstadoLabel, getSimplifiedEstadoColor } from '@ags/shared';
import { leadsService, usuariosService } from '../services/firebaseService';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { LeadSidebar } from '../components/leads/LeadSidebar';
import LeadTimeline from '../components/leads/LeadTimeline';
import LeadAdjuntosSection from '../components/leads/LeadAdjuntosSection';
import DerivarLeadModal from '../components/leads/DerivarLeadModal';
import FinalizarLeadModal from '../components/leads/FinalizarLeadModal';

export default function LeadDetailPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [usuarios, setUsuarios] = useState<{ id: string; displayName: string }[]>([]);
  const [showDerivar, setShowDerivar] = useState(false);
  const [showFinalizar, setShowFinalizar] = useState(false);
  const [comentario, setComentario] = useState('');
  const [enviandoComentario, setEnviandoComentario] = useState(false);

  // Escape key → back to grid
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showDerivar && !showFinalizar) {
        navigate('/leads');
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [navigate, showDerivar, showFinalizar]);

  // Entidades vinculadas (read-only)
  const [linkedOTs, setLinkedOTs] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    try {
      const [data, usrs] = await Promise.all([
        leadsService.getById(leadId),
        usuariosService.getIngenieros(),
      ]);
      if (!data) {
        alert('Lead no encontrado');
        navigate('/leads');
        return;
      }
      setLead(data);
      setUsuarios(usrs);
      setLinkedOTs(data.otIds || []);
    } catch (err) {
      console.error('Error al cargar lead:', err);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => { load(); }, [load]);

  const handleFieldUpdate = async (field: string, value: any) => {
    if (!lead) return;
    setLead(prev => prev ? { ...prev, [field]: value } : prev);
    leadsService.update(lead.id, { [field]: value }).catch(err => console.error('Error updating field:', err));
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
    setLead(prev => prev ? { ...prev, accionPendiente: null, postas: [...(prev.postas || []), posta] } : prev);
  };

  const handleAgregarComentario = async () => {
    if (!lead || !usuario || !comentario.trim()) return;
    setEnviandoComentario(true);
    try {
      const newPosta: Posta = {
        id: crypto.randomUUID(),
        fecha: new Date().toISOString(),
        deUsuarioId: usuario.id,
        deUsuarioNombre: usuario.displayName,
        aUsuarioId: lead.asignadoA || usuario.id,
        aUsuarioNombre: usuarios.find(u => u.id === (lead.asignadoA || usuario.id))?.displayName || usuario.displayName,
        comentario: comentario.trim(),
        estadoAnterior: lead.estado,
        estadoNuevo: lead.estado,
      };
      await leadsService.agregarComentario(lead.id, newPosta);
      setComentario('');
      setLead(prev => prev ? { ...prev, postas: [...(prev.postas || []), newPosta] } : prev);
    } catch {
      alert('Error al agregar observación');
    } finally {
      setEnviandoComentario(false);
    }
  };

  const [mobileTab, setMobileTab] = useState<'info' | 'historial' | 'adjuntos'>('info');

  if (loading) return <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando lead...</p></div>;
  if (!lead) return null;

  const isActive = lead.estado !== 'finalizado' && lead.estado !== 'no_concretado';

  const MOBILE_TABS = [
    { key: 'info' as const, label: 'Info' },
    { key: 'historial' as const, label: 'Historial' },
    { key: 'adjuntos' as const, label: 'Adjuntos' },
  ];

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.06)] z-10 px-3 md:px-5 pt-3 md:pt-4 pb-2 md:pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <button onClick={() => navigate('/leads')} className="text-slate-400 hover:text-slate-600 shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm md:text-lg font-semibold text-slate-900 tracking-tight truncate">{lead.razonSocial}</h2>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${getSimplifiedEstadoColor(lead.estado)}`}>
                  {getSimplifiedEstadoLabel(lead.estado)}
                </span>
              </div>
              <p className="text-[11px] md:text-xs text-slate-400 truncate">{lead.contacto}{lead.email ? ` · ${lead.email}` : ''}</p>
            </div>
          </div>
          <div className="flex gap-1.5 md:gap-2 items-center shrink-0">
            {isActive && (
              <>
                <Button size="sm" variant="outline" onClick={() => setShowDerivar(true)}>Derivar</Button>
                <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 hidden md:inline-flex" onClick={() => setShowFinalizar(true)}>Finalizar</Button>
              </>
            )}
          </div>
        </div>

        {/* Mobile tabs */}
        <div className="flex gap-1 mt-2 md:hidden">
          {MOBILE_TABS.map(t => (
            <button key={t.key} onClick={() => setMobileTab(t.key)}
              className={`flex-1 py-1.5 text-[11px] font-medium rounded-lg transition-colors ${
                mobileTab === t.key ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── MOBILE LAYOUT ─── */}
      <div className="flex-1 overflow-y-auto md:hidden px-3 py-3 space-y-3">
        {mobileTab === 'info' && (
          <>
            <LeadSidebar lead={lead} usuarios={usuarios} onFieldUpdate={handleFieldUpdate} />
            {/* Contacto */}
            <Card>
              <div className="p-3 space-y-1">
                <h3 className="text-[11px] font-medium text-slate-400">Contacto</h3>
                <p className="text-sm font-semibold text-slate-800">{lead.razonSocial}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-600">
                  {lead.contacto && <span>{lead.contacto}</span>}
                  {lead.email && <a href={`mailto:${lead.email}`} className="text-teal-600">{lead.email}</a>}
                  {lead.telefono && <span>{lead.telefono}</span>}
                </div>
              </div>
            </Card>
            {lead.descripcion && (
              <Card><div className="p-3"><h3 className="text-[11px] font-medium text-slate-400 mb-1">Descripción</h3><p className="text-xs text-slate-700 whitespace-pre-wrap">{lead.descripcion}</p></div></Card>
            )}
            {lead.accionPendiente && isActive && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-amber-600">Acción pendiente</p>
                  <p className="text-xs text-amber-800 font-medium">{lead.accionPendiente}</p>
                </div>
                <Button size="sm" onClick={handleCompletarAccion}>OK</Button>
              </div>
            )}
            {isActive && (
              <Button size="sm" variant="ghost" className="w-full text-red-500 md:hidden" onClick={() => setShowFinalizar(true)}>Finalizar ticket</Button>
            )}
          </>
        )}
        {mobileTab === 'historial' && (
          <>
            {isActive && (
              <div className="flex gap-2">
                <textarea value={comentario} onChange={e => setComentario(e.target.value)}
                  rows={2} placeholder="Agregar observación..."
                  className="flex-1 text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
                <Button size="sm" onClick={handleAgregarComentario} disabled={!comentario.trim() || enviandoComentario}>
                  {enviandoComentario ? '...' : 'Enviar'}
                </Button>
              </div>
            )}
            <Card><div className="p-3"><LeadTimeline postas={lead.postas} /></div></Card>
          </>
        )}
        {mobileTab === 'adjuntos' && (
          <LeadAdjuntosSection leadId={lead.id} adjuntos={lead.adjuntos || []} onUpdated={load} readOnly={!isActive} />
        )}
      </div>

      {/* ─── DESKTOP LAYOUT ─── */}
      <div className="flex-1 overflow-y-auto hidden md:block px-5 py-4">
        <div className="flex gap-5">
          <div className="w-72 shrink-0">
            <LeadSidebar lead={lead} usuarios={usuarios} onFieldUpdate={handleFieldUpdate} />
          </div>

          <div className="flex-1 min-w-0 space-y-3">
            {/* Contacto + Descripción */}
            <div className="flex gap-3">
              <Card className="flex-1">
                <div className="p-4 space-y-2">
                  <h3 className="text-[11px] font-medium text-slate-400 mb-2">Contacto</h3>
                  <span className="text-sm font-semibold text-slate-800">{lead.razonSocial}</span>
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

            {/* Adjuntos */}
            <LeadAdjuntosSection
              leadId={lead.id}
              adjuntos={lead.adjuntos || []}
              onUpdated={load}
              readOnly={!isActive}
            />

            {/* Entidades vinculadas (read-only) */}
            {linkedOTs.length > 0 && (
              <Card>
                <div className="p-4">
                  <h3 className="text-[11px] font-medium text-slate-400 mb-3">OTs vinculadas</h3>
                  <div className="space-y-2">
                    {linkedOTs.map(otNum => (
                      <div key={otNum} className="flex items-center gap-2">
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">OT</span>
                        <Link to={`/ordenes-trabajo/${otNum}`} className="text-xs text-teal-600 hover:text-teal-800 font-medium">{otNum}</Link>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}

            {/* Presupuestos vinculados (read-only, sin link) */}
            {(lead.presupuestosIds?.length ?? 0) > 0 && (
              <Card>
                <div className="p-4">
                  <h3 className="text-[11px] font-medium text-slate-400 mb-3">Presupuestos vinculados</h3>
                  <div className="space-y-2">
                    {lead.presupuestosIds!.map(pId => (
                      <div key={pId} className="flex items-center gap-2">
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">Presupuesto</span>
                        <span className="text-xs text-slate-600">{pId}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {showDerivar && <DerivarLeadModal lead={lead} onClose={() => setShowDerivar(false)} onSuccess={() => { setShowDerivar(false); load(); }} />}
      {showFinalizar && <FinalizarLeadModal lead={lead} onClose={() => setShowFinalizar(false)} onSuccess={() => { setShowFinalizar(false); navigate('/leads'); }} />}
    </div>
  );
}
