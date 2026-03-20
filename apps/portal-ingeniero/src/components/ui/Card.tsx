import { type ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  compact?: boolean;
}

export function Card({ children, className = '', compact = false }: CardProps) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${compact ? 'p-4' : 'p-5'} ${className}`}>
      {children}
    </div>
  );
}
