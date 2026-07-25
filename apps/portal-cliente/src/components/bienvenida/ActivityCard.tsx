import { Card, CardHeader } from '@/components/ui/Card';
import type { ActivityItem } from '@/data/types';
import type { BadgeTone } from '@/components/ui/Badge';

const DOT: Record<BadgeTone, string> = {
  success: 'bg-success',
  warn: 'bg-warn',
  danger: 'bg-danger',
  info: 'bg-info',
  teal: 'bg-teal-500',
  neutral: 'bg-ink-faint',
};

export function ActivityCard({ items }: { items: ActivityItem[] }) {
  return (
    <Card>
      <CardHeader title="Actividad reciente" />
      <div className="mt-2 divide-y divide-line">
        {items.map((it) => (
          <div key={it.id} className="flex gap-3 py-3">
            <span className={`mt-[7px] h-2.5 w-2.5 shrink-0 rounded-full ${DOT[it.tone]}`} />
            <div className="flex flex-col gap-0.5">
              <p className="text-sm text-ink">{it.title}</p>
              <p className="font-mono text-[11px] text-ink-faint">{it.meta}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
