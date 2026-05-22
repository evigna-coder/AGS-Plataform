import { PageHeader } from '../components/ui/PageHeader';
import { REPORTES_OT_URL } from '../utils/constants';

export default function ReportesPage() {
  return (
    <div className="h-full flex flex-col">
      <PageHeader title="Reportes" subtitle="Carga y edición de reportes de OT" />

      <div className="flex-1 min-h-0">
        <iframe
          src={REPORTES_OT_URL}
          className="w-full h-full border-0"
          title="Reportes OT"
          allow="clipboard-write"
        />
      </div>
    </div>
  );
}
