import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { REPORTES_OT_URL } from '../utils/constants';

export default function ReportesPage() {
  const [params] = useSearchParams();
  const reportId = params.get('reportId');

  // Si entran con ?reportId=XXX (ej. desde "Mis Pendientes"), reenviamos el
  // param al iframe para que reportes-ot abra el reporte específico dentro
  // del shell del portal en lugar de en una pestaña aparte.
  const iframeSrc = reportId
    ? `${REPORTES_OT_URL}?reportId=${encodeURIComponent(reportId)}`
    : REPORTES_OT_URL;

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title={reportId ? `Reporte ${reportId}` : 'Reportes'}
        subtitle={reportId ? 'Editando borrador' : 'Carga y edición de reportes de OT'}
      />

      <div className="flex-1 min-h-0">
        <iframe
          key={reportId ?? 'new'}
          src={iframeSrc}
          className="w-full h-full border-0"
          title="Reportes OT"
          allow="clipboard-write"
        />
      </div>
    </div>
  );
}
