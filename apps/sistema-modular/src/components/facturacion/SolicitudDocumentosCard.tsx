import type { SolicitudFacturacion } from '@ags/shared';
import { Card } from '../ui/Card';
import { useSolicitudDocumentos } from '../../hooks/useSolicitudDocumentos';

/** Abre una URL en ventana nueva (Electron → navegador externo; browser → tab). */
const openUrl = (url: string) => {
  const api = (window as any).electronAPI;
  if (api?.openExternal) api.openExternal(url);
  else if (api?.openWindow) api.openWindow(url);
  else window.open(url, '_blank', 'noopener');
};

const chipBase = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-[10px] font-mono uppercase tracking-wide transition-colors';
const chipActive = `${chipBase} border-teal-200 bg-teal-50/60 text-teal-700 hover:bg-teal-50 hover:border-teal-400 cursor-pointer`;
const chipDisabled = `${chipBase} border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed`;

interface Props {
  solicitud: SolicitudFacturacion;
}

/**
 * Accesos directos a los documentos que la encargada de facturación adjunta a la
 * factura: PDF del presupuesto (generado on-demand), PDF de la OC del cliente
 * (archivo en Storage) y reporte PDF de cada OT del aviso.
 * Solo lecturas — no toca el flujo de facturar/cobrar.
 */
export const SolicitudDocumentosCard = ({ solicitud }: Props) => {
  const { ocs, reportes, loadingDocs, generandoPdf, verPresupuestoPDF } = useSolicitudDocumentos(solicitud);

  const sinOtNumbers = !solicitud.otNumbers || solicitud.otNumbers.length === 0;

  return (
    <Card>
      <p className="text-[9px] font-mono font-semibold text-teal-700/70 uppercase tracking-widest mb-3">
        Documentos para la factura
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {/* Presupuesto — PDF generado on-demand con @react-pdf */}
        <button
          type="button"
          onClick={verPresupuestoPDF}
          disabled={generandoPdf}
          className={generandoPdf ? chipDisabled : chipActive}
          title="Genera y abre el PDF del presupuesto"
        >
          {generandoPdf ? 'Generando PDF…' : <>Presupuesto {solicitud.presupuestoNumero} <span aria-hidden>↗</span></>}
        </button>

        {/* OC del cliente — archivo(s) subido(s) a Storage */}
        {loadingDocs ? (
          <span className={chipDisabled}>OC: cargando…</span>
        ) : ocs.length === 0 ? (
          <span className={chipDisabled} title="El cliente no tiene una orden de compra cargada para este presupuesto">
            OC: sin cargar
          </span>
        ) : (
          ocs.map(oc =>
            oc.adjuntos.length === 0 ? (
              <span key={oc.id} className={chipDisabled} title="La OC no tiene archivo adjunto">
                OC {oc.numero}: sin archivo
              </span>
            ) : (
              oc.adjuntos.map((adj, i) => (
                <button
                  key={`${oc.id}-${adj.id}`}
                  type="button"
                  onClick={() => openUrl(adj.url)}
                  className={chipActive}
                  title={adj.nombre}
                >
                  OC {oc.numero}{oc.adjuntos.length > 1 ? ` (${i + 1})` : ''} <span aria-hidden>↗</span>
                </button>
              ))
            ),
          )
        )}

        {/* Reporte PDF de cada OT del aviso */}
        {loadingDocs ? (
          <span className={chipDisabled}>Reportes: cargando…</span>
        ) : sinOtNumbers ? (
          <span className={chipDisabled} title="Esta solicitud no tiene OTs asociadas">
            Reporte OT: sin OTs
          </span>
        ) : (
          reportes.map(r =>
            r.pdfUrl ? (
              <button
                key={r.otNumber}
                type="button"
                onClick={() => openUrl(r.pdfUrl!)}
                className={chipActive}
                title={`Ver reporte de la OT ${r.otNumber} (PDF)`}
              >
                Reporte OT {r.otNumber} <span aria-hidden>↗</span>
              </button>
            ) : (
              <span
                key={r.otNumber}
                className={chipDisabled}
                title="El reporte aún no tiene PDF (la OT no fue finalizada o falló la subida)"
              >
                Reporte OT {r.otNumber}: sin PDF
              </span>
            ),
          )
        )}
      </div>
    </Card>
  );
};
