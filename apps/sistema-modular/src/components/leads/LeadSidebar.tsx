import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { Lead, LeadEstado, UsuarioAGS } from '@ags/shared';
import { LEAD_ESTADO_LABELS, LEAD_AREA_LABELS, LEAD_AREA_COLORS, MOTIVO_LLAMADO_LABELS, MOTIVO_LLAMADO_COLORS, TICKET_PRIORIDAD_LABELS, TICKET_PRIORIDAD_COLORS, TICKET_PRIORIDAD_DIAS } from '@ags/shared';
import type { TicketPrioridad } from '@ags/shared';
import { Card } from '../ui/Card';
import { getDaysOpen, getDaysSinceLastActivity, getDaysUntilContacto, getAgeBadgeColor, getContactoStatusColor, getContactoStatusText } from '../../utils/leadHelpers';

interface LeadSidebarProps {
  lead: Lead;
  usuarios: UsuarioAGS[];
  onEstadoChange: (estado: LeadEstado) => void;
  onFieldUpdate?: (field: string, value: any) => void;
  moduloNombre?: string | null;
}

export const LeadSidebar = ({ lead, usuarios, onEstadoChange, onFieldUpdate, moduloNombre }: LeadSidebarProps) => {
  const { pathname } = useLocation();
  const responsable = usuarios.find(u => u.id === lead.asignadoA);
  const isActive = lead.estado !== 'finalizado' && lead.estado !== 'no_concretado';
  const daysOpen = getDaysOpen(lead.createdAt);
  const daysSinceActivity = getDaysSinceLastActivity(lead.postas);
  const daysUntilContacto = getDaysUntilContacto(lead.proximoContacto);

  // Local state for date input to avoid reload closing the picker
  const [localFechaContacto, setLocalFechaContacto] = useState(lead.proximoContacto || '');
  useEffect(() => { setLocalFechaContacto(lead.proximoContacto || ''); }, [lead.proximoContacto]);

  return (
    <div className="space-y-3">
      {/* Estado */}
      <Card>
        <div className="p-4 space-y-3">
          <InfoRow label="Estado">
            <select value={lead.estado} onChange={e => onEstadoChange(e.target.value as LeadEstado)}
              className="text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500">
              {Object.entries(LEAD_ESTADO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </InfoRow>
          <InfoRow label="Próximo contacto">
            <select value={lead.prioridad || ''} onChange={e => {
              const p = e.target.value as TicketPrioridad | '';
              if (!p) { onFieldUpdate?.('prioridad', null); return; }
              const dias = TICKET_PRIORIDAD_DIAS[p];
              const d = new Date(); d.setDate(d.getDate() + dias);
              onFieldUpdate?.('prioridad', p);
              onFieldUpdate?.('proximoContacto', d.toISOString().split('T')[0]);
            }}
              className="text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="">Sin definir</option>
              {Object.entries(TICKET_PRIORIDAD_DIAS).map(([k, dias]) => (
                <option key={k} value={k}>{dias <= 4 ? `${(dias as number) * 24} hs` : `${dias} días`} — {TICKET_PRIORIDAD_LABELS[k as TicketPrioridad]}</option>
              ))}
            </select>
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
            {lead.proximoContacto ? (
              <>
                <span className="text-xs text-slate-700">{new Date(lead.proximoContacto + 'T12:00:00').toLocaleDateString('es-AR')}</span>
                {daysUntilContacto !== null && (
                  <span className={`text-[10px] font-medium mt-0.5 block ${getContactoStatusColor(daysUntilContacto)}`}>
                    {getContactoStatusText(daysUntilContacto)}
                  </span>
                )}
              </>
            ) : (
              <span className="text-xs text-slate-400">Se define con la prioridad</span>
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


      {/* Sistema / Módulo */}
      {lead.sistemaId && (
        <Card>
          <div className="p-4 space-y-2">
            <div>
              <h3 className="text-[11px] font-medium text-slate-400 mb-1">Sistema/Equipo</h3>
              <Link to={`/equipos/${lead.sistemaId}`} state={{ from: pathname }} className="text-xs text-teal-600 hover:text-teal-800 font-medium">
                Ver equipo →
              </Link>
            </div>
            {lead.moduloId && moduloNombre && (
              <InfoRow label="Módulo">
                <span className="text-xs text-slate-700">{moduloNombre}</span>
              </InfoRow>
            )}
          </div>
        </Card>
      )}
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
