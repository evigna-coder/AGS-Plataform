import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { FichaPaso } from '@/data/types';

interface Props {
  pasos: FichaPaso[];
  pasoActual: string;
  totalPasos: number;
}

function StepNode({ status, index }: { status: FichaPaso['status']; index: number }) {
  if (status === 'done') {
    return (
      <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-teal-700">
        <Check className="h-4 w-4 text-ink-inv" />
      </div>
    );
  }
  if (status === 'current') {
    return (
      <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-warn">
        <span className="h-2.5 w-2.5 rounded-full bg-surface" />
      </div>
    );
  }
  return (
    <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-line-strong bg-surface">
      <span className="font-mono text-xs font-semibold text-ink-faint">{index + 1}</span>
    </div>
  );
}

export function LifecycleStepper({ pasos, pasoActual, totalPasos }: Props) {
  const currentIndex = pasos.findIndex((p) => p.status === 'current');
  const doneCount = pasos.filter((p) => p.status === 'done').length;
  const fraction = Math.min(1, (doneCount + (currentIndex >= 0 ? 0.5 : 0)) / totalPasos);

  return (
    <div>
      {/* Desktop: stepper horizontal */}
      <div className="hidden items-start md:flex">
        {pasos.map((p, i) => {
          const leftOn = i <= currentIndex;
          const rightOn = i < currentIndex;
          return (
            <div key={p.label} className="flex flex-1 flex-col items-center gap-2.5">
              <div className="flex w-full items-center">
                <span
                  className={cn('h-[3px] flex-1', i === 0 ? 'bg-transparent' : leftOn ? 'bg-teal-600' : 'bg-line')}
                />
                <StepNode status={p.status} index={i} />
                <span
                  className={cn(
                    'h-[3px] flex-1',
                    i === pasos.length - 1 ? 'bg-transparent' : rightOn ? 'bg-teal-600' : 'bg-line',
                  )}
                />
              </div>
              <span
                className={cn(
                  'px-1 text-center text-[13px]',
                  p.status === 'pending' ? 'text-ink-faint' : 'text-ink',
                  p.status === 'current' && 'font-semibold',
                )}
              >
                {p.label}
              </span>
              <span className="font-mono text-[10px] text-ink-faint">{p.fecha ?? '—'}</span>
            </div>
          );
        })}
      </div>

      {/* Mobile: barra de progreso compacta */}
      <div className="flex flex-col gap-2 md:hidden">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">{pasoActual}</span>
          <span className="font-mono text-[11px] text-ink-soft">
            Paso {currentIndex + 1} de {totalPasos}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
          <div className="h-full rounded-full bg-warn" style={{ width: `${Math.round(fraction * 100)}%` }} />
        </div>
      </div>
    </div>
  );
}
