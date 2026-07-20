import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { REPORTES_OT_URL } from '../utils/constants';

export default function ReportesPage() {
  const [params] = useSearchParams();
  const reportId = params.get('reportId');

  // Si entran con ?reportId=XXX (ej. desde "Mis Pendientes"), reenviamos el
  // param para que reportes-ot abra el reporte específico.
  const targetUrl = reportId
    ? `${REPORTES_OT_URL}?reportId=${encodeURIComponent(reportId)}`
    : REPORTES_OT_URL;

  // En MOBILE no se puede embeber: reportes-ot corre en otro dominio y los
  // browsers móviles particionan el storage de iframes third-party — el popup
  // de Google completa el login pero la sesión nunca llega al iframe y queda
  // en blanco (UAT 2026-07-20). En pantalla chica se navega DIRECTO a la app
  // en la misma pestaña (contexto first-party, donde el login funciona); el
  // botón queda solo como fallback visible durante la navegación.
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (!isDesktop) window.location.assign(targetUrl);
  }, [isDesktop, targetUrl]);

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title={reportId ? `Reporte ${reportId}` : 'Reportes'}
        subtitle={reportId ? 'Editando borrador' : 'Carga y edición de reportes de OT'}
      />

      {isDesktop ? (
        <div className="flex-1 min-h-0">
          <iframe
            key={reportId ?? 'new'}
            src={targetUrl}
            className="w-full h-full border-0"
            title="Reportes OT"
            allow="clipboard-write"
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-600 max-w-xs">Abriendo Reportes…</p>
          <a
            href={targetUrl}
            className="text-xs text-teal-700 underline underline-offset-2"
          >
            Tocá acá si no abre solo
          </a>
        </div>
      )}
    </div>
  );
}
