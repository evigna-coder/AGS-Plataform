import { Loader2 } from 'lucide-react';
import { useDashboard } from '@/data/mock';
import { OrdenesCard } from '@/components/dashboard/OrdenesCard';

export function OrdenesListPage() {
  const { data, loading } = useDashboard();

  if (loading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-ink-faint">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div>
        <h1 className="font-display text-[26px] font-semibold text-ink">Órdenes de compra</h1>
        <p className="text-sm text-ink-soft">{data.ocs.length} órdenes activas</p>
      </div>
      <OrdenesCard items={data.ocs} />
    </div>
  );
}
