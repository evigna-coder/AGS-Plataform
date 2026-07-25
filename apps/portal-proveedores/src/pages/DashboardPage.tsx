import { Loader2, FilePlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboard } from '@/data/mock';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { RequerimientosCard } from '@/components/dashboard/RequerimientosCard';
import { OrdenesCard } from '@/components/dashboard/OrdenesCard';

export function DashboardPage() {
  const { proveedor } = useAuth();
  const { data, loading } = useDashboard();

  if (loading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-ink-faint">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const nuevos = data.requerimientos.filter((r) => r.estado === 'nuevo').length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[26px] font-semibold text-ink">
            Hola, {proveedor?.razonSocial}
          </h1>
          <p className="text-sm text-ink-soft">
            Tenés {nuevos} requerimientos nuevos esperando cotización.
          </p>
        </div>
        <Button icon={<FilePlus className="h-[17px] w-[17px]" />}>Cargar cotización</Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {data.kpis.map((k) => (
          <KpiCard key={k.label} kpi={k} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_440px] lg:items-start">
        <RequerimientosCard items={data.requerimientos} />
        <OrdenesCard items={data.ocs} />
      </div>
    </div>
  );
}
