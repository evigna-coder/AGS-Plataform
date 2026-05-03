import type { WorkOrderWithPdf } from '../../services/firebaseService';
import { REPORTES_OT_URL } from '../../utils/constants';
import { OTStatusBadge } from '../ordenes-trabajo/OTStatusBadge';

function fmt(dateStr?: string) {
  if (!dateStr) return '—';
  try { return new Date(dateStr).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }); }
  catch { return dateStr; }
}

const openPDF = (ot: WorkOrderWithPdf) => {
  if (ot.pdfUrl) window.open(ot.pdfUrl, '_blank');
  else window.open(`${REPORTES_OT_URL}?reportId=${encodeURIComponent(ot.otNumber)}`, '_blank');
};

const openProtocol = (ot: WorkOrderWithPdf) => {
  if (ot.protocolPdfUrl) window.open(ot.protocolPdfUrl, '_blank');
};

export default function HistorialOTCard({ ot }: { ot: WorkOrderWithPdf }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-3.5">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold font-mono text-teal-600">OT-{ot.otNumber}</span>
          <OTStatusBadge status={ot.status} />
        </div>
        <span className="text-[11px] text-slate-400 shrink-0">{fmt(ot.fechaInicio || ot.fechaFin || ot.fechaServicioAprox)}</span>
      </div>

      <p className="text-sm font-semibold text-slate-800 truncate">{ot.razonSocial || '—'}</p>

      <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-500">
        {ot.sistema && <span className="truncate">{ot.sistema}</span>}
        {ot.codigoInternoCliente && (
          <span className="font-mono text-[10px] text-slate-400 shrink-0">{ot.codigoInternoCliente}</span>
        )}
        {ot.tipoServicio && (
          <>
            <span className="shrink-0">·</span>
            <span className="truncate">{ot.tipoServicio}</span>
          </>
        )}
      </div>

      {ot.moduloModelo && (
        <p className="mt-1 text-[11px] text-slate-400 truncate">
          {ot.moduloModelo}
          {ot.moduloSerie && <span className="ml-1">({ot.moduloSerie})</span>}
        </p>
      )}

      {ot.ingenieroAsignadoNombre && (
        <p className="mt-1 text-[11px] text-slate-400">
          Asignado: <span className="text-slate-600">{ot.ingenieroAsignadoNombre}</span>
        </p>
      )}

      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={() => openPDF(ot)}
          className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Reporte
        </button>
        {ot.protocolPdfUrl && (
          <button
            onClick={() => openProtocol(ot)}
            className="flex items-center gap-1 text-[10px] text-teal-600 font-medium"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Protocolo
          </button>
        )}
      </div>
    </div>
  );
}
