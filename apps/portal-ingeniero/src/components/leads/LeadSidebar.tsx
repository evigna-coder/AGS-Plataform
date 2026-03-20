import { useState, useEffect } from 'react';
import type { Lead, LeadEstado } from '@ags/shared';
import { LEAD_ESTADO_LABELS, LEAD_AREA_LABELS, LEAD_AREA_COLORS, MOTIVO_LLAMADO_LABELS, MOTIVO_LLAMADO_COLORS, LEAD_PRIORIDAD_LABELS, LEAD_PRIORIDAD_COLORS } from '@ags/shared';
import { Card } from '../ui/Card';
import { getDaysOpen, getDaysSinceLastActivity, getDaysUntilContacto, getAgeBadgeColor, getContactoStatusColor, getContactoStatusText } from '../../utils/leadHelpers';

interface LeadSidebarProps {
  lead: Lead;
  usuarios: { id: string; displayName: string }[];
  onEstadoChange: (estado: LeadEstado) => void;
  onFieldUpdate?: (field: string, value: any) => void;
}

export const LeadSidebar = ({ lead, usuarios, onEstadoChange, onFieldUpdate }: LeadSidebarProps) => {
  const responsable = usuarios.find(u => u.id === lead.asignadoA);
  const isActive = lead.estado !== 'finalizado' && lead.estado !== 'no_concretado';
  const daysOpen = getDaysOpen(lead.createdAt);
  const daysSinceActivity = getDaysSinceLastActivity(lead.postas);
  const daysUntilContacto = getDaysUntilContacto(lead.proximoContacto);

  const [localFechaContacto, setLocalFechaContacto] = useState(lead.proximoContacto || '');
  useEffect(() => { setLocalFechaContacto(lead.proximoContacto || ''); }, [lead.proximoContacto]);

  return (
    <div className="space-y-3">
      <Card>
        <div className="p-4 space-y-3">
          <InfoRow label="Estado">
            <select value={lead.estado} onChange={e => onEstadoChange(e.target.value as LeadEstado)}
              className="text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {Object.entries(LEAD_ESTADO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </InfoRow>
          <InfoRow label="Prioridad">
            <select value={lead.prioridad || ''} onChange={e => onFieldUpdate?.('prioridad', e.target.value || null)}
              className="text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Sin definir</option>
              {Object.entries(LEAD_PRIORIDAD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            {lead.prioridad && (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-1 inline-block ${LEAD_PRIORIDAD_COLORS[lead.prioridad]}`}>
                {LEAD_PRIORIDAD_LABELS[lead.prioridad]}
              </span>
            )}
          </InfoRow>
          <InfoRow label="Motivo">
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${MOTIVO_LLAMADO_COLORS[lead.motivoLlamado]}`}>
              {MOTIVO_LLAMADO_LABELS[lead.motivoLlamado]}
            </span>
          </InfoRow>
          <InfoRow label="Responsable">
            <span className="text-xs font-medium text-slate-700">{responsable?.displayName || 'Sin asignar'}</span>
          </InfoRow>
          {lead.areaActual && (
            <InfoRow label="Área">
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${LEAD_AREA_COLORS[lead.areaActual]}`}>
                {LEAD_AREA_LABELS[lead.areaActual]}
              </span>
            </InfoRow>
          )}
          <InfoRow label="Próximo contacto">
            <input type="date" value={localFechaContacto}
              onChange={e => setLocalFechaContacto(e.target.value)}
              onBlur={() => { const v = localFechaContacto || null; if (v !== (lead.proximoContacto || null)) onFieldUpdate?.('proximoContacto', v); }}
              className="text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            {daysUntilContacto !== null && (
              <span className={`text-[10px] font-medium mt-0.5 block ${getContactoStatusColor(daysUntilContacto)}`}>
                {getContactoStatusText(daysUntilContacto)}
              </span>
            )}
          </InfoRow>
          {isActive && (
            <InfoRow label="Días abierto">
              <span className={`text-xs font-medium ${getAgeBadgeColor(daysOpen)}`}>{daysOpen}d</span>
            </InfoRow>
          )}
          {daysSinceActivity !== null && (
            <InfoRow label="Última actividad">
              <span className="text-xs text-slate-600">hace {daysSinceActivity}d</span>
            </InfoRow>
          )}
          <InfoRow label="Creado">
            <span className="text-xs text-slate-600">{new Date(lead.createdAt).toLocaleDateString('es-AR')}</span>
          </InfoRow>
          {lead.finalizadoAt && (
            <InfoRow label="Finalizado">
              <span className="text-xs text-emerald-600">{new Date(lead.finalizadoAt).toLocaleDateString('es-AR')}</span>
            </InfoRow>
          )}
        </div>
      </Card>
    </div>
  );
};

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-slate-400 mb-0.5">{label}</p>
      {children}
    </div>
  );
}
