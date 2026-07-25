import { CalendarClock, Repeat, PackageSearch, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/Card';
import { LifecycleStepper } from './LifecycleStepper';
import type { FichaBench, SeguimientoEvento } from '@/data/types';
import type { BadgeTone } from '@/components/ui/Badge';

const DOT: Record<BadgeTone, string> = {
  success: 'bg-success',
  warn: 'bg-warn',
  danger: 'bg-danger',
  info: 'bg-info',
  teal: 'bg-teal-500',
  neutral: 'bg-ink-faint',
};

function InfoItem({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted">
        <Icon className="h-[18px] w-[18px] text-teal-700" />
      </div>
      <div className="flex flex-col">
        <span className="font-mono text-[10px] tracking-wide text-ink-faint">{label}</span>
        <span className="text-sm font-medium text-ink">{value}</span>
      </div>
    </div>
  );
}

function Seguimiento({ eventos }: { eventos: SeguimientoEvento[] }) {
  return (
    <div className="flex flex-col">
      {eventos.map((ev, i) => (
        <div key={i} className="flex gap-3.5">
          <div className="flex flex-col items-center">
            <span className={cn('mt-1 h-3 w-3 rounded-full', DOT[ev.tone])} />
            {i < eventos.length - 1 && <span className="w-0.5 flex-1 bg-line" />}
          </div>
          <div className="flex flex-col gap-0.5 pb-5">
            <span className="text-sm font-semibold text-ink">{ev.title}</span>
            <span className="font-mono text-[11px] text-ink-faint">{ev.fecha}</span>
            <span className="text-[13px] leading-snug text-ink-soft">{ev.nota}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function BenchBlock({ ficha }: { ficha: FichaBench }) {
  return (
    <Card className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-[17px] font-semibold text-ink">Estado de la reparación</h3>
        <span className="font-mono text-[11px] text-ink-soft">FICHA {ficha.numero}</span>
      </div>

      <LifecycleStepper pasos={ficha.pasos} pasoActual={ficha.pasoActual} totalPasos={ficha.totalPasos} />

      {(ficha.etaEntrega || ficha.loaner) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {ficha.etaEntrega && (
            <InfoItem icon={CalendarClock} label="ENTREGA ESTIMADA" value={ficha.etaEntrega} />
          )}
          {ficha.loaner && (
            <InfoItem
              icon={Repeat}
              label="EQUIPO DE PRÉSTAMO"
              value={`${ficha.loaner} · en tu planta`}
            />
          )}
        </div>
      )}

      {ficha.repuestoPendiente && (
        <div className="flex items-center gap-2.5 rounded-xl bg-warn-bg px-3.5 py-2.5">
          <PackageSearch className="h-[17px] w-[17px] shrink-0 text-warn" />
          <span className="text-[13px] font-medium text-warn">{ficha.repuestoPendiente}</span>
        </div>
      )}

      {ficha.sintomas && (
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] tracking-wide text-ink-faint">SÍNTOMAS REPORTADOS</span>
          <p className="text-sm leading-relaxed text-ink">{ficha.sintomas}</p>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-line pt-5">
        <span className="font-mono text-[10px] tracking-wide text-ink-faint">SEGUIMIENTO</span>
        <Seguimiento eventos={ficha.seguimiento} />
      </div>
    </Card>
  );
}
