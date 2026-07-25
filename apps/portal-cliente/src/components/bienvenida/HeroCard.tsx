import { Plus, ArrowRight, CircleCheck, Wrench, FileText, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { ClientePortal, FleetSummary } from '@/data/types';

interface ChipDef {
  value: number;
  label: string;
  icon: LucideIcon;
  dot: string;
}

function StatChip({ value, label, icon: Icon, dot }: ChipDef) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl bg-[#0E4A4A] p-4">
      <div className="flex items-center justify-between">
        <span className="font-display text-xl font-bold text-ink-inv">{value}</span>
        <Icon className="h-[18px] w-[18px] text-teal-500" />
      </div>
      <span className="flex items-center gap-1.5 font-mono text-[9px] tracking-wide text-[#8FB8B8]">
        <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />
        {label.toUpperCase()}
      </span>
    </div>
  );
}

interface HeroCardProps {
  cliente: ClientePortal;
  fleet: FleetSummary;
}

export function HeroCard({ cliente, fleet }: HeroCardProps) {
  const chips: ChipDef[] = [
    { value: fleet.operativos, label: 'Operativos', icon: CircleCheck, dot: 'bg-success' },
    { value: fleet.enBench, label: 'En bench', icon: Wrench, dot: 'bg-warn' },
    { value: fleet.informesNuevos, label: 'Informes', icon: FileText, dot: 'bg-teal-500' },
  ];

  return (
    <div className="flex flex-col gap-10 rounded-2xl bg-gradient-to-br from-teal-700 to-[#093F3F] p-6 md:flex-row md:items-center md:p-11">
      <div className="flex flex-1 flex-col gap-5">
        <span className="font-mono text-[11px] tracking-[0.15em] text-teal-500">
          PORTAL CLIENTE · AGS ANALÍTICA
        </span>
        <h1 className="font-display text-[26px] font-semibold leading-tight text-ink-inv md:text-[40px]">
          Bienvenida,
          <br />
          {cliente.razonSocial}
        </h1>
        <p className="max-w-[560px] text-sm leading-relaxed text-[#B9D4D4] md:text-[15px]">
          Tu flota bajo control. {fleet.operativos} de {fleet.total} equipos operativos,{' '}
          {fleet.enBench} en nuestro bench y {fleet.proximosServicios} servicios programados para
          los próximos 90 días.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-surface px-5 py-3 text-sm font-semibold text-teal-700 transition-colors hover:bg-surface-muted">
            <Plus className="h-[17px] w-[17px]" />
            Solicitar servicio técnico
          </button>
          <button className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#3E7A7A] px-5 py-3 text-sm font-medium text-ink-inv transition-colors hover:bg-white/5">
            Ver mis equipos
            <ArrowRight className="h-[17px] w-[17px]" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 md:flex md:w-[250px] md:flex-col">
        {chips.map((c) => (
          <StatChip key={c.label} {...c} />
        ))}
      </div>
    </div>
  );
}
