import { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react';

export interface TaskProgress {
  current: number;
  total: number;
}

export interface BackgroundTask<T = any> {
  running: boolean;
  done: boolean;
  progress: TaskProgress;
  rows: T[];
  filter?: string;
}

interface BackgroundTasksContextType {
  getTask: <T = any>(id: string) => BackgroundTask<T> | undefined;
  startTask: <T = any>(id: string, rows: T[], total: number) => void;
  updateRows: <T = any>(id: string, updater: (rows: T[]) => T[]) => void;
  setProgress: (id: string, current: number) => void;
  finishTask: (id: string) => void;
  cancelTask: (id: string) => void;
  isCancelled: (id: string) => boolean;
  clearTask: (id: string) => void;
  setFilter: (id: string, filter: string) => void;
  runningTaskIds: string[];
}

const BackgroundTasksContext = createContext<BackgroundTasksContextType | null>(null);

export const BackgroundTasksProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<Record<string, BackgroundTask>>({});
  const cancelRefs = useRef<Record<string, boolean>>({});

  const getTask = useCallback(<T = any>(id: string): BackgroundTask<T> | undefined => {
    return tasks[id] as BackgroundTask<T> | undefined;
  }, [tasks]);

  const startTask = useCallback(<T = any>(id: string, rows: T[], total: number) => {
    cancelRefs.current[id] = false;
    setTasks(prev => ({
      ...prev,
      [id]: { running: true, done: false, progress: { current: 0, total }, rows },
    }));
  }, []);

  const updateRows = useCallback(<T = any>(id: string, updater: (rows: T[]) => T[]) => {
    setTasks(prev => {
      const task = prev[id];
      if (!task) return prev;
      return { ...prev, [id]: { ...task, rows: updater(task.rows) } };
    });
  }, []);

  const setProgress = useCallback((id: string, current: number) => {
    setTasks(prev => {
      const task = prev[id];
      if (!task) return prev;
      return { ...prev, [id]: { ...task, progress: { ...task.progress, current } } };
    });
  }, []);

  const finishTask = useCallback((id: string) => {
    setTasks(prev => {
      const task = prev[id];
      if (!task) return prev;
      return { ...prev, [id]: { ...task, running: false, done: true } };
    });
  }, []);

  const cancelTask = useCallback((id: string) => {
    cancelRefs.current[id] = true;
  }, []);

  const isCancelled = useCallback((id: string) => {
    return cancelRefs.current[id] === true;
  }, []);

  const clearTask = useCallback((id: string) => {
    delete cancelRefs.current[id];
    setTasks(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const setFilter = useCallback((id: string, filter: string) => {
    setTasks(prev => {
      const task = prev[id];
      if (!task) return prev;
      return { ...prev, [id]: { ...task, filter } };
    });
  }, []);

  const runningTaskIds = Object.entries(tasks)
    .filter(([, t]) => t.running)
    .map(([id]) => id);

  return (
    <BackgroundTasksContext.Provider value={{
      getTask, startTask, updateRows, setProgress, finishTask,
      cancelTask, isCancelled, clearTask, setFilter, runningTaskIds,
    }}>
      {children}
    </BackgroundTasksContext.Provider>
  );
};

export const useBackgroundTasks = () => {
  const ctx = useContext(BackgroundTasksContext);
  if (!ctx) throw new Error('useBackgroundTasks must be used within BackgroundTasksProvider');
  return ctx;
};
