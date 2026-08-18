import { OT_ESTADO_COLORS, OT_ESTADO_LABELS } from '@ags/shared';
import type { WorkOrder, OTEstadoAdmin } from '@ags/shared';

/** Resuelve el estado efectivo de la OT — preferimos estadoAdmin sobre status. */
export const resolveEstadoOT = (ot: WorkOrder): string => {
  if (ot.estadoAdmin) return ot.estadoAdmin;
  return ot.status === 'FINALIZADO' ? 'FINALIZADO' : 'CREADA';
};

export const OTStatusBadge: React.FC<{ ot: WorkOrder }> = ({ ot }) => {
  const estado = resolveEstadoOT(ot);
  const label = OT_ESTADO_LABELS[estado as OTEstadoAdmin] ?? estado;
  const color = OT_ESTADO_COLORS[estado] ?? 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${color}`}>
      {label}
    </span>
  );
};
