interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ message = 'Cargando...' }) => (
  <div className="flex items-center justify-center py-12">
    <p className="text-sm text-slate-400">{message}</p>
  </div>
);
