import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Card } from '../components/ui/Card';

export default function ClientesPage() {
  return (
    <div className="h-full flex flex-col">
      <PageHeader title="Clientes" subtitle="Clientes asignados" />
      <div className="flex-1 p-4">
        <Card>
          <EmptyState message="Próximamente — listado de clientes" />
        </Card>
      </div>
    </div>
  );
}
