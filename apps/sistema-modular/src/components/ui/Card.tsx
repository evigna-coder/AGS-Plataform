import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
  actions?: ReactNode;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  title,
  description,
  actions
}) => {
  const hasCustomStyles = className.includes('bg-') || className.includes('border-');
  const defaultClasses = hasCustomStyles ? '' : 'bg-white border border-slate-200 shadow-sm';

  return (
    <div className={`rounded-xl ${defaultClasses} ${className}`}>
      {(title || actions) && (
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100">
          <div>
            {title && (
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                {title}
              </h3>
            )}
            {description && (
              <p className="mt-0.5 text-xs text-slate-500">{description}</p>
            )}
          </div>
          {actions && <div className="ml-4 shrink-0">{actions}</div>}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
};
