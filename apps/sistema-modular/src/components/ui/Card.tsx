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
  // Si className incluye bg- o border-, no aplicar estilos por defecto
  const hasCustomStyles = className.includes('bg-') || className.includes('border-');
  const defaultClasses = hasCustomStyles ? '' : 'bg-white border border-slate-200';
  
  return (
    <div className={`rounded-2xl shadow-sm ${defaultClasses} ${className}`}>
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
