import { useEffect, useState } from 'react';
import type { Pendiente } from '@ags/shared';
import { PENDIENTE_TIPO_LABELS, PENDIENTE_TIPO_COLORS, PENDIENTE_ESTADO_LABELS, PENDIENTE_ESTADO_COLORS } from '@ags/shared';
import { pendientesService } from '../../services/pendientesService';

interface Props {
  ticketId: string;
}

/**
 * Real-time list of pendientes generated from a ticket.
 * Subscribes via `pendientesService.subscribeByOrigenTicketId`.
 * Renders nothing if there are no pendientes.
 */
export const TicketPendientesChips: React.FC<Props> = ({ ticketId }) => {
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = pendientesService.subscribeByOrigenTicketId(ticketId, items => {
      setPendientes(items);
      setLoading(false);
    });
    return unsub;
  }, [ticketId]);

  if (loading || pendientes.length === 0) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] font-medium text-slate-400">
          Pendientes generados ({pendientes.length})
        </h3>
      </div>
      <div className="space-y-1.5">
        {pendientes.map(p => (
          <div
            key={p.id}
            className="flex items-start gap-2 bg-slate-50 border border-slate-100 rounded-md px-2.5 py-1.5"
          >
            <span
              className={`shrink-0 text-[9px] font-medium px-1.5 py-px rounded-full ${PENDIENTE_TIPO_COLORS[p.tipo]}`}
            >
              {PENDIENTE_TIPO_LABELS[p.tipo]}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-slate-700">{p.descripcion}</p>
              {p.equipoNombre && (
                <p className="text-[10px] text-slate-400">
                  {p.equipoNombre}
                  {p.equipoAgsId && <span className="font-mono ml-1">({p.equipoAgsId})</span>}
                </p>
              )}
              {p.resolucionDocLabel && p.estado === 'completada' && (
                <p className="text-[10px] text-emerald-600 mt-0.5">
                  ✓ Resuelta en {p.resolucionDocLabel}
                </p>
              )}
            </div>
            <span
              className={`shrink-0 text-[9px] font-medium px-1.5 py-px rounded-full ${PENDIENTE_ESTADO_COLORS[p.estado]}`}
            >
              {PENDIENTE_ESTADO_LABELS[p.estado]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
