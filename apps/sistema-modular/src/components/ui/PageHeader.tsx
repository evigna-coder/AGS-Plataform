import { ReactNode } from 'react';
import { useNumeroAnimado } from '@ags/shared';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  count?: number;
  actions?: ReactNode;
  children?: ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  count,
  actions,
  children,
}) => {
  // Contador que cuenta hasta el valor nuevo al filtrar (2026-09-30).
  const countAnimado = useNumeroAnimado(count ?? 0);
  return (
  <div className="shrink-0 bg-white border-b border-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.06)] z-10">
    <div className="flex items-center justify-between px-5 pt-4 pb-3">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-slate-900 tracking-tight">{title}</h2>
        {count != null && (
          <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full tabular-nums">
            {Math.round(countAnimado)}
          </span>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
    {subtitle && (
      <p className="text-xs text-slate-400 px-5 -mt-2 pb-3">{subtitle}</p>
    )}
    {children && <div className="px-5 pb-3">{children}</div>}
  </div>
);
};
