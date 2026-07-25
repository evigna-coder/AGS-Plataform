import { Inbox, ClipboardList, Truck, Package, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Kpi } from '@/data/types';
import type { BadgeTone } from '@/components/ui/Badge';

const ICONS: Record<string, LucideIcon> = {
  inbox: Inbox,
  'clipboard-list': ClipboardList,
  truck: Truck,
  package: Package,
};

const ICON_COLOR: Record<BadgeTone, string> = {
  info: 'text-info',
  teal: 'text-teal-700',
  warn: 'text-warn',
  success: 'text-success',
  danger: 'text-danger',
  neutral: 'text-ink-soft',
};

export function KpiCard({ kpi }: { kpi: Kpi }) {
  const Icon = ICONS[kpi.icon] ?? Package;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] tracking-wide text-ink-soft">{kpi.label}</span>
        <Icon className={cn('h-[18px] w-[18px]', ICON_COLOR[kpi.tone])} />
      </div>
      <span className="font-display text-[34px] font-semibold leading-none text-ink">{kpi.value}</span>
      <span className="font-mono text-[12px] text-ink-faint">{kpi.sub}</span>
    </div>
  );
}
