import { useEffect, useState } from 'react';
import type { Pendiente } from '@ags/shared';
import { PENDIENTE_TIPO_LABELS, PENDIENTE_TIPO_COLORS, PENDIENTE_ESTADO_LABELS, PENDIENTE_ESTADO_COLORS } from '@ags/shared';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';

interface Props {
  ticketId: string;
}

/**
 * Real-time list of pendientes generated from a ticket.
 * Subscribes via `origenTicketId` query.
 * Renders nothing if there are no pendientes.
 */
export const TicketPendientesChips: React.FC<Props> = ({ ticketId }) => {
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'pendientes'), where('origenTicketId', '==', ticketId));
    const unsub = onSnapshot(q, snap => {
      const items: Pendiente[] = snap.docs.map(d => {
        const data = d.data() as Record<string, unknown>;
        const toISO = (v: unknown): string | null => {
          if (!v) return null;
          if (typeof v === 'string') return v;
          const ts = v as { toDate?: () => Date };
          return ts.toDate ? ts.toDate().toISOString() : null;
        };
        return {
          id: d.id,
          clienteId: (data.clienteId as string) ?? '',
          clienteNombre: (data.clienteNombre as string) ?? '',
          equipoId: (data.equipoId as string) ?? null,
          equipoNombre: (data.equipoNombre as string) ?? null,
          equipoAgsId: (data.equipoAgsId as string) ?? null,
          tipo: (data.tipo as Pendiente['tipo']) ?? 'ambos',
          descripcion: (data.descripcion as string) ?? '',
          estado: (data.estado as Pendiente['estado']) ?? 'pendiente',
          origenTicketId: (data.origenTicketId as string) ?? null,
          origenTicketRazonSocial: (data.origenTicketRazonSocial as string) ?? null,
          completadaEn: toISO(data.completadaEn),
          completadaPor: (data.completadaPor as string) ?? null,
          completadaPorNombre: (data.completadaPorNombre as string) ?? null,
          resolucionDocType: (data.resolucionDocType as Pendiente['resolucionDocType']) ?? null,
          resolucionDocId: (data.resolucionDocId as string) ?? null,
          resolucionDocLabel: (data.resolucionDocLabel as string) ?? null,
          descartadaEn: toISO(data.descartadaEn),
          descartadaPor: (data.descartadaPor as string) ?? null,
          descartadaPorNombre: (data.descartadaPorNombre as string) ?? null,
          descartadaMotivo: (data.descartadaMotivo as string) ?? null,
          createdAt: toISO(data.createdAt) ?? new Date().toISOString(),
          updatedAt: toISO(data.updatedAt) ?? new Date().toISOString(),
          createdBy: (data.createdBy as string) ?? null,
          createdByName: (data.createdByName as string) ?? null,
          updatedBy: (data.updatedBy as string) ?? null,
          updatedByName: (data.updatedByName as string) ?? null,
        };
      });
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
