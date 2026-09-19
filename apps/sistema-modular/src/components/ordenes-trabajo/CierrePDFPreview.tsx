import { useState, useEffect } from 'react';
import type { WorkOrder } from '@ags/shared';
import { reportePdfService } from '../../services/reportePdfService';
import { ordenesTrabajoService } from '../../services/firebaseService';
import { DocumentosAdicionalesReporte } from './DocumentosAdicionalesReporte';

interface Props {
  otNumber: string;
}

const fechaCorta = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/**
 * Estado del envío del reporte al cliente (2026-09-18, caso 30029.01). El
 * registro lo escribe reportes-ot al mandar el mail y el portal al marcar una
 * entrega manual; el cierre no lo mostraba y la administración no tenía forma
 * de saber si el cliente ya lo tenía.
 */
function EnvioClienteLinea({ ot }: { ot: WorkOrder }) {
  if (ot.envioManual) {
    return <span className="text-teal-700">Entregado al cliente por otro medio{ot.envioManual.fecha ? ` el ${fechaCorta(ot.envioManual.fecha)}` : ''}{ot.envioManual.marcadoPorNombre ? ` (${ot.envioManual.marcadoPorNombre})` : ''}.</span>;
  }
  const e = ot.enviadoPorEmail;
  if (e?.estado === 'enviado') {
    return <span className="text-teal-700" title={(e.destinatarios ?? []).join(', ')}>Enviado al cliente por mail{e.fecha ? ` el ${fechaCorta(e.fecha)}` : ''}{e.destinatarios?.length ? ` a ${e.destinatarios.length} destinatario(s)` : ''}.</span>;
  }
  if (e?.estado === 'error') {
    return <span className="text-red-600" title={e.error ?? undefined}>El envío por mail al cliente falló{e.fecha ? ` el ${fechaCorta(e.fecha)}` : ''}. Reenviar desde la app de campo o marcar la entrega manual en el portal.</span>;
  }
  return <span className="text-amber-700">Sin envío registrado al cliente.</span>;
}

export const CierrePDFPreview: React.FC<Props> = ({ otNumber }) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [ot, setOt] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  // Se incrementa al anexar un documento → fuerza re-resolver + cache-bust del iframe.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!otNumber) return;
    setLoading(true);

    let cancelled = false;
    (async () => {
      const leida = await ordenesTrabajoService.getByOtNumber(otNumber).catch(() => null);
      const resolved = await reportePdfService.resolveReportePdf(otNumber, leida);
      if (cancelled) return;
      setOt(leida);
      setPdfUrl(resolved?.url ?? null);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [otNumber, reloadKey]);

  // Finalizada en campo (firmas cargadas) pero sin PDF: la subida a la nube
  // falló. Se recupera con el técnico tocando Finalizar de nuevo; no hay que
  // reabrir nada (reabrir borra la firma del cliente).
  const finalizadaSinPdf = !loading && !pdfUrl && !!ot && (ot.status === 'FINALIZADO' || !!ot.signatureEngineer);

  // Cache-bust para que el iframe muestre el PDF re-mergeado.
  const iframeSrc = pdfUrl
    ? `${pdfUrl}${pdfUrl.includes('?') ? '&' : '?'}_cb=${reloadKey}`
    : null;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-b border-slate-200">
        <p className="text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-wider">Reporte tecnico PDF</p>
        {iframeSrc && (
          <a href={iframeSrc} target="_blank" rel="noopener noreferrer"
            className="text-[10px] text-teal-600 hover:underline font-medium">
            Abrir en nueva ventana
          </a>
        )}
      </div>

      {loading ? (
        <div className="p-4 text-center">
          <p className="text-xs text-slate-400">Buscando PDF del reporte...</p>
        </div>
      ) : iframeSrc ? (
        <iframe src={iframeSrc} className="w-full h-[400px]" title={`Reporte OT-${otNumber}`} />
      ) : finalizadaSinPdf ? (
        <div className="p-4 text-center bg-amber-50">
          <p className="text-xs text-amber-800 font-medium">Finalizada en campo, pero el PDF no se subió a la nube</p>
          <p className="text-[10px] text-amber-700 mt-1">
            Las firmas están cargadas y falló la subida del PDF. Pedile al técnico que abra la OT {otNumber} en la app de campo con buena señal y vuelva a tocar Finalizar: solo regenera y sube el PDF. No hace falta reabrir la OT.
          </p>
        </div>
      ) : (
        <div className="p-4 text-center">
          <p className="text-xs text-slate-400">PDF del reporte no disponible</p>
          <p className="text-[10px] text-slate-300 mt-1">El técnico todavía no finalizó el reporte en la app de campo</p>
        </div>
      )}

      {!loading && ot && (
        <p className="px-3 py-1.5 text-[10px] border-t border-slate-200 bg-white">
          <EnvioClienteLinea ot={ot} />
        </p>
      )}

      <div className="px-3 py-2 border-t border-slate-200 bg-slate-50">
        <DocumentosAdicionalesReporte
          otNumber={otNumber}
          onAppended={() => setReloadKey(k => k + 1)}
        />
      </div>
    </div>
  );
};
