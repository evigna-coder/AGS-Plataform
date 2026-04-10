import { Link } from 'react-router-dom';
import type { Lead } from '@ags/shared';
import { getSimplifiedEstadoLabel, getSimplifiedEstadoColor, LEAD_AREA_LABELS, LEAD_AREA_COLORS, MOTIVO_LLAMADO_LABELS, MOTIVO_LLAMADO_COLORS } from '@ags/shared';

interface Props {
  lead: Lead;
}

export default function LeadCard({ lead }: Props) {
  const estadoColor = getSimplifiedEstadoColor(lead.estado);
  const motivoColor = MOTIVO_LLAMADO_COLORS[lead.motivoLlamado] ?? 'bg-slate-100 text-slate-600';
  const fecha = lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) : '';

  return (
    <Link
      to={`/leads/${lead.id}`}
      className="block bg-white rounded-xl border border-slate-200 p-3 space-y-1.5 active:bg-slate-50 transition-colors"
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${motivoColor}`}>
          {MOTIVO_LLAMADO_LABELS[lead.motivoLlamado] ?? lead.motivoLlamado}
        </span>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${estadoColor}`}>
          {getSimplifiedEstadoLabel(lead.estado)}
        </span>
        {lead.areaActual && (
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${LEAD_AREA_COLORS[lead.areaActual]}`}>
            {LEAD_AREA_LABELS[lead.areaActual]}
          </span>
        )}
        <span className="text-[10px] text-slate-400 ml-auto">{fecha}</span>
      </div>
      <p className="text-xs font-semibold text-slate-800 truncate">{lead.razonSocial}</p>
      {(lead.contacto || lead.motivoContacto) && (
        <p className="text-[11px] text-slate-500 truncate">
          {lead.contacto}{lead.motivoContacto ? ` · ${lead.motivoContacto}` : ''}
        </p>
      )}
    </Link>
  );
}
