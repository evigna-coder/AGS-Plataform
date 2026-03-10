import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Card } from '../components/ui/Card';

export default function AgendaPage() {
  return (
    <div className="h-full flex flex-col">
      <PageHeader title="Agenda" subtitle="Calendario de visitas y servicios" />
      <div className="flex-1 p-4">
        <Card>
          <EmptyState message="Próximamente — agenda de visitas" />
        </Card>
      </div>
    </div>
  );
}
