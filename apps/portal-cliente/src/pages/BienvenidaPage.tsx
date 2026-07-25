import { Loader2 } from 'lucide-react';
import { HeroCard } from '@/components/bienvenida/HeroCard';
import { QuickAccessGrid } from '@/components/bienvenida/QuickAccessGrid';
import { ActivityCard } from '@/components/bienvenida/ActivityCard';
import { useBienvenida } from '@/data/useBienvenida';

export function BienvenidaPage() {
  const { data, loading } = useBienvenida();

  if (loading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-ink-faint">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <HeroCard cliente={data.cliente} fleet={data.fleet} />
      <QuickAccessGrid fleet={data.fleet} />
      <ActivityCard items={data.actividad} />
    </div>
  );
}
