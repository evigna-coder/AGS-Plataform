import { cn } from '@/lib/cn';

interface SparklineProps {
  values: number[];
  className?: string;
  barClassName?: string;
}

/** Mini gráfico de barras decorativo. Escala al máximo del set. */
export function Sparkline({ values, className, barClassName = 'bg-teal-500' }: SparklineProps) {
  const max = Math.max(...values, 1);
  return (
    <div className={cn('flex h-9 items-end gap-1.5', className)}>
      {values.map((v, i) => (
        <div
          key={i}
          className={cn('w-[9px] rounded-[3px]', barClassName)}
          style={{ height: `${Math.max(15, Math.round((v / max) * 100))}%` }}
        />
      ))}
    </div>
  );
}
