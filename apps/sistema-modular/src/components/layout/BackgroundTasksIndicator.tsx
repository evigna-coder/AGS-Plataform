import { useBackgroundTasks } from '../../contexts/BackgroundTasksContext';

const TASK_LABELS: Record<string, string> = {
  'bulk-cuit-validation': 'Validando CUITs',
  'bulk-address-validation': 'Validando direcciones',
  'dedup-modulos': 'Escaneando duplicados',
  'repair-sistema-est': 'Reparando sistemas',
  'unify-sistemas': 'Unificando sistemas',
};

export const BackgroundTasksIndicator: React.FC = () => {
  const { runningTaskIds, getTask } = useBackgroundTasks();

  if (runningTaskIds.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {runningTaskIds.map(id => {
        const task = getTask(id);
        if (!task) return null;
        const pct = task.progress.total > 0
          ? Math.round((task.progress.current / task.progress.total) * 100)
          : 0;
        const label = TASK_LABELS[id] || 'Procesando...';
        return (
          <div key={id} className="bg-white rounded-lg shadow-lg border border-slate-200 px-3 py-2 flex items-center gap-3 min-w-[200px]">
            <div className="shrink-0 w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-slate-700">{label}</p>
              <div className="w-full bg-slate-100 rounded-full h-1 mt-1">
                <div className="h-1 rounded-full bg-teal-500 transition-all duration-300" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <span className="text-[10px] text-slate-400 tabular-nums shrink-0">{pct}%</span>
          </div>
        );
      })}
    </div>
  );
};
