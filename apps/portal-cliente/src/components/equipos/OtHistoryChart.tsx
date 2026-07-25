import { cn } from '@/lib/cn';

interface Props {
  data: { anio: string; cantidad: number }[];
}

const MAX_BAR_PX = 96;

export function OtHistoryChart({ data }: Props) {
  const max = Math.max(...data.map((d) => d.cantidad), 1);
  const lastAnio = data[data.length - 1]?.anio;

  return (
    <div className="flex items-end gap-3.5">
      {data.map((d) => (
        <div key={d.anio} className="flex flex-1 flex-col items-center justify-end gap-1.5">
          <span className="font-mono text-[11px] text-ink-faint">{d.cantidad}</span>
          <div
            className={cn(
              'w-full max-w-[40px] rounded-t-md',
              d.anio === lastAnio ? 'bg-teal-700' : 'bg-teal-500',
            )}
            style={{ height: `${Math.max(6, Math.round((d.cantidad / max) * MAX_BAR_PX))}px` }}
          />
          <span className="font-mono text-[10px] text-ink-faint">{d.anio}</span>
        </div>
      ))}
    </div>
  );
}
