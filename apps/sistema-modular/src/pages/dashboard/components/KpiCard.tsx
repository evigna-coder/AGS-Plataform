import { ReactNode } from 'react';

interface KpiCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'default' | 'positive' | 'warning' | 'danger';
  onClick?: () => void;
  icon?: ReactNode;
}

const toneClasses: Record<NonNullable<KpiCardProps['tone']>, string> = {
  default: 'border-slate-200',
  positive: 'border-emerald-200 bg-emerald-50/30',
  warning: 'border-amber-200 bg-amber-50/30',
  danger: 'border-red-200 bg-red-50/30',
};

const valueTone: Record<NonNullable<KpiCardProps['tone']>, string> = {
  default: 'text-slate-900',
  positive: 'text-emerald-700',
  warning: 'text-amber-700',
  danger: 'text-red-700',
};

export const KpiCard: React.FC<KpiCardProps> = ({ label, value, hint, tone = 'default', onClick, icon }) => {
  const interactive = !!onClick;
  return (
    <div
      onClick={onClick}
      className={`rounded-xl bg-white border ${toneClasses[tone]} p-4 transition-all ${
        interactive ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-mono uppercase tracking-wide text-slate-500">{label}</p>
        {icon && <span className="text-slate-400 text-base leading-none">{icon}</span>}
      </div>
      <p className={`mt-1.5 text-2xl font-semibold tabular-nums ${valueTone[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
};
