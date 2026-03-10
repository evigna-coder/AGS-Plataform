import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Card } from '../components/ui/Card';

export default function LeadsPage() {
  return (
    <div className="h-full flex flex-col">
      <PageHeader title="Leads" subtitle="Solicitudes de soporte y oportunidades" />
      <div className="flex-1 p-4">
        <Card>
          <EmptyState message="Próximamente — gestión de leads" />
        </Card>
      </div>
    </div>
  );
}
