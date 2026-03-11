import { Link } from 'react-router-dom';
import type { WorkOrder } from '@ags/shared';
import { OTStatusBadge } from './OTStatusBadge';
import { REPORTES_OT_URL } from '../../utils/constants';

interface OTCardProps {
  ot: WorkOrder;
}

function fmt(dateStr?: string) {
  if (!dateStr) return '—';
  try { return new Date(dateStr).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }); }
  catch { return dateStr; }
}

export function OTCard({ ot }: OTCardProps) {
  const isFinalizado = ot.status === 'FINALIZADO';

  // OTs en borrador → abrir reportes-ot para completar el reporte
  // OTs finalizadas → ver detalle read-only en portal-ingeniero
  if (!isFinalizado) {
    const reportesUrl = `${REPORTES_OT_URL}?reportId=${encodeURIComponent(ot.otNumber || '')}`;
    return (
      <a
        href={reportesUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block bg-white rounded-xl border border-slate-200 px-4 py-3.5 hover:border-indigo-300 hover:shadow-sm transition-all active:bg-slate-50"
      >
        <CardContent ot={ot} />
        <div className="mt-2 flex items-center gap-1 text-[10px] text-indigo-500 font-medium">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Abrir reporte
        </div>
      </a>
    );
  }

  return (
    <Link
      to={`/ordenes-trabajo/${ot.otNumber}`}
      className="block bg-white rounded-xl border border-slate-200 px-4 py-3.5 hover:border-indigo-300 hover:shadow-sm transition-all active:bg-slate-50"
    >
      <CardContent ot={ot} />
    </Link>
  );
}

function CardContent({ ot }: { ot: WorkOrder }) {
  return (
    <>
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
    </>
  );
}
