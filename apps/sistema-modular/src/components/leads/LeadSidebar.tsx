import { Link } from 'react-router-dom';
import type { Lead, LeadEstado, UsuarioAGS } from '@ags/shared';
import { LEAD_ESTADO_LABELS, LEAD_AREA_LABELS, LEAD_AREA_COLORS, MOTIVO_LLAMADO_LABELS, MOTIVO_LLAMADO_COLORS } from '@ags/shared';
import { Card } from '../ui/Card';

interface LeadSidebarProps {
  lead: Lead;
  usuarios: UsuarioAGS[];
  onEstadoChange: (estado: LeadEstado) => void;
  moduloNombre?: string | null;
}

export const LeadSidebar = ({ lead, usuarios, onEstadoChange, moduloNombre }: LeadSidebarProps) => {
  const responsable = usuarios.find(u => u.id === lead.asignadoA);

  return (
    <div className="space-y-3">
      {/* Estado */}
      <Card>
        <div className="p-4 space-y-3">
          <InfoRow label="Estado">
            <select value={lead.estado} onChange={e => onEstadoChange(e.target.value as LeadEstado)}
              className="text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {Object.entries(LEAD_ESTADO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
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

      {/* Contacto */}
      <Card>
        <div className="p-4 space-y-2">
          <h3 className="text-[11px] font-medium text-slate-400 mb-2">Contacto</h3>
          <InfoRow label="Razón Social">
            <span className="text-xs font-medium text-slate-700">{lead.razonSocial}</span>
          </InfoRow>
          <InfoRow label="Persona">
            <span className="text-xs text-slate-700">{lead.contacto}</span>
          </InfoRow>
          {lead.email && (
            <InfoRow label="Email">
              <a href={`mailto:${lead.email}`} className="text-xs text-indigo-600 hover:text-indigo-800">{lead.email}</a>
            </InfoRow>
          )}
          {lead.telefono && (
            <InfoRow label="Teléfono">
              <span className="text-xs text-slate-700">{lead.telefono}</span>
            </InfoRow>
          )}
          {lead.clienteId && (
            <div className="pt-2 border-t border-slate-100">
              <Link to={`/clientes/${lead.clienteId}`} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                Ver cliente →
              </Link>
            </div>
          )}
        </div>
      </Card>

      {/* Descripción */}
      {(lead.motivoContacto || lead.descripcion) && (
        <Card>
          <div className="p-4">
            <h3 className="text-[11px] font-medium text-slate-400 mb-1">Descripción</h3>
            <p className="text-xs text-slate-700 whitespace-pre-wrap">{lead.descripcion || lead.motivoContacto}</p>
          </div>
        </Card>
      )}

      {/* Sistema / Módulo */}
      {lead.sistemaId && (
        <Card>
          <div className="p-4 space-y-2">
            <div>
              <h3 className="text-[11px] font-medium text-slate-400 mb-1">Sistema/Equipo</h3>
              <Link to={`/equipos/${lead.sistemaId}`} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
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
