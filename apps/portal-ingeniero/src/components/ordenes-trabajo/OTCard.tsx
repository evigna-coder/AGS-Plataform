import { Link } from 'react-router-dom';
import type { WorkOrder } from '@ags/shared';
import { OTStatusBadge } from './OTStatusBadge';

interface OTCardProps {
  ot: WorkOrder;
}

function fmt(dateStr?: string) {
  if (!dateStr) return '—';
  try { return new Date(dateStr).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }); }
  catch { return dateStr; }
}

export function OTCard({ ot }: OTCardProps) {
  return (
    <Link
      to={`/ordenes-trabajo/${ot.otNumber}`}
      className="block bg-white rounded-xl border border-slate-200 px-4 py-3.5 hover:border-indigo-300 hover:shadow-sm transition-all active:bg-slate-50"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold font-mono text-indigo-600">OT-{ot.otNumber}</span>
          <OTStatusBadge status={ot.status} />
        </div>
        <span className="text-[11px] text-slate-400 shrink-0">{fmt(ot.fechaInicio || ot.updatedAt)}</span>
      </div>

      <p className="text-sm font-semibold text-slate-800 truncate">{ot.razonSocial || '—'}</p>

      <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-500">
        {ot.sistema && <span className="truncate">{ot.sistema}</span>}
        {ot.tipoServicio && (
          <>
            <span className="shrink-0">·</span>
            <span className="truncate">{ot.tipoServicio}</span>
          </>
        )}
      </div>

      {ot.ingenieroAsignadoNombre && (
        <p className="mt-1.5 text-[11px] text-slate-400">
          Asignado: <span className="text-slate-600">{ot.ingenieroAsignadoNombre}</span>
        </p>
      )}
    </Link>
  );
}
