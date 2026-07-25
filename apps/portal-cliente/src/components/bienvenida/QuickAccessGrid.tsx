import { Boxes, History, FileText, Headset, ArrowUpRight, type LucideIcon } from 'lucide-react';
import { Sparkline } from '@/components/ui/Sparkline';
import type { FleetSummary } from '@/data/types';

interface QuickCard {
  icon: LucideIcon;
  value: string;
  title: string;
  sub: string;
  spark: number[];
  sparkColor?: string;
}

function AccessCard({ icon: Icon, value, title, sub, spark, sparkColor }: QuickCard) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6">
      <div className="flex items-center justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50">
          <Icon className="h-[21px] w-[21px] text-teal-700" />
        </div>
        <ArrowUpRight className="h-[18px] w-[18px] text-ink-faint" />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="font-display text-[30px] font-bold leading-none text-ink">{value}</span>
        <span className="text-sm font-semibold text-ink">{title}</span>
        <span className="text-xs text-ink-soft">{sub}</span>
      </div>
      <Sparkline values={spark} barClassName={sparkColor} />
    </div>
  );
}

function SolicitarCard() {
  return (
    <div className="flex flex-col justify-between gap-4 rounded-2xl bg-teal-700 p-6">
      <div className="flex items-center justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#12807F]">
          <Headset className="h-[22px] w-[22px] text-ink-inv" />
        </div>
        <ArrowUpRight className="h-[18px] w-[18px] text-[#9BCACA]" />
      </div>
      <div className="flex flex-col gap-1">
        <span className="font-display text-xl font-semibold text-ink-inv">Solicitar servicio</span>
        <span className="text-[13px] leading-snug text-[#B9D4D4]">
          Coordinamos el retiro o la visita técnica de tu equipo.
        </span>
      </div>
    </div>
  );
}

export function QuickAccessGrid({ fleet }: { fleet: FleetSummary }) {
  const cards: QuickCard[] = [
    {
      icon: Boxes,
      value: String(fleet.total),
      title: 'Mis equipos',
      sub: 'en 3 establecimientos',
      spark: [14, 20, 16, 26, 22, 30],
    },
    {
      icon: History,
      value: '128',
      title: 'Historial de OTs',
      sub: '12 órdenes este año',
      spark: [10, 16, 12, 22, 18, 28],
    },
    {
      icon: FileText,
      value: String(fleet.informesNuevos),
      title: 'Informes y documentos',
      sub: 'nuevos para descargar',
      spark: [20, 14, 24, 18, 28, 22],
      sparkColor: 'bg-info',
    },
  ];

  return (
    <section className="flex flex-col gap-3.5">
      <span className="font-mono text-[11px] tracking-wide text-ink-soft">ACCESOS RÁPIDOS</span>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <AccessCard key={c.title} {...c} />
        ))}
        <SolicitarCard />
      </div>
    </section>
  );
}
