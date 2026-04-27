import type { WorkOrder, OTEstadoAdmin } from '@ags/shared';
import { OT_ESTADO_LABELS } from '@ags/shared';

const ESTADO_COLORS: Record<string, string> = {
  CREADA: 'bg-slate-100 text-slate-600',
  ASIGNADA: 'bg-blue-100 text-blue-700',
  COORDINADA: 'bg-violet-100 text-violet-700',
  EN_CURSO: 'bg-amber-100 text-amber-700',
  CIERRE_TECNICO: 'bg-orange-100 text-orange-700',
  CIERRE_ADMINISTRATIVO: 'bg-cyan-100 text-cyan-700',
  FINALIZADO: 'bg-emerald-100 text-emerald-700',
  BORRADOR: 'bg-amber-100 text-amber-700',
};

/** Resuelve el estado efectivo de la OT — preferimos estadoAdmin sobre status. */
export const resolveEstadoOT = (ot: WorkOrder): string => {
  if (ot.estadoAdmin) return ot.estadoAdmin;
  return ot.status === 'FINALIZADO' ? 'FINALIZADO' : 'CREADA';
};

export const OTStatusBadge: React.FC<{ ot: WorkOrder }> = ({ ot }) => {
  const estado = resolveEstadoOT(ot);
  const label = OT_ESTADO_LABELS[estado as OTEstadoAdmin] ?? estado;
  const color = ESTADO_COLORS[estado] ?? 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${color}`}>
      {label}
    </span>
  );
};
