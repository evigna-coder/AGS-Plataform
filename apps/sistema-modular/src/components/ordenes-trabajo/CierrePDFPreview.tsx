import { useState, useEffect } from 'react';
import { reportePdfService } from '../../services/reportePdfService';
import { DocumentosAdicionalesReporte } from './DocumentosAdicionalesReporte';

interface Props {
  otNumber: string;
}

export const CierrePDFPreview: React.FC<Props> = ({ otNumber }) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Se incrementa al anexar un documento → fuerza re-resolver + cache-bust del iframe.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!otNumber) return;
    setLoading(true);

    let cancelled = false;
    (async () => {
      const resolved = await reportePdfService.resolveReportePdf(otNumber);
      if (cancelled) return;
      setPdfUrl(resolved?.url ?? null);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [otNumber, reloadKey]);

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
      ) : (
        <div className="p-4 text-center">
          <p className="text-xs text-slate-400">PDF del reporte no disponible</p>
          <p className="text-[10px] text-slate-300 mt-1">El reporte debe generarse primero desde reportes-ot</p>
        </div>
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
