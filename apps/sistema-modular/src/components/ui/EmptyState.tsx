import { ReactNode } from 'react';
import { Card } from './Card';

interface EmptyStateProps {
  message: string;
  action?: ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ message, action }) => {
  return (
    <Card>
      <div className="text-center py-6">
        <p className="text-slate-400 text-xs">{message}</p>
        {action && <div className="mt-3">{action}</div>}
      </div>
    </Card>
  );
};
