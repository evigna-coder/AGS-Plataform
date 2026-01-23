import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  actions?: ReactNode;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  title,
  actions
}) => {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          {title && (
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
              {title}
            </h3>
          )}
          {actions && <div>{actions}</div>}
        </div>
      )}
      <div className={title || actions ? 'p-6' : 'p-6'}>
        {children}
      </div>
    </div>
  );
};
