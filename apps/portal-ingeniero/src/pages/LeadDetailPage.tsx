import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import LeadTimeline from '../components/leads/LeadTimeline';
import DerivarLeadModal from '../components/leads/DerivarLeadModal';
import FinalizarLeadModal from '../components/leads/FinalizarLeadModal';
import { useLeadDetail } from '../hooks/useLeadDetail';
import { useAuth } from '../contexts/AuthContext';
import { LEAD_ESTADO_LABELS, LEAD_ESTADO_COLORS, LEAD_AREA_LABELS, LEAD_AREA_COLORS, MOTIVO_LLAMADO_LABELS, MOTIVO_LLAMADO_COLORS, canUserModifyLead } from '@ags/shared';
import type { Posta } from '@ags/shared';
import { leadsService } from '../services/firebaseService';

export default function LeadDetailPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const { lead, loading, refresh } = useLeadDetail(leadId!);
  const [showDerivar, setShowDerivar] = useState(false);
  const [showFinalizar, setShowFinalizar] = useState(false);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <p className="text-sm text-slate-500">Lead no encontrado</p>
        <Button variant="ghost" size="sm" onClick={() => navigate('/leads')}>Volver</Button>
      </div>
    );
  }

  const estadoColor = LEAD_ESTADO_COLORS[lead.estado] ?? 'bg-slate-100 text-slate-600';
  const motivoColor = MOTIVO_LLAMADO_COLORS[lead.motivoLlamado] ?? 'bg-slate-100 text-slate-600';
  const isClosed = lead.estado === 'finalizado' || lead.estado === 'no_concretado';
  const canModify = usuario ? canUserModifyLead(lead, usuario) : false;

  const handleCompletarAccion = async () => {
    if (!lead.accionPendiente || !usuario) return;
    const posta: Posta = {
      id: crypto.randomUUID(),
      fecha: new Date().toISOString(),
      deUsuarioId: usuario.id,
      deUsuarioNombre: usuario.displayName,
      aUsuarioId: usuario.id,
      aUsuarioNombre: usuario.displayName,
      comentario: `Acción completada: ${lead.accionPendiente}`,
      estadoAnterior: lead.estado,
      estadoNuevo: lead.estado,
    };
    await leadsService.completarAccion(lead.id, posta);
    refresh();
  };

  return (
    <div className="h-full flex flex-col">
      <PageHeader title={lead.razonSocial} subtitle="Detalle de Lead" actions={
        <button onClick={() => navigate('/leads')} className="text-xs text-indigo-600 font-medium hover:underline">
          &larr; Volver
        </button>
      } />

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
        {/* Status & Motivo */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${estadoColor}`}>
            {LEAD_ESTADO_LABELS[lead.estado] ?? lead.estado}
          </span>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${motivoColor}`}>
            {MOTIVO_LLAMADO_LABELS[lead.motivoLlamado] ?? lead.motivoLlamado}
          </span>
          {lead.areaActual && (
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${LEAD_AREA_COLORS[lead.areaActual]}`}>
              {LEAD_AREA_LABELS[lead.areaActual]}
            </span>
          )}
          {lead.createdAt && (
            <span className="text-[10px] text-slate-400 ml-auto">
              {new Date(lead.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          )}
        </div>

        {/* Info card */}
        <Card>
          <div className="p-3 space-y-2">
            <InfoRow label="Contacto" value={lead.contacto} />
            {lead.email && <InfoRow label="Email" value={lead.email} />}
            {lead.telefono && <InfoRow label="Teléfono" value={lead.telefono} />}
            {lead.motivoContacto && <InfoRow label="Motivo de contacto" value={lead.motivoContacto} />}
            {lead.descripcion && <InfoRow label="Descripción" value={lead.descripcion} />}
          </div>
        </Card>

        {/* Acción pendiente */}
        {lead.accionPendiente && !isClosed && canModify && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-[11px] font-medium text-amber-600 mb-0.5">Acción pendiente</p>
            <p className="text-xs text-amber-800 font-medium">{lead.accionPendiente}</p>
            <Button size="sm" className="mt-2" onClick={handleCompletarAccion}>Completar acción</Button>
          </div>
        )}

        {/* Actions */}
        {!isClosed && canModify && (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" className="flex-1" onClick={() => setShowDerivar(true)}>
              Derivar
            </Button>
            <Button variant="danger" size="sm" className="flex-1" onClick={() => setShowFinalizar(true)}>
              Finalizar
            </Button>
          </div>
        )}

        {/* Timeline */}
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Actividad</p>
          <Card>
            <div className="p-3">
              <LeadTimeline postas={lead.postas} />
            </div>
          </Card>
        </div>
      </div>

      {showDerivar && (
        <DerivarLeadModal lead={lead} onClose={() => setShowDerivar(false)} onSuccess={refresh} />
      )}
      {showFinalizar && (
        <FinalizarLeadModal lead={lead} onClose={() => setShowFinalizar(false)} onSuccess={refresh} />
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-slate-400">{label}</p>
      <p className="text-xs text-slate-700">{value}</p>
    </div>
  );
}
