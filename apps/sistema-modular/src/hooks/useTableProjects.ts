import { useState, useCallback, useEffect } from 'react';
import { tableProjectsService } from '../services/firebaseService';
import type { TableProject } from '@ags/shared';

export function useTableProjects() {
  const [projects, setProjects] = useState<TableProject[]>([]);
  const [loading, setLoading] = useState(false);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      setProjects(await tableProjectsService.getAll());
    } catch (err) {
      console.error('Error cargando proyectos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProjects(); }, []);

  const createProject = useCallback(async (data: { name: string; description?: string | null; sysType?: string | null }) => {
    const id = await tableProjectsService.create(data);
    await loadProjects();
    return id;
  }, [loadProjects]);

  const updateProject = useCallback(async (id: string, data: Partial<{ name: string; description: string | null }>) => {
    await tableProjectsService.update(id, data);
    await loadProjects();
  }, [loadProjects]);

  const deleteProject = useCallback(async (id: string) => {
    await tableProjectsService.delete(id);
    await loadProjects();
  }, [loadProjects]);

  return { projects, loading, loadProjects, createProject, updateProject, deleteProject };
}
