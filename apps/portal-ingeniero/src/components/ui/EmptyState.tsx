import { type ReactNode } from 'react';

interface EmptyStateProps {
  message: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ message, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
      {icon && <div className="text-slate-300">{icon}</div>}
      <p className="text-sm text-slate-400">{message}</p>
      {action}
    </div>
  );
}
