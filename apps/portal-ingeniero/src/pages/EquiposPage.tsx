import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Card } from '../components/ui/Card';

export default function EquiposPage() {
  return (
    <div className="h-full flex flex-col">
      <PageHeader title="Equipos" subtitle="Equipos asignados a mis clientes" />
      <div className="flex-1 p-4">
        <Card>
          <EmptyState message="Próximamente — listado de equipos" />
        </Card>
      </div>
    </div>
  );
}
