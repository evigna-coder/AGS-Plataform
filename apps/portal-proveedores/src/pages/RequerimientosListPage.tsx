import { Loader2 } from 'lucide-react';
import { useDashboard } from '@/data/mock';
import { RequerimientosCard } from '@/components/dashboard/RequerimientosCard';

export function RequerimientosListPage() {
  const { data, loading } = useDashboard();

  if (loading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-ink-faint">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-[26px] font-semibold text-ink">Requerimientos</h1>
        <p className="text-sm text-ink-soft">
          {data.requerimientos.length} requerimientos asignados
        </p>
      </div>
      <RequerimientosCard items={data.requerimientos} />
    </div>
  );
}
