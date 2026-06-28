import { useState, useRef, useEffect } from 'react';
import type { WorkOrder } from '@ags/shared';

/** Abre una URL en ventana nueva (Electron → navegador externo; browser → tab). */
const openUrl = (url: string) => {
  const api = (window as any).electronAPI;
  if (api?.openExternal) api.openExternal(url);
  else if (api?.openWindow) api.openWindow(url);
  else window.open(url, '_blank', 'noopener');
};

/** Fallback: abre la OT en la app reportes-ot para generar/ver el reporte. */
const openReportesApp = (otNumber: string) => {
  openUrl(`http://localhost:3000?reportId=${otNumber}`);
};

interface Props {
  ot: WorkOrder;
}

/**
 * Acción "Reporte" del listado de OTs. Acceso directo al PDF ya generado por
 * reportes-ot (guardado en el mismo doc `reportes/{otNumber}`):
 *  - Si hay reporte + protocolo → menú "Solo reporte" / "Reporte + protocolo".
 *  - Si solo hay reporte → abre directo.
 *  - Si no hay PDF → cae a la app reportes-ot para generarlo.
 */
export const OTReporteButton: React.FC<Props> = ({ ot }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const pdfUrl = ot.pdfUrl || null;
  const protocolUrl = ot.protocolPdfUrl || null;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const handleClick = () => {
    if (pdfUrl && protocolUrl) {
      setOpen(o => !o);
    } else if (pdfUrl) {
      openUrl(pdfUrl);
    } else {
      openReportesApp(ot.otNumber);
    }
  };

  const openSolo = () => { setOpen(false); if (pdfUrl) openUrl(pdfUrl); };
  const openCompleto = () => {
    setOpen(false);
    if (pdfUrl) openUrl(pdfUrl);
    if (protocolUrl) openUrl(protocolUrl);
  };

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={handleClick}
        className="text-[10px] font-medium text-emerald-600 hover:text-emerald-800 px-1 py-0.5 rounded hover:bg-emerald-50"
        title={pdfUrl ? 'Ver reporte (PDF)' : 'Generar reporte en reportes-ot'}
      >
        Reporte
      </button>
      {open && pdfUrl && protocolUrl && (
        <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white shadow-lg py-1 text-left">
          <button
            onClick={openSolo}
            className="block w-full text-left px-3 py-1.5 text-[11px] text-slate-700 hover:bg-slate-50"
          >
            Solo reporte
          </button>
          <button
            onClick={openCompleto}
            className="block w-full text-left px-3 py-1.5 text-[11px] text-slate-700 hover:bg-slate-50"
          >
            Reporte + protocolo
          </button>
        </div>
      )}
    </div>
  );
};
